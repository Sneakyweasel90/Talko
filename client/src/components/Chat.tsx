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
import type { OnlineUser } from "../types";

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

  const currentChannelRef = useRef(channel);
  useEffect(() => { currentChannelRef.current = channel; }, [channel]);

  const rejoinVoiceRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (user?.token) load(user.token);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setShowSearch((s) => !s);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

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
      else handleMessage(data);
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
            avatar={user!.avatar ?? null}
            onNicknameChange={updateNickname}
            onAvatarChange={updateAvatar}
            voiceOccupancy={voiceOccupancy}
          />
        </ResizableSidebar>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
          {/* Channel header */}
          <div style={{
            display: "flex", alignItems: "center", gap: "0.5rem",
            padding: "0.75rem 1.5rem", borderBottom: "1px solid",
            background: theme.surface, borderColor: theme.border,
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
                  — BEGINNING OF #{channel} —
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
          <MessageInput send={send} channel={channel} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} />
        </div>
      </div>

      {popover && (
        <UserPopover
          userId={popover.userId}
          username={popover.username}
          isSelf={popover.userId === user!.id}
          anchorEl={popover.el}
          onClose={() => setPopover(null)}
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