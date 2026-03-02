import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { type User } from '../types/types';
import { supabase } from '../../supabaseClient';

/**
 * Hook to manage authentication state and lifecycle.
 * Handles session restoration on load and state changes.
 */
export function useAuth() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  useEffect(() => {
    /**
     * Internal initialization logic to check session and fetch profile.
     */
    const initAuth = async () => {
      try {
        const { data: { session }, error } = await authService.getSession();

        if (error || !session) {
          navigate('/login', { replace: true });
          return;
        }

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

    /**
     * Subscribes to auth events (e.g., signed out) to handle redirection.
     */
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        navigate('/login', { replace: true });
      }
    });

    return () => authListener.subscription.unsubscribe();
  }, [navigate]);

  const logout = async () => {
    await authService.signOut();
  };

  return { user, isLoading, isAuthChecking, logout };
}
