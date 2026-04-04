import Avatar from "../ui/Avatar";
import type { Channel } from "../../types";
import styles from "./ChannelList.module.css";
import { useState, useEffect } from "react";

interface CreateChannelInputProps {
  type: "text" | "voice";
  value: string;
  creating: boolean;
  onChange: (val: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

function CreateChannelInput({
  type,
  value,
  creating,
  onChange,
  onSubmit,
  onCancel,
}: CreateChannelInputProps) {
  return (
    <div className={styles.createRow}>
      <input
        autoFocus
        className={styles.createInput}
        placeholder={type === "voice" ? "channel-name" : "channel-name"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit();
          if (e.key === "Escape") onCancel();
        }}
      />
      <button
        className={styles.createConfirmBtn}
        onClick={onSubmit}
        disabled={creating}
      >
        ✓
      </button>
    </div>
  );
}

interface ChannelListProps {
  textChannels: Channel[];
  voiceChannels: Channel[];
  activeChannel: number | null; // now an ID
  voiceChannel: string | null;
  participants: string[];
  username: string;
  newChannelName: string;
  creating: boolean;
  showCreateText: boolean;
  showCreateVoice: boolean;
  unreadCounts: Record<string, number>; // keyed by channel id as string
  voiceOccupancy: Record<string, string[]>;
  onSelectChannel: (id: number, name: string) => void;
  onJoinVoice: (name: string) => void;
  onLeaveVoice: () => void;
  onDeleteChannel: (id: number, e: React.MouseEvent) => void;
  onToggleCreateText: () => void;
  onToggleCreateVoice: () => void;
  onChannelNameChange: (val: string) => void;
  onCreateChannel: (type: "text" | "voice") => void;
  onCancelCreate: () => void;
  afkChannel: Channel | null;
  onJoinAfk: () => void;
  mentionedChannels: Set<string>;
  mutedChannels: Set<string>;
  onToggleMute: (name: string) => void;
  activeSpeakers: Set<string>;
  participantVolumes: Record<string, number>;
  setParticipantVolume: (username: string, volume: number) => void;
}

export default function ChannelList({
  unreadCounts,
  textChannels,
  voiceChannels,
  activeChannel,
  voiceChannel,
  participants,
  username,
  newChannelName,
  creating,
  showCreateText,
  showCreateVoice,
  voiceOccupancy,
  onSelectChannel,
  onJoinVoice,
  onLeaveVoice,
  onDeleteChannel,
  onToggleCreateText,
  onToggleCreateVoice,
  onChannelNameChange,
  onCreateChannel,
  onCancelCreate,
  afkChannel,
  onJoinAfk,
  mentionedChannels,
  mutedChannels,
  onToggleMute,
  activeSpeakers,
  participantVolumes,
  setParticipantVolume,
}: ChannelListProps) {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    channelId: number;
    channelName: string;
  } | null>(null);

  const [volumePopout, setVolumePopout] = useState<string | null>(null);

  useEffect(() => {
    const handler = () => {
      setContextMenu(null);
      setVolumePopout(null);
    };
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, []);

  return (
    <>
      {/* Text channels header */}
      <div className={styles.sectionHeader}>
        <span className={styles.sectionLabel}>// TEXT CHANNELS</span>
        <button
          className={styles.addBtn}
          onClick={onToggleCreateText}
          title="Create text channel"
        >
          +
        </button>
      </div>

      {showCreateText && (
        <CreateChannelInput
          type="text"
          value={newChannelName}
          creating={creating}
          onChange={onChannelNameChange}
          onSubmit={() => onCreateChannel("text")}
          onCancel={onCancelCreate}
        />
      )}

      {textChannels.map((ch) => {
        const isActive = ch.id === activeChannel;
        const muted = mutedChannels.has(ch.name);
        const unread = muted ? 0 : (unreadCounts[String(ch.id)] ?? 0);
        const hasUnread = unread > 0 && !isActive;
        const hasMention = !muted && mentionedChannels.has(String(ch.id));
        return (
          <div
            key={ch.id}
            onClick={() => onSelectChannel(ch.id, ch.name)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({
                x: e.clientX,
                y: e.clientY,
                channelId: ch.id,
                channelName: ch.name,
              });
            }}
            className={`${styles.channel} ${isActive ? styles.active : ""} ${hasUnread ? styles.hasUnread : ""} ${hasMention ? styles.hasMention : ""} ${muted ? styles.muted : ""}`}
          >
            <span className={styles.channelHash}>#</span>
            <span className={styles.channelName}>{ch.name}</span>
            {muted && (
              <span className={styles.muteIcon} title="Muted">
                🔇
              </span>
            )}
            {hasMention && !isActive && (
              <span className={styles.mentionBadge}>@</span>
            )}
            {hasUnread && !hasMention && (
              <span className={styles.unreadBadge}>
                {unread > 99 ? "99+" : unread}
              </span>
            )}
            {isActive && <div className={styles.activeDot} />}
            {ch.created_by !== null && (
              <span
                className={styles.deleteBtn}
                onClick={(e) => onDeleteChannel(ch.id, e)}
                title="Delete channel"
              >
                ×
              </span>
            )}
          </div>
        );
      })}

      {/* Voice channels header */}
      <div className={styles.sectionHeader}>
        <span className={styles.sectionLabel}>// VOICE CHANNELS</span>
        <button
          className={styles.addBtn}
          onClick={onToggleCreateVoice}
          title="Create voice channel"
        >
          +
        </button>
      </div>

      {/* AFK channel */}
      {afkChannel && (
        <div className={styles.voiceChannelWrap}>
          <div className={styles.voiceChannelRow}>
            <div
              onClick={voiceChannel === "voice-afk" ? onLeaveVoice : onJoinAfk}
              className={`${styles.channel} ${styles.voiceChannelMain} ${voiceChannel === "voice-afk" ? styles.active : ""}`}
            >
              <span className={styles.channelVoiceIcon}>💤</span>
              <span className={styles.channelName}>AFK</span>
              {(voiceOccupancy["voice-afk"] ?? []).length > 0 &&
                voiceChannel !== "voice-afk" && (
                  <span className={styles.voiceOccupantCount}>
                    {voiceOccupancy["voice-afk"].length}
                  </span>
                )}
            </div>
            {voiceChannel === "voice-afk" && (
              <span className={styles.liveBadge}>AFK</span>
            )}
          </div>
          {(voiceOccupancy["voice-afk"] ?? []).map((name) => (
            <div key={name} className={styles.occupantRow}>
              <Avatar username={name} size={18} />
              <span className={styles.occupantName}>{name}</span>
              <span
                className={`${styles.occupantMic} ${activeSpeakers.has(name) ? styles.speaking : ""}`}
              >
                💤
              </span>
            </div>
          ))}
        </div>
      )}

      {showCreateVoice && (
        <CreateChannelInput
          type="voice"
          value={newChannelName}
          creating={creating}
          onChange={onChannelNameChange}
          onSubmit={() => onCreateChannel("voice")}
          onCancel={onCancelCreate}
        />
      )}

      {/* Regular voice channels */}
      {voiceChannels.map((ch) => {
        const occupants: string[] =
          voiceOccupancy[ch.name] ??
          (ch.name === voiceChannel ? [username, ...participants] : []);
        const isActiveVoice = ch.name === voiceChannel;
        return (
          <div key={ch.id} className={styles.voiceChannelWrap}>
            <div className={styles.voiceChannelRow}>
              <div
                onClick={() =>
                  isActiveVoice ? onLeaveVoice() : onJoinVoice(ch.name)
                }
                className={`${styles.channel} ${styles.voiceChannelMain} ${isActiveVoice ? styles.active : ""}`}
              >
                <span className={styles.channelVoiceIcon}>◈</span>
                <span className={styles.channelName}>
                  {ch.name.replace("voice-", "")}
                </span>
                {occupants.length > 0 && !isActiveVoice && (
                  <span className={styles.voiceOccupantCount}>
                    {occupants.length}
                  </span>
                )}
              </div>
              {isActiveVoice && <span className={styles.liveBadge}>LIVE</span>}
              {ch.created_by !== null && (
                <span
                  className={styles.deleteBtn}
                  onClick={(e) => onDeleteChannel(ch.id, e)}
                  title="Delete channel"
                >
                  ×
                </span>
              )}
            </div>
            {occupants.map((name) => (
              <div key={name} className={styles.occupantRow}>
                <span
                  className={
                    activeSpeakers.has(name) ? styles.speakingAvatar : ""
                  }
                >
                  <Avatar username={name} size={18} />
                </span>
                <span
                  className={styles.occupantName}
                  onClick={(e) => {
                    e.stopPropagation();
                    setVolumePopout(volumePopout === name ? null : name);
                  }}
                  title="Click to adjust volume"
                >
                  {name}
                </span>
                <span className={styles.occupantMic}>🎙</span>
                {volumePopout === name && (
                  <div
                    className={styles.volumePopout}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className={styles.volumePopoutLabel}>
                      {Math.round((participantVolumes[name] ?? 1) * 100)}%
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={2}
                      step={0.05}
                      value={participantVolumes[name] ?? 1}
                      onChange={(e) =>
                        setParticipantVolume(name, parseFloat(e.target.value))
                      }
                      className={styles.volumePopoutSlider}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}

      {contextMenu && (
        <div
          className={styles.contextMenu}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className={styles.contextMenuItem}
            onClick={() => {
              onToggleMute(contextMenu.channelName);
              setContextMenu(null);
            }}
          >
            {mutedChannels.has(contextMenu.channelName)
              ? "🔔 Unmute channel"
              : "🔇 Mute channel"}
          </button>
        </div>
      )}
    </>
  );
}
