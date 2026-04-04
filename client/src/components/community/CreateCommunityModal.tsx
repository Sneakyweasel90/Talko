import { useState } from "react";
import axios from "axios";
import config from "../../config";
import { useAuth } from "../../context/AuthContext";
import styles from "./CreateCommunityModal.module.css";
import { Community } from "../../hooks/useCommunities";

interface Props {
  onClose: () => void;
  onCreated: (community: Community) => void;
}

type View = "choice" | "create" | "join";

export default function CreateCommunityModal({ onClose, onCreated }: Props) {
  const { user } = useAuth();
  const [view, setView] = useState<View>("choice");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return setError("Name is required");
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.post(
        `${config.HTTP}/api/communities`,
        { name: name.trim(), description: description.trim() || undefined },
        { headers: { Authorization: `Bearer ${user!.token}` } },
      );
      onCreated(data);
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Failed to create community");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    const code = inviteCode.trim().split("/").pop() ?? "";
    if (!code) return setError("Invite code is required");
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.post(
        `${config.HTTP}/api/invite/${code}/join`,
        {},
        { headers: { Authorization: `Bearer ${user!.token}` } },
      );
      // Fetch the community details after joining
      const community = await axios.get(
        `${config.HTTP}/api/communities/${data.community_id}`,
        { headers: { Authorization: `Bearer ${user!.token}` } },
      );
      onCreated(community.data);
    } catch (err: any) {
      setError(err.response?.data?.error ?? "Failed to join community");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose}>
          ✕
        </button>

        {view === "choice" && (
          <>
            <h2 className={styles.title}>Add a Community</h2>
            <p className={styles.subtitle}>
              Create your own or join an existing one with an invite.
            </p>
            <div className={styles.choices}>
              <div
                className={styles.choiceCard}
                onClick={() => setView("create")}
              >
                <div className={styles.choiceIcon}>✦</div>
                <div className={styles.choiceName}>Create a Community</div>
                <div className={styles.choiceDesc}>
                  Build your own space for friends or groups
                </div>
              </div>
              <div
                className={styles.choiceCard}
                onClick={() => setView("join")}
              >
                <div className={styles.choiceIcon}>⊕</div>
                <div className={styles.choiceName}>Join a Community</div>
                <div className={styles.choiceDesc}>
                  Enter an invite link to join an existing community
                </div>
              </div>
            </div>
          </>
        )}

        {view === "create" && (
          <>
            <button
              className={styles.backBtn}
              onClick={() => {
                setView("choice");
                setError(null);
              }}
            >
              ← Back
            </button>
            <h2 className={styles.title}>Create a Community</h2>
            <p className={styles.subtitle}>
              Give your community a name to get started.
            </p>

            <div className={styles.field}>
              <label className={styles.label}>COMMUNITY NAME</label>
              <input
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Community"
                maxLength={100}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>DESCRIPTION (optional)</label>
              <input
                className={styles.input}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's this community about?"
                maxLength={200}
              />
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <button
              className={styles.submitBtn}
              onClick={handleCreate}
              disabled={loading || !name.trim()}
            >
              {loading ? "Creating..." : "Create Community"}
            </button>
          </>
        )}

        {view === "join" && (
          <>
            <button
              className={styles.backBtn}
              onClick={() => {
                setView("choice");
                setError(null);
              }}
            >
              ← Back
            </button>
            <h2 className={styles.title}>Join a Community</h2>
            <p className={styles.subtitle}>
              Enter an invite link or code below.
            </p>

            <div className={styles.field}>
              <label className={styles.label}>INVITE LINK OR CODE</label>
              <input
                className={styles.input}
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="https://talko.app/invite/abc12345 or abc12345"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              />
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <button
              className={styles.submitBtn}
              onClick={handleJoin}
              disabled={loading || !inviteCode.trim()}
            >
              {loading ? "Joining..." : "Join Community"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
