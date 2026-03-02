import { useTheme } from "../context/ThemeContext";
import type { UserRole } from "../types";

export function RoleBadge({ role, customRoleName }: { role: UserRole; customRoleName?: string | null }) {
  const { theme } = useTheme();
  if (role === "user") return null;

  const label = role === "admin"
    ? "ADMIN"
    : role === "custom"
    ? (customRoleName || "MEMBER").toUpperCase()
    : null;

  if (!label) return null;

  const color = role === "admin" ? theme.error : theme.primaryDim;

  return (
    <span style={{
      fontSize: "0.55rem",
      fontFamily: "'Share Tech Mono', monospace",
      letterSpacing: "0.08em",
      color,
      border: `1px solid ${color}`,
      borderRadius: "2px",
      padding: "1px 4px",
      lineHeight: 1,
      opacity: 0.9,
      flexShrink: 0,
    }}>
      {label}
    </span>
  );
}