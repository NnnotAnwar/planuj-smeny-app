import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from './authService';
import { type User } from '@shared/types';
import { supabase } from '@shared/api/supabaseClient';

/**
 * --- AUTH CONTEXT ---
 * This file handles the global "state" of who is logged in.
 * Any component in the app can ask "who is the user?" using the useAuthContext() hook.
 */

interface AuthContextType {
  user: User | null; // The logged-in user object or null if not logged in.
  isLoading: boolean; // True while we are fetching the user profile for the first time.
  isAuthChecking: boolean; // True while we are checking if a session exists (on page load).
  logout: () => Promise<void>; // Function to sign the user out.
  refreshUser: () => Promise<void>; // Re-fetch the profile (e.g. after editing it in Settings).
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Initial setup: Check if the user is already logged in (Restore session).
  useEffect(() => {
    const initAuth = async () => {
      try {
        // The invite-acceptance page handles its own session (set from the URL).
        // Don't bounce the invitee to /login while that page is processing.
        if (window.location.pathname === '/accept-invite') {
          return;
        }

        const { data: { session }, error: sessionError } = await authService.getSession();

        // If no session or error, go to the login page.
        if (sessionError || !session) {
          navigate('/login', { replace: true });
          return;
        }

        // Fetch user profile based on the ID from the session.
        try {
          const profile = await authService.getUserProfile(session.user.id);
          if (profile) {
            setUser(profile);
          } else {
            // Profile not found in DB - this should not happen but we handle it.
            console.warn('Profile not found, signing out.');
            await authService.signOut();
            navigate('/login', { replace: true });
          }
        } catch (profileErr) {
          console.error('Failed to load profile:', profileErr);
          // If we have a session but profile fetch fails (e.g., network error),
          // we don't clear the session but we should show an error or try again.
          // For now, let's keep the user at the loading state or redirect.
          await authService.signOut();
          navigate('/login', { replace: true });
        }
      } catch (err) {
        console.error('Error initAuth:', err);
      } finally {
        setIsLoading(false);
        setIsAuthChecking(false);
      }
    };

    initAuth();

    // Listen for global auth changes (like signing out on another device).
    // Only react to an explicit SIGNED_OUT — an empty INITIAL_SESSION must NOT
    // bounce to /login (that would break the /accept-invite flow, where the
    // session only appears after verifyOtp runs).
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        if (window.location.pathname !== '/accept-invite') {
          navigate('/login', { replace: true });
        }
      }
    });

    return () => authListener.subscription.unsubscribe();
  }, [navigate]);

  const logout = async () => {
    await authService.signOut();
  };

  // Re-pull the profile from the DB and update the cached user. Called after the
  // user edits their own profile (e.g. changes their username in Settings).
  const refreshUser = useCallback(async () => {
    const { data: { session } } = await authService.getSession();
    if (!session) return;
    const profile = await authService.getUserProfile(session.user.id);
    if (profile) setUser(profile);
  }, []);

  const value = { user, isLoading, isAuthChecking, logout, refreshUser };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * CUSTOM HOOK: useAuthContext
 * This allows any component to easily access the authentication state.
 */
export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
