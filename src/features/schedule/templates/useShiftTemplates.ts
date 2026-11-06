import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@shared/toast/toastStore';
import { useTranslation } from '@shared/preferences/PreferencesContext';
import { type User } from '@shared/types';
import { shiftTemplateService } from './shiftTemplateService';
import { type ShiftTemplateInput } from './types';

/**
 * --- useShiftTemplates ---
 * The org's reusable shift templates + manager mutations. The rota editor reads
 * `list.data` to offer "apply template"; managers add/edit/remove them.
 */
export function useShiftTemplates(user: User | null) {
  const t = useTranslation();
  const qc = useQueryClient();
  const enabled = !!user;
  const orgId = user?.organization_id ?? 'anon';
  const key = ['shift-templates', orgId];

  const list = useQuery({
    queryKey: key,
    queryFn: () => shiftTemplateService.getForOrg(user!.organization_id),
    enabled,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const create = useMutation({
    mutationFn: (input: ShiftTemplateInput) => {
      if (!user) throw new Error('You must be signed in.');
      return shiftTemplateService.create(user, input);
    },
    onSuccess: () => {
      invalidate();
      toast(t('tpl.saved'), 'success');
    },
    // TEMPLATE_LIMIT comes from the DB trigger (max 8 per organization).
    onError: (e: unknown) =>
      toast(e instanceof Error && e.message.includes('TEMPLATE_LIMIT') ? t('tpl.limit') : t('tpl.error'), 'error'),
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<ShiftTemplateInput> }) =>
      shiftTemplateService.update(id, patch),
    onSuccess: invalidate,
    onError: () => toast(t('tpl.error'), 'error'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => shiftTemplateService.remove(id),
    onSuccess: () => {
      invalidate();
      toast(t('tpl.removed'), 'success');
    },
    onError: () => toast(t('tpl.error'), 'error'),
  });

  return { list, create, update, remove };
}
