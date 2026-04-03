import { useState, useRef, useEffect } from "react";
import { useLocalNicknames } from "../../context/LocalNicknameContext";
import Avatar from "../ui/Avatar";
import styles from "./UserPopover.module.css";

interface Props {
  userId: number;
  username: string;
  isSelf: boolean;
  onClose: () => void;
  anchorEl: HTMLElement;
  onOpenDM?: (userId: number) => void;
}

export default function UserPopover({
  userId,
  username,
  isSelf,
  onClose,
  anchorEl,
  onOpenDM,
}: Props) {
  const { setLocalNickname, nicknames } = useLocalNicknames();
  const ref = useRef<HTMLDivElement>(null);

  const existing = nicknames[userId] || "";
  const [value, setValue] = useState(existing);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const rect = anchorEl.getBoundingClientRect();
  const top = Math.min(rect.bottom + 6, window.innerHeight - 220);
  const left = Math.min(rect.left, window.innerWidth - 240);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await setLocalNickname(userId, value);
      setMsg({ text: value.trim() ? "Saved" : "Cleared", ok: true });
      setTimeout(onClose, 600);
    } catch {
      setMsg({ text: "Failed to save", ok: false });
    } finally {
      setSaving(false);
    }
  };

  const displayedAs = nicknames[userId] || username;

  return (
    <div ref={ref} className={styles.popover} style={{ top, left }}>
      {/* User header */}
      <div className={styles.userHeader}>
        <Avatar username={displayedAs} size={36} />
        <div className={styles.userInfo}>
          <div className={styles.displayName}>{displayedAs}</div>
          <div className={styles.usernameHint}>@{username}</div>
        </div>
      </div>

      {/* DM button */}
      {!isSelf && onOpenDM && (
        <button className={styles.dmBtn} onClick={() => onOpenDM(userId)}>
          ◈ MESSAGE
        </button>
      )}

      {/* Local nickname */}
      {!isSelf && (
        <>
          <div className={styles.nicknameLabel}>YOUR LOCAL NICKNAME</div>
          <div className={styles.nicknameRow}>
            <input
              autoFocus
              className={styles.nicknameInput}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
                if (e.key === "Escape") onClose();
              }}
              placeholder="Only visible to you..."
              maxLength={50}
            />
            <button className={styles.setBtn} onClick={save} disabled={saving}>
              {saving ? "..." : "SET"}
            </button>
          </div>
          {existing && (
            <button className={styles.clearBtn} onClick={() => setValue("")}>
              clear nickname
            </button>
          )}
          {msg && (
            <div className={msg.ok ? styles.msgOk : styles.msgErr}>
              {msg.text}
            </div>
          )}
        </>
      )}

      {isSelf && (
        <div className={styles.selfNote}>
          That's you! Edit your name in account settings.
        </div>
      )}
    </div>
  );
}
