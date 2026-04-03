import { useTheme } from "../../context/ThemeContext";
import { useVoiceControls } from "../../hooks/useVoiceControls";
import styles from "./VoiceIndicator.module.css";

interface Props {
  inVoice: boolean;
  voiceChannel: string | null;
  participants: string[];
  participantVolumes: Record<string, number>;
  selfVolume: number;
  leaveVoice: () => void;
  setParticipantVolume: (username: string, volume: number) => void;
  setSelfVolume: (volume: number) => void;
  setAllParticipantsDeafened: (deafened: boolean) => void;
  setMuted: (muted: boolean) => void;
}

function VolumeSlider({
  label,
  value,
  onChange,
  color,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  color: string;
}) {
  return (
    <div className={styles.sliderWrap}>
      <span className={styles.sliderLabel} style={{ color }}>
        {label}
      </span>
      <input
        type="range"
        min={0}
        max={2}
        step={0.05}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className={styles.sliderInput}
        style={{ accentColor: color }}
        title={`${Math.round(value * 100)}%`}
      />
      <span className={styles.sliderValue} style={{ color }}>
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}

export default function VoiceIndicator({
  inVoice,
  voiceChannel,
  participants,
  participantVolumes,
  selfVolume,
  leaveVoice,
  setMuted,
  setParticipantVolume,
  setSelfVolume,
  setAllParticipantsDeafened,
}: Props) {
  const { theme } = useTheme();
  const {
    isMuted,
    isDeafened,
    isPttActive,
    mode,
    muteKey,
    pttKey,
    assigningKey,
    toggleMute,
    toggleDeafen,
    toggleMode,
    setAssigningKey,
    resetControls,
  } = useVoiceControls(setMuted);

  if (!inVoice) return null;

  const handleLeave = () => {
    resetControls();
    leaveVoice();
  };

  const handleToggleDeafen = () => {
    const next = !isDeafened;
    toggleDeafen();
    setAllParticipantsDeafened(next);
  };

  return (
    <div className={styles.root}>
      {/* Channel label */}
      <div className={styles.channelRow}>
        <span className={styles.channelLabel}>🔊 {voiceChannel}</span>
        {mode === "ptt" && (
          <span
            className={`${styles.pttBadge} ${isPttActive ? styles.active : ""}`}
          >
            {isPttActive ? "● TRANSMITTING" : `PTT: ${pttKey}`}
          </span>
        )}
      </div>

      {/* Controls row */}
      <div className={styles.controlsRow}>
        {/* Mute */}
        {mode === "open" && (
          <button
            onClick={toggleMute}
            title={isMuted ? "Unmute mic" : "Mute mic"}
            className={`${styles.btn} ${isMuted ? styles.btnMuted : styles.btnDefault}`}
          >
            {isMuted ? "🔇 MUTED" : "🎙 MUTE"}
          </button>
        )}

        {/* Deafen */}
        <button
          onClick={handleToggleDeafen}
          title={
            isDeafened ? "Undeafen" : "Deafen (mutes mic + all incoming audio)"
          }
          className={`${styles.btn} ${isDeafened ? styles.btnDeafened : styles.btnDefault}`}
        >
          {isDeafened ? "🔕 DEAFENED" : "🔔 DEAFEN"}
        </button>

        {/* Mode toggle */}
        <button
          onClick={toggleMode}
          title={
            mode === "open" ? "Switch to Push to Talk" : "Switch to Open Mic"
          }
          className={`${styles.btn} ${styles.btnDefault}`}
        >
          {mode === "open" ? "PTT" : "OPEN MIC"}
        </button>

        {/* Mute keybind */}
        {mode === "open" && (
          <button
            onClick={() =>
              setAssigningKey(assigningKey === "mute" ? null : "mute")
            }
            className={`${styles.btn} ${assigningKey === "mute" ? styles.btnActive : styles.btnDefault}`}
          >
            {assigningKey === "mute"
              ? "PRESS A KEY..."
              : `MUTE KEY: ${muteKey}`}
          </button>
        )}

        {/* PTT keybind */}
        {mode === "ptt" && (
          <button
            onClick={() =>
              setAssigningKey(assigningKey === "ptt" ? null : "ptt")
            }
            className={`${styles.btn} ${assigningKey === "ptt" ? styles.btnActive : styles.btnDefault}`}
          >
            {assigningKey === "ptt" ? "PRESS A KEY..." : `PTT KEY: ${pttKey}`}
          </button>
        )}

        {/* Disconnect */}
        <button
          onClick={handleLeave}
          className={`${styles.btn} ${styles.btnDisconnect}`}
        >
          DISCONNECT
        </button>
      </div>

      {/* Volume sliders */}
      {participants.length > 0 && (
        <div
          className={`${styles.slidersRow} ${isDeafened ? styles.deafened : ""}`}
        >
          <VolumeSlider
            label="YOU"
            value={selfVolume}
            onChange={setSelfVolume}
            color={theme.primary}
          />
          {participants.map((name) => (
            <VolumeSlider
              key={name}
              label={name}
              value={participantVolumes[name] ?? 1}
              onChange={(v) => setParticipantVolume(name, v)}
              color={theme.textDim}
            />
          ))}
        </div>
      )}
    </div>
  );
}
