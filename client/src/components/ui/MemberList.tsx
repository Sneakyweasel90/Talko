import { useState, useRef } from "react";
import { useTheme } from "../../context/ThemeContext";
import Avatar from "./Avatar";
import type { OnlineUser } from "../../types";
import styles from "./MemberList.module.css";

interface Props {
  onlineUsers: OnlineUser[];
  allUsers: { id: number; username: string }[];
  currentUserId: number;
  onUserClick: (userId: number, username: string, el: HTMLElement) => void;
}

const STATUS_COLORS = {
  online: "#4ade80",
  away: "#facc15",
  dnd: "#f87171",
  offline: "#6b7280",
};
const PANEL_WIDTH = 200;

export default function MemberList({
  onlineUsers,
  allUsers,
  currentUserId,
  onUserClick,
}: Props) {
  const { theme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const onlineIds = new Set(onlineUsers.map((u) => u.id));
  const offlineUsers = allUsers.filter((u) => !onlineIds.has(u.id));

  return (
    <div className={styles.root}>
      {/* Toggle tab */}
      <div
        className={styles.toggleTab}
        onClick={() => setCollapsed((c) => !c)}
        title={collapsed ? "Show members" : "Hide members"}
      >
        <span className={styles.toggleLabel}>
          {collapsed ? "▶ MEMBERS" : "◀"}
        </span>
      </div>

      {/* Sliding panel */}
      <div
        className={`${styles.panel} ${collapsed ? styles.collapsed : ""}`}
        style={{
          width: collapsed ? 0 : PANEL_WIDTH,
          background: `linear-gradient(180deg, ${theme.surface2} 0%, ${theme.surface} 100%)`,
        }}
      >
        <div className={styles.panelInner} style={{ width: PANEL_WIDTH }}>
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.headerTitle}>MEMBERS</div>
            <div className={styles.headerUnderline} />
          </div>

          {/* Online label */}
          <div className={styles.onlineLabel}>
            <span className={styles.onlineLabelText}>// ONLINE</span>
            <span className={styles.onlineCount}>{onlineUsers.length}</span>
          </div>

          {/* User list */}
          <div className={styles.userList}>
            {onlineUsers.map((u) => (
              <MemberRow
                key={u.id}
                user={u}
                isSelf={u.id === currentUserId}
                onUserClick={onUserClick}
              />
            ))}
            {onlineUsers.length === 0 && (
              <div className={styles.emptyText}>no one online</div>
            )}
            {offlineUsers.length > 0 && (
              <>
                <div className={styles.onlineLabel}>
                  <span className={styles.onlineLabelText}>// OFFLINE</span>
                  <span className={styles.onlineCount}>
                    {offlineUsers.length}
                  </span>
                </div>
                <div className={styles.userList}>
                  {offlineUsers.map((u) => (
                    <MemberRow
                      key={u.id}
                      user={{ ...u, status: "offline" } as any}
                      isSelf={u.id === currentUserId}
                      onUserClick={onUserClick}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MemberRow({
  user,
  isSelf,
  onUserClick,
}: {
  user: OnlineUser;
  isSelf: boolean;
  onUserClick: (userId: number, username: string, el: HTMLElement) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const dotColor = STATUS_COLORS[user.status ?? "online"];

  return (
    <div
      ref={rowRef}
      className={styles.memberRow}
      onClick={() =>
        rowRef.current && onUserClick(user.id, user.username, rowRef.current)
      }
    >
      <div className={styles.avatarWrap}>
        <Avatar username={user.username} size={26} />
        <div
          className={styles.statusDot}
          style={{ background: dotColor, boxShadow: `0 0 5px ${dotColor}` }}
        />
      </div>

      <div className={styles.memberInfo}>
        <div className={styles.memberName}>{user.username}</div>
        {user.statusText ? (
          <div className={styles.memberSubText}>{user.statusText}</div>
        ) : isSelf ? (
          <div className={styles.memberSubText}>you</div>
        ) : null}
      </div>
    </div>
  );
}
