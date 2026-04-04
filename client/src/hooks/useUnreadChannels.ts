import { useState, useCallback } from "react";
import axios from "axios";
import config from "../config";

export function useUnreadChannels(token: string, mutedChannels: Set<string>) {
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  const handleUnreadMessage = useCallback(
    (data: {
      type: string;
      counts?: Record<string, number>;
      channelId?: number;
    }) => {
      if (data.type === "channel_unread_counts" && data.counts) {
        setUnreadCounts(data.counts);
      }
      if (data.type === "channel_unread_increment" && data.channelId) {
        const key = String(data.channelId);
        if (mutedChannels.has(key)) return;
        setUnreadCounts((prev) => ({
          ...prev,
          [key]: (prev[key] ?? 0) + 1,
        }));
      }
    },
    [mutedChannels],
  );

  const markChannelRead = useCallback(
    async (channelId: string) => {
      const key = String(channelId);
      setUnreadCounts((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
      try {
        await axios.post(
          `${config.HTTP}/api/channels/read`,
          { channelId: Number(channelId) },
          { headers: { Authorization: `Bearer ${token}` } },
        );
      } catch {
        /* non-fatal */
      }
    },
    [token],
  );

  const totalUnreadChannels = Object.values(unreadCounts).reduce(
    (s, n) => s + n,
    0,
  );

  return {
    unreadCounts,
    handleUnreadMessage,
    markChannelRead,
    totalUnreadChannels,
  };
}
