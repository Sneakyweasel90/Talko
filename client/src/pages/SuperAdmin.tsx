import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import axios from "axios";
import config from "../config";
import Avatar from "../components/ui/Avatar";
import TitleBar from "../components/ui/TitleBar";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import styles from "./SuperAdmin.module.css";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Stats {
  totalUsers: number;
  totalMessages: number;
  totalCommunities: number;
  bannedUsers: number;
  messagesLast24h: number;
  newUsersLast7d: number;
}

interface ChartPoint {
  day: string;
  count: number;
}

interface AdminUser {
  id: number;
  username: string;
  nickname: string | null;
  avatar: string | null;
  role: string;
  custom_role_name: string | null;
  banned_at: string | null;
  kicked_until: string | null;
  created_at: string;
}

interface AdminCommunity {
  id: number;
  name: string;
  icon: string | null;
  owner_username: string;
  member_count: number;
  channel_count: number;
  message_count: number;
  created_at: string;
}

interface UserMessage {
  id: number;
  content: string;
  created_at: string;
  edited_at: string | null;
  channel_id: string;
  channel_name: string | null;
  community_name: string | null;
  community_id: number | null;
}

interface CommunityMember {
  user_id: number;
  username: string;
  nickname: string | null;
  avatar: string | null;
  joined_at: string;
}

type NavSection = "overview" | "users" | "communities";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  );
}

function roleClass(role: string) {
  if (role === "admin") return styles.roleAdmin;
  if (role === "custom") return styles.roleCustom;
  return styles.roleUser;
}

function roleLabel(u: AdminUser) {
  return u.role === "custom" ? (u.custom_role_name ?? "custom") : u.role;
}

// Fill in missing days with 0 so chart lines are continuous
function fillDays(
  raw: { day: string; count: number }[],
  numDays = 30,
): ChartPoint[] {
  const map = new Map(raw.map((d) => [d.day, d.count]));
  const result: ChartPoint[] = [];
  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    const label = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    result.push({ day: label, count: map.get(key) ?? 0 });
  }
  return result;
}

// ── Custom Tooltip (recharts) ─────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.chartTooltip}>
      <div className={styles.chartTooltipLabel}>{label}</div>
      <div className={styles.chartTooltipValue}>
        {payload[0].value.toLocaleString()}
      </div>
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div
      className={`${styles.statCard} ${accent ? styles.statCardAccent : ""}`}
    >
      <div className={styles.statValue}>{value.toLocaleString()}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  );
}

// ── Overview Panel ────────────────────────────────────────────────────────────

function OverviewPanel({ token }: { token: string }) {
  const { theme } = useTheme();
  const [stats, setStats] = useState<Stats | null>(null);
  const [msgActivity, setMsgActivity] = useState<ChartPoint[]>([]);
  const [userActivity, setUserActivity] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      axios.get(`${config.HTTP}/api/superadmin/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      axios.get(`${config.HTTP}/api/superadmin/activity`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ])
      .then(([statsRes, activityRes]) => {
        setStats(statsRes.data);
        setMsgActivity(fillDays(activityRes.data.messages));
        setUserActivity(fillDays(activityRes.data.users));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className={styles.stateMsg}>LOADING STATS...</div>;
  if (!stats)
    return <div className={styles.stateMsg}>failed to load stats</div>;

  // Show only every 5th label on the x-axis to avoid crowding
  const xTickFormatter = (_: string, index: number) =>
    index % 5 === 0 ? _ : "";

  return (
    <div className={styles.overviewPanel}>
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>// OVERVIEW</span>
      </div>

      <div className={styles.overviewScroll}>
        {/* Stat cards */}
        <div className={styles.statsGrid}>
          <StatCard label="TOTAL USERS" value={stats.totalUsers} />
          <StatCard label="TOTAL MESSAGES" value={stats.totalMessages} />
          <StatCard label="COMMUNITIES" value={stats.totalCommunities} />
          <StatCard
            label="BANNED USERS"
            value={stats.bannedUsers}
            accent={stats.bannedUsers > 0}
          />
          <StatCard label="MESSAGES — 24H" value={stats.messagesLast24h} />
          <StatCard label="NEW USERS — 7D" value={stats.newUsersLast7d} />
        </div>

        {/* Charts */}
        <div className={styles.chartsRow}>
          <div className={styles.chartCard}>
            <div className={styles.chartTitle}>
              // MESSAGE ACTIVITY — 30 DAYS
            </div>
            <div className={styles.chartWrap}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={msgActivity}>
                  <defs>
                    <linearGradient id="msgGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor={theme.primary}
                        stopOpacity={0.25}
                      />
                      <stop
                        offset="95%"
                        stopColor={theme.primary}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={theme.border}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    tick={{
                      fill: theme.textDim,
                      fontSize: 10,
                      fontFamily: "Share Tech Mono, monospace",
                    }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={xTickFormatter}
                  />
                  <YAxis
                    tick={{
                      fill: theme.textDim,
                      fontSize: 10,
                      fontFamily: "Share Tech Mono, monospace",
                    }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    width={32}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke={theme.primary}
                    strokeWidth={2}
                    fill="url(#msgGrad)"
                    dot={false}
                    activeDot={{ r: 4, fill: theme.primary }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={styles.chartCard}>
            <div className={styles.chartTitle}>
              // USER REGISTRATIONS — 30 DAYS
            </div>
            <div className={styles.chartWrap}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={userActivity}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={theme.border}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="day"
                    tick={{
                      fill: theme.textDim,
                      fontSize: 10,
                      fontFamily: "Share Tech Mono, monospace",
                    }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={xTickFormatter}
                  />
                  <YAxis
                    tick={{
                      fill: theme.textDim,
                      fontSize: 10,
                      fontFamily: "Share Tech Mono, monospace",
                    }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                    width={32}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar
                    dataKey="count"
                    fill={theme.primaryGlow}
                    stroke={theme.primaryDim}
                    strokeWidth={1}
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── User Detail (right panel) ─────────────────────────────────────────────────

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
    fn: () => Promise<void>,
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

  const toggleBan = async () => {
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
              <span className={`${styles.roleBadge} ${roleClass(user.role)}`}>
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

function UsersPanel({
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
                        className={`${styles.roleBadge} ${roleClass(u.role)}`}
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

// ── Communities Panel ─────────────────────────────────────────────────────────

function CommunitiesPanel({
  token,
  onViewUser,
}: {
  token: string;
  onViewUser: (user: AdminUser) => void;
}) {
  const [communities, setCommunities] = useState<AdminCommunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdminCommunity | null>(null);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    axios
      .get(`${config.HTTP}/api/superadmin/communities`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(({ data }) => setCommunities(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const selectCommunity = async (c: AdminCommunity) => {
    if (selected?.id === c.id) {
      setSelected(null);
      setMembers([]);
      return;
    }
    setSelected(c);
    setLoadingMembers(true);
    try {
      const { data } = await axios.get(
        `${config.HTTP}/api/communities/${c.id}/members`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setMembers(data);
    } catch {
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  };

  const deleteCommunity = async (c: AdminCommunity) => {
    if (
      !confirm(
        `Permanently delete "${c.name}"?\n\nThis will delete all ${c.member_count} members, ${c.channel_count} channels, and ${c.message_count.toLocaleString()} messages. This cannot be undone.`,
      )
    )
      return;
    setDeletingId(c.id);
    try {
      await axios.delete(`${config.HTTP}/api/superadmin/communities/${c.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCommunities((prev) => prev.filter((x) => x.id !== c.id));
      if (selected?.id === c.id) {
        setSelected(null);
        setMembers([]);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to delete community");
    } finally {
      setDeletingId(null);
    }
  };

  const viewUserMsgs = async (member: CommunityMember) => {
    try {
      const { data } = await axios.get(`${config.HTTP}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const adminUser = data.users.find(
        (u: AdminUser) => u.id === member.user_id,
      );
      if (adminUser) onViewUser(adminUser);
    } catch {}
  };

  const filteredMembers = members.filter(
    (m) =>
      !memberSearch ||
      m.username.toLowerCase().includes(memberSearch.toLowerCase()) ||
      (m.nickname ?? "").toLowerCase().includes(memberSearch.toLowerCase()),
  );

  return (
    <div className={styles.splitPanel}>
      <div
        className={`${styles.tablePanel} ${selected ? styles.tablePanelNarrow : ""}`}
      >
        <div className={styles.panelHeader}>
          <span className={styles.panelTitle}>// COMMUNITIES</span>
          <span className={styles.panelCount}>{communities.length}</span>
        </div>

        {loading ? (
          <div className={styles.stateMsg}>LOADING COMMUNITIES...</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>NAME</th>
                  <th className={styles.th}>OWNER</th>
                  <th className={styles.th}>MEMBERS</th>
                  <th className={styles.th}>CHANNELS</th>
                  <th className={styles.th}>MESSAGES</th>
                  <th className={styles.th}>CREATED</th>
                </tr>
              </thead>
              <tbody>
                {communities.map((c) => (
                  <tr
                    key={c.id}
                    className={`${styles.tr} ${selected?.id === c.id ? styles.trSelected : ""}`}
                    onClick={() => selectCommunity(c)}
                  >
                    <td className={styles.td}>
                      <div className={styles.commCell}>
                        {c.icon ? (
                          <img
                            src={c.icon}
                            className={styles.commIcon}
                            alt=""
                          />
                        ) : (
                          <div className={styles.commIconFallback}>
                            {c.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <span className={styles.cellName}>{c.name}</span>
                      </div>
                    </td>
                    <td className={styles.td}>
                      <span className={styles.cellMuted}>
                        {c.owner_username}
                      </span>
                    </td>
                    <td className={styles.td}>
                      <span className={styles.cellNum}>{c.member_count}</span>
                    </td>
                    <td className={styles.td}>
                      <span className={styles.cellNum}>{c.channel_count}</span>
                    </td>
                    <td className={styles.td}>
                      <span className={styles.cellNum}>
                        {c.message_count.toLocaleString()}
                      </span>
                    </td>
                    <td className={styles.td}>
                      <span className={styles.cellMuted}>
                        {fmtDate(c.created_at)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div className={styles.detail}>
          <div className={styles.detailHeader}>
            <div className={styles.detailUserInfo}>
              {selected.icon ? (
                <img src={selected.icon} className={styles.commIconLg} alt="" />
              ) : (
                <div className={styles.commIconFallbackLg}>
                  {selected.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <div className={styles.detailName}>{selected.name}</div>
                <div className={styles.detailHandle}>
                  owner: {selected.owner_username}
                </div>
                <div className={styles.detailBadges}>
                  <span className={styles.metaTag}>
                    {selected.member_count} members
                  </span>
                  <span className={styles.metaTag}>
                    {selected.channel_count} channels
                  </span>
                  <span className={styles.metaTag}>
                    {selected.message_count.toLocaleString()} messages
                  </span>
                </div>
              </div>
            </div>
            <button
              className={styles.closeBtn}
              onClick={() => {
                setSelected(null);
                setMembers([]);
              }}
            >
              ✕
            </button>
          </div>

          <div className={styles.detailMeta}>
            <span>ID: {selected.id}</span>
            <span>Created: {fmtDate(selected.created_at)}</span>
          </div>

          {/* Delete community action */}
          <div className={styles.detailActions}>
            <button
              className={`${styles.actionBtn} ${styles.actionDanger}`}
              onClick={() => deleteCommunity(selected)}
              disabled={deletingId === selected.id}
            >
              {deletingId === selected.id ? "DELETING..." : "DELETE COMMUNITY"}
            </button>
          </div>

          <div className={styles.detailSection}>
            <div className={styles.sectionTitle}>
              // MEMBERS — {members.length}
            </div>
            <input
              className={styles.searchInput}
              style={{ margin: "8px 0 4px" }}
              placeholder="search members..."
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
            />
            {loadingMembers ? (
              <div className={styles.stateMsg}>LOADING...</div>
            ) : (
              <div className={styles.memberList}>
                {filteredMembers.map((m) => (
                  <div key={m.user_id} className={styles.memberRow}>
                    <Avatar
                      username={m.nickname || m.username}
                      avatar={m.avatar}
                      size={22}
                    />
                    <span className={styles.memberName}>
                      {m.nickname || m.username}
                    </span>
                    {m.nickname && (
                      <span className={styles.cellHandle}>@{m.username}</span>
                    )}
                    <span className={styles.memberJoined}>
                      {fmtDate(m.joined_at)}
                    </span>
                    <button
                      className={styles.viewMsgsBtn}
                      onClick={() => viewUserMsgs(m)}
                    >
                      VIEW MSGS
                    </button>
                  </div>
                ))}
                {filteredMembers.length === 0 && (
                  <div className={styles.stateMsg}>no members found</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SuperAdmin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [nav, setNav] = useState<NavSection>("overview");
  const [jumpUser, setJumpUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    if (user?.role !== "admin") navigate("/");
  }, [user, navigate]);

  const handleViewUser = (adminUser: AdminUser) => {
    setJumpUser(adminUser);
    setNav("users");
  };

  const navItems: { key: NavSection; icon: string; label: string }[] = [
    { key: "overview", icon: "◈", label: "OVERVIEW" },
    { key: "users", icon: "◉", label: "USERS" },
    { key: "communities", icon: "⬡", label: "COMMUNITIES" },
  ];

  return (
    <div className={styles.root}>
      <TitleBar />
      <div className={styles.shell}>
        <nav className={styles.sidebar}>
          <div className={styles.brand}>
            <div className={styles.brandTitle}>TALKO</div>
            <div className={styles.brandSub}>ADMIN CONSOLE</div>
          </div>
          <div className={styles.navList}>
            {navItems.map(({ key, icon, label }) => (
              <button
                key={key}
                className={`${styles.navItem} ${nav === key ? styles.navItemActive : ""}`}
                onClick={() => {
                  setNav(key);
                  if (key !== "users") setJumpUser(null);
                }}
              >
                <span className={styles.navIcon}>{icon}</span>
                {label}
              </button>
            ))}
          </div>
          <button className={styles.exitBtn} onClick={() => navigate("/")}>
            ← EXIT
          </button>
        </nav>

        <main className={styles.main}>
          {nav === "overview" && <OverviewPanel token={user!.token} />}
          {nav === "users" && (
            <UsersPanel
              key={jumpUser?.id ?? "users-panel"}
              token={user!.token}
              initialUser={jumpUser}
            />
          )}
          {nav === "communities" && (
            <CommunitiesPanel token={user!.token} onViewUser={handleViewUser} />
          )}
        </main>
      </div>
    </div>
  );
}
