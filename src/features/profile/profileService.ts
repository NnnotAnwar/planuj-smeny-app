import { supabase } from '@shared/api/supabaseClient';
import { ProfileSchema, type ProfileDetail } from '@shared/types';

const PROFILE_SELECT =
  'id, username, first_name, last_name, email, organization_id, username_changed_at, role(name, is_admin, rank), organization:organizations(name)';

function mapProfileRow(data: Record<string, unknown>): ProfileDetail {
  const validated = ProfileSchema.parse({
    ...data,
    organization_id: data.organization_id,
  });
  const org = data.organization as { name?: string } | null | undefined;

  return {
    ...validated,
    first_name: validated.first_name ?? null,
    last_name: validated.last_name ?? null,
    username_changed_at: validated.username_changed_at ?? null,
    organizationName: org?.name ?? null,
  };
}

export const profileService = {
  async getProfile(userId: string): Promise<ProfileDetail | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_SELECT)
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return mapProfileRow(data as Record<string, unknown>);
  },
};
