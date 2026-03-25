import { supabase } from "@/shared/api/supabaseClient";
import { type Shift, type Organization, OrganizationSchema, ShiftSchema } from '@shared/types';
import { z } from 'zod';

export const adminService = {

    async createOrganization(orgName: string, slug: string): Promise<Organization> {
        const { data, error } = await supabase
            .from("organizations")
            .insert({
                name: orgName,
                slug: slug,
            })
            .select()
            .single();
        if (error) throw error;
        return OrganizationSchema.parse(data)
    },

    async getOrganizations(isSuperAdmin: boolean): Promise<Organization[] | null> {
        if (isSuperAdmin) {
            const { data, error } = await supabase
                .from('organizations')
                .select('*, locations(id, name), profiles(id, role, email, username, first_name, last_name)')
            if (error) throw error;
            if (!data) return null;
            return z.array(OrganizationSchema).parse(data);
        } else {
            return null
        }
    },

    async getAllActiveShifts(organizationId: string, isSuperAdmin: boolean): Promise<Shift[]> {

        let query = supabase
            .from('shifts')
            .select('*, profiles(username, first_name, last_name)')
            .is('ended_at', null);

        if (!isSuperAdmin) {
            query = query.eq('organization_id', organizationId);
        }

        const { data, error } = await query

        if (error) throw error;
        if (!data) return [];

        return z.array(ShiftSchema).parse(data);
    },

}