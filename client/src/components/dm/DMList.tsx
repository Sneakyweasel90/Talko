import Avatar from "../ui/Avatar";
import type { DMConversation, OnlineUser } from "../../types";
import styles from "./DMList.module.css";

interface Props {
  conversations: DMConversation[];
  activeDMChannel: string | null;
  onlineUsers: OnlineUser[];
  onSelectDM: (conv: DMConversation) => void;
  loading: boolean;
}

const STATUS_COLORS = { online: "#4ade80", away: "#facc15", dnd: "#f87171" };

export default function DMList({
  conversations,
  activeDMChannel,
  onlineUsers,
  onSelectDM,
  loading,
}: Props) {
  if (loading && conversations.length === 0) {
    return <div className={styles.loading}>LOADING...</div>;
  }

  if (conversations.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>◈</div>
        No direct messages yet.
        <br />
        Click a username in chat to start one.
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {conversations.map((conv) => {
        const isActive = activeDMChannel === conv.channelId;
        const userStatus = onlineUsers.find((u) => u.id === conv.other_user_id);
        const dotColor = userStatus
          ? STATUS_COLORS[userStatus.status ?? "online"]
          : undefined;
        const displayName = conv.nickname || conv.username;
        const hasUnread = conv.unread_count > 0;

        return (
          <div
            key={conv.channelId}
            onClick={() => onSelectDM(conv)}
            className={`${styles.item} ${isActive ? styles.active : ""}`}
          >
            {/* Avatar with status dot */}
            <div className={styles.avatarWrap}>
              <Avatar username={displayName} avatar={conv.avatar} size={32} />
              <div
                className={styles.statusDot}
                style={{
                  background: dotColor ?? "var(--border)",
                  boxShadow: dotColor ? `0 0 5px ${dotColor}` : "none",
                }}
              />
            </div>

            {/* Name + last message */}
            <div className={styles.nameWrap}>
              <div className={styles.nameRow}>
                <span
                  className={`${styles.displayName} ${hasUnread ? styles.hasUnread : ""}`}
                >
                  {displayName}
                </span>
                {hasUnread && (
                  <span className={styles.unreadBadge}>
                    {conv.unread_count > 99 ? "99+" : conv.unread_count}
                  </span>
                )}
              </div>
              {userStatus?.statusText ? (
                <div className={styles.subText}>{userStatus.statusText}</div>
              ) : conv.last_message ? (
                <div
                  className={`${styles.lastMessage} ${hasUnread ? styles.hasUnread : ""}`}
                >
                  {conv.last_message.length > 35
                    ? conv.last_message.slice(0, 35) + "…"
                    : conv.last_message}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
