import { useRef, useState } from "react";
import axios from "axios";
import Avatar from "../ui/Avatar";
import config from "../../config";
import type { UserRole } from "../../types";
import { RoleBadge } from "../ui/RoleBadge";
import AdminPanel from "./AdminPanel";
import styles from "./AccountSettings.module.css";

interface Props {
  user: {
    id: number;
    username: string;
    nickname: string | null;
    avatar: string | null;
    token: string;
    role: UserRole;
    customRoleName: string | null;
  };
  onClose: () => void;
  onNicknameChange: (nickname: string | null) => void;
  onAvatarChange: (avatar: string | null) => void;
}

export default function AccountSettings({
  user,
  onClose,
  onNicknameChange,
  onAvatarChange,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<"profile" | "admin">("profile");

  const [nickname, setNickname] = useState(user.nickname || "");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    user.avatar,
  );
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [nickSaving, setNickSaving] = useState(false);
  const [nickMsg, setNickMsg] = useState<{ text: string; ok: boolean } | null>(
    null,
  );
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState<{
    text: string;
    ok: boolean;
  } | null>(null);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ text: string; ok: boolean } | null>(
    null,
  );

  const displayName = user.nickname || user.username;
  const isAdmin = user.role === "admin";

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAvatarMsg({ text: "Please select an image file", ok: false });
      return;
    }
    if (file.size > 500 * 1024) {
      setAvatarMsg({ text: "Image must be under 500KB", ok: false });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarPreview(reader.result as string);
      setAvatarMsg(null);
    };
    reader.readAsDataURL(file);
  };

  const saveAvatar = async () => {
    setAvatarSaving(true);
    setAvatarMsg(null);
    try {
      const { data } = await axios.patch(
        `${config.HTTP}/api/users/me`,
        { avatar: avatarPreview },
        { headers: { Authorization: `Bearer ${user.token}` } },
      );
      onAvatarChange(data.avatar);
      setAvatarMsg({
        text: avatarPreview ? "Avatar saved" : "Avatar removed",
        ok: true,
      });
    } catch (err: unknown) {
      if (axios.isAxiosError(err))
        setAvatarMsg({
          text: err.response?.data?.error || "Failed to save",
          ok: false,
        });
    } finally {
      setAvatarSaving(false);
    }
  };

  const saveNickname = async () => {
    setNickSaving(true);
    setNickMsg(null);
    try {
      const { data } = await axios.patch(
        `${config.HTTP}/api/users/me`,
        { nickname: nickname.trim() },
        { headers: { Authorization: `Bearer ${user.token}` } },
      );
      onNicknameChange(data.nickname);
      setNickMsg({
        text: nickname.trim() ? "Nickname saved" : "Nickname cleared",
        ok: true,
      });
    } catch (err: unknown) {
      if (axios.isAxiosError(err))
        setNickMsg({
          text: err.response?.data?.error || "Failed to save",
          ok: false,
        });
    } finally {
      setNickSaving(false);
    }
  };

  const savePassword = async () => {
    if (newPassword !== confirmPassword) {
      setPwMsg({ text: "Passwords do not match", ok: false });
      return;
    }
    if (newPassword.length < 6) {
      setPwMsg({ text: "Must be at least 6 characters", ok: false });
      return;
    }
    setPwSaving(true);
    setPwMsg(null);
    try {
      await axios.patch(
        `${config.HTTP}/api/users/me`,
        { currentPassword, newPassword },
        { headers: { Authorization: `Bearer ${user.token}` } },
      );
      setPwMsg({ text: "Password updated", ok: true });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      if (axios.isAxiosError(err))
        setPwMsg({
          text: err.response?.data?.error || "Failed to update",
          ok: false,
        });
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <span className={styles.title}>◈ ACCOUNT SETTINGS</span>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Tabs */}
        {isAdmin && (
          <div className={styles.tabs}>
            {(["profile", "admin"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`${styles.tab} ${tab === t ? styles.active : ""}`}
              >
                {t === "profile" ? "◈ PROFILE" : "⚙ USER MANAGEMENT"}
              </button>
            ))}
          </div>
        )}

        {/* Profile tab */}
        {tab === "profile" && (
          <>
            {/* Profile preview */}
            <div className={styles.profile}>
              <Avatar username={displayName} avatar={avatarPreview} size={56} />
              <div className={styles.profileInfo}>
                <div className={styles.profileNameRow}>
                  <span className={styles.displayName}>{displayName}</span>
                  <RoleBadge
                    role={user.role}
                    customRoleName={user.customRoleName}
                  />
                </div>
                {user.nickname && (
                  <div className={styles.usernameHint}>@{user.username}</div>
                )}
              </div>
            </div>

            {/* Avatar */}
            <div className={styles.section}>
              <label className={styles.label}>AVATAR IMAGE</label>
              <p className={styles.hint}>JPG or PNG, max 500KB.</p>
              <div className={styles.avatarButtons}>
                <button
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  onClick={() => fileRef.current?.click()}
                >
                  {avatarPreview ? "CHANGE IMAGE" : "UPLOAD IMAGE"}
                </button>
                {avatarPreview && (
                  <button
                    className={`${styles.btn} ${styles.btnSecondary}`}
                    onClick={() => {
                      setAvatarPreview(null);
                      setAvatarMsg(null);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                  >
                    REMOVE
                  </button>
                )}
                <button
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  onClick={saveAvatar}
                  disabled={avatarSaving}
                  style={{ opacity: avatarSaving ? 0.5 : 1 }}
                >
                  {avatarSaving ? "SAVING..." : "SAVE AVATAR"}
                </button>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleAvatarFile}
              />
              {avatarMsg && (
                <p
                  className={`${styles.msg} ${avatarMsg.ok ? styles.msgOk : styles.msgErr}`}
                >
                  {avatarMsg.text}
                </p>
              )}
            </div>

            {/* Nickname */}
            <div className={styles.sectionDivider}>
              <label className={styles.label}>DISPLAY NAME</label>
              <div className={styles.row}>
                <input
                  className={styles.input}
                  placeholder="nickname (leave blank to use username)"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveNickname()}
                />
                <button
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  onClick={saveNickname}
                  disabled={nickSaving}
                  style={{ opacity: nickSaving ? 0.5 : 1 }}
                >
                  {nickSaving ? "..." : "SAVE"}
                </button>
              </div>
              {nickMsg && (
                <p
                  className={`${styles.msg} ${nickMsg.ok ? styles.msgOk : styles.msgErr}`}
                >
                  {nickMsg.text}
                </p>
              )}
            </div>

            {/* Password */}
            <div className={styles.sectionDivider}>
              <label className={styles.label}>CHANGE PASSWORD</label>
              <input
                className={`${styles.input} ${styles.inputSpaced}`}
                type="password"
                placeholder="Current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
              <input
                className={`${styles.input} ${styles.inputSpaced}`}
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <input
                className={`${styles.input} ${styles.inputSpacedLg}`}
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && savePassword()}
              />
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={savePassword}
                disabled={
                  pwSaving ||
                  !currentPassword ||
                  !newPassword ||
                  !confirmPassword
                }
                style={{
                  opacity:
                    pwSaving ||
                    !currentPassword ||
                    !newPassword ||
                    !confirmPassword
                      ? 0.5
                      : 1,
                }}
              >
                {pwSaving ? "UPDATING..." : "UPDATE PASSWORD"}
              </button>
              {pwMsg && (
                <p
                  className={`${styles.msg} ${pwMsg.ok ? styles.msgOk : styles.msgErr}`}
                >
                  {pwMsg.text}
                </p>
              )}
            </div>
          </>
        )}

        {/* Admin tab */}
        {tab === "admin" && isAdmin && (
          <div className={styles.section}>
            <AdminPanel token={user.token} currentUserId={user.id} />
          </div>
        )}
      </div>
    </div>
  );
}
