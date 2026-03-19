import React, { createContext, useContext, useState, useEffect } from 'react';
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
        const { data: { session }, error } = await authService.getSession();

        // If no session or error, go to the login page.
        if (error || !session) {
          navigate('/login', { replace: true });
          return;
        }

        // Fetch user profile based on the ID from the session.
        const profile = await authService.getUserProfile(session.user.id);
        if (profile) {
          setUser(profile);
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
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        navigate('/login', { replace: true });
      }
    });

    return () => authListener.subscription.unsubscribe();
  }, [navigate]);

  const logout = async () => {
    await authService.signOut();
  };

  const value = { user, isLoading, isAuthChecking, logout };

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
