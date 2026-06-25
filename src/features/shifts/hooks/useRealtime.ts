import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@shared/api/supabaseClient';
import { isSuperAdmin } from '@shared/auth/permissions';
import { type Shift, type ShiftWithProfile, type User } from '@shared/types';
import { App } from '@capacitor/app';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { shiftKeys } from '../shiftKeys';

/**
 * --- useShiftRealtime ---
 * Listens for `shifts` / `locations` changes and translates them into React
 * Query cache updates. It no longer reaches into useShifts' setState functions
 * (5 props) — it owns nothing but the queryClient, so the composition is
 * decoupled and cleanup is trivial. Cases that need joined/parsed data simply
 * invalidate the relevant query and let React Query refetch (with dedupe);
 * pure removals edit the cache directly for instant feedback.
 */
export function useShiftRealtime(user: User | null) {
    const qc = useQueryClient();

    useEffect(() => {
        if (!user?.organization_id || !user?.id) return;

        const sa = isSuperAdmin(user);
        const boardKey = shiftKeys.board(user.organization_id);
        const activeKey = shiftKeys.active(user.id);
        const historyKey = shiftKeys.history(user.id);

        // Superadmins oversee every organization, so they subscribe WITHOUT the
        // org filter (RLS still authorizes the rows). Everyone else is scoped to
        // their own org — mirroring the initial board fetch.
        const orgFilter = sa ? {} : { filter: `organization_id=eq.${user.organization_id}` };

        // MOBILE ONLY: refetch when the app returns from background.
        let listener: PluginListenerHandle | null = null;
        let cancelled = false;
        if (Capacitor.isNativePlatform()) {
            App.addListener('appStateChange', ({ isActive }) => {
                if (isActive) qc.invalidateQueries({ queryKey: shiftKeys.all });
            }).then((l) => {
                if (cancelled) l.remove();
                else listener = l;
            });
        }

        const channel = supabase
            .channel('realtime_shifts')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'shifts', ...orgFilter },
                (payload) => {
                    const row = payload.new as Shift;

                    if (payload.eventType === 'INSERT') {
                        // New shift: own one updates our active card, anyone's updates
                        // the board. Both need parsed/joined data, so just refetch.
                        if (row.user_id === user.id) qc.invalidateQueries({ queryKey: activeKey });
                        qc.invalidateQueries({ queryKey: boardKey });
                    } else if (payload.eventType === 'UPDATE') {
                        if (row.ended_at) {
                            // Shift ended.
                            if (row.user_id === user.id) {
                                qc.setQueryData<Shift | null>(activeKey, null);
                                qc.invalidateQueries({ queryKey: historyKey });
                            }
                            qc.setQueryData<ShiftWithProfile[]>(boardKey, (b = []) =>
                                b.filter((s) => s.id !== row.id),
                            );
                        } else {
                            // Location change (or other edit) on a still-open shift.
                            if (row.user_id === user.id) {
                                qc.invalidateQueries({ queryKey: activeKey });
                            }
                            // Merge into the board entry, preserving the joined profile.
                            qc.setQueryData<ShiftWithProfile[]>(boardKey, (b = []) =>
                                b.map((s) => (s.id === row.id ? { ...s, ...row } : s)),
                            );
                        }
                    } else if (payload.eventType === 'DELETE') {
                        // DELETE payloads carry only the primary key (unless REPLICA
                        // IDENTITY FULL), so match by id.
                        const deletedId = (payload.old as { id?: string })?.id;
                        if (!deletedId) return;
                        qc.setQueryData<ShiftWithProfile[]>(boardKey, (b = []) =>
                            b.filter((s) => s.id !== deletedId),
                        );
                        qc.setQueryData<Shift | null>(activeKey, (s) =>
                            s && s.id === deletedId ? null : s,
                        );
                    }
                },
            )
            // Locations: an admin adding / renaming / removing a location should
            // reflect in the picker live.
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'locations', ...orgFilter },
                () => qc.invalidateQueries({ queryKey: shiftKeys.locations(user.organization_id) }),
            )
            .subscribe();

        return () => {
            cancelled = true;
            supabase.removeChannel(channel);
            if (listener) listener.remove();
        };
    }, [user, qc]);
}
