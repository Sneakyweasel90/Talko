import type { AdminUser, ChartPoint } from "./types";

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return (
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  );
}

// Returns the CSS module key name so callers can do styles[roleClass(role)]
export function roleClass(role: string): string {
  if (role === "admin") return "roleAdmin";
  if (role === "custom") return "roleCustom";
  return "roleUser";
}

export function roleLabel(u: AdminUser): string {
  return u.role === "custom" ? (u.custom_role_name ?? "custom") : u.role;
}

export function fillDays(
  raw: { day: string; count: number }[],
  numDays = 30,
): ChartPoint[] {
  const map = new Map(raw.map((d) => [d.day, d.count]));
  const result: ChartPoint[] = [];
  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    const label = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    result.push({ day: label, count: map.get(key) ?? 0 });
  }
  return result;
}
