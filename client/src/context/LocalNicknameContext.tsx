import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import axios from "axios";
import config from "../config";

// Map of target_user_id -> local nickname string
type NicknameMap = Record<number, string>;

interface LocalNicknameContextValue {
  // Resolve a display name: returns local nickname if set, otherwise the server display name
  resolve: (userId: number, serverDisplayName: string) => string;
  // Set or clear a local nickname
  setLocalNickname: (targetId: number, nickname: string) => Promise<void>;
  // The raw map for direct lookups
  nicknames: NicknameMap;
  // Load from server (call after login)
  load: (token: string) => Promise<void>;
}

const LocalNicknameContext = createContext<LocalNicknameContextValue | null>(
  null,
);

export function LocalNicknameProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [nicknames, setNicknames] = useState<NicknameMap>({});
  const [token, setToken] = useState<string | null>(null);

  const load = useCallback(async (authToken: string) => {
    setToken(authToken);
    try {
      const { data } = await axios.get(
        `${config.HTTP}/api/users/local-nicknames`,
        {
          headers: { Authorization: `Bearer ${authToken}` },
        },
      );
      const map: NicknameMap = {};
      for (const row of data) {
        map[row.target_id] = row.nickname;
      }
      setNicknames(map);
    } catch {
      // Non-fatal
    }
  }, []);

  const resolve = useCallback(
    (userId: number, serverDisplayName: string): string => {
      return nicknames[userId] ?? serverDisplayName;
    },
    [nicknames],
  );

  const setLocalNickname = useCallback(
    async (targetId: number, nickname: string) => {
      if (!token) return;
      await axios.put(
        `${config.HTTP}/api/users/${targetId}/local-nickname`,
        { nickname },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setNicknames((prev) => {
        const next = { ...prev };
        if (nickname.trim()) {
          next[targetId] = nickname.trim();
        } else {
          delete next[targetId];
        }
        return next;
      });
    },
    [token],
  );

  return (
    <LocalNicknameContext.Provider
      value={{ resolve, setLocalNickname, nicknames, load }}
    >
      {children}
    </LocalNicknameContext.Provider>
  );
}

export function useLocalNicknames(): LocalNicknameContextValue {
  const ctx = useContext(LocalNicknameContext);
  if (!ctx)
    throw new Error(
      "useLocalNicknames must be used inside LocalNicknameProvider",
    );
  return ctx;
}
