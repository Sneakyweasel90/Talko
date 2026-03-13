import { useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import PinnedMessages from "../overlays/PinnedMessages";

interface Props {
  channel: string;
  onlineCount: number;
  token: string;
  isAdmin: boolean;
  onUnpin: (messageId: number) => void;
}

export default function ChannelHeader({ channel, onlineCount, token, isAdmin, onUnpin }: Props) {
  const { theme } = useTheme();
  const [showPins, setShowPins] = useState(false);

  return (
    <>
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

        {/* Pin button */}
        <button
          onClick={() => setShowPins(true)}
          title="Pinned messages"
          style={{
            background: "none", border: `1px solid ${theme.border}`,
            borderRadius: "3px", cursor: "pointer", color: theme.textDim,
            fontSize: "0.75rem", padding: "2px 7px",
            fontFamily: "'Share Tech Mono', monospace",
            transition: "all 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.color = theme.primary; e.currentTarget.style.borderColor = theme.primaryDim; }}
          onMouseLeave={e => { e.currentTarget.style.color = theme.textDim; e.currentTarget.style.borderColor = theme.border; }}
        >
          📌
        </button>

        <span style={{ fontSize: "0.72rem", fontFamily: "'Share Tech Mono', monospace", color: theme.textDim, flexShrink: 0 }}>
          <span style={{ color: "#4ade80", marginRight: "4px" }}>●</span>
          {onlineCount} online
        </span>
      </div>

      {showPins && (
        <PinnedMessages
          channel={channel}
          token={token}
          isAdmin={isAdmin}
          onClose={() => setShowPins(false)}
          onUnpin={onUnpin}
        />
      )}
    </>
  );
}