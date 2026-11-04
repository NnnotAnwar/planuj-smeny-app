import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@shared/toast/toastStore';
import { type User } from '@shared/types';
import { wageService } from './wageService';
import { type MemberWageInput } from './types';

/**
 * --- useWages ---
 * Pay rates: `mine` (the member's own rate, for a pay estimate) and `org`
 * (managers only). `setRate` is a manager action. Members never load peers'
 * rates — RLS and the separate queries keep pay private.
 */
export function useWages(user: User | null) {
  const qc = useQueryClient();
  const enabled = !!user;
  const isManager = enabled && (user.role.rank ?? 0) >= 20;

  const mine = useQuery({
    queryKey: ['wages', 'mine', user?.id ?? 'anon'],
    queryFn: () => wageService.getMine(user!.id),
    enabled,
  });

  const org = useQuery({
    queryKey: ['wages', 'org', user?.organization_id ?? 'anon'],
    queryFn: () => wageService.getForOrg(user!.organization_id),
    enabled: isManager,
  });

  const setRate = useMutation({
    mutationFn: (input: MemberWageInput) => {
      if (!user) throw new Error('You must be signed in.');
      return wageService.setRate(user, input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wages', 'org', user?.organization_id ?? 'anon'] });
      qc.invalidateQueries({ queryKey: ['wages', 'mine'] });
      toast('Rate saved.', 'success');
    },
    onError: (e: unknown) => toast(e instanceof Error ? e.message : 'Could not save the rate.', 'error'),
  });

  return { mine, org, setRate, isManager };
}
