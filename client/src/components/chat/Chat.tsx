import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { useWebSocket } from "../../hooks/useWebSocket";
import { useVoice } from "../../hooks/useVoice";
import { useLocalNicknames } from "../../context/LocalNicknameContext";
import { useMessages } from "../../hooks/useMessages";
import { useDMs } from "../../hooks/useDMs";
import axios from "axios";
import config from "../../config";

import TitleBar from "../ui/TitleBar";
import ResizableSidebar from "../sidebar/ResizableSidebar";
import Sidebar from "../sidebar/Sidebar";
import ChatMain from "./ChatMain";
import MemberList from "../ui/MemberList";
import SearchOverlay from "../overlays/SearchOverlay";
import UserPopover from "../overlays/UserPopover";

import type { OnlineUser, DMConversation, GroupedMessage, UserStatus } from "../../types";
import { useUnreadChannels } from "../../hooks/useUnreadChannels";
import styles from "./Chat.module.css";

export default function Chat() {
  const { user, logout, updateNickname, updateAvatar } = useAuth();
  const { resolve, load, nicknames } = useLocalNicknames();
  const { unreadCounts, handleUnreadMessage, markChannelRead } = useUnreadChannels(user!.token);

  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  const resolveNickname = useCallback((userId: number, serverDisplayName: string): string => {
    if (userId === user!.id) return userRef.current?.nickname || serverDisplayName;
    return resolve(userId, serverDisplayName);
  }, [resolve, nicknames]); // eslint-disable-line react-hooks/exhaustive-deps

  const [channel, setChannel] = useState("general");
  const handleSelectChannel = useCallback((name: string) => {
    setChannel(name);
    markChannelRead(name);
  }, [markChannelRead]);

  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [voiceOccupancy, setVoiceOccupancy] = useState<Record<string, string[]>>({});
  const [showSearch, setShowSearch] = useState(false);
  const [pickerMsgId, setPickerMsgId] = useState<number | null>(null);
  const [hoveredMsgId, setHoveredMsgId] = useState<number | null>(null);
  const [replyTo, setReplyTo] = useState<GroupedMessage | null>(null);
  const [popover, setPopover] = useState<{ userId: number; username: string; el: HTMLElement } | null>(null);
  const [avatarMap, setAvatarMap] = useState<Record<number, string | null>>({});
  const [activeTab, setActiveTab] = useState<"channels" | "dms">("channels");
  const [activeDMConv, setActiveDMConv] = useState<DMConversation | null>(null);
  const [myStatus, setMyStatus] = useState<UserStatus>("online");
  const [myStatusText, setMyStatusText] = useState<string | null>(null);

  const { conversations: dmConversations, dmLoading, openDM, markRead, onDMMessage, totalUnread } = useDMs(user!.token, user!.id);

  const textChannelNamesRef = useRef<string[]>([]);
  const currentChannelRef = useRef(channel);
  useEffect(() => { currentChannelRef.current = channel; }, [channel]);

  useEffect(() => { if (user?.token) load(user.token); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user?.token) return;
    axios.get(`${config.HTTP}/api/users/avatars`, { headers: { Authorization: `Bearer ${user.token}` } })
      .then(({ data }) => {
        const map: Record<number, string | null> = {};
        for (const u of data) map[u.id] = u.avatar;
        setAvatarMap(map);
      }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setShowSearch((s) => !s);
        return;
      }
      if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        if (activeTab !== "channels") return;
        const names = textChannelNamesRef.current;
        if (names.length === 0) return;
        e.preventDefault();
        const cur = currentChannelRef.current;
        const idx = names.indexOf(cur);
        const next = e.key === "ArrowDown"
          ? names[(idx + 1) % names.length]
          : names[(idx - 1 + names.length) % names.length];
        handleSelectChannel(next);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeTab, handleSelectChannel]);

  const { send, disconnect } = useWebSocket(
    user!.token,
    (data) => {
      if (data.type?.startsWith("voice_")) {
        if (data.type === "voice_state") { setVoiceOccupancy(data.channels); return; }
        if (data.type === "voice_presence_update") {
          setVoiceOccupancy((prev) => {
            const current = prev[data.channelId] ?? [];
            if (data.action === "join") {
              return { ...prev, [data.channelId]: current.includes(data.username) ? current : [...current, data.username] };
            } else {
              const updated = current.filter((u) => u !== data.username);
              const next = { ...prev };
              if (updated.length === 0) delete next[data.channelId];
              else next[data.channelId] = updated;
              return next;
            }
          });
          return;
        }
      } else if (data.type === "presence") {
        setOnlineUsers(data.users);
      } else if (data.type === "channel_unread_counts" || data.type === "channel_unread_increment") {
        handleUnreadMessage(data);
      } else if (data.type === "avatar_update") {
        setAvatarMap(prev => ({ ...prev, [data.userId]: data.avatar }));
      } else {
        if (data.type === "message" && typeof data.message?.channel_id === "string" && data.message.channel_id.startsWith("dm:")) {
          onDMMessage(data.message.channel_id, data.message.content, data.message.user_id, data.message.created_at);
          return;
        }
        handleMessage(data);
      }
    },
  );

  const handleStatusChange = useCallback((status: UserStatus, statusText?: string | null) => {
    setMyStatus(status);
    setMyStatusText(statusText ?? null);
    send({ type: "set_status", status, statusText: statusText ?? null });
  }, [send]);

  const {
    groupedMessages, typers, hasMore, loadingMore,
    handleMessage, handleScroll, handleReact, handleEdit, handleDelete, bottomRef, messagesContainerRef,
  } = useMessages({ channel, send, currentUserId: user!.id, currentChannelRef, userRef });

  const {
    inVoice, voiceChannel, participants, participantVolumes, selfVolume,
    joinVoice, leaveVoice, setParticipantVolume, setSelfVolume,
    setMuted, setAllParticipantsDeafened,
  } = useVoice(user!.token, send);

  const handleLogout = useCallback(async () => {
    disconnect();
    await new Promise((r) => setTimeout(r, 200));
    await logout();
  }, [disconnect, logout]);

  const handleOpenDM = useCallback(async (userId: number) => {
    const channelId = await openDM(userId);
    if (!channelId) return;
    setActiveTab("dms");
    markRead(channelId);
    currentChannelRef.current = channelId;
    send({ type: "join", channelId });
  }, [openDM, markRead, send, currentChannelRef]);

  const handleSelectDM = useCallback((conv: DMConversation) => {
    setActiveDMConv(conv);
    markRead(conv.channelId);
    currentChannelRef.current = conv.channelId;
    send({ type: "join", channelId: conv.channelId });
  }, [markRead, send, currentChannelRef]);

  return (
    <div className={styles.root}>
      <TitleBar />

      <div className={styles.body}>
        <ResizableSidebar>
          <Sidebar
            channel={channel}
            setChannel={handleSelectChannel}
            unreadCounts={unreadCounts}
            voiceChannel={voiceChannel}
            participants={participants}
            joinVoice={joinVoice}
            leaveVoice={leaveVoice}
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
              if (user?.id) setAvatarMap(prev => ({ ...prev, [user.id]: avatar }));
            }}
            voiceOccupancy={voiceOccupancy}
            dmConversations={dmConversations}
            dmLoading={false}
            activeDMChannel={activeDMConv?.channelId ?? null}
            totalUnread={totalUnread}
            activeTab={activeTab}
            onTabChange={(tab) => {
              setActiveTab(tab);
              if (tab === "channels") {
                currentChannelRef.current = channel;
                send({ type: "join", channelId: channel });
              }
              if (tab === "dms") {
                const firstConv = activeDMConv ?? dmConversations[0] ?? null;
                if (firstConv && !activeDMConv) {
                  setActiveDMConv(firstConv);
                  markRead(firstConv.channelId);
                  currentChannelRef.current = firstConv.channelId;
                  send({ type: "join", channelId: firstConv.channelId });
                } else if (activeDMConv) {
                  send({ type: "join", channelId: activeDMConv.channelId });
                }
              }
            }}
            onSelectDM={(conv) => { setActiveDMConv(conv); handleSelectDM(conv); }}
            onTextChannelNamesChange={(names) => { textChannelNamesRef.current = names; }}
            currentStatus={myStatus}
            currentStatusText={myStatusText}
            onStatusChange={handleStatusChange}
          />
        </ResizableSidebar>

        <ChatMain
          token={user!.token}
          isAdmin={user!.role === "admin"}
          onPin={(messageId) => send({ type: "pin_message", messageId, channelId: channel })}
          onUnpin={(messageId) => send({ type: "unpin_message", messageId, channelId: channel })}
          channel={channel}
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
          currentUsername={userRef.current!.nickname || userRef.current!.username}
          currentUserId={user!.id}
          avatarMap={avatarMap}
          onScroll={handleScroll}
          onHover={setHoveredMsgId}
          onPickerToggle={setPickerMsgId}
          onReact={handleReact}
          onReply={setReplyTo}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onUsernameClick={(userId, username, el) => setPopover({ userId, username, el })}
          resolveNickname={resolveNickname}
          typers={typers}
          inVoice={inVoice}
          voiceChannel={voiceChannel}
          participants={participants}
          participantVolumes={participantVolumes}
          selfVolume={selfVolume}
          leaveVoice={leaveVoice}
          setParticipantVolume={setParticipantVolume}
          setSelfVolume={setSelfVolume}
          send={send}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          setAllParticipantsDeafened={setAllParticipantsDeafened}
          setMuted={setMuted}
        />

        <MemberList
          onlineUsers={onlineUsers}
          currentUserId={user!.id}
          onUserClick={(userId, username, el) => setPopover({ userId, username, el })}
        />
      </div>

      {popover && (
        <UserPopover
          userId={popover.userId}
          username={popover.username}
          isSelf={popover.userId === user!.id}
          anchorEl={popover.el}
          onClose={() => setPopover(null)}
          onOpenDM={(userId) => { setPopover(null); handleOpenDM(userId); }}
        />
      )}

      {showSearch && (
        <SearchOverlay
          token={user!.token}
          currentChannel={channel}
          onJumpTo={(channelId) => setChannel(channelId)}
          onClose={() => setShowSearch(false)}
        />
      )}
    </div>
  );
}