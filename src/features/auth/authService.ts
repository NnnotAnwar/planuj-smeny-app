import { supabase } from '@shared/api/supabaseClient';
import { type User } from '@shared/types';
import { ProfileSchema } from '@shared/types';

/**
 * --- AUTH SERVICE ---
 * This file handles all DIRECT communication with Supabase for user authentication.
 * Separation of Concerns: Components should NOT talk to Supabase directly; 
 * they should use this service instead.
 */

export const authService = {
  /**
   * Retrieves the current active user session from Supabase.
   */
  async getSession() {
    return await supabase.auth.getSession();
  },

  /**
   * Fetches the user's detailed profile (first name, role, etc.) from the DB.
   * Uses Zod (ProfileSchema) to validate that the DB data is correct.
   */
  async getUserProfile(userId: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, first_name, last_name, role(name, is_admin), email, organization_id')
      .eq('id', userId)
      .single();

    if (error) throw error;
    if (!data) return null;

    // Validate the data from DB before using it in the app.
    const validated = ProfileSchema.parse(data);
    return {
      id: validated.id,
      username: validated.username,
      first_name: validated.first_name ?? null,
      role: {
        name: validated.role.name,
        is_admin: validated.role.is_admin
      },
      email: validated.email,
      last_name: validated.last_name ?? null,
      organization_id: validated.organization_id
    };
  },

  /**
   * If a user logs in with a username, we need to find their email first.
   * We use a custom DB function (RPC) called 'get_email_by_username'.
   */
  async getEmailByUsername(username: string): Promise<string | null> {
    const { data, error } = await supabase.rpc('get_email_by_username', {
      u_name: username
    });
    if (error) throw error;
    return data;
  },

  /**
   * Standard email + password sign in.
   */
  async signIn(email: string, password: string) {
    return await supabase.auth.signInWithPassword({
      email,
      password,
    });
  },

  /**
   * Signs out the user and clears the local session.
   */
  async signOut() {
    return await supabase.auth.signOut();
  }
};
