import db from "../db/postgres.js";

export async function logAdminAction({
  adminId,
  adminUsername,
  action,
  targetType = null,
  targetId = null,
  targetName = null,
  metadata = null,
}) {
  try {
    await db.query(
      `INSERT INTO admin_audit_log
         (admin_id, admin_username, action, target_type, target_id, target_name, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        adminId,
        adminUsername,
        action,
        targetType,
        targetId,
        targetName,
        metadata ? JSON.stringify(metadata) : null,
      ],
    );
  } catch (err) {
    console.error("Audit log write failed:", err.message);
  }
}
