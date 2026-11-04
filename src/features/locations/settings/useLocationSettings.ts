import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@shared/toast/toastStore';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { type User } from '@shared/types';
import { locationSettingsService } from './locationSettingsService';
import { type LocationSettings, type LocationSettingsInput } from './types';

/**
 * --- useLocationSettings ---
 * Per-location operational settings for the org + a `byLocation` lookup, so the
 * rota/clock can read a location's open hours or break rule in O(1). Managers
 * save them.
 */
export function useLocationSettings(user: User | null) {
  const t = useTranslation();
  const qc = useQueryClient();
  const enabled = !!user;
  const orgId = user?.organization_id ?? 'anon';
  const key = ['location-settings', orgId];

  const list = useQuery({
    queryKey: key,
    queryFn: () => locationSettingsService.getForOrg(user!.organization_id),
    enabled,
  });

  const byLocation = useMemo(() => {
    const map = new Map<string, LocationSettings>();
    for (const s of list.data ?? []) map.set(s.location_id, s);
    return map;
  }, [list.data]);

  const save = useMutation({
    mutationFn: (input: LocationSettingsInput) => {
      if (!user) throw new Error('You must be signed in.');
      return locationSettingsService.save(user, input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast(t('locset.saved'), 'success');
    },
    onError: () => toast(t('locset.error'), 'error'),
  });

  return { list, byLocation, save };
}
