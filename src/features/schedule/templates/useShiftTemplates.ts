import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@shared/toast/toastStore';
import { type User } from '@shared/types';
import { shiftTemplateService } from './shiftTemplateService';
import { type ShiftTemplateInput } from './types';

/**
 * --- useShiftTemplates ---
 * The org's reusable shift templates + manager mutations. The rota editor reads
 * `list.data` to offer "apply template"; managers add/edit/remove them.
 */
export function useShiftTemplates(user: User | null) {
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
      toast('Template saved.', 'success');
    },
    onError: (e: unknown) => toast(e instanceof Error ? e.message : 'Could not save the template.', 'error'),
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<ShiftTemplateInput> }) =>
      shiftTemplateService.update(id, patch),
    onSuccess: invalidate,
    onError: (e: unknown) => toast(e instanceof Error ? e.message : 'Could not update the template.', 'error'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => shiftTemplateService.remove(id),
    onSuccess: () => {
      invalidate();
      toast('Template removed.', 'success');
    },
    onError: (e: unknown) => toast(e instanceof Error ? e.message : 'Could not remove the template.', 'error'),
  });

  return { list, create, update, remove };
}
