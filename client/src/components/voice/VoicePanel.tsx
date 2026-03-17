import { useVoiceControls } from "../../hooks/useVoiceControls";
import styles from "./VoicePanel.module.css";

interface Props {
  voiceChannel: string | null;
  inVoice: boolean;
  leaveVoice: () => void;
  setMuted: (muted: boolean) => void;
  setAllParticipantsDeafened: (deafened: boolean) => void;
  isScreenSharing: boolean;
  onStartScreenShare: () => void;
  onStopScreenShare: () => void;
}

export default function VoicePanel({
  voiceChannel,
  inVoice,
  leaveVoice,
  setMuted,
  setAllParticipantsDeafened,
  isScreenSharing, onStartScreenShare, onStopScreenShare,
}: Props) {
  const {
    isMuted,
    isDeafened,
    isPttActive,
    mode,
    pttKey,
    toggleMute,
    toggleDeafen,
    toggleMode,
    resetControls,
    assigningKey,
    setAssigningKey,
  } = useVoiceControls(setMuted);

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
    <div className={`${styles.root} ${!inVoice ? styles.hidden : ""}`}>
      {inVoice && (
        <>
          {/* Status */}
          <div className={styles.status}>
            <span className={styles.statusDot} />
            <span className={styles.statusText}>VOICE CONNECTED</span>
          </div>

          {/* Channel name + PTT */}
          <div className={styles.channelRow}>
            <span className={styles.channelName}>🔊 {voiceChannel}</span>
            {mode === "ptt" && (
              <span
                className={`${styles.pttBadge} ${isPttActive ? styles.pttActive : ""}`}
              >
                {isPttActive ? "● LIVE" : `PTT: ${pttKey}`}
              </span>
            )}
          </div>

          {/* Icon buttons */}
          <div className={styles.controls}>
            {/* Mic / mute */}
            <button
              onClick={toggleMute}
              title={isMuted ? "Unmute" : "Mute"}
              className={`${styles.iconBtn} ${isMuted ? styles.iconBtnDanger : ""}`}
            >
              {isMuted ? (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
                </svg>
              )}
            </button>

            {/* Headphones / deafen */}
            <button
              onClick={handleToggleDeafen}
              title={isDeafened ? "Undeafen" : "Deafen"}
              className={`${styles.iconBtn} ${isDeafened ? styles.iconBtnDanger : ""}`}
            >
              {isDeafened ? (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 1C7.03 1 3 5.03 3 10v4c0 1.1.9 2 2 2h1v-5H5v-1c0-3.87 3.13-7 7-7s7 3.13 7 7v1h-1v5h1c1.1 0 2-.9 2-2v-4c0-4.97-4.03-9-9-9zm-1 14H9v-5h2v5zm4 0h-2v-5h2v5z" />
                  <line
                    x1="3"
                    y1="3"
                    x2="21"
                    y2="21"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 1C7.03 1 3 5.03 3 10v4c0 1.1.9 2 2 2h1v-5H5v-1c0-3.87 3.13-7 7-7s7 3.13 7 7v1h-1v5h1c1.1 0 2-.9 2-2v-4c0-4.97-4.03-9-9-9zm-1 14H9v-5h2v5zm4 0h-2v-5h2v5z" />
                </svg>
              )}
            </button>

            {/* PTT / Open mic toggle */}
            <button
              onClick={toggleMode}
              title={
                mode === "open"
                  ? "Switch to Push to Talk"
                  : "Switch to Open Mic"
              }
              className={`${styles.iconBtn} ${mode === "ptt" ? styles.iconBtnActive : ""}`}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M17 12h-2v2h2v-2zm-8 0H7v2h2v-2zm4-10C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm1-13h-2v6h2V7zm0 8h-2v2h2v-2z" />
              </svg>
            </button>

            {mode === "ptt" && (
              <span className={styles.pttKeyLabel}>
                {assigningKey === "ptt" ? "PRESS A KEY..." : pttKey}
              </span>
            )}

            {mode === "ptt" && (
              <button
                onClick={() => setAssigningKey(assigningKey === "ptt" ? null : "ptt")}
                title="Change PTT key"
                className={`${styles.iconBtn} ${assigningKey === "ptt" ? styles.iconBtnActive : ""}`}
              >
                {assigningKey === "ptt" ? (
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 5H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 5H5v-2h2v2zm10 0H9v-2h8v2zm0-3h-2v-2h2v2zm0-3h-2V8h2v2z"/></svg>
                )}
              </button>
            )}

            {inVoice && (
              <button
                onClick={isScreenSharing ? onStopScreenShare : onStartScreenShare}
                title={isScreenSharing ? "Stop sharing" : "Share screen"}
                className={`${styles.iconBtn} ${isScreenSharing ? styles.iconBtnActive : ""}`}
              >
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h6v2H8v2h8v-2h-2v-2h6c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 13H4V5h16v11z"/>
                </svg>
              </button>
            )}

            {/* Disconnect */}
            <button
              onClick={handleLeave}
              title="Disconnect from voice"
              className={`${styles.iconBtn} ${styles.iconBtnDisconnect}`}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" />
              </svg>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
