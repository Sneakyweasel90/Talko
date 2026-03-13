import { useState } from "react";
import { useTheme } from "../context/ThemeContext";
import Avatar from "./Avatar";
import ThemePicker from "./ThemePicker";
import AccountSettings from "./AccountSettings";
import DMList from "./DMList";
import type { OnlineUser, DMConversation, UserRole } from "../types";

interface SidebarFooterProps {
  username: string;
  nickname: string | null;
  avatar: string | null;
  userId: number;
  token: string;
  role: string;
  customRoleName: string | null;
  onNicknameChange: (nickname: string | null) => void;
  onAvatarChange: (avatar: string | null) => void;
  onLogout: () => void;
  // DM props
  onlineUsers: OnlineUser[];
  dmConversations: DMConversation[];
  dmLoading: boolean;
  activeDMChannel: string | null;
  totalUnread: number;
  activeTab: "channels" | "dms";
  onTabChange: (tab: "channels" | "dms") => void;
  onSelectDM: (conv: DMConversation) => void;
}

export default function SidebarFooter({
  username,
  nickname,
  avatar,
  userId,
  token,
  role,
  customRoleName,
  onNicknameChange,
  onAvatarChange,
  onLogout,
  onlineUsers,
  dmConversations,
  dmLoading,
  activeDMChannel,
  totalUnread,
  activeTab,
  onTabChange,
  onSelectDM,
}: SidebarFooterProps) {
  const { theme } = useTheme();
  const [showThemes, setShowThemes] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
      }}
    >
      {/* DM list — only shown in DMs tab */}
      {activeTab === "dms" && (
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          <DMList
            conversations={dmConversations}
            activeDMChannel={activeDMChannel}
            onlineUsers={onlineUsers}
            onSelectDM={onSelectDM}
            loading={dmLoading}
          />
        </div>
      )}

      {/* Spacer on channels tab so themes/user stay at bottom */}
      {activeTab === "channels" && <div style={{ flex: 1 }} />}

      {/* ── Tab switcher — pinned to bottom ── */}
      <div
        style={{
          display: "flex",
          borderTop: `1px solid ${theme.border}`,
          flexShrink: 0,
        }}
      >
        {(["channels", "dms"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            style={{
              flex: 1,
              background: "none",
              border: "none",
              borderTop: `2px solid ${activeTab === tab ? theme.primary : "transparent"}`,
              color: activeTab === tab ? theme.primary : theme.textDim,
              fontSize: "0.6rem",
              fontFamily: "'Share Tech Mono', monospace",
              letterSpacing: "0.1em",
              padding: "0.5rem 0.25rem",
              cursor: "pointer",
              transition: "all 0.15s",
              position: "relative",
            }}
          >
            {tab === "channels" ? "// CHANNELS" : "// DMs"}
            {tab === "dms" && totalUnread > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: "4px",
                  right: "8px",
                  background: theme.primary,
                  color: theme.background,
                  borderRadius: "8px",
                  padding: "0 4px",
                  fontSize: "0.55rem",
                  fontFamily: "'Share Tech Mono', monospace",
                  fontWeight: 700,
                  minWidth: "14px",
                  textAlign: "center",
                }}
              >
                {totalUnread > 99 ? "99+" : totalUnread}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Themes button ── */}
      <div
        style={{
          margin: "0.5rem",
          padding: "0.5rem 1rem",
          cursor: "pointer",
          border: `1px solid ${theme.border}`,
          borderRadius: "2px",
          textAlign: "center",
          transition: "all 0.2s",
        }}
        onClick={() => setShowThemes(true)}
      >
        <span
          style={{
            color: theme.textDim,
            fontSize: "0.75rem",
            fontFamily: "'Share Tech Mono', monospace",
          }}
        >
          ⚙ THEMES
        </span>
      </div>

      {/* ── User footer ── */}
      <div
        style={{
          padding: "0.75rem 1rem",
          borderTop: `1px solid ${theme.border}`,
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          flexShrink: 0,
        }}
      >
        <div
          onClick={() => setShowSettings(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            flex: 1,
            cursor: "pointer",
            minWidth: 0,
          }}
          title="Account settings"
        >
          <Avatar username={nickname || username} avatar={avatar} size={28} />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: "0.85rem",
                fontFamily: "'Share Tech Mono', monospace",
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: theme.text,
              }}
            >
              {nickname || username}
            </div>
            {nickname && (
              <div
                style={{
                  fontSize: "0.6rem",
                  color: theme.textDim,
                  fontFamily: "'Share Tech Mono', monospace",
                  opacity: 0.6,
                }}
              >
                @{username}
              </div>
            )}
          </div>
        </div>
        <button
          onClick={onLogout}
          style={{
            background: "none",
            border: `1px solid ${theme.border}`,
            cursor: "pointer",
            fontSize: "0.6rem",
            fontFamily: "'Share Tech Mono', monospace",
            letterSpacing: "0.1em",
            padding: "3px 6px",
            borderRadius: "2px",
            transition: "all 0.2s",
            flexShrink: 0,
            color: theme.textDim,
          }}
        >
          EXIT
        </button>
      </div>

      {showThemes && <ThemePicker onClose={() => setShowThemes(false)} />}
      {showSettings && (
        <AccountSettings
          user={{
            id: userId,
            username,
            nickname,
            avatar,
            token,
            role: role as UserRole,
            customRoleName,
          }}
          onClose={() => setShowSettings(false)}
          onNicknameChange={onNicknameChange}
          onAvatarChange={onAvatarChange}
        />
      )}
    </div>
  );
}
