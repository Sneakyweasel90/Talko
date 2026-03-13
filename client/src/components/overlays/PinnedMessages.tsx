import { useState, useEffect } from "react";
import { useTheme } from "../../context/ThemeContext";
import axios from "axios";
import config from "../../config";
import type { PinnedMessage } from "../../types";

interface Props {
  channel: string;
  token: string;
  isAdmin: boolean;
  onClose: () => void;
  onUnpin: (messageId: number) => void;
}

export default function PinnedMessages({ channel, token, isAdmin, onClose, onUnpin }: Props) {
  const { theme } = useTheme();
  const [pins, setPins] = useState<PinnedMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${config.HTTP}/api/channels/${channel}/pins`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(({ data }) => setPins(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [channel, token]);

  const handleUnpin = async (messageId: number) => {
    await axios.delete(`${config.HTTP}/api/channels/${channel}/pins/${messageId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setPins(prev => prev.filter(p => p.id !== messageId));
    onUnpin(messageId);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 300,
      background: "rgba(0,0,0,0.6)",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      paddingTop: "8vh",
    }} onClick={onClose}>
      <div style={{
        background: theme.surface,
        border: `1px solid ${theme.primaryDim}`,
        borderRadius: "4px",
        width: "min(560px, 94vw)",
        maxHeight: "70vh",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        boxShadow: `0 8px 40px rgba(0,0,0,0.6)`,
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{
          padding: "0.75rem 1rem",
          borderBottom: `1px solid ${theme.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: "0.7rem", letterSpacing: "0.12em", color: theme.primary,
          }}>
            📌 PINNED MESSAGES — #{channel}
          </span>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer",
            color: theme.textDim, fontSize: "1rem",
          }}>✕</button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0.5rem 0" }}>
          {loading && (
            <div style={{ padding: "1.5rem", textAlign: "center", color: theme.textDim, fontSize: "0.7rem", fontFamily: "'Share Tech Mono', monospace" }}>
              LOADING...
            </div>
          )}
          {!loading && pins.length === 0 && (
            <div style={{ padding: "2rem", textAlign: "center", color: theme.textDim, fontSize: "0.72rem", fontFamily: "'Share Tech Mono', monospace", opacity: 0.6 }}>
              No pinned messages in #{channel}
            </div>
          )}
          {pins.map(pin => (
            <div key={pin.id} style={{
              padding: "0.75rem 1rem",
              borderBottom: `1px solid ${theme.border}`,
              display: "flex", gap: "0.75rem",
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "baseline", marginBottom: "0.25rem" }}>
                  <span style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "0.88rem", color: theme.primary }}>
                    {pin.username}
                  </span>
                  <span style={{ fontSize: "0.6rem", fontFamily: "'Share Tech Mono', monospace", color: theme.textDim }}>
                    {new Date(pin.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                </div>
                <div style={{ fontSize: "0.88rem", color: theme.text, lineHeight: 1.4, wordBreak: "break-word" }}>
                  {pin.content.startsWith("[img]")
                    ? <span style={{ color: theme.textDim, fontStyle: "italic", fontSize: "0.8rem" }}>[image]</span>
                    : pin.content
                  }
                </div>
                <div style={{ marginTop: "0.3rem", fontSize: "0.6rem", fontFamily: "'Share Tech Mono', monospace", color: theme.textDim, opacity: 0.5 }}>
                  pinned by {pin.pinned_by_username ?? "unknown"}
                </div>
              </div>
              {isAdmin && (
                <button onClick={() => handleUnpin(pin.id)} style={{
                  background: "none", border: `1px solid ${theme.border}`,
                  borderRadius: "3px", color: theme.textDim, cursor: "pointer",
                  fontSize: "0.6rem", padding: "2px 6px", flexShrink: 0,
                  fontFamily: "'Share Tech Mono', monospace", alignSelf: "flex-start",
                  transition: "all 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.color = theme.error; e.currentTarget.style.borderColor = theme.error; }}
                onMouseLeave={e => { e.currentTarget.style.color = theme.textDim; e.currentTarget.style.borderColor = theme.border; }}
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