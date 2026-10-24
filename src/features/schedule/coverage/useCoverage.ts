import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@shared/toast/toastStore';
import { type User } from '@shared/types';
import { coverageService } from './coverageService';
import { type CoverageRequirementInput } from './types';

/**
 * --- useCoverage ---
 * The org's coverage rules + a lookup helper `requiredFor(locationId, weekday)`
 * so the rota can compare planned headcount against the minimum and flag gaps.
 * Managers set/remove rules.
 */
export function useCoverage(user: User | null) {
  const qc = useQueryClient();
  const enabled = !!user;
  const orgId = user?.organization_id ?? 'anon';
  const key = ['coverage-requirements', orgId];

  const list = useQuery({
    queryKey: key,
    queryFn: () => coverageService.getForOrg(user!.organization_id),
    enabled,
  });

  const bySlot = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of list.data ?? []) map.set(`${r.location_id}:${r.day_of_week}`, r.min_headcount);
    return map;
  }, [list.data]);

  /** Minimum headcount for a location on a weekday (0 if no rule set). */
  const requiredFor = (locationId: string, dayOfWeek: number): number =>
    bySlot.get(`${locationId}:${dayOfWeek}`) ?? 0;

  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const set = useMutation({
    mutationFn: (input: CoverageRequirementInput) => {
      if (!user) throw new Error('You must be signed in.');
      return coverageService.set(user, input);
    },
    onSuccess: invalidate,
    onError: (e: unknown) => toast(e instanceof Error ? e.message : 'Could not save the rule.', 'error'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => coverageService.remove(id),
    onSuccess: invalidate,
    onError: (e: unknown) => toast(e instanceof Error ? e.message : 'Could not remove the rule.', 'error'),
  });

  return { list, bySlot, requiredFor, set, remove };
}
