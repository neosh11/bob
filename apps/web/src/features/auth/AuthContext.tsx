import { createContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { ApiError } from "../../lib/apiClient";
import { connectSocket, disconnectSocket } from "../../lib/socket";

import { fetchCurrentUser, login, logout } from "./authApi";
import type { AuthUser } from "./types";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  initialized: boolean;
  login: (input: { username?: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  const refresh = async (): Promise<void> => {
    setLoading(true);
    try {
      const response = await fetchCurrentUser();
      setUser(response.user);
      connectSocket();
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) {
        throw error;
      }
      setUser(null);
      disconnectSocket();
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      initialized,
      async login(input) {
        const response = await login(input);
        setUser(response.user);
        connectSocket();
      },
      async logout() {
        await logout();
        setUser(null);
        disconnectSocket();
      },
      refresh
    }),
    [initialized, loading, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export { AuthContext };
