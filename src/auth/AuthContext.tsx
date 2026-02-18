import { createContext, useContext } from 'react';

export type UserRole = 'Admin' | 'Supervisor';

export type AuthUser = {
  username: string;
  role: UserRole;
};

export type AuthContextValue = {
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

