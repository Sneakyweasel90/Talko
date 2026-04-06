import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import TitleBar from "../components/ui/TitleBar";
import { OverviewPanel } from "./superadmin/OverviewPanel";
import { UsersPanel } from "./superadmin/UsersPanel";
import { CommunitiesPanel } from "./superadmin/CommunitiesPanel";
import { AuditLogPanel } from "./superadmin/AuditLogPanel";
import type { NavSection, AdminUser } from "./superadmin/types";
import styles from "./SuperAdmin.module.css";

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
    { key: "audit", icon: "⊙", label: "AUDIT LOG" },
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
          {nav === "audit" && <AuditLogPanel token={user!.token} />}
        </main>
      </div>
    </div>
  );
}
