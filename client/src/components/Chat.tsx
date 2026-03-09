import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useWebSocket } from "../hooks/useWebSocket";
import { useVoice } from "../hooks/useVoice";
import { useTheme } from "../context/ThemeContext";
import { useLocalNicknames } from "../context/LocalNicknameContext";
import { useMessages } from "../hooks/useMessages";
import Sidebar from "./Sidebar";
import MessageInput from "./MessageInput";
import TypingIndicator from "./TypingIndicator";
import TitleBar from "./TitleBar";
import VoiceIndicator from "./VoiceIndicator";
import SearchOverlay from "./SearchOverlay";
import UserPopover from "./UserPopover";
import MessageItem from "./MessageItem";
import ResizableSidebar from "./ResizableSidebar";
import axios from "axios";
import { useDMs } from "../hooks/useDMs";
import DMHeader from "./DMHeader";
import config from "../config";
import type { OnlineUser, DMConversation } from "../types";

export default function Chat() {
  const { user, logout, updateNickname, updateAvatar } = useAuth();

  const { resolve, load, nicknames } = useLocalNicknames();

  // Wrap resolve to handle own nickname (local nicknames can't be set for yourself,
  // so we fall back to user.nickname from AuthContext for the current user)
  const resolveNickname = useCallback((userId: number, serverDisplayName: string): string => {
    if (userId === user!.id) return userRef.current?.nickname || serverDisplayName;
    return resolve(userId, serverDisplayName);
  }, [resolve, nicknames]); // eslint-disable-line react-hooks/exhaustive-deps
  const { theme } = useTheme();

  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  const [channel, setChannel] = useState("general");
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [voiceOccupancy, setVoiceOccupancy] = useState<Record<string, string[]>>({});
  const [showSearch, setShowSearch] = useState(false);
  const [pickerMsgId, setPickerMsgId] = useState<number | null>(null);
  const [hoveredMsgId, setHoveredMsgId] = useState<number | null>(null);
  const [replyTo, setReplyTo] = useState<import("../types").GroupedMessage | null>(null);
  const [popover, setPopover] = useState<{ userId: number; username: string; el: HTMLElement } | null>(null);
  const [avatarMap, setAvatarMap] = useState<Record<number, string | null>>({});
  const [activeTab, setActiveTab] = useState<"channels" | "dms">("channels");
  const [activeDMConv, setActiveDMConv] = useState<DMConversation | null>(null);

  const { conversations: dmConversations, dmLoading, openDM, markRead, onDMMessage, totalUnread } = useDMs(user!.token, user!.id);

  // Ref that Sidebar keeps populated with the current ordered text channel names.
  // Used by the Alt+↑/↓ keyboard handler below without needing to lift state.
  const textChannelNamesRef = useRef<string[]>([]);

  const currentChannelRef = useRef(channel);
  useEffect(() => { currentChannelRef.current = channel; }, [channel]);

  const rejoinVoiceRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (user?.token) load(user.token);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user?.token) return;
    axios.get(`${config.HTTP}/api/users/avatars`, { headers: { Authorization: `Bearer ${user.token}` } })
      .then(({ data }) => {
        const map: Record<number, string | null> = {};
        for (const u of data) map[u.id] = u.avatar;
        setAvatarMap(map);
      }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl/Cmd+K — toggle search
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setShowSearch((s) => !s);
        return;
      }

      // Alt+↑/↓ — navigate text channels (channels tab only, not in input)
      if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        if (activeTab !== "channels") return;

        const names = textChannelNamesRef.current;
        if (names.length === 0) return;

        e.preventDefault();
        const cur = currentChannelRef.current;
        const idx = names.indexOf(cur);
        const next =
          e.key === "ArrowDown"
            ? names[(idx + 1) % names.length]
            : names[(idx - 1 + names.length) % names.length];
        setChannel(next);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeTab]); // activeTab needed so the guard works correctly

  const { send, disconnect } = useWebSocket(
    user!.token,
    (data) => {
      if (data.type?.startsWith("voice_")) {
        if (data.type === "voice_state") {
          setVoiceOccupancy(data.channels);
          return;
        }
        if (data.type === "voice_presence_update") {
          setVoiceOccupancy((prev) => {
            const current = prev[data.channelId] ?? [];
            if (data.action === "join") {
              return {
                ...prev,
                [data.channelId]: current.includes(data.username)
                  ? current
                  : [...current, data.username],
              };
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
        handleVoiceMessage(data);
      }
      else if (data.type === "presence") setOnlineUsers(data.users);
      else if (data.type === "avatar_update") {
        setAvatarMap(prev => ({ ...prev, [data.userId]: data.avatar }));
      }
      else {
        // If it's a DM message, update DM conversation list
        if (data.type === "message" && typeof data.message?.channel_id === "string" && data.message.channel_id.startsWith("dm:")) {
          onDMMessage(data.message.channel_id, data.message.content, data.message.user_id, data.message.created_at);
          return;
        }
        handleMessage(data);
      }
    },
    () => rejoinVoiceRef.current(),
  );

  const {
    groupedMessages, typers, hasMore, loadingMore,
    handleMessage, handleScroll, handleReact, handleEdit, handleDelete, bottomRef, messagesContainerRef,
  } = useMessages({ channel, send, currentUserId: user!.id, currentChannelRef, userRef });

  const {
    inVoice, voiceChannel, participants,
    participantVolumes, selfVolume,
    joinVoice, leaveVoice, rejoinVoice,
    handleVoiceMessage, localStream,
    setParticipantVolume, setSelfVolume,
  } = useVoice(send, user!.id);

  useEffect(() => {
    rejoinVoiceRef.current = rejoinVoice;
  }, [rejoinVoice]);

  const handleLogout = useCallback(async () => {
    disconnect();
    await new Promise((r) => setTimeout(r, 200));
    await logout();
  }, [disconnect, logout]);

  const handleJumpTo = useCallback((channelId: string) => {
    setChannel(channelId);
  }, []);

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
    <div style={{
      display: "flex", flexDirection: "column",
      height: "100vh", width: "100vw",
      background: theme.background, color: theme.text,
      fontFamily: "'Rajdhani', sans-serif",
    }}>
      <TitleBar />

      <div style={{ display: "flex", flex: 1, overflow: "hidden", alignItems: "stretch" }}>
        <ResizableSidebar>
          <Sidebar
            channel={channel}
            setChannel={setChannel}
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
              if (tab === "channels") currentChannelRef.current = channel;
            }}
            onSelectDM={(conv) => {
              setActiveDMConv(conv);
              handleSelectDM(conv);
            }}
            onTextChannelNamesChange={(names) => { textChannelNamesRef.current = names; }}
          />
        </ResizableSidebar>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
          {/* Header — DM or channel */}
          {activeTab === "dms" && activeDMConv ? (
            <DMHeader conversation={activeDMConv} onlineUsers={onlineUsers} />
          ) : (
            <div style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              padding: "0.75rem 1.5rem", borderBottom: "1px solid",
              background: theme.surface, borderColor: theme.border, flexShrink: 0,
            }}>
              <span style={{ color: theme.textDim }}>#</span>
              <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "1rem", color: theme.primary }}>
                {channel}
              </span>
              <div style={{ flex: 1, height: "1px", background: `linear-gradient(90deg, ${theme.border}, transparent)` }} />
              <span style={{ fontSize: "0.72rem", fontFamily: "'Share Tech Mono', monospace", color: theme.textDim, flexShrink: 0 }}>
                <span style={{ color: "#4ade80", marginRight: "4px" }}>●</span>
                {onlineUsers.length} online
              </span>
            </div>
          )}

          {/* Messages */}
          <div ref={messagesContainerRef} style={{ flex: 1, overflowY: "auto", padding: "0 1rem 0.5rem" }} onScroll={handleScroll}>
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
                key={msg.id}
                msg={msg}
                hoveredMsgId={hoveredMsgId}
                pickerMsgId={pickerMsgId}
                currentUsername={userRef.current!.nickname || userRef.current!.username}
                onHover={setHoveredMsgId}
                onPickerToggle={setPickerMsgId}
                onReact={handleReact}
                onReply={setReplyTo}
                onEdit={handleEdit}
                onDelete={handleDelete}
                currentUserId={user!.id}
                avatarMap={avatarMap}
                onUsernameClick={(userId, username, el) => setPopover({ userId, username, el })}
                resolveNickname={resolveNickname}
              />
            ))}
            <div ref={bottomRef} />
          </div>

          <TypingIndicator typers={Object.values(typers)} />
          {inVoice && (
            <VoiceIndicator
              inVoice={inVoice}
              voiceChannel={voiceChannel}
              participants={participants}
              participantVolumes={participantVolumes}
              selfVolume={selfVolume}
              leaveVoice={leaveVoice}
              localStream={localStream}
              setParticipantVolume={setParticipantVolume}
              setSelfVolume={setSelfVolume}
            />
          )}
          {/* FIX 1: pass onlineUsers so @mention autocomplete has candidates */}
          <MessageInput
            send={send}
            channel={activeTab === "dms" && activeDMConv ? activeDMConv.channelId : channel}
            replyTo={replyTo}
            onCancelReply={() => setReplyTo(null)}
            onlineUsers={onlineUsers}
          />
        </div>
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
          onJumpTo={handleJumpTo}
          onClose={() => setShowSearch(false)}
        />
      )}

      <style>{`
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${theme.primaryDim}; border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: ${theme.primary}; }
      `}</style>
    </div>
  );
}