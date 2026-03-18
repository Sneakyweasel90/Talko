import React, { useRef, useEffect, useState } from "react";
import { RoleBadge } from "../ui/RoleBadge";
import type { GroupedMessage, Reaction } from "../../types";
import Avatar from "../ui/Avatar";
import styles from "./MessageItem.module.css";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import EmojiPickerLib from "emoji-picker-react";

interface EmojiPickerProps {
  messageId: number;
  onReact: (messageId: number, emoji: string) => void;
  onClose: () => void;
}

function renderContent(text: string, currentUsername: string): React.ReactNode {
    if (text.startsWith("[img]")) {
    const src = text.slice(5);
    return (
      <img
        src={src}
        alt="attachment"
        className={styles.attachmentImg}
        onClick={() => window.open(src, "_blank")}
      />
    );
  }

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ node, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || "");
          const isBlock = !props.inline;
          return isBlock ? (
            <SyntaxHighlighter
              style={vscDarkPlus}
              language={match?.[1] || "text"}
              PreTag="div"
              className={styles.codeBlock}
            >
              {String(children).replace(/\n$/, "")}
            </SyntaxHighlighter>
          ) : (
            <code className={styles.inlineCode} {...props}>
              {children}
            </code>
          );
        },
        a({ href, children }: any) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.messageLink}
              onClick={(e) => e.stopPropagation()}
            >
              {children}
            </a>
          );
        },
        p({ children }: any) {
          const highlightMentions = (child: React.ReactNode): React.ReactNode => {
            if (typeof child !== "string") return child;
            const parts = child.split(/(@\S+)/g);
            return parts.map((part, i) => {
              if (part.startsWith("@")) {
                const name = part.slice(1);
                const isMe = name.toLowerCase() === currentUsername.toLowerCase();
                return (
                  <span
                    key={i}
                    className={isMe ? styles.mentionMe : styles.mention}
                  >
                    {part}
                  </span>
                );
              }
              return part;
            });
          };
          return (
            <span className={styles.mdParagraph}>
              {React.Children.map(children, highlightMentions)}
            </span>
          );
        },
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

// ── EmojiPicker ────────────────────────────────────────────────────────────────

function EmojiPicker({ messageId, onReact, onClose }: EmojiPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div ref={ref} className={styles.emojiPickerWrap2}>
      <EmojiPickerLib
        onEmojiClick={(emojiData) => {
          onReact(messageId, emojiData.emoji);
          onClose();
        }}
        width={320}
        height={400}
        theme={"dark" as any}
        searchPlaceholder="Search emoji..."
        lazyLoadEmojis
      />
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

function ReactionPills({
  reactions,
  messageId,
  currentUsername,
  onReact,
}: ReactionPillsProps) {
  if (reactions.length === 0) return null;

  return (
    <div className={styles.reactionsRow}>
      {reactions.map((r) => {
        const reacted = r.users.includes(currentUsername);
        return (
          <button
            key={r.emoji}
            onClick={() => onReact(messageId, r.emoji)}
            title={r.users.join(", ")}
            className={`${styles.reactionPill} ${reacted ? styles.reacted : ""}`}
          >
            <span>{r.emoji}</span>
            <span className={styles.reactionCount}>{r.count}</span>
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
  msg: GroupedMessage & {
    user_role?: string;
    user_custom_role_name?: string | null;
  };
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
  onJumpToMessage: (id: number) => void;
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
  onJumpToMessage,
}: MessageItemProps) {
  const isHovered = hoveredMsgId === msg.id;
  const isPickerOpen = pickerMsgId === msg.id;
  const isOwnMessage = msg.user_id === currentUserId;
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(msg.content);

  return (
    <div
      id={`msg-${msg.id}`}
      className={`${styles.messageRow} ${msg.isGrouped ? styles.grouped : ""}`}
      onMouseEnter={() => onHover(msg.id)}
      onMouseLeave={() => {
        if (!isPickerOpen && !editing) onHover(null);
      }}
    >
      {/* Avatar column */}
      <div className={styles.avatarCol}>
        {!msg.isGrouped && (
          <Avatar
            username={msg.username}
            avatar={avatarMap[msg.user_id] ?? null}
            size={34}
          />
        )}
      </div>

      {/* Message body */}
      <div className={styles.messageBody}>
        {/* Header row */}
        {!msg.isGrouped && (
          <div className={styles.headerRow}>
            <span
              className={styles.username}
              onClick={(e) =>
                onUsernameClick(
                  msg.user_id,
                  msg.raw_username || msg.username,
                  e.currentTarget as HTMLElement,
                )
              }
              title="Click to set local nickname"
            >
              {resolveNickname(msg.user_id, msg.raw_username || msg.username)}
            </span>
            {msg.user_role && msg.user_role !== "user" && (
              <RoleBadge
                role={msg.user_role as "admin" | "user" | "custom"}
                customRoleName={msg.user_custom_role_name}
              />
            )}
            <span className={styles.timestamp}>
              {new Date(msg.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        )}

        {/* Reply quote block */}
        {msg.reply_to_username && msg.reply_to_content && (
          <div
            className={styles.replyQuote}
            onClick={() => msg.reply_to_id && onJumpToMessage(msg.reply_to_id)}
            style={{ cursor: "pointer" }}
          >
            <span className={styles.replyAuthor}>{msg.reply_to_username}</span>
            <span className={styles.replyContent}>
              {msg.reply_to_content.startsWith("[img]")
                ? "[image]"
                : msg.reply_to_content.length > 80
                  ? msg.reply_to_content.slice(0, 80) + "…"
                  : msg.reply_to_content}
            </span>
          </div>
        )}

        {/* Message content — inline edit or normal render */}
        {editing ? (
          <form
            className={styles.editForm}
            onSubmit={(e) => {
              e.preventDefault();
              if (editText.trim() && editText.trim() !== msg.content)
                onEdit(msg.id, editText.trim());
              setEditing(false);
            }}
            onMouseEnter={(e) => e.stopPropagation()}
            onMouseLeave={(e) => e.stopPropagation()}
          >
            <textarea
              autoFocus
              className={styles.editInput}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (editText.trim() && editText.trim() !== msg.content)
                    onEdit(msg.id, editText.trim());
                  setEditing(false);
                }
                if (e.key === "Escape") {
                  setEditing(false);
                  setEditText(msg.content);
                }
              }}
              rows={1}
            />
            <button type="submit" className={styles.editSaveBtn}>
              SAVE
            </button>
            <button
              type="button"
              className={styles.editCancelBtn}
              onClick={() => {
                setEditing(false);
                setEditText(msg.content);
              }}
            >
              CANCEL
            </button>
          </form>
        ) : (
          <div className={styles.messageContent}>
            {renderContent(msg.content, currentUsername)}
            {msg.edited_at && (
              <span className={styles.editedLabel}>(edited)</span>
            )}
          </div>
        )}

        {/* Reactions */}
        <ReactionPills
          reactions={msg.reactions || []}
          messageId={msg.id}
          currentUsername={currentUsername}
          onReact={onReact}
        />

        {/* Action bar */}
        {(isHovered || isPickerOpen || editing) && (
          <div className={styles.actionBar}>
            {/* Reply */}
            <button
              className={styles.actionBtn}
              onClick={() => onReply(msg)}
              title="Reply"
            >
              ↩ REPLY
            </button>

            {/* Pin — admins only, not for images */}
            {isAdmin && !msg.content.startsWith("[img]") && (
              <button
                className={styles.actionBtn}
                onClick={() => onPin(msg.id)}
                title="Pin message"
              >
                📌 PIN
              </button>
            )}

            {/* Edit + Delete — own messages only */}
            {isOwnMessage && !editing && !msg.content.startsWith("[img]") && (
              <button
                className={styles.actionBtn}
                onClick={() => {
                  setEditing(true);
                  setEditText(msg.content);
                }}
                title="Edit"
              >
                ✎ EDIT
              </button>
            )}
            {isOwnMessage && !editing && (
              <button
                className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                onClick={() => {
                  if (window.confirm("Delete this message?")) onDelete(msg.id);
                }}
                title="Delete"
              >
                ✕ DEL
              </button>
            )}

            {/* React */}
            <div className={styles.emojiPickerWrap}>
              <button
                className={`${styles.actionBtn} ${isPickerOpen ? styles.actionBtnActive : ""}`}
                onClick={() => onPickerToggle(isPickerOpen ? null : msg.id)}
                title="Add reaction"
              >
                + 😊
              </button>
              {isPickerOpen && (
                <EmojiPicker
                  messageId={msg.id}
                  onReact={onReact}
                  onClose={() => {
                    onPickerToggle(null);
                    onHover(null);
                  }}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
