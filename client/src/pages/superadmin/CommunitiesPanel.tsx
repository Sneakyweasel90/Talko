import { useState, useEffect } from "react";
import axios from "axios";
import config from "../../config";
import Avatar from "../../components/ui/Avatar";
import type { AdminUser, AdminCommunity, CommunityMember } from "./types";
import { fmtDate } from "./helpers";
import styles from "../SuperAdmin.module.css";

export function CommunitiesPanel({
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
