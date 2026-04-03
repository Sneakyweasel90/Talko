import styles from "./ConnectionModal.module.css";

interface Props {
  status: "connecting" | "connected" | "disconnected";
  onRetry: () => void;
}

export default function ConnectionModal({ status, onRetry }: Props) {
  if (status === "connected") return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.icon}>{status === "connecting" ? "⟳" : "⚠"}</div>
        <div className={styles.title}>
          {status === "connecting" ? "CONNECTING..." : "CONNECTION LOST"}
        </div>
        <div className={styles.subtitle}>
          {status === "connecting"
            ? "Establishing connection to server"
            : "Lost connection to server — attempting to reconnect"}
        </div>
        {status === "disconnected" && (
          <button className={styles.retryBtn} onClick={onRetry}>
            ↺ RETRY NOW
          </button>
        )}
        <div className={styles.dots}>
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}
