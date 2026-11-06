import { useEffect, useId } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@shared/api/supabaseClient';
import { toast } from '@shared/toast/toastStore';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import type { User } from '@shared/types';
import { swapBlockReason, swapService } from './swapService';

export const swapKeys = { all: ['shift-swaps'] as const };

/**
 * --- useShiftSwaps ---
 * Swaps visible to the user + the member actions (offer, take, withdraw).
 * Admin decisions live in the Requests inbox (useRequests). Realtime keeps
 * offers fresh, so a taken offer disappears for everyone at once.
 */
export function useShiftSwaps(user: User | null) {
    const t = useTranslation();
    const qc = useQueryClient();
    const channelId = useId();

    const list = useQuery({ queryKey: swapKeys.all, queryFn: swapService.list, enabled: !!user });

    useEffect(() => {
        if (!user) return;
        const ch = supabase
            .channel(`shift-swaps:${user.organization_id}:${channelId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'shift_swaps', filter: `organization_id=eq.${user.organization_id}` }, () => {
                qc.invalidateQueries({ queryKey: swapKeys.all });
            })
            .subscribe();
        return () => {
            supabase.removeChannel(ch);
        };
    }, [user, channelId, qc]);

    const refresh = () => {
        qc.invalidateQueries({ queryKey: swapKeys.all });
        qc.invalidateQueries({ queryKey: ['schedule'] });
    };
    const blockedMsg = (e: unknown) => {
        const r = swapBlockReason(e);
        return r ? t(`swap.blocked_${r}` as 'swap.blocked_busy') : t('swap.error');
    };

    const offer = useMutation({
        mutationFn: (shiftId: string) => swapService.offer(shiftId),
        onSuccess: refresh,
        onError: () => toast(t('swap.error'), 'error'),
    });
    const take = useMutation({
        mutationFn: (id: string) => swapService.take(id),
        onSuccess: () => {
            refresh();
            toast(t('swap.taken'), 'success');
        },
        onError: (e) => {
            refresh();
            toast(blockedMsg(e), 'error');
        },
    });
    const withdraw = useMutation({
        mutationFn: (id: string) => swapService.withdraw(id),
        onSuccess: refresh,
        onError: () => toast(t('swap.error'), 'error'),
    });

    return { list, swaps: list.data ?? [], offer, take, withdraw, blockedMsg };
}
