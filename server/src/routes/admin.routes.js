import express from "express";
import crypto from "crypto";
import db from "../db/postgres.js";
import { requireAuth } from "../middleware/auth.js";
import { getWss } from "../websocket/gateway.js";

const router = express.Router();

// Middleware: admin only
function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ error: "Admin only" });
  next();
}

// Helper to force disconnect a user by ID
function forceDisconnectUser(userId) {
  const wss = getWss();
  if (!wss) return;
  for (const client of wss.clients) {
    if (client.readyState === 1 && client.user?.id === userId) {
      client.send(JSON.stringify({ type: "force_logout" }));
      client.close(1008, "Kicked");
    }
  }
}

// Helper: get the owner (lowest ID user) and target user info
async function getTargetAndOwner(targetId) {
  const { rows: ownerRows } = await db.query(`SELECT id FROM users ORDER BY id ASC LIMIT 1`);
  const { rows: targetRows } = await db.query(
    `SELECT id, username, role FROM users WHERE id = $1`, [targetId]
  );
  return { ownerId: ownerRows[0]?.id ?? null, target: targetRows[0] ?? null };
}

// ── User management ───────────────────────────────────────────────────────────

// GET /api/admin/users
router.get("/users", requireAuth, requireAdmin, async (req, res) => {
  const { rows } = await db.query(
    `SELECT id, username, nickname, avatar, role, custom_role_name, banned_at, created_at
     FROM users ORDER BY created_at ASC`
  );
  const { rows: ownerRows } = await db.query(`SELECT id FROM users ORDER BY id ASC LIMIT 1`);
  res.json({ users: rows, ownerId: ownerRows[0]?.id ?? null });
});

router.delete("/users/:id", requireAuth, requireAdmin, async (req, res) => {
  const targetId = parseInt(req.params.id);
  if (isNaN(targetId)) return res.status(400).json({ error: "Invalid user id" });
  if (targetId === req.user.id) return res.status(400).json({ error: "Cannot delete yourself" });

  const { ownerId, target } = await getTargetAndOwner(targetId);
  if (!target) return res.status(404).json({ error: "User not found" });
  if (targetId === ownerId) return res.status(403).json({ error: "Cannot delete the server owner" });
  if (target.role === "admin") return res.status(403).json({ error: "Cannot delete another admin" });

  forceDisconnectUser(targetId);

  await db.query(`DELETE FROM reactions WHERE user_id = $1`, [targetId]);
  await db.query(`DELETE FROM local_nicknames WHERE owner_id = $1 OR target_id = $1`, [targetId]);
  await db.query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [targetId]);
  await db.query(`DELETE FROM invite_tokens WHERE created_by = $1`, [targetId]);
  await db.query(`DELETE FROM channel_last_read WHERE user_id = $1`, [targetId]);
  await db.query(`DELETE FROM dm_last_read WHERE user_id = $1`, [targetId]);
  await db.query(`DELETE FROM pinned_messages WHERE pinned_by = $1`, [targetId]);
  await db.query(`UPDATE messages SET username = '[deleted]', user_id = NULL WHERE user_id = $1`, [targetId]);
  await db.query(`DELETE FROM dm_conversations WHERE user1_id = $1 OR user2_id = $1`, [targetId]);
  await db.query(`DELETE FROM users WHERE id = $1`, [targetId]);

  res.json({ ok: true });
});

// PATCH /api/admin/users/:id/role
router.patch("/users/:id/role", requireAuth, requireAdmin, async (req, res) => {
  const targetId = parseInt(req.params.id);
  if (isNaN(targetId)) return res.status(400).json({ error: "Invalid user id" });
  if (targetId === req.user.id) return res.status(400).json({ error: "Cannot change your own role" });

  const { ownerId, target } = await getTargetAndOwner(targetId);
  if (!target) return res.status(404).json({ error: "User not found" });
  if (targetId === ownerId) return res.status(403).json({ error: "Cannot change the server owner's role" });
  if (target.role === "admin" && req.user.id !== ownerId)
    return res.status(403).json({ error: "Only the server owner can change another admin's role" });

  const { role, customRoleName } = req.body;
  const validRoles = ["admin", "user", "custom"];
  if (!validRoles.includes(role)) return res.status(400).json({ error: "Invalid role" });

  const cleanCustomName = role === "custom"
    ? (customRoleName || "").trim().slice(0, 50) || "Member"
    : null;

  const { rows } = await db.query(
    `UPDATE users SET role = $1, custom_role_name = $2 WHERE id = $3
     RETURNING id, username, role, custom_role_name`,
    [role, cleanCustomName, targetId]
  );
  res.json(rows[0]);
});

// POST /api/admin/users/:id/kick
router.post("/users/:id/kick", requireAuth, requireAdmin, async (req, res) => {
  const targetId = parseInt(req.params.id);
  if (isNaN(targetId)) return res.status(400).json({ error: "Invalid user id" });
  if (targetId === req.user.id) return res.status(400).json({ error: "Cannot kick yourself" });

  const { ownerId, target } = await getTargetAndOwner(targetId);
  if (!target) return res.status(404).json({ error: "User not found" });
  if (targetId === ownerId) return res.status(403).json({ error: "Cannot kick the server owner" });
  if (target.role === "admin") return res.status(403).json({ error: "Cannot kick another admin" });

  const { durationMinutes = 10 } = req.body;
  const kickedUntil = new Date(Date.now() + durationMinutes * 60 * 1000);

  await db.query(`UPDATE users SET kicked_until = $1 WHERE id = $2`, [kickedUntil, targetId]);
  await db.query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [targetId]);
  forceDisconnectUser(targetId);
  res.json({ ok: true });
});

// POST /api/admin/users/:id/ban
router.post("/users/:id/ban", requireAuth, requireAdmin, async (req, res) => {
  const targetId = parseInt(req.params.id);
  if (isNaN(targetId)) return res.status(400).json({ error: "Invalid user id" });
  if (targetId === req.user.id) return res.status(400).json({ error: "Cannot ban yourself" });

  const { ownerId, target } = await getTargetAndOwner(targetId);
  if (!target) return res.status(404).json({ error: "User not found" });
  if (targetId === ownerId) return res.status(403).json({ error: "Cannot ban the server owner" });
  if (target.role === "admin") return res.status(403).json({ error: "Cannot ban another admin" });

  await db.query(`UPDATE users SET banned_at = NOW() WHERE id = $1`, [targetId]);
  await db.query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [targetId]);
  forceDisconnectUser(targetId);
  res.json({ ok: true });
});

// POST /api/admin/users/:id/unban
router.post("/users/:id/unban", requireAuth, requireAdmin, async (req, res) => {
  const targetId = parseInt(req.params.id);
  if (isNaN(targetId)) return res.status(400).json({ error: "Invalid user id" });
  await db.query(`UPDATE users SET banned_at = NULL, kicked_until = NULL WHERE id = $1`, [targetId]);
  res.json({ ok: true });
});

// ── Invite tokens ─────────────────────────────────────────────────────────────

// GET /api/admin/invites — list all invite tokens (admin only)
router.get("/invites", requireAuth, requireAdmin, async (req, res) => {
  const { rows } = await db.query(
    `SELECT id, token, note, created_at, expires_at, used_at, used_by_username
     FROM invite_tokens ORDER BY created_at DESC`
  );
  res.json(rows);
});

// GET /api/admin/settings
router.get("/settings", requireAuth, requireAdmin, async (req, res) => {
  const { rows } = await db.query(`SELECT key, value FROM server_settings`);
  const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));
  res.json(settings);
});

// PATCH /api/admin/settings
router.patch("/settings", requireAuth, requireAdmin, async (req, res) => {
  const { afk_timeout_minutes } = req.body;
  const val = parseInt(afk_timeout_minutes);
  if (isNaN(val) || val < 1 || val > 480)
    return res.status(400).json({ error: "Must be between 1 and 480 minutes" });
  await db.query(
    `INSERT INTO server_settings (key, value) VALUES ('afk_timeout_minutes', $1)
     ON CONFLICT (key) DO UPDATE SET value = $1`,
    [String(val)]
  );
  res.json({ ok: true });
});

// GET /api/settings/afk-timeout — public, no auth needed
router.get("/afk-timeout", async (req, res) => {
  const { rows } = await db.query(
    `SELECT value FROM server_settings WHERE key = 'afk_timeout_minutes'`
  );
  res.json({ afk_timeout_minutes: rows[0] ? parseInt(rows[0].value) : 10 });
});

// POST /api/admin/invites — generate a new invite token
// Body: { note?: string, expiresInHours?: number }  (omit expiresInHours for no expiry)
router.post("/invites", requireAuth, requireAdmin, async (req, res) => {
  const { note, expiresInHours } = req.body;
  const token = crypto.randomBytes(24).toString("hex"); // 48-char hex token
  const expiresAt = expiresInHours
    ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
    : null;
  const cleanNote = (note || "").trim().slice(0, 100) || null;

  const { rows } = await db.query(
    `INSERT INTO invite_tokens (token, created_by, expires_at, note)
     VALUES ($1, $2, $3, $4)
     RETURNING id, token, note, created_at, expires_at, used_at, used_by_username`,
    [token, req.user.id, expiresAt, cleanNote]
  );
  res.status(201).json(rows[0]);
});

// DELETE /api/admin/invites/:id — revoke/delete an invite token
router.delete("/invites/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  await db.query(`DELETE FROM invite_tokens WHERE id = $1`, [id]);
  res.json({ ok: true });
});

export default router;