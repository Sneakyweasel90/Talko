import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { useLocalNicknames } from "../../context/LocalNicknameContext";
import Avatar from "../ui/Avatar";
import config from "../../config";
import styles from "./UserPopover.module.css";

interface MutualCommunity {
  id: number;
  name: string;
  icon: string | null;
}

interface Props {
  userId: number;
  username: string;
  isSelf: boolean;
  onClose: () => void;
  anchorEl: HTMLElement;
  token: string;
  onOpenDM?: (userId: number) => void;
}

export default function UserPopover({
  userId,
  username,
  isSelf,
  onClose,
  anchorEl,
  token,
  onOpenDM,
}: Props) {
  const { setLocalNickname, nicknames } = useLocalNicknames();
  const ref = useRef<HTMLDivElement>(null);

  const existing = nicknames[userId] || "";
  const [value, setValue] = useState(existing);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [mutualCommunities, setMutualCommunities] = useState<MutualCommunity[]>(
    [],
  );

  const rect = anchorEl.getBoundingClientRect();
  const top = Math.min(rect.bottom + 6, window.innerHeight - 280);
  const left = Math.min(rect.left, window.innerWidth - 240);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Fetch mutual communities when popover opens (skip for self)
  useEffect(() => {
    if (isSelf) return;
    axios
      .get(`${config.HTTP}/api/users/${userId}/mutual-communities`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(({ data }) => setMutualCommunities(data))
      .catch(() => {});
  }, [userId, token, isSelf]);

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

      {/* Mutual communities */}
      {!isSelf && (
        <div className={styles.mutualSection}>
          <div className={styles.mutualLabel}>
            MUTUAL SERVERS{" "}
            {mutualCommunities.length > 0 && `— ${mutualCommunities.length}`}
          </div>
          {mutualCommunities.length === 0 ? (
            <div className={styles.mutualEmpty}>no mutual servers</div>
          ) : (
            <div className={styles.mutualList}>
              {mutualCommunities.map((c) => (
                <div key={c.id} className={styles.mutualItem}>
                  {c.icon ? (
                    <img
                      src={c.icon}
                      alt={c.name}
                      className={styles.mutualIcon}
                    />
                  ) : (
                    <div className={styles.mutualIconFallback}>
                      {c.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <span className={styles.mutualName}>{c.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
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
