import { useState, type ReactNode } from 'react';
import { AuthContext, type AuthUser, type UserRole } from './AuthContext';

const USERS: Array<{ username: string; password: string; role: UserRole }> = [
  { username: 'admin', password: 'admin', role: 'Admin' },
  { username: 'supervisor', password: 'super', role: 'Supervisor' },
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  const login = async (username: string, password: string) => {
    const found = USERS.find(
      (u) => u.username === username.trim() && u.password === password.trim(),
    );

    if (!found) {
      return false;
    }

    setUser({ username: found.username, role: found.role });
    return true;
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

