import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useAuth } from "../../context/AuthContext";
import type { Community } from "../../hooks/useCommunities";
import styles from "./CommunitySwitcher.module.css";
import CreateCommunityModal from "./CreateCommunityModal";
import config from "../../config";

function getColor(name: string): string {
  const colors = [
    "#5865f2",
    "#57f287",
    "#fee75c",
    "#eb459e",
    "#ed4245",
    "#3ba55c",
    "#faa61a",
    "#00b0f4",
    "#9b59b6",
    "#e67e22",
    "#1abc9c",
    "#e74c3c",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

interface ContextMenu {
  x: number;
  y: number;
  community: Community;
  isOwner: boolean;
}

interface Props {
  communities: Community[];
  activeCommunityId: number | null;
  onSwitch: (id: number) => void;
  onCommunityCreated: (community: Community) => void;
  onCommunityRemoved: (id: number) => void;
  userId: number;
}

export default function CommunitySwitcher({
  communities,
  activeCommunityId,
  onSwitch,
  onCommunityCreated,
  onCommunityRemoved,
  userId,
}: Props) {
  const { user } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, []);

  const handleDelete = async (community: Community) => {
    if (!confirm(`Delete "${community.name}"? This cannot be undone.`)) return;
    try {
      await axios.delete(`${config.HTTP}/api/communities/${community.id}`, {
        headers: { Authorization: `Bearer ${user!.token}` },
      });
      onCommunityRemoved(community.id);
    } catch (err: any) {
      alert(err.response?.data?.error ?? "Failed to delete community");
    }
    setContextMenu(null);
  };

  const handleLeave = async (community: Community) => {
    if (!confirm(`Leave "${community.name}"?`)) return;
    try {
      await axios.delete(
        `${config.HTTP}/api/communities/${community.id}/leave`,
        { headers: { Authorization: `Bearer ${user!.token}` } },
      );
      onCommunityRemoved(community.id);
    } catch (err: any) {
      alert(err.response?.data?.error ?? "Failed to leave community");
    }
    setContextMenu(null);
  };

  return (
    <div className={styles.root}>
      {communities.map((community) => (
        <div
          key={community.id}
          className={`${styles.item} ${community.id === activeCommunityId ? styles.active : ""}`}
          onClick={() => onSwitch(community.id)}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu({
              x: e.clientX,
              y: e.clientY,
              community,
              isOwner: community.owner_id === userId,
            });
          }}
        >
          <div
            className={styles.icon}
            style={
              !community.icon
                ? { background: getColor(community.name) }
                : undefined
            }
          >
            {community.icon ? (
              <img src={community.icon} alt={community.name} />
            ) : (
              getInitials(community.name)
            )}
          </div>
          <span className={styles.tooltip}>{community.name}</span>
        </div>
      ))}

      <div className={styles.divider} />

      <div className={styles.addBtn} onClick={() => setShowCreate(true)}>
        +<span className={styles.tooltip}>Create or join a community</span>
      </div>

      {contextMenu && (
        <div
          ref={menuRef}
          className={styles.contextMenu}
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <div className={styles.contextMenuHeader}>
            {contextMenu.community.name}
          </div>
          {contextMenu.isOwner ? (
            <button
              className={`${styles.contextMenuItem} ${styles.danger}`}
              onClick={() => handleDelete(contextMenu.community)}
            >
              🗑 Delete Community
            </button>
          ) : (
            <button
              className={styles.contextMenuItem}
              onClick={() => handleLeave(contextMenu.community)}
            >
              🚪 Leave Community
            </button>
          )}
        </div>
      )}

      {showCreate && (
        <CreateCommunityModal
          onClose={() => setShowCreate(false)}
          onCreated={(community) => {
            onCommunityCreated(community);
            setShowCreate(false);
          }}
        />
      )}
    </div>
  );
}
