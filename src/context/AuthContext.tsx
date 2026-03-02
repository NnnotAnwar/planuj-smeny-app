import React, { createContext, useContext } from 'react';
import { useAuth } from '../hooks/useAuth';
import { type User } from '../types/types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthChecking: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Provider component that wraps the app to provide authentication state.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to consume the authentication context.
 * @throws Error if used outside of AuthProvider.
 */
export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
