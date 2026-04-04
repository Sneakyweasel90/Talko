import { useState } from "react";
import PinnedMessages from "../overlays/PinnedMessages";
import styles from "./ChannelHeader.module.css";

interface Props {
  channel: number | null;
  channelName: string;
  onlineCount: number;
  token: string;
  isAdmin: boolean;
  onUnpin: (messageId: number) => void;
}

export default function ChannelHeader({
  channel,
  channelName,
  onlineCount,
  token,
  isAdmin,
  onUnpin,
}: Props) {
  const [showPins, setShowPins] = useState(false);
  return (
    <>
      <div className={styles.header}>
        <span className={styles.hash}>#</span>
        <span className={styles.channelName}>{channelName}</span>
        <div className={styles.divider} />
        <button
          className={styles.pinBtn}
          onClick={() => setShowPins(true)}
          title="Pinned messages"
        >
          📌
        </button>
        <span className={styles.onlineCount}>
          <span className={styles.onlineDot}>●</span>
          {onlineCount} online
        </span>
      </div>
      {showPins && (
        <PinnedMessages
          channel={String(channel ?? "")}
          token={token}
          isAdmin={isAdmin}
          onClose={() => setShowPins(false)}
          onUnpin={onUnpin}
        />
      )}
    </>
  );
}
