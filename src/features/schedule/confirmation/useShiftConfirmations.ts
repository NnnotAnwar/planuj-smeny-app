import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@shared/toast/toastStore';
import { type User } from '@shared/types';
import { shiftConfirmationService } from './shiftConfirmationService';
import { shiftConfirmationKeys } from './shiftConfirmationKeys';

/**
 * --- useShiftConfirmations ---
 * Server state for the "confirm your shift" feature:
 *   • `confirmedIds` — a Set of the member's confirmed scheduled-shift ids
 *     (so a card can show its state with `confirmedIds.has(shift.id)`)
 *   • `orgConfirmations` — every confirmation in the org (managers only)
 *   • `confirm` / `unconfirm` — toggle the current member's acknowledgement
 * Managers get the org query; staff don't (it would be empty for them anyway).
 */
export function useShiftConfirmations(user: User | null) {
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

  const confirm = useMutation({
    mutationFn: (scheduledShiftId: string) => {
      if (!user) throw new Error('You must be signed in.');
      return shiftConfirmationService.confirm(user, scheduledShiftId);
    },
    onSuccess: invalidate,
    onError: (e: unknown) => toast(e instanceof Error ? e.message : 'Could not confirm the shift.', 'error'),
  });

  const unconfirm = useMutation({
    mutationFn: (scheduledShiftId: string) => shiftConfirmationService.unconfirm(scheduledShiftId),
    onSuccess: invalidate,
    onError: (e: unknown) => toast(e instanceof Error ? e.message : 'Could not withdraw the confirmation.', 'error'),
  });

  return { mine, orgConfirmations, confirmedIds, confirm, unconfirm, isManager };
}
