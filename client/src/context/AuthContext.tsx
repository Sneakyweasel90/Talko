import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import axios from "axios";
import config from "../config";
import { e2eKeyStore } from "../crypto/e2e";
import type { User } from "../types";

interface AuthContextValue {
  user: User | null;
  ready: boolean;
  login: (userData: User, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateNickname: (nickname: string | null) => void;
  updateAvatar: (avatar: string | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const REFRESH_BUFFER_MS = 2 * 60 * 1000;
const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem("talko_user");
    return stored ? JSON.parse(stored) : null;
  });

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleRefresh = useCallback((currentUser: User) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const delay = ACCESS_TOKEN_TTL_MS - REFRESH_BUFFER_MS;
    refreshTimerRef.current = setTimeout(() => doRefresh(currentUser), delay);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const doRefresh = useCallback(
    async (currentUser: User) => {
      try {
        const { data } = await axios.post(`${config.HTTP}/api/auth/refresh`, {
          refreshToken: currentUser.refreshToken,
        });
        const updated: User = {
          ...currentUser,
          token: data.token,
          refreshToken: data.refreshToken,
        };
        localStorage.setItem("talko_user", JSON.stringify(updated));
        setUser(updated);
        scheduleRefresh(updated);
      } catch {
        await logout();
      }
    },
    [scheduleRefresh],
  ); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) {
      setReady(true);
      return;
    }

    // If the token was issued more than 13 minutes ago it may already be expired.
    const doInitialRefresh = async () => {
      try {
        const { data } = await axios.post(`${config.HTTP}/api/auth/refresh`, {
          refreshToken: user.refreshToken,
        });
        const updated: User = {
          ...user,
          token: data.token,
          refreshToken: data.refreshToken,
        };
        localStorage.setItem("talko_user", JSON.stringify(updated));
        setUser(updated);
        scheduleRefresh(updated);
      } catch {
        await logout();
      } finally {
        setReady(true);
      }
    };

    doInitialRefresh();

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(
    async (userData: User, password: string) => {
      // Load or generate the ECDH key pair, persisted in IndexedDB encrypted with the password.
      // Passing the password lets PBKDF2 wrap/unwrap the private key so it survives page refreshes.
      const publicKeyB64 = await e2eKeyStore.init(userData.username, password);
      try {
        await axios.post(
          `${config.HTTP}/api/users/public-key`,
          { publicKey: publicKeyB64 },
          { headers: { Authorization: `Bearer ${userData.token}` } },
        );
      } catch {
        console.warn("Failed to publish E2E public key");
      }
      localStorage.setItem("talko_user", JSON.stringify(userData));
      setUser(userData);
      scheduleRefresh(userData);
    },
    [scheduleRefresh],
  );

  const logout = useCallback(async () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const stored = localStorage.getItem("talko_user");
    if (stored) {
      const u: User = JSON.parse(stored);
      try {
        await axios.post(`${config.HTTP}/api/auth/logout`, {
          refreshToken: u.refreshToken,
        });
      } catch {
        /* best effort */
      }
    }
    e2eKeyStore.clear();
    localStorage.removeItem("talko_user");
    setUser(null);
  }, []);

  const updateNickname = useCallback((nickname: string | null) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, nickname };
      localStorage.setItem("talko_user", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const updateAvatar = useCallback((avatar: string | null) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, avatar };
      localStorage.setItem("talko_user", JSON.stringify(updated));
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, ready, login, logout, updateNickname, updateAvatar }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
