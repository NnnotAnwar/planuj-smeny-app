import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@shared/toast/toastStore';
import { useTranslation } from '@shared/preferences/PreferencesContext';
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
  const t = useTranslation();
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
      toast(t('open.posted'), 'success');
    },
    onError: () => toast(t('open.error'), 'error'),
  });

  const claim = useMutation({
    mutationFn: (id: string) => {
      if (!user) throw new Error('You must be signed in.');
      return openShiftService.claim(user, id);
    },
    onSuccess: () => {
      invalidate();
      toast(t('open.claimed'), 'success');
    },
    onError: () => toast(t('open.tooLate'), 'error'),
  });

  const release = useMutation({
    mutationFn: (id: string) => openShiftService.release(id),
    onSuccess: invalidate,
    onError: () => toast(t('open.error'), 'error'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => openShiftService.remove(id),
    onSuccess: invalidate,
    onError: () => toast(t('open.error'), 'error'),
  });

  return { list, create, claim, release, remove };
}
