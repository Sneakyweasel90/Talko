import Avatar from "../ui/Avatar";
import type { DMConversation, OnlineUser } from "../../types";
import styles from "./DMHeader.module.css";

interface Props {
  conversation: DMConversation;
  onlineUsers: OnlineUser[];
}

const STATUS_COLORS = { online: "#4ade80", away: "#facc15", dnd: "#f87171" };
const STATUS_LABELS = { online: "ONLINE", away: "AWAY", dnd: "DO NOT DISTURB" };

export default function DMHeader({ conversation, onlineUsers }: Props) {
  const userStatus = onlineUsers.find(
    (u) => u.id === conversation.other_user_id,
  );
  const displayName = conversation.nickname || conversation.username;
  const dotColor = userStatus
    ? STATUS_COLORS[userStatus.status ?? "online"]
    : undefined;

  return (
    <div className={styles.header}>
      <div className={styles.avatarWrap}>
        <Avatar username={displayName} avatar={conversation.avatar} size={28} />
        <div
          className={styles.statusDot}
          style={{
            background: dotColor ?? "var(--border)",
            boxShadow: dotColor ? `0 0 5px ${dotColor}` : "none",
          }}
        />
      </div>

      <div className={styles.nameWrap}>
        <span className={styles.displayName}>{displayName}</span>
        {conversation.nickname && (
          <span className={styles.usernameHint}>@{conversation.username}</span>
        )}
      </div>

      <div className={styles.statusWrap}>
        {userStatus ? (
          <span className={styles.statusLabel} style={{ color: dotColor }}>
            ● {STATUS_LABELS[userStatus.status ?? "online"]}
          </span>
        ) : (
          <span className={styles.statusOffline}>○ OFFLINE</span>
        )}
        {userStatus?.statusText && (
          <span className={styles.statusText}>{userStatus.statusText}</span>
        )}
      </div>
    </div>
  );
}
