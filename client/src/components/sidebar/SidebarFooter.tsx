import { useState, useRef, useEffect } from "react";
import { useTheme } from "../../context/ThemeContext";
import Avatar from "../ui/Avatar";
import ThemePicker from "../overlays/ThemePicker";
import AccountSettings from "../overlays/AccountSettings";
import DMList from "../dm/DMList";
import type {
  OnlineUser,
  DMConversation,
  UserRole,
  UserStatus,
} from "../../types";
import styles from "./SidebarFooter.module.css";
import VoicePanel from "../voice/VoicePanel";

const STATUS_COLORS: Record<UserStatus, string> = {
  online: "#4ade80",
  away: "#facc15",
  dnd: "#f87171",
};
const STATUS_LABELS: Record<UserStatus, string> = {
  online: "ONLINE",
  away: "AWAY",
  dnd: "DO NOT DISTURB",
};

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
  onlineUsers: OnlineUser[];
  dmConversations: DMConversation[];
  dmLoading: boolean;
  activeDMChannel: string | null;
  totalUnread: number;
  activeTab: "channels" | "dms";
  onTabChange: (tab: "channels" | "dms") => void;
  onSelectDM: (conv: DMConversation) => void;
  currentStatus: UserStatus;
  currentStatusText: string | null;
  onStatusChange: (status: UserStatus, statusText?: string | null) => void;
  inVoice: boolean;
  voiceChannel: string | null;
  leaveVoice: () => void;
  setMuted: (muted: boolean) => void;
  setAllParticipantsDeafened: (deafened: boolean) => void;
  isScreenSharing: boolean;
  onStartScreenShare: () => void;
  onStopScreenShare: () => void;
  participantVolumes: Record<string, number>;
  selfVolume: number;
  setParticipantVolume: (username: string, volume: number) => void;
  setSelfVolume: (volume: number) => void;
  participants: string[];
}

function UserRow({
  nickname,
  username,
  avatar,
  currentStatus,
  currentStatusText,
  onClick,
}: {
  nickname: string | null;
  username: string;
  avatar: string | null;
  currentStatus: UserStatus;
  currentStatusText: string | null;
  onClick: () => void;
}) {
  const dotColor = STATUS_COLORS[currentStatus];
  return (
    <div className={styles.userRow} onClick={onClick} title="Account settings">
      <div className={styles.userAvatarWrap}>
        <Avatar username={nickname || username} avatar={avatar} size={28} />
        <div
          className={styles.userStatusDot}
          style={{ background: dotColor, boxShadow: `0 0 5px ${dotColor}` }}
        />
      </div>
      <div className={styles.userNameWrap}>
        <div className={styles.userDisplayName}>{nickname || username}</div>
        {currentStatusText ? (
          <div className={styles.userStatusText} style={{ color: dotColor }}>
            {currentStatusText}
          </div>
        ) : nickname ? (
          <div className={styles.userUsernameHint}>@{username}</div>
        ) : null}
      </div>
    </div>
  );
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
  currentStatus,
  currentStatusText,
  onStatusChange,
  inVoice,
  voiceChannel,
  leaveVoice,
  setMuted,
  setAllParticipantsDeafened,
  isScreenSharing,
  onStartScreenShare,
  onStopScreenShare,
  participantVolumes,
  selfVolume,
  setParticipantVolume,
  setSelfVolume,
  participants,
}: SidebarFooterProps) {
  const { theme } = useTheme();
  const [showThemes, setShowThemes] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const statusPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        statusPickerRef.current &&
        !statusPickerRef.current.contains(e.target as Node)
      ) {
        setShowStatusPicker(false);
      }
    };
    if (showStatusPicker) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showStatusPicker]);

  return (
    <div className={styles.root}>
      {/* DM list */}
      {activeTab === "dms" && (
        <div className={styles.dmListWrap}>
          <DMList
            conversations={dmConversations}
            activeDMChannel={activeDMChannel}
            onlineUsers={onlineUsers}
            onSelectDM={onSelectDM}
            loading={dmLoading}
          />
        </div>
      )}

      {activeTab === "channels" && <div className={styles.spacer} />}

      {/* Tab switcher */}
      <div className={styles.tabs}>
        {(["channels", "dms"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`${styles.tab} ${activeTab === tab ? styles.active : ""}`}
          >
            {tab === "channels" ? "// CHANNELS" : "// DMs"}
            {tab === "dms" && totalUnread > 0 && (
              <span className={styles.tabUnreadBadge}>
                {totalUnread > 99 ? "99+" : totalUnread}
              </span>
            )}
          </button>
        ))}
      </div>

      <VoicePanel
        inVoice={inVoice}
        voiceChannel={voiceChannel}
        leaveVoice={leaveVoice}
        setMuted={setMuted}
        setAllParticipantsDeafened={setAllParticipantsDeafened}
        isScreenSharing={isScreenSharing}
        onStartScreenShare={onStartScreenShare}
        onStopScreenShare={onStopScreenShare}
        participantVolumes={participantVolumes}
        selfVolume={selfVolume}
        setParticipantVolume={setParticipantVolume}
        setSelfVolume={setSelfVolume}
        participants={participants}
      />

      {/* Theme row */}
      <div className={styles.themeRow}>
        <button className={styles.themeBtn} onClick={() => setShowThemes(true)}>
          THEME
        </button>
      </div>

      {/* User bar */}
      <div className={styles.userBar}>
        {/* Status picker popup */}
        {showStatusPicker && (
          <div ref={statusPickerRef} className={styles.statusPicker}>
            <div className={styles.statusPickerTitle}>// SET STATUS</div>
            {(["online", "away", "dnd"] as const).map((s) => (
              <div
                key={s}
                onClick={() => {
                  onStatusChange(s, currentStatusText);
                  setShowStatusPicker(false);
                }}
                className={`${styles.statusOption} ${currentStatus === s ? styles.activeStatus : ""}`}
              >
                <div
                  className={styles.statusOptionDot}
                  style={{ background: STATUS_COLORS[s] }}
                />
                <span className={styles.statusOptionLabel}>
                  {STATUS_LABELS[s]}
                </span>
              </div>
            ))}
            <div className={styles.statusTextWrap}>
              <input
                className={styles.statusTextInput}
                placeholder="Custom status..."
                value={currentStatusText ?? ""}
                maxLength={60}
                onChange={(e) =>
                  onStatusChange(currentStatus, e.target.value || null)
                }
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        )}

        {/* User row */}
        <UserRow
          nickname={nickname}
          username={username}
          avatar={avatar}
          currentStatus={currentStatus}
          currentStatusText={currentStatusText}
          onClick={() => setShowSettings(true)}
        />

        {/* Action row */}
        <div className={styles.actionRow}>
          <button
            onClick={() => setShowStatusPicker((s) => !s)}
            className={`${styles.statusBtn} ${showStatusPicker ? styles.open : ""}`}
          >
            <div
              className={styles.statusBtnDot}
              style={{ background: STATUS_COLORS[currentStatus] }}
            />
            SET STATUS
          </button>
          <button className={styles.exitBtn} onClick={onLogout}>
            EXIT
          </button>
        </div>
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
