import { supabase } from '@shared/api/supabaseClient';
import { z } from 'zod';
import { type User } from '@shared/types';
import { ShiftTemplateSchema, type ShiftTemplate, type ShiftTemplateInput } from './types';

/** Data access for reusable shift templates (manager-managed, org-read). */
export const shiftTemplateService = {
  async getForOrg(organizationId: string): Promise<ShiftTemplate[]> {
    const { data, error } = await supabase
      .from('shift_templates')
      .select('*')
      .eq('organization_id', organizationId)
      .order('start_time', { ascending: true });
    if (error) throw error;
    return z.array(ShiftTemplateSchema).parse(data ?? []);
  },

  async create(user: User, input: ShiftTemplateInput): Promise<ShiftTemplate> {
    const { data, error } = await supabase
      .from('shift_templates')
      .insert({
        organization_id: user.organization_id,
        created_by: user.id,
        name: input.name.trim(),
        role: input.role ?? null,
        start_time: input.start_time,
        end_time: input.end_time,
        color: input.color ?? null,
      })
      .select('*')
      .single();
    if (error) throw error;
    return ShiftTemplateSchema.parse(data);
  },

  async update(id: string, patch: Partial<ShiftTemplateInput>): Promise<ShiftTemplate> {
    const { data, error } = await supabase
      .from('shift_templates')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return ShiftTemplateSchema.parse(data);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('shift_templates').delete().eq('id', id);
    if (error) throw error;
  },
};
