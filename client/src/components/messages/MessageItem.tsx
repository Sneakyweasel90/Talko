import { useRef, useEffect, useState } from "react";
import { RoleBadge } from "../ui/RoleBadge";
import type { GroupedMessage, Reaction } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import Avatar from "../ui/Avatar";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

// ── URL auto-linking ──────────────────────────────────────────────────────────

const URL_REGEX = /https?:\/\/[^\s<>"']+/g;

function renderContent(text: string, linkColor: string, borderColor: string): React.ReactNode[] {
  // Image attachment
  if (text.startsWith("[img]")) {
    const src = text.slice(5);
    return [
      <img
        key="img"
        src={src}
        alt="attachment"
        style={{
          maxWidth: "400px",
          maxHeight: "300px",
          borderRadius: "4px",
          border: `1px solid ${borderColor}`,
          display: "block",
          cursor: "pointer",
          marginTop: "2px",
          objectFit: "contain",
        }}
        onClick={() => window.open(src, "_blank")}
      />
    ];
  }

  // URL auto-linking (existing logic)
  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  URL_REGEX.lastIndex = 0;
  while ((match = URL_REGEX.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const url = match[0];
    parts.push(
      <a key={match.index} href={url} target="_blank" rel="noopener noreferrer"
        style={{ color: linkColor, textDecoration: "underline", textUnderlineOffset: "2px", wordBreak: "break-all" }}
        onClick={(e) => e.stopPropagation()}
      >{url}</a>
    );
    last = match.index + url.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

// ── EmojiPicker ────────────────────────────────────────────────────────────────

interface EmojiPickerProps {
  messageId: number;
  onReact: (messageId: number, emoji: string) => void;
  onClose: () => void;
}

function EmojiPicker({ messageId, onReact, onClose }: EmojiPickerProps) {
  const { theme } = useTheme();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        top: "-44px",
        left: 0,
        zIndex: 100,
        background: theme.surface,
        border: `1px solid ${theme.border}`,
        borderRadius: "4px",
        padding: "4px 6px",
        display: "flex",
        gap: "2px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
      }}
    >
      {QUICK_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => { onReact(messageId, emoji); onClose(); }}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "1.15rem",
            padding: "3px 5px",
            borderRadius: "3px",
            transition: "background 0.1s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = theme.primaryGlow)}
          onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

// ── ReactionPills ──────────────────────────────────────────────────────────────

interface ReactionPillsProps {
  reactions: Reaction[];
  messageId: number;
  currentUsername: string;
  onReact: (messageId: number, emoji: string) => void;
}

function ReactionPills({ reactions, messageId, currentUsername, onReact }: ReactionPillsProps) {
  const { theme } = useTheme();
  if (reactions.length === 0) return null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "4px" }}>
      {reactions.map((r) => {
        const reacted = r.users.includes(currentUsername);
        return (
          <button
            key={r.emoji}
            onClick={() => onReact(messageId, r.emoji)}
            title={r.users.join(", ")}
            style={{
              background: reacted ? theme.primaryGlow : "rgba(255,255,255,0.04)",
              border: `1px solid ${reacted ? theme.primaryDim : theme.border}`,
              borderRadius: "10px",
              padding: "1px 7px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "0.8rem",
              transition: "all 0.15s",
            }}
          >
            <span>{r.emoji}</span>
            <span style={{ color: reacted ? theme.primary : theme.textDim, fontSize: "0.7rem", fontFamily: "'Share Tech Mono', monospace" }}>
              {r.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── MessageItem ────────────────────────────────────────────────────────────────

interface MessageItemProps {
  isAdmin: boolean;
  onPin: (messageId: number) => void;
  msg: GroupedMessage & { user_role?: string; user_custom_role_name?: string | null };
  hoveredMsgId: number | null;
  pickerMsgId: number | null;
  currentUsername: string;
  currentUserId: number;
  onHover: (id: number | null) => void;
  onPickerToggle: (id: number | null) => void;
  onReact: (messageId: number, emoji: string) => void;
  onReply: (msg: GroupedMessage) => void;
  onEdit: (messageId: number, content: string) => void;
  onDelete: (messageId: number) => void;
  onUsernameClick: (userId: number, username: string, el: HTMLElement) => void;
  resolveNickname: (userId: number, username: string) => string;
  avatarMap: Record<number, string | null>;
}

export default function MessageItem({
  isAdmin, 
  onPin, 
  msg,
  hoveredMsgId,
  pickerMsgId,
  currentUsername,
  currentUserId,
  onHover,
  onPickerToggle,
  onReact,
  onReply,
  onEdit,
  onDelete,
  onUsernameClick,
  resolveNickname,
  avatarMap,
}: MessageItemProps) {
  const { theme } = useTheme();
  const isHovered = hoveredMsgId === msg.id;
  const isPickerOpen = pickerMsgId === msg.id;
  const isOwnMessage = msg.user_id === currentUserId;
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(msg.content);

  return (
    <div
      style={{
        display: "flex",
        gap: "0.75rem",
        padding: `${msg.isGrouped ? "0.1rem" : "0.65rem"} 0.5rem`,
        borderRadius: "3px",
      }}
      onMouseEnter={() => onHover(msg.id)}
      onMouseLeave={() => { if (!isPickerOpen && !editing) onHover(null); }}
    >
      {/* Avatar column */}
      <div style={{ width: "34px", flexShrink: 0, display: "flex", alignItems: "flex-start", paddingTop: "2px" }}>
        {!msg.isGrouped && <Avatar username={msg.username} avatar={avatarMap[msg.user_id] ?? null} size={34} />}
      </div>

      {/* Message body */}
      <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
        {/* Header row */}
        {!msg.isGrouped && (
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.6rem", marginBottom: "0.1rem" }}>
            <span
              style={{ fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: "0.9rem", color: theme.primary, cursor: "pointer" }}
              onClick={(e) => onUsernameClick(msg.user_id, msg.raw_username || msg.username, e.currentTarget as HTMLElement)}
              title="Click to set local nickname"
            >
              {resolveNickname(msg.user_id, msg.raw_username || msg.username)}
            </span>
            {msg.user_role && msg.user_role !== "user" && (
              <RoleBadge role={msg.user_role as "admin" | "user" | "custom"} customRoleName={msg.user_custom_role_name} />
            )}
            <span style={{ fontSize: "0.65rem", fontFamily: "'Share Tech Mono', monospace", color: theme.textDim }}>
              {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        )}

        {/* Reply quote block */}
        {msg.reply_to_username && msg.reply_to_content && (
          <div style={{
            borderLeft: `2px solid ${theme.primaryDim}`,
            paddingLeft: "8px",
            marginBottom: "4px",
            opacity: 0.7,
            fontSize: "0.8rem",
            fontFamily: "'Share Tech Mono', monospace",
          }}>
            <span style={{ color: theme.primary, fontWeight: 700, marginRight: "6px" }}>
              {msg.reply_to_username}
            </span>
            <span style={{ color: theme.textDim }}>
              {msg.reply_to_content.length > 80
                ? msg.reply_to_content.slice(0, 80) + "…"
                : msg.reply_to_content}
            </span>
          </div>
        )}

        {/* Message content — inline edit or normal render */}
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (editText.trim() && editText.trim() !== msg.content) onEdit(msg.id, editText.trim());
              setEditing(false);
            }}
            onMouseEnter={(e) => e.stopPropagation()}
            onMouseLeave={(e) => e.stopPropagation()}
            style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "4px" }}
          >
            <input
              autoFocus
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { setEditing(false); setEditText(msg.content); } }}
              onMouseEnter={(e) => e.stopPropagation()}
              onMouseLeave={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              style={{
                flex: 1, background: theme.surface2 || theme.surface,
                border: `1px solid ${theme.primaryDim}`, borderRadius: "3px",
                color: theme.text, fontSize: "0.9rem", padding: "3px 8px",
                fontFamily: "'Share Tech Mono', monospace",
              }}
            />
            <button type="submit" style={{ background: "none", border: `1px solid ${theme.primaryDim}`, borderRadius: "3px", color: theme.primary, fontSize: "0.7rem", padding: "2px 8px", cursor: "pointer", fontFamily: "'Share Tech Mono', monospace" }}>SAVE</button>
            <button type="button" onClick={() => { setEditing(false); setEditText(msg.content); }} style={{ background: "none", border: `1px solid ${theme.border}`, borderRadius: "3px", color: theme.textDim, fontSize: "0.7rem", padding: "2px 8px", cursor: "pointer", fontFamily: "'Share Tech Mono', monospace" }}>CANCEL</button>
          </form>
        ) : (
          <div style={{ fontSize: "0.9rem", lineHeight: 1.5, wordBreak: "break-word", color: theme.text, paddingRight: "4.5rem" }}>
            {renderContent(msg.content, theme.primary, theme.border)}
            {msg.edited_at && (
              <span style={{ fontSize: "0.65rem", color: theme.textDim, marginLeft: "6px", fontFamily: "'Share Tech Mono', monospace", opacity: 0.6 }}>(edited)</span>
            )}
          </div>
        )}

        {/* Reactions + action buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
          <ReactionPills
            reactions={msg.reactions || []}
            messageId={msg.id}
            currentUsername={currentUsername}
            onReact={onReact}
          />

          {(isHovered || isPickerOpen || editing) && (
            <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
              {/* Reply button */}
              <button
                style={{
                  border: `1px solid ${theme.border}`,
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: "0.7rem",
                  padding: "1px 6px",
                  borderRadius: "10px",
                  fontFamily: "'Share Tech Mono', monospace",
                  letterSpacing: "0.05em",
                  transition: "all 0.15s",
                  lineHeight: "1.6",
                  color: theme.textDim,
                } as React.CSSProperties}
                onClick={() => onReply(msg)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = theme.primary;
                  e.currentTarget.style.borderColor = theme.primaryDim;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = theme.textDim;
                  e.currentTarget.style.borderColor = theme.border;
                }}
                title="Reply"
              >
                ↩ REPLY
              </button>

              {/* Pin button — admins only, not for image messages */}
              {isAdmin && !msg.content.startsWith("[img]") && (
                <button
                  style={{ border: `1px solid ${theme.border}`, background: "transparent", cursor: "pointer", fontSize: "0.7rem", padding: "1px 6px", borderRadius: "10px", fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.05em", transition: "all 0.15s", lineHeight: "1.6", color: theme.textDim } as React.CSSProperties}
                  onClick={() => onPin(msg.id)}
                  onMouseEnter={e => { e.currentTarget.style.color = theme.primary; e.currentTarget.style.borderColor = theme.primaryDim; }}
                  onMouseLeave={e => { e.currentTarget.style.color = theme.textDim; e.currentTarget.style.borderColor = theme.border; }}
                  title="Pin message"
                >
                  📌 PIN
                </button>
              )}

              {/* Edit + Delete — only for own messages */}
              {isOwnMessage && !editing && (
                <>
                  <button
                    style={{ border: `1px solid ${theme.border}`, background: "transparent", cursor: "pointer", fontSize: "0.7rem", padding: "1px 6px", borderRadius: "10px", fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.05em", transition: "all 0.15s", lineHeight: "1.6", color: theme.textDim } as React.CSSProperties}
                    onClick={() => { setEditing(true); setEditText(msg.content); }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = theme.primary; e.currentTarget.style.borderColor = theme.primaryDim; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = theme.textDim; e.currentTarget.style.borderColor = theme.border; }}
                    title="Edit"
                  >
                    ✎ EDIT
                  </button>
                  <button
                    style={{ border: `1px solid ${theme.border}`, background: "transparent", cursor: "pointer", fontSize: "0.7rem", padding: "1px 6px", borderRadius: "10px", fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.05em", transition: "all 0.15s", lineHeight: "1.6", color: theme.textDim } as React.CSSProperties}
                    onClick={() => { if (window.confirm("Delete this message?")) onDelete(msg.id); }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = theme.error; e.currentTarget.style.borderColor = theme.error; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = theme.textDim; e.currentTarget.style.borderColor = theme.border; }}
                    title="Delete"
                  >
                    ✕ DEL
                  </button>
                </>
              )}

              {/* React button */}
              <div style={{ position: "relative" }}>
                <button
                  style={{
                    border: `1px solid ${isPickerOpen ? theme.primaryDim : theme.border}`,
                    cursor: "pointer",
                    fontSize: "0.7rem",
                    padding: "1px 6px",
                    borderRadius: "10px",
                    fontFamily: "'Share Tech Mono', monospace",
                    letterSpacing: "0.05em",
                    transition: "all 0.15s",
                    lineHeight: "1.6",
                    color: isPickerOpen ? theme.primary : theme.textDim,
                    background: isPickerOpen ? theme.primaryGlow : "transparent",
                  } as React.CSSProperties}
                  onClick={() => onPickerToggle(isPickerOpen ? null : msg.id)}
                  title="Add reaction"
                >
                  + 😊
                </button>
                {isPickerOpen && (
                  <EmojiPicker
                    messageId={msg.id}
                    onReact={onReact}
                    onClose={() => { onPickerToggle(null); onHover(null); }}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}