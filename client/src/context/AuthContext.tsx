import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { AuthContextType } from '../types';

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [residentId, setResidentId] = useState<string | null>(null);

  const login = useCallback((newToken: string, newResidentId: string) => {
    setToken(newToken);
    setResidentId(newResidentId);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setResidentId(null);
  }, []);

  const value = useMemo(
    () => ({ token, residentId, login, logout }),
    [token, residentId, login, logout]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
