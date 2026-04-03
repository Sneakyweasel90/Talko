import { useEffect } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useChannels } from "../../hooks/useChannels";
import ChannelList from "./ChannelList";
import SidebarFooter from "./SidebarFooter";
import type { OnlineUser, DMConversation, UserStatus } from "../../types";
import styles from "./Sidebar.module.css";

interface Props {
  channel: string;
  setChannel: (c: string) => void;
  unreadCounts: Record<string, number>;
  voiceChannel: string | null;
  joinVoice: (c: string) => void;
  leaveVoice: () => void;
  logout: () => void;
  username: string;
  nickname: string | null;
  avatar: string | null;
  userId: number;
  token: string;
  role: string;
  customRoleName: string | null;
  onlineUsers: OnlineUser[];
  onSearchOpen: () => void;
  onNicknameChange: (nickname: string | null) => void;
  onAvatarChange: (avatar: string | null) => void;
  participants: string[];
  voiceOccupancy: Record<string, string[]>;
  dmConversations: DMConversation[];
  dmLoading: boolean;
  activeDMChannel: string | null;
  totalUnread: number;
  activeTab: "channels" | "dms";
  onTabChange: (tab: "channels" | "dms") => void;
  onSelectDM: (conv: DMConversation) => void;
  onTextChannelNamesChange?: (names: string[]) => void;
  currentStatus: UserStatus;
  currentStatusText: string | null;
  onStatusChange: (status: UserStatus, statusText?: string | null) => void;
  inVoice: boolean;
  setMuted: (muted: boolean) => void;
  setAllParticipantsDeafened: (deafened: boolean) => void;
  joinAfk: () => void;
  isScreenSharing: boolean;
  onStartScreenShare: () => void;
  onStopScreenShare: () => void;
  mentionedChannels: Set<string>;
  participantVolumes: Record<string, number>;
  selfVolume: number;
  setParticipantVolume: (username: string, volume: number) => void;
  setSelfVolume: (volume: number) => void;
  activeSpeakers: Set<string>;
  onRegisterRefetchChannels?: (fn: () => void) => void;
  mutedChannels: Set<string>;
  onToggleMute: (channel: string) => void;
}

export default function Sidebar({
  channel,
  setChannel,
  unreadCounts,
  voiceChannel,
  joinVoice,
  leaveVoice,
  logout,
  username,
  nickname,
  avatar,
  userId,
  token,
  role,
  customRoleName,
  onlineUsers,
  onSearchOpen,
  onNicknameChange,
  onAvatarChange,
  participants,
  voiceOccupancy,
  dmConversations,
  dmLoading,
  activeDMChannel,
  totalUnread,
  activeTab,
  onTabChange,
  onSelectDM,
  onTextChannelNamesChange,
  inVoice,
  setMuted,
  setAllParticipantsDeafened,
  currentStatus,
  currentStatusText,
  onStatusChange,
  joinAfk,
  isScreenSharing,
  onStartScreenShare,
  onStopScreenShare,
  mentionedChannels,
  participantVolumes,
  selfVolume,
  setParticipantVolume,
  setSelfVolume,
  activeSpeakers,
  onRegisterRefetchChannels,
  mutedChannels,
  onToggleMute,
}: Props) {
  const { theme } = useTheme();
  const {
    textChannels,
    voiceChannels,
    newChannelName,
    setNewChannelName,
    creating,
    showCreateText,
    showCreateVoice,
    createChannel,
    deleteChannel,
    toggleCreateText,
    toggleCreateVoice,
    cancelCreate,
    afkChannel,
    refetch,
  } = useChannels(token);

  useEffect(() => {
    onTextChannelNamesChange?.(textChannels.map((c) => c.name));
  }, [textChannels, onTextChannelNamesChange]);

  useEffect(() => {
    onRegisterRefetchChannels?.(refetch);
  }, [refetch, onRegisterRefetchChannels]);

  return (
    <div
      className={styles.root}
      style={{
        background: `linear-gradient(180deg, ${theme.surface2} 0%, ${theme.surface} 100%)`,
      }}
    >
      {/* Logo */}
      <div className={styles.logoWrap}>
        <span className={styles.logoText}>TALKO</span>
        <div className={styles.logoUnderline} />
      </div>

      {/* Search button */}
      <div className={styles.searchBtn} onClick={onSearchOpen}>
        <span className={styles.searchIcon}>⌕</span>
        <span className={styles.searchLabel}>SEARCH</span>
        <span className={styles.searchShortcut}>ctrl+k</span>
      </div>

      {/* Channel list */}
      {activeTab === "channels" && (
        <div className={styles.channelListWrap}>
          <ChannelList
            activeSpeakers={activeSpeakers}
            mentionedChannels={mentionedChannels}
            textChannels={textChannels}
            voiceChannels={voiceChannels}
            activeChannel={channel}
            voiceChannel={voiceChannel}
            participants={participants}
            username={username}
            newChannelName={newChannelName}
            creating={creating}
            showCreateText={showCreateText}
            showCreateVoice={showCreateVoice}
            onSelectChannel={setChannel}
            onJoinVoice={joinVoice}
            onLeaveVoice={leaveVoice}
            onDeleteChannel={deleteChannel}
            onToggleCreateText={toggleCreateText}
            onToggleCreateVoice={toggleCreateVoice}
            onChannelNameChange={setNewChannelName}
            onCreateChannel={createChannel}
            onCancelCreate={cancelCreate}
            voiceOccupancy={voiceOccupancy}
            unreadCounts={unreadCounts}
            onJoinAfk={joinAfk}
            afkChannel={afkChannel}
            mutedChannels={mutedChannels}
            onToggleMute={onToggleMute}
            participantVolumes={participantVolumes}
            setParticipantVolume={setParticipantVolume}
          />
        </div>
      )}

      <SidebarFooter
        isScreenSharing={isScreenSharing}
        onStartScreenShare={onStartScreenShare}
        onStopScreenShare={onStopScreenShare}
        username={username}
        nickname={nickname}
        avatar={avatar}
        userId={userId}
        token={token}
        role={role}
        customRoleName={customRoleName}
        onlineUsers={onlineUsers}
        onNicknameChange={onNicknameChange}
        onAvatarChange={onAvatarChange}
        onLogout={logout}
        dmConversations={dmConversations}
        dmLoading={dmLoading}
        activeDMChannel={activeDMChannel}
        totalUnread={totalUnread}
        activeTab={activeTab}
        onTabChange={onTabChange}
        onSelectDM={onSelectDM}
        currentStatus={currentStatus}
        currentStatusText={currentStatusText}
        onStatusChange={onStatusChange}
        inVoice={inVoice}
        voiceChannel={voiceChannel}
        leaveVoice={leaveVoice}
        setMuted={setMuted}
        setAllParticipantsDeafened={setAllParticipantsDeafened}
        participantVolumes={participantVolumes}
        selfVolume={selfVolume}
        setParticipantVolume={setParticipantVolume}
        setSelfVolume={setSelfVolume}
        participants={participants}
      />
    </div>
  );
}
