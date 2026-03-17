import ChannelHeader from "./ChannelHeader";
import MessageFeed from "./MessageFeed";
import DMHeader from "../dm/DMHeader";
import TypingIndicator from "../messages/TypingIndicator";
import VoiceIndicator from "../voice/VoiceIndicator";
import MessageInput from "../messages/MessageInput";
import type { RefObject, MutableRefObject } from "react";
import type { GroupedMessage, DMConversation, OnlineUser } from "../../types";
import styles from "./ChatMain.module.css";

interface Props {
  channel: string;
  activeTab: "channels" | "dms";
  activeDMConv: DMConversation | null;
  onlineUsers: OnlineUser[];
  token: string;
  isAdmin: boolean;
  onPin: (messageId: number) => void;
  onUnpin: (messageId: number) => void;
  messagesContainerRef: RefObject<HTMLDivElement>;
  bottomRef: RefObject<HTMLDivElement>;
  groupedMessages: GroupedMessage[];
  loadingMore: boolean;
  hasMore: boolean;
  hoveredMsgId: number | null;
  pickerMsgId: number | null;
  currentUsername: string;
  currentUserId: number;
  avatarMap: Record<number, string | null>;
  onScroll: () => void;
  onHover: (id: number | null) => void;
  onPickerToggle: (id: number | null) => void;
  onReact: (messageId: number, emoji: string) => void;
  onReply: (msg: GroupedMessage) => void;
  onEdit: (messageId: number, content: string) => void;
  onDelete: (messageId: number) => void;
  onUsernameClick: (userId: number, username: string, el: HTMLElement) => void;
  resolveNickname: (userId: number, username: string) => string;
  typers: Record<string, string>;
  inVoice: boolean;
  voiceChannel: string | null;
  participants: string[];
  participantVolumes: Record<string, number>;
  selfVolume: number;
  leaveVoice: () => void;
  localStream: MutableRefObject<MediaStream | null>;
  setParticipantVolume: (username: string, volume: number) => void;
  setSelfVolume: (volume: number) => void;
  send: (data: object) => void;
  replyTo: GroupedMessage | null;
  onCancelReply: () => void;
  setAllParticipantsDeafened: (deafened: boolean) => void;
}

export default function ChatMain({
  channel, activeTab, activeDMConv, onlineUsers,
  token, isAdmin, onPin, onUnpin,
  messagesContainerRef, bottomRef, groupedMessages,
  loadingMore, hasMore,
  hoveredMsgId, pickerMsgId, currentUsername, currentUserId, avatarMap,
  onScroll, onHover, onPickerToggle, onReact, onReply, onEdit, onDelete,
  onUsernameClick, resolveNickname,
  typers, setAllParticipantsDeafened,
  inVoice, voiceChannel, participants, participantVolumes, selfVolume,
  leaveVoice, localStream, setParticipantVolume, setSelfVolume,
  send, replyTo, onCancelReply,
}: Props) {
  return (
    <div className={styles.root}>
      {activeTab === "dms" && activeDMConv
        ? <DMHeader conversation={activeDMConv} onlineUsers={onlineUsers} />
        : <ChannelHeader
            channel={channel}
            onlineCount={onlineUsers.length}
            token={token}
            isAdmin={isAdmin}
            onUnpin={onUnpin}
          />
      }

      <MessageFeed
        messagesContainerRef={messagesContainerRef}
        bottomRef={bottomRef}
        onScroll={onScroll}
        groupedMessages={groupedMessages}
        loadingMore={loadingMore}
        hasMore={hasMore}
        activeTab={activeTab}
        activeDMConv={activeDMConv}
        channel={channel}
        hoveredMsgId={hoveredMsgId}
        pickerMsgId={pickerMsgId}
        currentUsername={currentUsername}
        currentUserId={currentUserId}
        avatarMap={avatarMap}
        onHover={onHover}
        onPickerToggle={onPickerToggle}
        onReact={onReact}
        onReply={onReply}
        onEdit={onEdit}
        onDelete={onDelete}
        onUsernameClick={onUsernameClick}
        resolveNickname={resolveNickname}
        isAdmin={isAdmin}
        onPin={onPin}
      />

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
          setAllParticipantsDeafened={setAllParticipantsDeafened}
        />
      )}

      <MessageInput
        send={send}
        channel={activeTab === "dms" && activeDMConv ? activeDMConv.channelId : channel}
        replyTo={replyTo}
        onCancelReply={onCancelReply}
        onlineUsers={onlineUsers}
      />
    </div>
  );
}