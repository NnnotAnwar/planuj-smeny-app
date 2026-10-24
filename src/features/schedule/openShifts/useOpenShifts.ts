import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@shared/toast/toastStore';
import { type User } from '@shared/types';
import { openShiftService } from './openShiftService';
import { type OpenShiftInput } from './types';

/**
 * --- useOpenShifts ---
 * The org's open (claimable) shifts + actions: managers post/remove, members
 * claim/release. First-come claiming is enforced server-side (the claim only
 * succeeds while the row is still unclaimed).
 */
export function useOpenShifts(user: User | null) {
  const qc = useQueryClient();
  const enabled = !!user;
  const orgId = user?.organization_id ?? 'anon';
  const key = ['open-shifts', orgId];

  const list = useQuery({
    queryKey: key,
    queryFn: () => openShiftService.getForOrg(user!.organization_id),
    enabled,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const create = useMutation({
    mutationFn: (input: OpenShiftInput) => {
      if (!user) throw new Error('You must be signed in.');
      return openShiftService.create(user, input);
    },
    onSuccess: () => {
      invalidate();
      toast('Open shift posted.', 'success');
    },
    onError: (e: unknown) => toast(e instanceof Error ? e.message : 'Could not post the open shift.', 'error'),
  });

  const claim = useMutation({
    mutationFn: (id: string) => {
      if (!user) throw new Error('You must be signed in.');
      return openShiftService.claim(user, id);
    },
    onSuccess: () => {
      invalidate();
      toast('Shift claimed — it\'s yours.', 'success');
    },
    onError: () => toast('Too late — someone already claimed this shift.', 'error'),
  });

  const release = useMutation({
    mutationFn: (id: string) => openShiftService.release(id),
    onSuccess: invalidate,
    onError: (e: unknown) => toast(e instanceof Error ? e.message : 'Could not release the shift.', 'error'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => openShiftService.remove(id),
    onSuccess: invalidate,
    onError: (e: unknown) => toast(e instanceof Error ? e.message : 'Could not remove the open shift.', 'error'),
  });

  return { list, create, claim, release, remove };
}
