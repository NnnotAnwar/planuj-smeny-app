/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from './authService';
import { type User } from '@shared/types';
import { supabase } from '@shared/api/supabaseClient';

/**
 * --- AUTH CONTEXT ---
 * Single source of truth for "who is logged in". It only exposes STATE — it no
 * longer navigates. Routing decisions live in the declarative route guards
 * (ProtectedRoute / PublicRoute), which removes the old races where AuthContext,
 * LoginPage and the guards all tried to redirect.
 */

interface AuthContextType {
  user: User | null; // The logged-in user, or null.
  isLoading: boolean; // True during the first profile load.
  isAuthChecking: boolean; // True until the initial session check resolves.
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>; // Re-pull the profile (e.g. after editing it).
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  useEffect(() => {
    let active = true;

    const loadProfile = async (userId: string) => {
      try {
        const profile = await authService.getUserProfile(userId);
        if (active) setUser(profile ?? null);
      } catch (err) {
        console.error('Failed to load profile:', err);
        if (active) setUser(null);
      }
    };

    // 1. Initial session restore — flip isAuthChecking only AFTER the profile is
    //    loaded, so guards never see "session but no user" and bounce wrongly.
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) await loadProfile(session.user.id);
        else if (active) setUser(null);
      } finally {
        if (active) {
          setIsLoading(false);
          setIsAuthChecking(false);
        }
      }
    })();

    // 2. React to later auth changes: login, logout, token refresh, and the
    //    session the /accept-invite page establishes via verifyOtp. INITIAL_SESSION
    //    is handled by the restore above, so we skip it here to avoid a double fetch.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return;
      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        return;
      }
      loadProfile(session.user.id);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Sign out; the SIGNED_OUT listener clears the user and the guard redirects.
  const logout = useCallback(async () => {
    await authService.signOut();
  }, []);

  // Re-fetch the profile and update the cached user (used after Settings edits).
  const refreshUser = useCallback(async () => {
    const { data: { session } } = await authService.getSession();
    if (!session) return;
    const profile = await authService.getUserProfile(session.user.id);
    if (profile) setUser(profile);
  }, []);

  const value = { user, isLoading, isAuthChecking, logout, refreshUser };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * CUSTOM HOOK: useAuthContext
 * Lets any component read the authentication state.
 */
export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
