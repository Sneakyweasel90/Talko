import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import config from "../../config";
import Avatar from "../../components/ui/Avatar";
import type { AdminUser, UserMessage } from "./types";
import { fmtDate, fmtDateTime, roleClass, roleLabel } from "./helpers";
import styles from "../SuperAdmin.module.css";

// ── User Detail ───────────────────────────────────────────────────────────────

function UserDetail({
  user,
  token,
  onClose,
  onUserChanged,
}: {
  user: AdminUser;
  token: string;
  onClose: () => void;
  onUserChanged: (id: number, patch: Partial<AdminUser>) => void;
}) {
  const [messages, setMessages] = useState<UserMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [oldestId, setOldestId] = useState<number | null>(null);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [kickMinutes, setKickMinutes] = useState("10");
  const [busy, setBusy] = useState(false);

  const isBanned = !!user.banned_at;
  const isKicked =
    !!user.kicked_until && new Date(user.kicked_until) > new Date();

  const loadMsgs = useCallback(
    async (before?: number) => {
      const params: Record<string, any> = { limit: 50 };
      if (before) params.before = before;
      const { data } = await axios.get(
        `${config.HTTP}/api/superadmin/users/${user.id}/messages`,
        { headers: { Authorization: `Bearer ${token}` }, params },
      );
      return data;
    },
    [user.id, token],
  );

  useEffect(() => {
    setMessages([]);
    setLoadingMsgs(true);
    loadMsgs().then((d) => {
      setMessages(d.messages);
      setHasMore(d.hasMore);
      setOldestId(d.oldestId);
      setLoadingMsgs(false);
    });
  }, [user.id, loadMsgs]);

  const handleLoadMore = async () => {
    if (!oldestId || loadingMore) return;
    setLoadingMore(true);
    const d = await loadMsgs(oldestId);
    setMessages((prev) => [...prev, ...d.messages]);
    setHasMore(d.hasMore);
    setOldestId(d.oldestId);
    setLoadingMore(false);
  };

  const deleteMessage = async (msgId: number) => {
    try {
      await axios.delete(`${config.HTTP}/api/superadmin/messages/${msgId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to delete message");
    }
  };

  const doAction = async (
    fn: () => Promise<any>,
    patch: Partial<AdminUser>,
  ) => {
    setBusy(true);
    try {
      await fn();
      onUserChanged(user.id, patch);
    } catch (err: any) {
      alert(err.response?.data?.error || "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const kick = () => {
    const mins = Math.max(1, parseInt(kickMinutes) || 10);
    doAction(
      () =>
        axios.post(
          `${config.HTTP}/api/admin/users/${user.id}/kick`,
          { durationMinutes: mins },
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      { kicked_until: new Date(Date.now() + mins * 60 * 1000).toISOString() },
    );
  };

  const toggleBan = () => {
    if (!isBanned && !confirm(`Ban ${user.username}? They will be logged out.`))
      return;
    const action = isBanned ? "unban" : "ban";
    doAction(
      () =>
        axios.post(
          `${config.HTTP}/api/admin/users/${user.id}/${action}`,
          {},
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      { banned_at: isBanned ? null : new Date().toISOString() },
    );
  };

  const deleteUser = async () => {
    if (
      !confirm(
        `Permanently delete ${user.username}?\n\nThis removes all their data and cannot be undone.`,
      )
    )
      return;
    setBusy(true);
    try {
      await axios.delete(`${config.HTTP}/api/admin/users/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      onClose();
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to delete");
      setBusy(false);
    }
  };

  return (
    <div className={styles.detail}>
      <div className={styles.detailHeader}>
        <div className={styles.detailUserInfo}>
          <Avatar
            username={user.nickname || user.username}
            avatar={user.avatar}
            size={42}
          />
          <div>
            <div className={styles.detailName}>
              {user.nickname || user.username}
            </div>
            {user.nickname && (
              <div className={styles.detailHandle}>@{user.username}</div>
            )}
            <div className={styles.detailBadges}>
              <span
                className={`${styles.roleBadge} ${styles[roleClass(user.role)]}`}
              >
                {roleLabel(user)}
              </span>
              {isBanned && <span className={styles.badgeBanned}>BANNED</span>}
              {isKicked && !isBanned && (
                <span className={styles.badgeKicked}>KICKED</span>
              )}
            </div>
          </div>
        </div>
        <button className={styles.closeBtn} onClick={onClose}>
          ✕
        </button>
      </div>

      <div className={styles.detailMeta}>
        <span>ID: {user.id}</span>
        <span>Joined: {fmtDate(user.created_at)}</span>
      </div>

      <div className={styles.detailActions}>
        <div className={styles.kickGroup}>
          <input
            className={styles.kickInput}
            type="number"
            min={1}
            max={10080}
            value={kickMinutes}
            onChange={(e) => setKickMinutes(e.target.value)}
            title="Duration in minutes"
            disabled={busy}
          />
          <span className={styles.kickUnit}>min</span>
          <button
            className={`${styles.actionBtn} ${styles.actionMuted}`}
            onClick={kick}
            disabled={busy}
          >
            KICK
          </button>
        </div>
        <button
          className={`${styles.actionBtn} ${isBanned ? styles.actionSuccess : styles.actionWarn}`}
          onClick={toggleBan}
          disabled={busy}
        >
          {isBanned ? "UNBAN" : "BAN"}
        </button>
        <button
          className={`${styles.actionBtn} ${styles.actionDanger}`}
          onClick={deleteUser}
          disabled={busy}
        >
          DELETE USER
        </button>
      </div>

      <div className={styles.detailSection}>
        <div className={styles.sectionTitle}>
          // MESSAGES
          {!loadingMsgs && ` — ${messages.length}${hasMore ? "+" : ""}`}
        </div>
        {loadingMsgs ? (
          <div className={styles.stateMsg}>LOADING...</div>
        ) : messages.length === 0 ? (
          <div className={styles.stateMsg}>no messages</div>
        ) : (
          <div className={styles.msgList}>
            {messages.map((m) => (
              <div key={m.id} className={styles.msgItem}>
                <div className={styles.msgTop}>
                  <div className={styles.msgContent}>
                    {m.content.startsWith("[img]")
                      ? "📎 [image]"
                      : m.content.startsWith("[gif]")
                        ? "🎞 [gif]"
                        : m.content.length > 140
                          ? m.content.slice(0, 140) + "…"
                          : m.content}
                  </div>
                  <button
                    className={styles.msgDeleteBtn}
                    onClick={() => deleteMessage(m.id)}
                    title="Delete message"
                  >
                    ✕
                  </button>
                </div>
                <div className={styles.msgMeta}>
                  {m.community_name && (
                    <span className={styles.metaTag}>{m.community_name}</span>
                  )}
                  {m.channel_name ? (
                    <span className={styles.metaTag}>#{m.channel_name}</span>
                  ) : m.channel_id?.startsWith("dm:") ? (
                    <span className={styles.metaTag}>DM</span>
                  ) : null}
                  <span className={styles.metaTime}>
                    {fmtDateTime(m.created_at)}
                  </span>
                  {m.edited_at && (
                    <span className={styles.metaEdited}>(edited)</span>
                  )}
                </div>
              </div>
            ))}
            {hasMore && (
              <button
                className={styles.loadMoreBtn}
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? "LOADING..." : "▼ LOAD MORE"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Users Panel ───────────────────────────────────────────────────────────────

export function UsersPanel({
  token,
  initialUser,
}: {
  token: string;
  initialUser?: AdminUser | null;
}) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(
    initialUser ?? null,
  );
  const [sortBy, setSortBy] = useState<"username" | "created_at" | "role">(
    "created_at",
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filter, setFilter] = useState<"all" | "banned" | "active">("all");

  useEffect(() => {
    axios
      .get(`${config.HTTP}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(({ data }) => setUsers(data.users))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(col);
      setSortDir("asc");
    }
  };

  const sortArrow = (col: typeof sortBy) =>
    sortBy !== col ? "" : sortDir === "asc" ? " ▲" : " ▼";

  const filtered = users
    .filter((u) => {
      if (filter === "banned" && !u.banned_at) return false;
      if (filter === "active" && u.banned_at) return false;
      if (!search) return true;
      return (
        u.username.toLowerCase().includes(search.toLowerCase()) ||
        (u.nickname ?? "").toLowerCase().includes(search.toLowerCase())
      );
    })
    .sort((a, b) => {
      const va =
        sortBy === "username"
          ? a.username
          : sortBy === "role"
            ? a.role
            : a.created_at;
      const vb =
        sortBy === "username"
          ? b.username
          : sortBy === "role"
            ? b.role
            : b.created_at;
      return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    });

  return (
    <div className={styles.splitPanel}>
      <div
        className={`${styles.tablePanel} ${selectedUser ? styles.tablePanelNarrow : ""}`}
      >
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>// USERS</span>
          <span className={styles.panelCount}>
            {filtered.length} / {users.length}
          </span>
          <input
            className={styles.searchInput}
            placeholder="search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className={styles.filterGroup}>
            {(["all", "active", "banned"] as const).map((f) => (
              <button
                key={f}
                className={`${styles.filterBtn} ${filter === f ? styles.filterBtnActive : ""}`}
                onClick={() => setFilter(f)}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className={styles.stateMsg}>LOADING USERS...</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th
                    className={styles.th}
                    onClick={() => toggleSort("username")}
                  >
                    USER{sortArrow("username")}
                  </th>
                  <th className={styles.th} onClick={() => toggleSort("role")}>
                    ROLE{sortArrow("role")}
                  </th>
                  <th
                    className={styles.th}
                    onClick={() => toggleSort("created_at")}
                  >
                    JOINED{sortArrow("created_at")}
                  </th>
                  <th className={styles.th}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr
                    key={u.id}
                    className={`${styles.tr} ${selectedUser?.id === u.id ? styles.trSelected : ""} ${u.banned_at ? styles.trBanned : ""}`}
                    onClick={() =>
                      setSelectedUser(selectedUser?.id === u.id ? null : u)
                    }
                  >
                    <td className={styles.td}>
                      <div className={styles.userCell}>
                        <Avatar
                          username={u.nickname || u.username}
                          avatar={u.avatar}
                          size={20}
                        />
                        <span className={styles.cellName}>
                          {u.nickname || u.username}
                        </span>
                        {u.nickname && (
                          <span className={styles.cellHandle}>
                            @{u.username}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={styles.td}>
                      <span
                        className={`${styles.roleBadge} ${styles[roleClass(u.role)]}`}
                      >
                        {roleLabel(u)}
                      </span>
                    </td>
                    <td className={styles.td}>
                      <span className={styles.cellMuted}>
                        {fmtDate(u.created_at)}
                      </span>
                    </td>
                    <td className={styles.td}>
                      {u.banned_at ? (
                        <span className={styles.statusBanned}>BANNED</span>
                      ) : u.kicked_until &&
                        new Date(u.kicked_until) > new Date() ? (
                        <span className={styles.statusKicked}>KICKED</span>
                      ) : (
                        <span className={styles.statusOk}>ACTIVE</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedUser && (
        <UserDetail
          key={selectedUser.id}
          user={selectedUser}
          token={token}
          onClose={() => setSelectedUser(null)}
          onUserChanged={(id, patch) => {
            setUsers((prev) =>
              prev.map((u) => (u.id === id ? { ...u, ...patch } : u)),
            );
            setSelectedUser((prev) =>
              prev?.id === id ? { ...prev, ...patch } : prev,
            );
          }}
        />
      )}
    </div>
  );
}
