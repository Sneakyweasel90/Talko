import { useState, useCallback } from "react";
import type { DMConversation } from "../types";

interface UseDMStateOptions {
  send: (data: object) => void;
  openDM: (userId: number) => Promise<string | null>;
  markRead: (channelId: string) => void;
  currentChannelRef: React.MutableRefObject<string>;
  dmConversations: DMConversation[];
}

export function useDMState({
  send,
  openDM,
  markRead,
  currentChannelRef,
  dmConversations,
}: UseDMStateOptions) {
  const [activeDMConv, setActiveDMConv] = useState<DMConversation | null>(null);

  const handleOpenDM = useCallback(
    async (userId: number) => {
      const channelId = await openDM(userId);
      if (!channelId) return;
      markRead(channelId);
      currentChannelRef.current = channelId;
      send({ type: "join", channelId });
      return channelId;
    },
    [openDM, markRead, send, currentChannelRef],
  );

  const handleSelectDM = useCallback(
    (conv: DMConversation) => {
      setActiveDMConv(conv);
      markRead(conv.channelId);
      currentChannelRef.current = conv.channelId;
      send({ type: "join", channelId: conv.channelId });
    },
    [markRead, send, currentChannelRef],
  );

  const handleTabToDMs = useCallback(
    (channel: string) => {
      const firstConv = activeDMConv ?? dmConversations[0] ?? null;
      if (firstConv && !activeDMConv) {
        setActiveDMConv(firstConv);
        markRead(firstConv.channelId);
        currentChannelRef.current = firstConv.channelId;
        send({ type: "join", channelId: firstConv.channelId });
      } else if (activeDMConv) {
        send({ type: "join", channelId: activeDMConv.channelId });
      }
    },
    [activeDMConv, dmConversations, markRead, send, currentChannelRef],
  );

  const handleTabToChannels = useCallback(
    (channel: string) => {
      currentChannelRef.current = channel;
      send({ type: "join", channelId: channel });
    },
    [send, currentChannelRef],
  );

  return {
    activeDMConv,
    setActiveDMConv,
    handleOpenDM,
    handleSelectDM,
    handleTabToDMs,
    handleTabToChannels,
  };
}