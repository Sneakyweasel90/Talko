import { useState, useRef, useEffect, useCallback } from "react";
import type { GroupedMessage } from "../../types";
import styles from "./MessageInput.module.css";

interface Props {
  send: (msg: object) => void;
  channel: string;
  replyTo: GroupedMessage | null;
  onCancelReply: () => void;
  allUsers?: { id: number; username: string }[];
}

async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 900;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) {
            height = Math.round((height * MAX) / width);
            width = MAX;
          } else {
            width = Math.round((width * MAX) / height);
            height = MAX;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function MessageInput({
  send,
  channel,
  replyTo,
  onCancelReply,
  allUsers = [],
}: Props) {
  const [text, setText] = useState("");
  const typingRef = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number>(0);
  const [mentionIndex, setMentionIndex] = useState(0);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 15 * 1024 * 1024) {
      alert("Image must be under 15MB");
      return;
    }
    const compressed = await compressImage(file);
    setImagePreview(compressed);
  }, []);

  const mentionCandidates =
    mentionQuery === null
      ? []
      : allUsers
          .filter(
            (u) =>
              mentionQuery === "" ||
              u.username.toLowerCase().startsWith(mentionQuery.toLowerCase()),
          )
          .slice(0, 6);

  useEffect(() => {
    if (replyTo) inputRef.current?.focus();
  }, [replyTo]);

  useEffect(() => {
    const stop = (e: DragEvent) => e.preventDefault();
    window.addEventListener("dragover", stop);
    window.addEventListener("drop", stop);
    return () => {
      window.removeEventListener("dragover", stop);
      window.removeEventListener("drop", stop);
    };
  }, []);

  const parseMention = (val: string, cursorPos: number) => {
    const slice = val.slice(0, cursorPos);
    const atIdx = slice.lastIndexOf("@");
    if (atIdx === -1) {
      setMentionQuery(null);
      return;
    }
    const fragment = slice.slice(atIdx + 1);
    if (fragment.includes(" ")) {
      setMentionQuery(null);
      return;
    }
    setMentionQuery(fragment);
    setMentionStart(atIdx);
    setMentionIndex(0);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    parseMention(val, e.target.selectionStart ?? val.length);
    if (!typingRef.current) {
      send({ type: "typing", channelId: channel });
      typingRef.current = true;
      setTimeout(() => {
        typingRef.current = false;
      }, 2000);
    }
  };

  const commitMention = (user: { id: number; username: string }) => {
    const display = user.username;
    const before = text.slice(0, mentionStart);
    const after = text.slice(mentionStart + 1 + (mentionQuery?.length ?? 0));
    const next = `${before}@${display} ${after}`;
    setText(next);
    setMentionQuery(null);
    setTimeout(() => {
      if (inputRef.current) {
        const pos = before.length + display.length + 2;
        inputRef.current.focus();
        inputRef.current.setSelectionRange(pos, pos);
      }
    }, 0);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && !imagePreview) return;
    if (imagePreview) {
      send({
        type: "message",
        channelId: channel,
        content: `[img]${imagePreview}`,
        replyToId: replyTo?.id ?? null,
      });
      setImagePreview(null);
    }
    if (text.trim()) {
      send({
        type: "message",
        channelId: channel,
        content: text.trim(),
        replyToId: replyTo?.id ?? null,
      });
    }
    setText("");
    setMentionQuery(null);
    onCancelReply();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (mentionCandidates.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % mentionCandidates.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex(
          (i) => (i - 1 + mentionCandidates.length) % mentionCandidates.length,
        );
        return;
      }
      if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        commitMention(mentionCandidates[mentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        setMentionQuery(null);
        return;
      }
    }
    if (e.key === "Escape" && replyTo) {
      e.preventDefault();
      onCancelReply();
    }
  };

  return (
    <div
      className={styles.wrapper}
      onDragOver={(e) => {
        e.preventDefault();
        if (!isDragging) setIsDragging(true);
      }}
      onDragLeave={(e) => {
        if (
          e.relatedTarget &&
          e.currentTarget.contains(e.relatedTarget as Node)
        )
          return;
        setIsDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) handleFile(f);
      }}
    >
      {/* Drop overlay */}
      {isDragging && (
        <div className={styles.dropOverlay}>
          <div className={styles.dropOverlayInner}>
            <div className={styles.dropIcon}>🖼</div>
            <div className={styles.dropLabel}>DROP IMAGE TO UPLOAD</div>
          </div>
        </div>
      )}

      {/* Mention dropdown */}
      {mentionCandidates.length > 0 && (
        <div className={styles.mentionDropdown}>
          <div className={styles.mentionHeader}>// MENTION USER</div>
          {mentionCandidates.map((u, i) => (
            <div
              key={u.id}
              onMouseDown={(e) => {
                e.preventDefault();
                commitMention(u);
              }}
              className={`${styles.mentionItem} ${i === mentionIndex ? styles.active : ""}`}
              onMouseEnter={() => setMentionIndex(i)}
            >
              <span className={styles.mentionAt}>@</span>
              <span className={styles.mentionName}>{u.username}</span>
            </div>
          ))}
          <div className={styles.mentionFooter}>
            TAB or ENTER to select · ESC to close
          </div>
        </div>
      )}

      {/* Image preview */}
      {imagePreview && (
        <div className={styles.imagePreviewBar}>
          <img
            src={imagePreview}
            alt="preview"
            className={styles.imagePreviewThumb}
          />
          <button
            className={styles.imageRemoveBtn}
            onClick={() => setImagePreview(null)}
          >
            ✕ REMOVE
          </button>
        </div>
      )}

      {/* Reply banner */}
      {replyTo && (
        <div className={styles.replyBanner}>
          <span className={styles.replyBannerText}>
            <span className={styles.replyBannerAuthor}>
              ↩ replying to {replyTo.username}
            </span>
            <span className={styles.replyBannerContent}>
              {replyTo.content.startsWith("[img]")
                ? "[image]"
                : replyTo.content.length > 60
                  ? replyTo.content.slice(0, 60) + "…"
                  : replyTo.content}
            </span>
          </span>
          <button
            className={styles.replyBannerCancel}
            onClick={onCancelReply}
            title="Cancel reply (Esc)"
          >
            ✕
          </button>
        </div>
      )}

      {/* Input row */}
      <form className={styles.inputForm} onSubmit={handleSend}>
        <div className={styles.inputBar}>
          <span className={styles.inputBarPrefix}>
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              className={`${styles.attachBtn} ${imagePreview ? styles.hasImage : ""}`}
              onClick={() => fileInputRef.current?.click()}
              title="Attach image"
            >
              📎
            </button>
            &gt;
          </span>
          <textarea
            ref={inputRef}
            className={styles.textInput}
            placeholder={
              replyTo
                ? `reply to ${replyTo.username}...`
                : `transmit to #${channel}...`
            }
            value={text}
            onChange={handleChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                if (mentionCandidates.length > 0) {
                  handleKeyDown(e);
                  return;
                }
                e.preventDefault();
                handleSend(e as any);
              } else {
                handleKeyDown(e);
              }
            }}
            rows={1}
          />
        </div>
        <button type="submit" className={styles.sendBtn}>
          SEND
        </button>
      </form>
    </div>
  );
}
