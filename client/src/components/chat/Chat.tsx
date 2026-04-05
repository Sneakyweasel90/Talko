import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useVoice } from "../../hooks/useVoice";
import { useLocalNicknames } from "../../context/LocalNicknameContext";
import { useMessages } from "../../hooks/useMessages";
import { useDMs } from "../../hooks/useDMs";
import { useUnreadChannels } from "../../hooks/useUnreadChannels";
import { useAfkDetector } from "../../hooks/useAfkDetector";
import { usePresence } from "../../hooks/usePresence";
import { useChatKeyboard } from "../../hooks/useChatKeyboard";
import axios from "axios";
import config from "../../config";
import TitleBar from "../ui/TitleBar";
import ResizableSidebar from "../sidebar/ResizableSidebar";
import Sidebar from "../sidebar/Sidebar";
import ChatMain from "./ChatMain";
import MemberList from "../ui/MemberList";
import SearchOverlay from "../overlays/SearchOverlay";
import UserPopover from "../overlays/UserPopover";
import ScreenShareViewer from "../voice/ScreenShareViewer";
import ScreenPickerModal from "../voice/ScreenPickerModal";
import ConnectionModal from "../overlays/ConnectionModal";
import type { GroupedMessage, UserStatus } from "../../types";
import styles from "./Chat.module.css";
import { useDMState } from "../../hooks/useDMState";
import { usePopover } from "../../hooks/usePopover";
import { useMutedChannels } from "../../hooks/useMutedChannels";
import CommunitySwitcher from "../community/CommunitySwitcher";
import { useCommunities } from "../../hooks/useCommunities";
import WelcomeScreen from "../community/WelcomeScreen";

export default function Chat() {
  const { user, logout, updateNickname, updateAvatar } = useAuth();
  const { resolve, load, nicknames } = useLocalNicknames();
  const { mutedChannels, toggleMute } = useMutedChannels(user!.token);
  const { unreadCounts, handleUnreadMessage, markChannelRead } =
    useUnreadChannels(user!.token, mutedChannels);
  const {
    onlineUsers,
    voiceOccupancy,
    avatarMap,
    handlePresenceMessage,
    updateAvatarMap,
  } = usePresence();
  const { popover, openPopover, closePopover } = usePopover();
  const {
    communities,
    loading,
    activeCommunityId,
    activeCommunity,
    switchCommunity,
    addCommunity,
    removeCommunity,
  } = useCommunities(user!.token);

  const [channel, setChannel] = useState<number | null>(null);
  const [channelName, setChannelName] = useState<string>("");
  const [showSearch, setShowSearch] = useState(false);
  const [pickerMsgId, setPickerMsgId] = useState<number | null>(null);
  const [hoveredMsgId, setHoveredMsgId] = useState<number | null>(null);
  const [replyTo, setReplyTo] = useState<GroupedMessage | null>(null);
  const [activeTab, setActiveTab] = useState<"channels" | "dms">("channels");
  const [myStatus, setMyStatus] = useState<UserStatus>("online");
  const [myStatusText, setMyStatusText] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<{ id: number; username: string }[]>(
    [],
  );

  const textChannelNamesRef = useRef<string[]>([]);
  const currentChannelRef = useRef<number | string | null>(null);
  const userRef = useRef(user);
  const sendRef = useRef<(data: object) => void>(() => {});
  const sendViaRef = useCallback((data: object) => sendRef.current(data), []);
  const lastFetchedCommunityRef = useRef<number | null>(null);

  // Ref so the WS callback (defined before `voice`) can safely call voice methods.
  const voiceRef = useRef<{ inVoice: boolean; leaveVoice: () => void } | null>(
    null,
  );

  const handleSwitchCommunity = useCallback(
    (id: number) => {
      switchCommunity(id);
      setChannel(null);
    },
    [switchCommunity],
  );

  useEffect(() => {
    userRef.current = user;
  }, [user]);
  useEffect(() => {
    currentChannelRef.current = channel;
  }, [channel]);
  useEffect(() => {
    if (user?.token) load(user.token);
  }, []); // eslint-disable-line

  const resolveNickname = useCallback(
    (userId: number, serverDisplayName: string): string => {
      if (userId === user!.id)
        return userRef.current?.nickname || serverDisplayName;
      return resolve(userId, serverDisplayName);
    },
    [resolve, nicknames], // eslint-disable-line
  );

  const {
    conversations: dmConversations,
    dmLoading,
    openDM,
    markRead,
    onDMMessage,
    totalUnread,
  } = useDMs(user!.token, user!.id);

  const {
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
  } = useMessages({
    channel,
    communityId: activeCommunityId,
    send: sendViaRef,
    currentUserId: user!.id,
    currentChannelRef,
    userRef,
    mutedChannels,
  });

  const { send, disconnect, status, reconnect } = useWebSocket(
    user!.token,
    (data) => {
      if (handlePresenceMessage(data)) return;
      if (
        data.type === "channel_unread_counts" ||
        data.type === "channel_unread_increment"
      ) {
        handleUnreadMessage(data);
        return;
      }
      if (
        data.type === "message" &&
        typeof data.message?.channel_id === "string" &&
        data.message.channel_id.startsWith("dm:")
      ) {
        onDMMessage(
          data.message.channel_id,
          data.message.content,
          data.message.user_id,
          data.message.created_at,
        );
        return;
      }
      // When an admin deletes a community, leave voice if in it and remove from UI.
      if (data.type === "community_deleted") {
        if (voiceRef.current?.inVoice) voiceRef.current.leaveVoice();
        removeCommunity(data.communityId);
        return;
      }
      handleMessage(data);
    },
  );

  sendRef.current = send;

  const voice = useVoice(user!.token, send);

  // Keep voiceRef in sync so the WS callback above can access voice state.
  voiceRef.current = { inVoice: voice.inVoice, leaveVoice: voice.leaveVoice };

  const {
    activeDMConv,
    setActiveDMConv,
    handleOpenDM,
    handleSelectDM,
    handleTabToDMs,
    handleTabToChannels,
  } = useDMState({
    send,
    openDM,
    markRead,
    currentChannelRef,
    dmConversations,
  });

  const handleSelectChannel = useCallback(
    (id: number, name: string) => {
      setChannel(id);
      setChannelName(name);
      markChannelRead(String(id));
      clearMention(String(id));
    },
    [markChannelRead, clearMention],
  );

  useChatKeyboard({
    activeTab,
    textChannelNamesRef,
    currentChannelRef,
    onOpenSearch: () => setShowSearch((s) => !s),
    onSelectChannel: handleSelectChannel,
  });

  useAfkDetector(voice.inVoice, voice.voiceChannel, voice.joinAfk);

  const handleStatusChange = useCallback(
    (status: UserStatus, statusText?: string | null) => {
      setMyStatus(status);
      setMyStatusText(statusText ?? null);
      send({ type: "set_status", status, statusText: statusText ?? null });
    },
    [send],
  );

  const handleLogout = useCallback(async () => {
    disconnect();
    await new Promise((r) => setTimeout(r, 200));
    await logout();
  }, [disconnect, logout]);

  useEffect(() => {
    if (!user?.token) return;
    axios
      .get(`${config.HTTP}/api/users/avatars`, {
        headers: { Authorization: `Bearer ${user.token}` },
      })
      .then(({ data }) => {
        const map: Record<number, string | null> = {};
        for (const u of data) map[u.id] = u.avatar;
        for (const [id, avatar] of Object.entries(map)) {
          updateAvatarMap(Number(id), avatar as string | null);
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!user?.token || !activeCommunityId) return;
    if (lastFetchedCommunityRef.current === activeCommunityId) return;
    lastFetchedCommunityRef.current = activeCommunityId;
    axios
      .get(`${config.HTTP}/api/communities/${activeCommunityId}/members`, {
        headers: { Authorization: `Bearer ${user.token}` },
      })
      .then(({ data }) =>
        setAllUsers(
          data.map((m: any) => ({ id: m.user_id, username: m.username })),
        ),
      )
      .catch(() => {});
  });

  return (
    <div className={styles.root}>
      <TitleBar />
      <ConnectionModal status={status} onRetry={reconnect} />
      {loading ? null : communities.length === 0 ? (
        <WelcomeScreen
          username={user!.nickname ?? user!.username}
          onCommunityCreated={addCommunity}
          onLogout={handleLogout}
        />
      ) : (
        <div className={styles.body}>
          <CommunitySwitcher
            communities={communities}
            activeCommunityId={activeCommunityId}
            onSwitch={handleSwitchCommunity}
            onCommunityCreated={addCommunity}
            onCommunityRemoved={removeCommunity}
            userId={user!.id}
          />
          <ResizableSidebar>
            <Sidebar
              mentionedChannels={mentionedChannels}
              isScreenSharing={voice.isScreenSharing}
              onStartScreenShare={voice.startScreenShare}
              onStopScreenShare={voice.stopScreenShare}
              joinAfk={voice.joinAfk}
              inVoice={voice.inVoice}
              setMuted={voice.setMuted}
              setAllParticipantsDeafened={voice.setAllParticipantsDeafened}
              channel={channel}
              setChannel={handleSelectChannel}
              unreadCounts={unreadCounts}
              voiceChannel={voice.voiceChannel}
              participants={voice.participants}
              joinVoice={voice.joinVoice}
              leaveVoice={voice.leaveVoice}
              logout={handleLogout}
              username={user!.username}
              nickname={user!.nickname ?? null}
              userId={user!.id}
              token={user!.token}
              onlineUsers={onlineUsers}
              onSearchOpen={() => setShowSearch(true)}
              role={user!.role ?? "user"}
              customRoleName={user!.customRoleName ?? null}
              avatar={user!.avatar ?? null}
              onNicknameChange={updateNickname}
              onAvatarChange={(avatar) => {
                updateAvatar(avatar);
                if (user?.id) updateAvatarMap(user.id, avatar);
              }}
              voiceOccupancy={voiceOccupancy}
              dmConversations={dmConversations}
              dmLoading={false}
              activeDMChannel={activeDMConv?.channelId ?? null}
              totalUnread={totalUnread}
              activeTab={activeTab}
              onTabChange={(tab) => {
                setActiveTab(tab);
                if (tab === "channels") handleTabToChannels(channel);
                if (tab === "dms") handleTabToDMs(channel);
              }}
              onSelectDM={(conv) => {
                setActiveDMConv(conv);
                handleSelectDM(conv);
              }}
              onTextChannelNamesChange={(names) => {
                textChannelNamesRef.current = names;
              }}
              currentStatus={myStatus}
              currentStatusText={myStatusText}
              onStatusChange={handleStatusChange}
              participantVolumes={voice.participantVolumes}
              selfVolume={voice.selfVolume}
              setParticipantVolume={voice.setParticipantVolume}
              setSelfVolume={voice.setSelfVolume}
              activeSpeakers={new Set()}
              mutedChannels={mutedChannels}
              onToggleMute={toggleMute}
              communityId={activeCommunityId}
            />
          </ResizableSidebar>

          <ChatMain
            token={user!.token}
            isAdmin={user!.role === "admin"}
            onPin={(messageId) =>
              send({ type: "pin_message", messageId, channelId: channel })
            }
            onUnpin={(messageId) =>
              send({ type: "unpin_message", messageId, channelId: channel })
            }
            channel={channel}
            channelName={channelName}
            communityId={activeCommunityId}
            activeTab={activeTab}
            activeDMConv={activeDMConv}
            onlineUsers={onlineUsers}
            messagesContainerRef={messagesContainerRef}
            bottomRef={bottomRef}
            groupedMessages={groupedMessages}
            loadingMore={loadingMore}
            hasMore={hasMore}
            hoveredMsgId={hoveredMsgId}
            pickerMsgId={pickerMsgId}
            currentUsername={
              userRef.current!.nickname || userRef.current!.username
            }
            currentUserId={user!.id}
            avatarMap={avatarMap}
            onScroll={handleScroll}
            onHover={setHoveredMsgId}
            onPickerToggle={setPickerMsgId}
            onReact={handleReact}
            onReply={setReplyTo}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onUsernameClick={openPopover}
            resolveNickname={resolveNickname}
            typers={typers}
            send={send}
            replyTo={replyTo}
            onCancelReply={() => setReplyTo(null)}
            allUsers={allUsers}
          />

          <MemberList
            onlineUsers={onlineUsers}
            allUsers={allUsers}
            currentUserId={user!.id}
            onUserClick={openPopover}
          />
        </div>
      )}

      {popover && (
        <UserPopover
          userId={popover.userId}
          username={popover.username}
          isSelf={popover.userId === user!.id}
          anchorEl={popover.el}
          token={user!.token}
          onClose={closePopover}
          onOpenDM={async (userId) => {
            closePopover();
            const channelId = await handleOpenDM(userId);
            if (channelId) setActiveTab("dms");
          }}
        />
      )}

      {(voice.localScreenShareTrack || voice.screenShareTrack) && (
        <ScreenShareViewer
          track={(voice.localScreenShareTrack || voice.screenShareTrack)!}
          participantName={
            voice.isScreenSharing
              ? user!.username
              : (voice.screenShareParticipant ?? "")
          }
          isLocal={voice.isScreenSharing}
          onClose={voice.stopScreenShare}
        />
      )}

      {voice.pickerSources && (
        <ScreenPickerModal
          sources={voice.pickerSources}
          onSelect={voice.selectSource}
          onCancel={voice.cancelPicker}
        />
      )}

      {showSearch && (
        <SearchOverlay
          token={user!.token}
          currentChannel={String(channel ?? "")}
          onJumpTo={(channelId) => setChannel(Number(channelId))}
          onClose={() => setShowSearch(false)}
        />
      )}
    </div>
  );
}
