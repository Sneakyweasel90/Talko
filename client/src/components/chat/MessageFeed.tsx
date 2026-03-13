import type { RefObject } from "react";
import { useTheme } from "../../context/ThemeContext";
import MessageItem from "../messages/MessageItem";
import type { GroupedMessage, DMConversation, OnlineUser } from "../../types";

interface Props {
  isAdmin: boolean;
  onPin: (messageId: number) => void;
  messagesContainerRef: RefObject<HTMLDivElement>;
  bottomRef: RefObject<HTMLDivElement>;
  onScroll: () => void;
  groupedMessages: GroupedMessage[];
  loadingMore: boolean;
  hasMore: boolean;
  activeTab: "channels" | "dms";
  activeDMConv: DMConversation | null;
  channel: string;
  hoveredMsgId: number | null;
  pickerMsgId: number | null;
  currentUsername: string;
  currentUserId: number;
  avatarMap: Record<number, string | null>;
  onHover: (id: number | null) => void;
  onPickerToggle: (id: number | null) => void;
  onReact: (messageId: number, emoji: string) => void;
  onReply: (msg: GroupedMessage) => void;
  onEdit: (messageId: number, content: string) => void;
  onDelete: (messageId: number) => void;
  onUsernameClick: (userId: number, username: string, el: HTMLElement) => void;
  resolveNickname: (userId: number, username: string) => string;
}

export default function MessageFeed({
  messagesContainerRef, bottomRef, onScroll,
  groupedMessages, loadingMore, hasMore,
  activeTab, activeDMConv, channel,
  hoveredMsgId, pickerMsgId, isAdmin, onPin,
  currentUsername, currentUserId, avatarMap,
  onHover, onPickerToggle, onReact, onReply, onEdit, onDelete,
  onUsernameClick, resolveNickname,
}: Props) {
  const { theme } = useTheme();

  return (
    <div
      ref={messagesContainerRef}
      style={{ flex: 1, overflowY: "auto", padding: "0 1rem 0.5rem" }}
      onScroll={onScroll}
    >
      <div style={{ textAlign: "center", padding: "0.5rem 0" }}>
        {loadingMore && (
          <span style={{ color: theme.textDim, fontSize: "0.7rem", fontFamily: "'Share Tech Mono', monospace" }}>
            LOADING...
          </span>
        )}
        {!hasMore && groupedMessages.length > 0 && (
          <span style={{ color: theme.textDim, fontSize: "0.65rem", fontFamily: "'Share Tech Mono', monospace", opacity: 0.4 }}>
            {activeTab === "dms" && activeDMConv
              ? `— START OF DM WITH ${(activeDMConv.nickname || activeDMConv.username).toUpperCase()} —`
              : `— BEGINNING OF #${channel} —`}
          </span>
        )}
      </div>

      {groupedMessages.map((msg) => (
        <MessageItem
          isAdmin={isAdmin}
          onPin={onPin}
          key={msg.id}
          msg={msg}
          hoveredMsgId={hoveredMsgId}
          pickerMsgId={pickerMsgId}
          currentUsername={currentUsername}
          currentUserId={currentUserId}
          avatarMap={avatarMap}
          onHover={onHover}
          onPickerToggle={onPickerToggle}
          onReact={onReact}
          onReply={onReply}
          onEdit={onEdit}
          onDelete={onDelete}
          onUsernameClick={onUsernameClick}
          resolveNickname={resolveNickname}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}