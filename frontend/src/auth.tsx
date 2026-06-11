import { createContext, useContext, useState, ReactNode } from 'react';
import { api, setToken, getToken } from './api';

interface User { id: number; name: string; email: string; role: string; companyId: number; departmentId?: number; }
interface AuthCtx { user: User | null; login: (e: string, p: string) => Promise<void>; logout: () => void; }

const Ctx = createContext<AuthCtx>(null as any);
export const useAuth = () => useContext(Ctx);

function decode(tok: string): User | null {
  try {
    const p = JSON.parse(atob(tok.split('.')[1]));
    return { id: p.sub, name: p.name, email: '', role: p.role, companyId: p.companyId };
  } catch { return null; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const t = getToken();
    return t ? decode(t) : null;
  });

  const login = async (email: string, password: string) => {
    const { token, user } = await api.login(email, password);
    setToken(token);
    setUser(user);
  };
  const logout = () => {
    api.logout().catch(() => {});
    setToken(null);
    setUser(null);
    location.hash = '#/login';
  };

  return <Ctx.Provider value={{ user, login, logout }}>{children}</Ctx.Provider>;
}
