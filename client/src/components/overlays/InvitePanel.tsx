import axios from "axios";
import { useState, useCallback, useEffect } from "react";
import config from "../../config";
import styles from "./InvitePanel.module.css";

interface InviteToken {
  id: number;
  token: string;
  note: string | null;
  created_at: string;
  expires_at: string | null;
  used_at: string | null;
  used_by_username: string | null;
}

export default function InvitePanel({ token }: { token: string }) {
  const [invites, setInvites] = useState<InviteToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [expiresIn, setExpiresIn] = useState("24");
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${config.HTTP}/api/admin/invites`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setInvites(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    setCreating(true);
    try {
      const body: Record<string, unknown> = { note: note.trim() || undefined };
      if (expiresIn !== "never") body.expiresInHours = parseInt(expiresIn);
      const { data } = await axios.post(
        `${config.HTTP}/api/admin/invites`,
        body,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      setInvites((prev) => [data, ...prev]);
      setNote("");
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) alert(err.response?.data?.error || "Failed");
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: number) => {
    if (!confirm("Revoke this invite code?")) return;
    try {
      await axios.delete(`${config.HTTP}/api/admin/invites/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setInvites((prev) => prev.filter((i) => i.id !== id));
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) alert(err.response?.data?.error || "Failed");
    }
  };

  const copy = async (invite: InviteToken) => {
    await navigator.clipboard.writeText(invite.token);
    setCopied(invite.id);
    setTimeout(() => setCopied(null), 2000);
  };

  const formatExpiry = (invite: InviteToken) => {
    if (invite.used_at) return `used by ${invite.used_by_username}`;
    if (!invite.expires_at) return "no expiry";
    const d = new Date(invite.expires_at);
    if (d < new Date()) return "expired";
    return `expires ${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  };

  const isUsedOrExpired = (invite: InviteToken) =>
    !!invite.used_at ||
    (!!invite.expires_at && new Date(invite.expires_at) < new Date());

  if (loading) return <div className={styles.loading}>LOADING...</div>;

  return (
    <div>
      {/* Generate form */}
      <div className={styles.generateForm}>
        <div className={styles.generateLabel}>GENERATE INVITE</div>
        <input
          className={styles.input}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="note (optional — who is this for?)"
        />
        <div className={styles.expiryRow}>
          <span className={styles.expiryLabel}>EXPIRES IN</span>
          <select
            className={styles.select}
            value={expiresIn}
            onChange={(e) => setExpiresIn(e.target.value)}
          >
            <option value="1">1 hour</option>
            <option value="6">6 hours</option>
            <option value="24">24 hours</option>
            <option value="72">3 days</option>
            <option value="168">7 days</option>
            <option value="never">never</option>
          </select>
          <button
            onClick={create}
            disabled={creating}
            className={`${styles.btn} ${styles.btnPrimary} ${styles.createBtn}`}
          >
            {creating ? "..." : "+ CREATE"}
          </button>
        </div>
      </div>

      {/* Token list */}
      {invites.length === 0 ? (
        <div className={styles.empty}>No invite codes yet</div>
      ) : (
        <div className={styles.tokenList}>
          {invites.map((inv) => {
            const dead = isUsedOrExpired(inv);
            return (
              <div
                key={inv.id}
                className={`${styles.tokenCard} ${dead ? styles.dead : ""}`}
              >
                <div className={styles.tokenRow}>
                  <code
                    className={`${styles.tokenCode} ${dead ? styles.dead : ""}`}
                  >
                    {inv.token}
                  </code>
                  {!dead && (
                    <button
                      onClick={() => copy(inv)}
                      className={`${styles.btn} ${styles.btnPrimary}`}
                    >
                      {copied === inv.id ? "✓" : "COPY"}
                    </button>
                  )}
                  <button
                    onClick={() => revoke(inv.id)}
                    className={`${styles.btn} ${styles.btnMuted}`}
                  >
                    ✕
                  </button>
                </div>
                <div className={styles.tokenMeta}>
                  {inv.note && <span>{inv.note}</span>}
                  <span
                    className={
                      inv.note ? styles.tokenExpiry : styles.tokenExpiryAuto
                    }
                  >
                    {formatExpiry(inv)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
