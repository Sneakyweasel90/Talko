import { useState, useCallback } from "react";
import axios from "axios";
import config from "../config";

export function useUnreadChannels(token: string, mutedChannels: Set<string>) {
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  const handleUnreadMessage = useCallback(
    (data: {
      type: string;
      counts?: Record<string, number>;
      channelName?: string;
    }) => {
      if (data.type === "channel_unread_counts" && data.counts) {
        setUnreadCounts(data.counts);
      }
      if (data.type === "channel_unread_increment" && data.channelName) {
        if (mutedChannels.has(data.channelName)) return;
        setUnreadCounts((prev) => ({
          ...prev,
          [data.channelName!]: (prev[data.channelName!] ?? 0) + 1,
        }));
      }
    },
    [mutedChannels],
  );

  const markChannelRead = useCallback(
    async (channelName: string) => {
      setUnreadCounts((prev) => {
        if (!prev[channelName]) return prev;
        const next = { ...prev };
        delete next[channelName];
        return next;
      });
      try {
        await axios.post(
          `${config.HTTP}/api/channels/read`,
          { channelName },
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
