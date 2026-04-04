import { useState, useCallback } from "react";
import axios from "axios";
import config from "../../config";
import styles from "./InviteButton.module.css";

interface Props {
  communityId: number | null;
  token: string;
}

export default function InviteButton({ communityId, token }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchInvite = useCallback(async () => {
    if (!communityId) return;
    setLoading(true);
    try {
      const { data } = await axios.get(
        `${config.HTTP}/api/communities/${communityId}/invites`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      // Use the first permanent invite (no expiry)
      const permanent = data.find((i: any) => !i.expires_at);
      if (permanent) {
        setInviteCode(permanent.code);
      } else if (data.length > 0) {
        setInviteCode(data[0].code);
      } else {
        // Create one if none exists
        const res = await axios.post(
          `${config.HTTP}/api/communities/${communityId}/invites`,
          { max_uses: null, expires_in: null },
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setInviteCode(res.data.code);
      }
    } catch (err) {
      console.error("Failed to fetch invite:", err);
    } finally {
      setLoading(false);
    }
  }, [communityId, token]);

  const handleOpen = () => {
    setShowModal(true);
    fetchInvite();
  };

  const inviteLink = inviteCode
    ? `${config.HTTP.replace("http://", "").replace("https://", "")}/invite/${inviteCode}`
    : "";

  const handleCopy = () => {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!communityId) return null;

  return (
    <>
      <div className={styles.btn} onClick={handleOpen}>
        <span className={styles.icon}>🔗</span>
        <span className={styles.label}>INVITE PEOPLE</span>
      </div>

      {showModal && (
        <div className={styles.overlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <button
              className={styles.closeBtn}
              onClick={() => setShowModal(false)}
            >
              ✕
            </button>
            <h2 className={styles.title}>Invite People</h2>
            <p className={styles.subtitle}>
              Share this link with anyone you want to invite to this community.
            </p>

            {loading ? (
              <div className={styles.loading}>Loading...</div>
            ) : (
              <div className={styles.linkRow}>
                <div className={styles.linkBox}>{inviteLink}</div>
                <button
                  className={`${styles.copyBtn} ${copied ? styles.copied : ""}`}
                  onClick={handleCopy}
                >
                  {copied ? "✓ Copied!" : "Copy"}
                </button>
              </div>
            )}

            <p className={styles.hint}>
              This link never expires. Anyone with it can join.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
