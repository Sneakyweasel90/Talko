import { useState } from "react";
import type { Community } from "../../hooks/useCommunities";
import CreateCommunityModal from "./CreateCommunityModal";
import styles from "./WelcomeScreen.module.css";

interface Props {
  username: string;
  onCommunityCreated: (community: Community) => void;
  onLogout: () => void;
}

export default function WelcomeScreen({
  username,
  onCommunityCreated,
  onLogout,
}: Props) {
  const [showModal, setShowModal] = useState(false);
  const [modalView, setModalView] = useState<"create" | "join">("create");

  return (
    <div className={styles.root}>
      <div className={styles.card}>
        <div className={styles.logo}>TALKO</div>
        <h1 className={styles.title}>Welcome, {username}</h1>
        <p className={styles.subtitle}>
          You're not in any communities yet. Create your own or join one with an
          invite link.
        </p>

        <div className={styles.actions}>
          <div
            className={styles.actionCard}
            onClick={() => {
              setModalView("create");
              setShowModal(true);
            }}
          >
            <div className={styles.actionIcon}>✦</div>
            <div className={styles.actionTitle}>Create a Community</div>
            <div className={styles.actionDesc}>
              Build your own space for friends or groups
            </div>
          </div>

          <div
            className={styles.actionCard}
            onClick={() => {
              setModalView("join");
              setShowModal(true);
            }}
          >
            <div className={styles.actionIcon}>⊕</div>
            <div className={styles.actionTitle}>Join a Community</div>
            <div className={styles.actionDesc}>
              Enter an invite link to join an existing community
            </div>
          </div>
        </div>

        <button className={styles.logoutBtn} onClick={onLogout}>
          Sign out
        </button>
      </div>

      {showModal && (
        <CreateCommunityModal
          initialView={modalView}
          onClose={() => setShowModal(false)}
          onCreated={(community) => {
            onCommunityCreated(community);
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}
