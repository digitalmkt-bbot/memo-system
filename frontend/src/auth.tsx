import { createContext, useContext, useState, ReactNode } from 'react';
import { api, setToken, getToken } from './api';

interface User { id: number; name: string; email: string; role: string; companyId: number; departmentId?: number; }
interface AuthCtx { user: User | null; login: (e: string, p: string) => Promise<void>; logout: () => void; }

const Ctx = createContext<AuthCtx>(null as any);
export const useAuth = () => useContext(Ctx);

// Decode the JWT payload with proper UTF-8 handling. atob() yields a binary
// (latin1) string, so Thai names came out as mojibake — re-decode the bytes as
// UTF-8 with TextDecoder.
function decode(tok: string): User | null {
  try {
    const b64 = tok.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const p = JSON.parse(new TextDecoder('utf-8').decode(bytes));
    return { id: p.sub, name: p.name, email: '', role: p.role, companyId: p.companyId, departmentId: p.departmentId };
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
