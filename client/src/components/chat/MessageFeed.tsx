import type { RefObject } from "react";
import MessageItem from "../messages/MessageItem";
import type { GroupedMessage, DMConversation } from "../../types";
import styles from "./MessageFeed.module.css";

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

const onJumpToMessage = (id: number) => {
  const el = document.getElementById(`msg-${id}`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add(styles.highlighted);
  setTimeout(() => el.classList.remove(styles.highlighted), 1500);
};

export default function MessageFeed({
  messagesContainerRef,
  bottomRef,
  onScroll,
  groupedMessages,
  loadingMore,
  hasMore,
  activeTab,
  activeDMConv,
  channel,
  hoveredMsgId,
  pickerMsgId,
  isAdmin,
  onPin,
  currentUsername,
  currentUserId,
  avatarMap,
  onHover,
  onPickerToggle,
  onReact,
  onReply,
  onEdit,
  onDelete,
  onUsernameClick,
  resolveNickname,
}: Props) {
  return (
    <div
      ref={messagesContainerRef}
      className={styles.container}
      onScroll={onScroll}
    >
      <div className={styles.statusRow}>
        {loadingMore && <span className={styles.loadingText}>LOADING...</span>}
        {!hasMore && groupedMessages.length > 0 && (
          <span className={styles.beginningText}>
            {activeTab === "dms" && activeDMConv
              ? `— START OF DM WITH ${(activeDMConv.nickname || activeDMConv.username).toUpperCase()} —`
              : `— BEGINNING OF #${channel} —`}
          </span>
        )}
      </div>

      {groupedMessages.map((msg) => (
        <MessageItem
          key={msg.id}
          isAdmin={isAdmin}
          onPin={onPin}
          msg={msg}
          hoveredMsgId={hoveredMsgId}
          pickerMsgId={pickerMsgId}
          currentUsername={currentUsername}
          currentUserId={currentUserId}
          avatarMap={avatarMap}
          onHover={onHover}
          onReact={onReact}
          onReply={onReply}
          onEdit={onEdit}
          onDelete={onDelete}
          onUsernameClick={onUsernameClick}
          resolveNickname={resolveNickname}
          onJumpToMessage={onJumpToMessage}
          onPickerToggle={onPickerToggle}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
