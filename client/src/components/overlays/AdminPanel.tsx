import { useCallback, useEffect, useState } from "react";
import { AdminUser, UserRole } from "../../types";
import axios from "axios";
import Avatar from "../ui/Avatar";
import config from "../../config";
import InvitePanel from "./InvitePanel";
import styles from "./AdminPanel.module.css";

  function AfkSettingsPanel({ token }: { token: string }) {
    const [minutes, setMinutes] = useState<number>(10);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    useEffect(() => {
      axios.get(`${config.HTTP}/api/admin/afk-timeout`)
        .then(({ data }) => setMinutes(data.afk_timeout_minutes))
        .catch(() => {});
    }, []);

    const save = async () => {
      setSaving(true);
      try {
        await axios.patch(
          `${config.HTTP}/api/admin/settings`,
          { afk_timeout_minutes: minutes },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setMsg("Saved");
        setTimeout(() => setMsg(null), 2000);
      } catch (err: unknown) {
        if (axios.isAxiosError(err)) setMsg(err.response?.data?.error || "Failed");
        else setMsg("Failed");
      } finally {
        setSaving(false);
      }
    };

    return (
      <div>
        <div className={styles.generateLabel}>AFK TIMEOUT</div>
        <div className={styles.expiryRow}>
          <select
            className={styles.select}
            value={String(minutes)}
            onChange={e => setMinutes(Number(e.target.value))}
          >
            {[5, 10, 15, 20, 30, 60].map(m => (
              <option key={m} value={String(m)}>{m} minutes</option>
            ))}
          </select>
          <button onClick={save} disabled={saving} className={`${styles.btn} ${styles.btnPrimary}`}>
            {saving ? "..." : "SAVE"}
          </button>
          {msg && <span style={{ fontSize: "0.7rem", color: "var(--primary)" }}>{msg}</span>}
        </div>
      </div>
    );
  }

export default function AdminPanel({ token, currentUserId }: { token: string; currentUserId: number }) {
  const [adminTab, setAdminTab] = useState<"users" | "invites">("users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [ownerId, setOwnerId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [customNames, setCustomNames] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get(`${config.HTTP}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(data.users);
      setOwnerId(data.ownerId);
      const names: Record<number, string> = {};
      for (const u of data.users) {
        if (u.role === "custom") names[u.id] = u.custom_role_name || "";
      }
      setCustomNames(names);
    } catch {
      setError("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const setRole = async (userId: number, role: UserRole) => {
    try {
      await axios.patch(
        `${config.HTTP}/api/admin/users/${userId}/role`,
        { role, customRoleName: customNames[userId] || "Member" },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setUsers(prev => prev.map(u => u.id === userId
        ? { ...u, role, custom_role_name: role === "custom" ? (customNames[userId] || "Member") : null }
        : u
      ));
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) alert(err.response?.data?.error || "Failed");
    }
  };

  const saveCustomName = async (userId: number) => {
    try {
      await axios.patch(
        `${config.HTTP}/api/admin/users/${userId}/role`,
        { role: "custom", customRoleName: customNames[userId] || "Member" },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setUsers(prev => prev.map(u => u.id === userId
        ? { ...u, custom_role_name: customNames[userId] || "Member" }
        : u
      ));
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) alert(err.response?.data?.error || "Failed");
    }
  };

  const kick = async (userId: number, username: string) => {
    if (!window.confirm(`Kick ${username}? They will be logged out immediately.`)) return;
    try {
      await axios.post(`${config.HTTP}/api/admin/users/${userId}/kick`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert(`${username} has been kicked.`);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) alert(err.response?.data?.error || "Failed");
    }
  };

  const ban = async (userId: number, username: string, isBanned: boolean) => {
    const action = isBanned ? "unban" : "ban";
    if (!isBanned && !window.confirm(`Ban ${username}? They will be logged out and blocked from logging in.`)) return;
    try {
      await axios.post(`${config.HTTP}/api/admin/users/${userId}/${action}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(prev => prev.map(u => u.id === userId
        ? { ...u, banned_at: isBanned ? null : new Date().toISOString() }
        : u
      ));
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) alert(err.response?.data?.error || "Failed");
    }
  };

  const roleColorClass = (role: UserRole) => {
    if (role === "admin") return styles.btnDanger;
    if (role === "custom") return styles.btnPrimary;
    return styles.btnMuted;
  };

  return (
    <div>
      {/* Sub-tab bar */}
      <div className={styles.tabBar}>
        {(["users", "invites", "settings"] as const).map(t => (
          <button
            key={t}
            onClick={() => setAdminTab(t)}
            className={`${styles.tab} ${adminTab === t ? styles.active : ""}`}
          >
            {t === "users" ? "USERS" : t === "invites" ? "INVITE CODES" : "SETTINGS"}
          </button>
        ))}
      </div>

      {/* Users sub-tab */}
      {adminTab === "users" && (
        <>
          {loading && <div className={styles.loadingText}>LOADING USERS...</div>}
          {error && <div className={styles.errorText}>{error}</div>}
          <div className={styles.userList}>
            {users.map(u => {
              const isSelf = u.id === currentUserId;
              const isOwner = u.id === ownerId;
              const isAdmin = u.role === "admin";
              const isProtected = isOwner || (isAdmin && currentUserId !== ownerId);
              const isBanned = !!u.banned_at;

              return (
                <div
                  key={u.id}
                  className={`${styles.userCard} ${isBanned ? styles.banned : ""}`}
                >
                  <div className={`${styles.userRow} ${isProtected || isSelf ? styles.noActions : styles.hasActions}`}>
                    <Avatar username={u.nickname || u.username} avatar={u.avatar} size={24} />
                    <span className={styles.userName}>
                      {u.nickname || u.username}
                      {u.nickname && <span className={styles.userNameHint}> @{u.username}</span>}
                      {isSelf && <span className={styles.userSelfHint}> (you)</span>}
                    </span>
                    <span
                      className={`${styles.userRole} ${roleColorClass(u.role as UserRole)}`}
                      style={{ border: "none", background: "none", padding: 0 }}
                    >
                      {u.role === "custom" ? u.custom_role_name : u.role}
                    </span>
                  </div>

                  {isProtected && !isSelf && (
                    <div className={styles.protectedNote}>
                      {isOwner ? "server owner — cannot be modified" : "admin — only owner can modify"}
                    </div>
                  )}

                  {!isSelf && !isProtected && (
                    <div className={styles.actions}>
                      <select
                        value={u.role}
                        onChange={e => setRole(u.id, e.target.value as UserRole)}
                        className={styles.roleSelect}
                      >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                        <option value="custom">custom</option>
                      </select>

                      {u.role === "custom" && (
                        <>
                          <input
                            value={customNames[u.id] ?? u.custom_role_name ?? ""}
                            onChange={e => setCustomNames(prev => ({ ...prev, [u.id]: e.target.value }))}
                            onKeyDown={e => e.key === "Enter" && saveCustomName(u.id)}
                            placeholder="role name"
                            className={styles.customNameInput}
                          />
                          <button
                            onClick={() => saveCustomName(u.id)}
                            className={`${styles.btn} ${styles.btnPrimary}`}
                          >
                            SAVE
                          </button>
                        </>
                      )}

                      <div className={styles.actionGroupRight}>
                        <button
                          onClick={() => kick(u.id, u.username)}
                          className={`${styles.btn} ${styles.btnMuted}`}
                        >
                          KICK
                        </button>
                        <button
                          onClick={() => ban(u.id, u.username, isBanned)}
                          className={`${styles.btn} ${isBanned ? styles.btnSuccess : styles.btnDanger}`}
                        >
                          {isBanned ? "UNBAN" : "BAN"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Invites sub-tab */}
      {adminTab === "invites" && <InvitePanel token={token} />}

      {/* Settings sub-tab */}
      {adminTab === "settings" && <AfkSettingsPanel token={token} />}
    </div>
  );
}