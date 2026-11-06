import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { can } from '@shared/auth/permissions';
import { toast } from '@shared/toast/toastStore';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { type User } from '@shared/types';
import { availabilityService } from './availabilityService';
import { availabilityKeys } from './availabilityKeys';
import { type AvailabilityInput } from './types';

/**
 * --- useAvailability ---
 * Server state for the availability feature:
 *   • `mine` — the member's own entries (manage screen)
 *   • `org`  — everyone's entries (manager planning view; managers only)
 *   • `create` / `update` / `remove` — the member's mutations
 */
export function useAvailability(user: User | null) {
  const t = useTranslation();
  const qc = useQueryClient();
  const enabled = !!user;
  const isManager = enabled && can(user, 'rota.view');

  const mine = useQuery({
    queryKey: availabilityKeys.mine(user?.id ?? 'anon'),
    queryFn: () => availabilityService.getMine(user!.id),
    enabled,
  });

  const org = useQuery({
    queryKey: availabilityKeys.org(user?.organization_id ?? 'anon'),
    queryFn: () => availabilityService.getForOrg(user!.organization_id),
    enabled: isManager,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: availabilityKeys.mine(user?.id ?? 'anon') });
    if (user) qc.invalidateQueries({ queryKey: availabilityKeys.org(user.organization_id) });
  };

  const create = useMutation({
    mutationFn: (input: AvailabilityInput) => {
      if (!user) throw new Error('You must be signed in.');
      return availabilityService.create(user, input);
    },
    onSuccess: () => {
      invalidate();
      toast(t('avail.saved'), 'success');
    },
    onError: () => toast(t('avail.error'), 'error'),
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<AvailabilityInput> }) =>
      availabilityService.update(id, patch),
    onSuccess: invalidate,
    onError: () => toast(t('avail.error'), 'error'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => availabilityService.remove(id),
    onSuccess: () => {
      invalidate();
      toast(t('avail.removed'), 'success');
    },
    onError: () => toast(t('avail.error'), 'error'),
  });

  return { mine, org, create, update, remove, isManager };
}
