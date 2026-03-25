import { useState, useRef, useCallback, useEffect } from "react";
import type { Message, GroupedMessage, ServerMessage } from "../types";

interface UseMessagesOptions {
  channel: string;
  send: (msg: object) => void;
  currentUserId: number;
  currentChannelRef: React.MutableRefObject<string>;
  userRef: React.MutableRefObject<{
    id: number;
    username: string;
    nickname: string | null;
  } | null>;
  mutedChannels: Set<string>;
}

export function useMessages({
  channel,
  send,
  currentUserId,
  currentChannelRef,
  userRef,
  mutedChannels,
}: UseMessagesOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [typers, setTypers] = useState<Record<number, string>>({});
  const [hasMore, setHasMore] = useState(false);
  const [oldestId, setOldestId] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const typingTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>(
    {},
  );
  const prevScrollHeightRef = useRef(0);
  const jumpToBottomRef = useRef(true);
  const [mentionedChannels, setMentionedChannels] = useState<Set<string>>(
    new Set(),
  );

  const scrollToBottom = useCallback((instant = false) => {
    const el = messagesContainerRef.current;
    if (!el) return;
    if (instant) el.scrollTop = el.scrollHeight;
    else bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const clearMention = useCallback((channelId: string) => {
    setMentionedChannels((prev) => {
      const next = new Set(prev);
      next.delete(channelId);
      return next;
    });
  }, []);

  const handleMessage = useCallback(
    (data: ServerMessage) => {
      if (data.type === "history") {
        setMessages(data.messages);
        setHasMore(data.hasMore);
        setOldestId(data.oldestId);
        jumpToBottomRef.current = true;
      }

      if (data.type === "history_prepend") {
        setLoadingMore(false);
        if (data.messages.length === 0) {
          setHasMore(false);
          return;
        }
        prevScrollHeightRef.current =
          messagesContainerRef.current?.scrollHeight ?? 0;
        setMessages((prev) => [...data.messages, ...prev]);
        setHasMore(data.hasMore);
        setOldestId(data.oldestId);
      }

      if (data.type === "mention") {
        if (mutedChannels.has(data.channelId)) return;
        setMentionedChannels((prev) => new Set([...prev, data.channelId]));
        const isDM = data.channelId.startsWith("dm:");
        const title = isDM
          ? `${data.senderName} mentioned you in a DM`
          : `${data.senderName} mentioned you in #${data.channelId}`;
        window.electronAPI?.notify(title, data.content);
        // Also trigger browser notification for web users
        if (
          typeof Notification !== "undefined" &&
          Notification.permission === "granted"
        ) {
          new Notification(title, { body: data.content });
        }
        return;
      }

      if (data.type === "message") {
        if (data.message.channel_id === currentChannelRef.current) {
          setMessages((prev) => {
            if (prev.find((m) => m.id === data.message.id)) return prev;
            return [...prev, data.message];
          });
        }
        // Non-mention messages in other channels — keep existing notify for DMs only
        else if (
          data.message.user_id !== currentUserId &&
          data.message.channel_id.startsWith("dm:")
        ) {
          window.electronAPI?.notify(
            `DM from ${data.message.username}`,
            data.message.content.slice(0, 80),
          );
        }
      }

      if (data.type === "reaction_update") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === data.messageId ? { ...m, reactions: data.reactions } : m,
          ),
        );
      }

      if (data.type === "message_edited") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === data.messageId
              ? {
                  ...m,
                  content: data.content,
                  edited_at: new Date().toISOString(),
                }
              : m,
          ),
        );
      }

      if (data.type === "message_deleted") {
        setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
      }

      if (data.type === "typing") {
        setTypers((prev) => ({ ...prev, [data.userId]: data.username }));
        clearTimeout(typingTimers.current[data.userId]);
        typingTimers.current[data.userId] = setTimeout(() => {
          setTypers((prev) => {
            const n = { ...prev };
            delete n[data.userId];
            return n;
          });
        }, 3000);
      }
    },
    [currentChannelRef, currentUserId, mutedChannels],
  ); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset and rejoin when channel changes
  useEffect(() => {
    setMessages([]);
    setHasMore(false);
    setOldestId(null);
    jumpToBottomRef.current = true;
    const t = setTimeout(() => send({ type: "join", channelId: channel }), 300);
    return () => clearTimeout(t);
  }, [channel, send]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (loadingMore) return;
    if (jumpToBottomRef.current) {
      scrollToBottom(true);
      jumpToBottomRef.current = false;
    } else {
      const el = messagesContainerRef.current;
      if (!el) return;
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 120)
        scrollToBottom(false);
    }
  }, [messages, loadingMore, scrollToBottom]);

  // Restore scroll position after prepending history
  useEffect(() => {
    if (prevScrollHeightRef.current > 0 && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight - prevScrollHeightRef.current;
      prevScrollHeightRef.current = 0;
    }
  }, [messages]);

  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    if (el.scrollTop < 80 && hasMore && !loadingMore && oldestId !== null) {
      setLoadingMore(true);
      send({ type: "load_more", channelId: channel, beforeId: oldestId });
    }
  }, [hasMore, loadingMore, oldestId, channel, send]);

  const handleReact = useCallback(
    (messageId: number, emoji: string) => {
      send({ type: "react", messageId, emoji });
    },
    [send],
  );

  const handleEdit = useCallback(
    (messageId: number, content: string) => {
      send({ type: "edit_message", messageId, content });
    },
    [send],
  );

  const handleDelete = useCallback(
    (messageId: number) => {
      send({ type: "delete_message", messageId });
    },
    [send],
  );

  const groupedMessages: GroupedMessage[] = messages.reduce<GroupedMessage[]>(
    (acc, msg, i) => {
      const prev = messages[i - 1];
      const isGrouped = false;
      acc.push({ ...msg, isGrouped });
      return acc;
    },
    [],
  );

  return {
    groupedMessages,
    typers,
    hasMore,
    loadingMore,
    handleMessage,
    handleScroll,
    handleReact,
    handleEdit,
    handleDelete,
    bottomRef,
    messagesContainerRef,
    mentionedChannels,
    clearMention,
  };
}
