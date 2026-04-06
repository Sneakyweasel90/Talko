import { useState, useEffect } from "react";
import axios from "axios";
import config from "../../config";
import type { AuditLogEntry } from "./types";
import { fmtDateTime } from "./helpers";
import styles from "../SuperAdmin.module.css";

const ACTION_META: Record<
  string,
  { icon: string; label: string; color: string }
> = {
  ban: { icon: "◉", label: "BANNED", color: "#f87171" },
  unban: { icon: "◉", label: "UNBANNED", color: "#4ade80" },
  kick: { icon: "⚡", label: "KICKED", color: "#facc15" },
  delete_user: { icon: "✕", label: "DELETED USER", color: "#f87171" },
  delete_message: { icon: "✕", label: "DELETED MSG", color: "#f87171" },
  delete_community: { icon: "✕", label: "DELETED COMMUNITY", color: "#f87171" },
};

function describeEntry(entry: AuditLogEntry): string {
  const meta = ACTION_META[entry.action];
  const label = meta?.label ?? entry.action.toUpperCase();
  const parts: string[] = [label];
  if (entry.target_name) parts.push(`"${entry.target_name}"`);
  if (entry.action === "kick" && entry.metadata?.durationMinutes)
    parts.push(`for ${entry.metadata.durationMinutes}m`);
  return parts.join(" ");
}

export function AuditLogPanel({ token }: { token: string }) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [oldestId, setOldestId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filterAction, setFilterAction] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = async (before?: number) => {
    const params: Record<string, any> = { limit: 50 };
    if (before) params.before = before;
    if (filterAction !== "all") params.action = filterAction;
    const { data } = await axios.get(
      `${config.HTTP}/api/superadmin/audit-log`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params,
      },
    );
    return data;
  };

  useEffect(() => {
    setEntries([]);
    setError(null);
    setLoading(true);
    fetchEntries()
      .then((d) => {
        // Guard against the table not existing yet or unexpected response shape
        setEntries(d?.entries ?? []);
        setHasMore(d?.hasMore ?? false);
        setOldestId(d?.oldestId ?? null);
      })
      .catch((err) => {
        setError(err?.response?.data?.error ?? "Failed to load audit log");
      })
      .finally(() => setLoading(false));
  }, [token, filterAction]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = async () => {
    if (!oldestId || loadingMore) return;
    setLoadingMore(true);
    try {
      const d = await fetchEntries(oldestId);
      setEntries((prev) => [...prev, ...(d?.entries ?? [])]);
      setHasMore(d?.hasMore ?? false);
      setOldestId(d?.oldestId ?? null);
    } catch {
    } finally {
      setLoadingMore(false);
    }
  };

  const filterOptions = [
    { key: "all", label: "ALL" },
    { key: "ban", label: "BANS" },
    { key: "kick", label: "KICKS" },
    { key: "delete_user", label: "DELETED USERS" },
    { key: "delete_message", label: "DELETED MSGS" },
    { key: "delete_community", label: "DELETED COMMS" },
  ];

  return (
    <div className={styles.auditPanel}>
      <div className={styles.panelHeader}>
        <span className={styles.panelTitle}>// AUDIT LOG</span>
        <span className={styles.panelCount}>
          {entries.length}
          {hasMore ? "+" : ""} entries
        </span>
        <div className={styles.filterGroup} style={{ flexWrap: "wrap" }}>
          {filterOptions.map((f) => (
            <button
              key={f.key}
              className={`${styles.filterBtn} ${filterAction === f.key ? styles.filterBtnActive : ""}`}
              onClick={() => setFilterAction(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className={styles.stateMsg}>LOADING AUDIT LOG...</div>
      ) : error ? (
        <div className={styles.stateMsg} style={{ color: "#f87171" }}>
          {error}
        </div>
      ) : entries.length === 0 ? (
        <div className={styles.stateMsg}>no entries found</div>
      ) : (
        <div className={styles.auditList}>
          {entries.map((entry) => {
            const meta = ACTION_META[entry.action];
            return (
              <div key={entry.id} className={styles.auditEntry}>
                <span
                  className={styles.auditIcon}
                  style={{ color: meta?.color ?? "var(--text-dim)" }}
                >
                  {meta?.icon ?? "◈"}
                </span>
                <div className={styles.auditBody}>
                  <span
                    className={styles.auditAction}
                    style={{ color: meta?.color ?? "var(--text)" }}
                  >
                    {describeEntry(entry)}
                  </span>
                  <span className={styles.auditBy}>
                    — by {entry.admin_username}
                  </span>
                </div>
                <span className={styles.auditTime}>
                  {fmtDateTime(entry.created_at)}
                </span>
              </div>
            );
          })}
          {hasMore && (
            <button
              className={styles.loadMoreBtn}
              onClick={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? "LOADING..." : "▼ LOAD MORE"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
