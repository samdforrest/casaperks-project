import { createContext, useContext, useState, ReactNode } from 'react';
import { AuthContextType } from '../types';

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [residentId, setResidentId] = useState<string | null>(null);

  const login = (newToken: string, newResidentId: string) => {
    setToken(newToken);
    setResidentId(newResidentId);
  };

  const logout = () => {
    setToken(null);
    setResidentId(null);
  };

  return (
    <AuthContext.Provider value={{ token, residentId, login, logout }}>
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
