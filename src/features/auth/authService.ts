import { supabase } from '@shared/api/supabaseClient';
import { type User, type NameChangeRequest } from '@shared/types';
import { ProfileSchema, NameChangeRequestSchema } from '@shared/types';

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
      .select('id, username, first_name, last_name, role(name, is_admin, rank), email, organization_id, username_changed_at')
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
        is_admin: validated.role.is_admin,
        rank: validated.role.rank
      },
      email: validated.email,
      last_name: validated.last_name ?? null,
      organization_id: validated.organization_id,
      username_changed_at: validated.username_changed_at ?? null
    };
  },

  /**
   * Sign in with a username. The username -> email resolution AND the sign-in
   * happen inside the `username-login` Edge Function so the username/email map
   * is never exposed to the client (no enumeration / PII leak). On success the
   * returned tokens are adopted as the local session.
   */
  async signInWithUsername(username: string, password: string): Promise<void> {
    const { data, error } = await supabase.functions.invoke('username-login', {
      body: { username, password },
    });
    // Any non-2xx (FunctionsHttpError) or missing tokens => generic failure.
    if (error || !data?.access_token || !data?.refresh_token) {
      throw new Error('Invalid username or password.');
    }
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });
    if (sessionError) throw sessionError;
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
  },

  /**
   * Updates the caller's own profile (username is the login identifier).
   * RLS ("Users can update own profile") restricts this to the user's own row;
   * the unique_username constraint surfaces as a 23505 error if taken.
   */
  async updateProfile(
    userId: string,
    fields: { username?: string; first_name?: string | null; last_name?: string | null }
  ) {
    return await supabase.from('profiles').update(fields).eq('id', userId);
  },

  /**
   * The caller's most recent name-change request (any status), or null.
   * Staff use this to see whether they already have one pending.
   */
  async getMyLatestNameRequest(userId: string): Promise<NameChangeRequest | null> {
    const { data, error } = await supabase
      .from('name_change_requests')
      .select(
        'id, user_id, organization_id, current_first_name, current_last_name, requested_first_name, requested_last_name, note, review_note, status, reviewed_at, created_at',
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data ? NameChangeRequestSchema.parse(data) : null;
  },

  /** Submit a request to change your first/last name (SECURITY DEFINER RPC). */
  async requestNameChange(firstName: string, lastName: string, note?: string | null) {
    const { error } = await supabase.rpc('request_name_change', {
      p_first_name: firstName,
      p_last_name: lastName,
      p_note: note ?? null,
    });
    if (error) throw new Error(error.message);
  },

  /** Cancel your own pending name-change request. */
  async cancelNameChange(requestId: string) {
    const { error } = await supabase.rpc('cancel_name_change_request', { p_id: requestId });
    if (error) throw new Error(error.message);
  },
};
