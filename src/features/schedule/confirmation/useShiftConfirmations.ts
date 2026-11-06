import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@shared/toast/toastStore';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { type User } from '@shared/types';
import { shiftConfirmationService } from './shiftConfirmationService';
import { shiftConfirmationKeys } from './shiftConfirmationKeys';

/**
 * --- useShiftConfirmations ---
 * Server state for the "confirm your shift" feature:
 *   • `confirmedIds` — a Set of the member's confirmed scheduled-shift ids
 *     (so a card can show its state with `confirmedIds.has(shift.id)`)
 *   • `orgConfirmations` — every confirmation in the org (managers only)
 *   • `confirm(ids)` — acknowledge one or several shifts at once; final for
 *     the member (no withdraw — only a manager can reset a confirmation)
 * Managers get the org query; staff don't (it would be empty for them anyway).
 */
export function useShiftConfirmations(user: User | null) {
  const t = useTranslation();
  const qc = useQueryClient();
  const enabled = !!user;
  const isManager = enabled && (user.role.rank ?? 0) >= 20;

  const mine = useQuery({
    queryKey: shiftConfirmationKeys.mine(user?.id ?? 'anon'),
    queryFn: () => shiftConfirmationService.getMine(user!.id),
    enabled,
  });

  const orgConfirmations = useQuery({
    queryKey: shiftConfirmationKeys.org(user?.organization_id ?? 'anon'),
    queryFn: () => shiftConfirmationService.getForOrg(user!.organization_id),
    enabled: isManager,
  });

  const confirmedIds = useMemo(
    () => new Set((mine.data ?? []).map((c) => c.scheduled_shift_id)),
    [mine.data],
  );

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: shiftConfirmationKeys.mine(user?.id ?? 'anon') });
    if (user) qc.invalidateQueries({ queryKey: shiftConfirmationKeys.org(user.organization_id) });
  };

  // Confirm one or many (the selected shifts) in a single request. Final for
  // the member — there's no withdraw (RLS: only managers can reset one).
  const confirm = useMutation({
    mutationFn: (scheduledShiftIds: string[]) => {
      if (!user) throw new Error('You must be signed in.');
      return shiftConfirmationService.confirm(user, scheduledShiftIds);
    },
    onSuccess: (_data, ids) => {
      invalidate();
      toast(ids.length === 1 ? t('confirm.toastDone') : t('confirm.allDone', { n: ids.length }), 'success');
    },
    onError: () => toast(t('confirm.error'), 'error'),
  });

  return { mine, orgConfirmations, confirmedIds, confirm, isManager };
}
