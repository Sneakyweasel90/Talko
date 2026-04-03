import { useState, useCallback, useEffect } from "react";
import axios from "axios";
import config from "../config";
import type { DMConversation } from "../types";

export function useDMs(token: string, currentUserId: number) {
  const [conversations, setConversations] = useState<DMConversation[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchConversations = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const { data } = await axios.get(`${config.HTTP}/api/dm/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setConversations(data);
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Open or create a DM with a user — returns the channelId
  const openDM = useCallback(
    async (userId: number): Promise<string | null> => {
      try {
        const { data } = await axios.post(
          `${config.HTTP}/api/dm/open`,
          { userId },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        await fetchConversations();
        return data.channelId;
      } catch {
        return null;
      }
    },
    [token, fetchConversations],
  );

  // Mark a DM channel as read — clears unread badge
  const markRead = useCallback(
    async (channelId: string) => {
      try {
        await axios.post(
          `${config.HTTP}/api/dm/read`,
          { channelId },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setConversations((prev) =>
          prev.map((c) =>
            c.channelId === channelId ? { ...c, unread_count: 0 } : c,
          ),
        );
      } catch {
        // non-fatal
      }
    },
    [token],
  );

  // When a new DM message arrives via WS, update last_message and unread count
  const onDMMessage = useCallback(
    (
      channelId: string,
      content: string,
      senderId: number,
      createdAt: string,
    ) => {
      setConversations((prev) => {
        const existing = prev.find((c) => c.channelId === channelId);
        if (existing) {
          return prev
            .map((c) =>
              c.channelId === channelId
                ? {
                    ...c,
                    last_message: content,
                    last_message_at: createdAt,
                    // Only increment unread if the message is from the other person
                    unread_count:
                      senderId !== currentUserId
                        ? c.unread_count + 1
                        : c.unread_count,
                  }
                : c,
            )
            .sort((a, b) =>
              (b.last_message_at ?? "").localeCompare(a.last_message_at ?? ""),
            );
        }
        // New conversation — refetch
        fetchConversations();
        return prev;
      });
    },
    [currentUserId, fetchConversations],
  );

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0);

  return {
    conversations,
    loading,
    openDM,
    markRead,
    onDMMessage,
    fetchConversations,
    totalUnread,
  };
}
