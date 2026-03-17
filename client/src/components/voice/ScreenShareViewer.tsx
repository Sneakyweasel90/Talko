import { useEffect, useRef, useState } from "react";
import styles from "./ScreenShareViewer.module.css";

interface Props {
  track: MediaStreamTrack;
  participantName: string;
  isLocal: boolean;
  onClose: () => void;
}

export default function ScreenShareViewer({ track, participantName, isLocal, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    if (!videoRef.current) return;
    const stream = new MediaStream([track]);
    videoRef.current.srcObject = stream;
    videoRef.current.play().catch(() => {});
    return () => {
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [track]);

  return (
    <div className={`${styles.root} ${minimized ? styles.minimized : ""}`}>
      <div className={styles.header}>
        <span className={styles.label}>
          <svg viewBox="0 0 24 24" fill="currentColor" className={styles.icon}>
            <path d="M20 3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h6v2H8v2h8v-2h-2v-2h6c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 13H4V5h16v11z"/>
          </svg>
          {isLocal ? "You are sharing" : `${participantName} is sharing`}
        </span>
        <div className={styles.controls}>
          <button
            onClick={() => setMinimized(m => !m)}
            className={styles.controlBtn}
            title={minimized ? "Expand" : "Minimise"}
          >
            {minimized ? (
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>
            )}
          </button>
          {isLocal && (
            <button onClick={onClose} className={`${styles.controlBtn} ${styles.stopBtn}`} title="Stop sharing">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg>
            </button>
          )}
        </div>
      </div>
      {!minimized && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={styles.video}
        />
      )}
    </div>
  );
}