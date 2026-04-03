import { useState, useCallback } from "react";
import type { OnlineUser } from "../types";

export function usePresence() {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [voiceOccupancy, setVoiceOccupancy] = useState<
    Record<string, string[]>
  >({});
  const [avatarMap, setAvatarMap] = useState<Record<number, string | null>>({});

  const handlePresenceMessage = useCallback((data: any) => {
    if (data.type === "presence") {
      setOnlineUsers(data.users);
      return true;
    }
    if (data.type === "voice_state") {
      setVoiceOccupancy(data.channels);
      return true;
    }
    if (data.type === "voice_presence_update") {
      setVoiceOccupancy((prev) => {
        const current = prev[data.channelId] ?? [];
        if (data.action === "join") {
          return {
            ...prev,
            [data.channelId]: current.includes(data.username)
              ? current
              : [...current, data.username],
          };
        } else {
          const updated = current.filter((u) => u !== data.username);
          const next = { ...prev };
          if (updated.length === 0) delete next[data.channelId];
          else next[data.channelId] = updated;
          return next;
        }
      });
      return true;
    }
    if (data.type === "avatar_update") {
      setAvatarMap((prev) => ({ ...prev, [data.userId]: data.avatar }));
      return true;
    }
    return false;
  }, []);

  const updateAvatarMap = useCallback(
    (userId: number, avatar: string | null) => {
      setAvatarMap((prev) => ({ ...prev, [userId]: avatar }));
    },
    [],
  );

  return {
    onlineUsers,
    voiceOccupancy,
    avatarMap,
    handlePresenceMessage,
    updateAvatarMap,
  };
}
