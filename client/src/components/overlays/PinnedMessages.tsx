import { useState, useEffect } from "react";
import axios from "axios";
import config from "../../config";
import type { PinnedMessage } from "../../types";
import styles from "./PinnedMessages.module.css";

interface Props {
  channel: string;
  token: string;
  isAdmin: boolean;
  onClose: () => void;
  onUnpin: (messageId: number) => void;
}

export default function PinnedMessages({
  channel,
  token,
  isAdmin,
  onClose,
  onUnpin,
}: Props) {
  const [pins, setPins] = useState<PinnedMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get(`${config.HTTP}/api/channels/${channel}/pins`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(({ data }) => setPins(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [channel, token]);

  const handleUnpin = async (messageId: number) => {
    await axios.delete(
      `${config.HTTP}/api/channels/${channel}/pins/${messageId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    setPins((prev) => prev.filter((p) => p.id !== messageId));
    onUnpin(messageId);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <span className={styles.title}>📌 PINNED MESSAGES — #{channel}</span>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {loading && <div className={styles.loadingText}>LOADING...</div>}
          {!loading && pins.length === 0 && (
            <div className={styles.emptyText}>
              No pinned messages in #{channel}
            </div>
          )}
          {pins.map((pin) => (
            <div key={pin.id} className={styles.pinItem}>
              <div className={styles.pinBody}>
                <div className={styles.pinMetaRow}>
                  <span className={styles.pinAuthor}>{pin.username}</span>
                  <span className={styles.pinDate}>
                    {new Date(pin.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <div className={styles.pinContent}>
                  {pin.content.startsWith("[img]") ||
                  pin.content.startsWith("[gif]") ? (
                    <span className={styles.pinImageLabel}>[image]</span>
                  ) : (
                    pin.content
                  )}
                </div>
                <div className={styles.pinFooter}>
                  pinned by {pin.pinned_by_username ?? "unknown"}
                </div>
              </div>
              {isAdmin && (
                <button
                  className={styles.unpinBtn}
                  onClick={() => handleUnpin(pin.id)}
                >
                  UNPIN
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
