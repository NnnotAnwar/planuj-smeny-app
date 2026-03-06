import { supabase } from '../../supabaseClient';
import { type User } from '../types/types';
import { ProfileSchema } from '../types/schemas';

/**
 * Service handling all authentication-related operations with Supabase.
 */
export const authService = {
  /**
   * Retrieves the current session from Supabase Auth.
   * @returns The session data and any potential errors.
   */
  async getSession() {
    return await supabase.auth.getSession();
  },

  /**
   * Fetches the detailed user profile from the database.
   * @param userId - The unique identifier of the user.
   * @returns The user's profile data or null if not found.
   */
  async getUserProfile(userId: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, first_name, last_name, role, organization_id')
      .eq('id', userId)
      .single();

    if (error) throw error;
    if (!data) return null;

    // Validate data with Zod
    const validated = ProfileSchema.parse(data);

    return {
      id: validated.id,
      username: validated.username,
      first_name: validated.first_name ?? null,
      last_name: validated.last_name ?? null,
      role: validated.role,
      organization_id: validated.organization_id
    };
  },

  /**
   * Calls a Supabase RPC function to look up an email by username.
   * Useful for login scenarios where users provide a username instead of an email.
   * @param username - The username to search for.
   * @returns The corresponding email address or null.
   */
  async getEmailByUsername(username: string): Promise<string | null> {
    const { data, error } = await supabase.rpc('get_email_by_username', {
      u_name: username
    });
    if (error) throw error;
    return data;
  },

  /**
   * Authenticates a user using email and password.
   * @param email - User's email address.
   * @param password - User's password.
   * @returns Auth response containing user/session or error.
   */
  async signIn(email: string, password: string) {
    return await supabase.auth.signInWithPassword({
      email,
      password,
    });
  },

  /**
   * Signs out the current user.
   */
  async signOut() {
    return await supabase.auth.signOut();
  }
};
