import { useTheme } from "../../context/ThemeContext";
import type { UserRole } from "../../types";
import styles from "./RoleBadge.module.css";

export function RoleBadge({
  role,
  customRoleName,
}: {
  role: UserRole;
  customRoleName?: string | null;
}) {
  const { theme } = useTheme();

  if (role === "user") return null;

  const label =
    role === "admin"
      ? "ADMIN"
      : role === "custom"
        ? (customRoleName || "MEMBER").toUpperCase()
        : null;

  if (!label) return null;

  const color = role === "admin" ? theme.error : theme.primaryDim;

  return (
    <span className={styles.badge} style={{ color, borderColor: color }}>
      {label}
    </span>
  );
}
