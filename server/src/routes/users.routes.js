import express from "express";
import bcrypt from "bcrypt";
import db from "../db/postgres.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.post("/public-key", requireAuth, async (req, res) => {
  const { publicKey } = req.body;
  if (!publicKey) return res.status(400).json({ error: "publicKey required" });
  await db.query(`UPDATE users SET public_key = $1 WHERE id = $2`, [
    publicKey,
    req.user.id,
  ]);
  res.json({ ok: true });
});

router.get("/:userId/public-key", requireAuth, async (req, res) => {
  const { rows } = await db.query(
    `SELECT public_key FROM users WHERE id = $1`,
    [req.params.userId],
  );
  if (!rows[0]) return res.status(404).json({ error: "User not found" });
  res.json({ publicKey: rows[0].public_key });
});

// GET /api/users/:userId/mutual-communities
// Returns communities shared between the requesting user and the target user.
router.get("/:userId/mutual-communities", requireAuth, async (req, res) => {
  const targetId = parseInt(req.params.userId);
  if (isNaN(targetId))
    return res.status(400).json({ error: "Invalid user id" });
  try {
    const { rows } = await db.query(
      `SELECT c.id, c.name, c.icon
       FROM communities c
       JOIN community_members cm1 ON cm1.community_id = c.id AND cm1.user_id = $1
       JOIN community_members cm2 ON cm2.community_id = c.id AND cm2.user_id = $2
       ORDER BY c.name ASC`,
      [targetId, req.user.id],
    );
    res.json(rows);
  } catch (err) {
    console.error("Mutual communities error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET all user avatars — used by client to populate avatarMap for message display
router.get("/avatars", requireAuth, async (req, res) => {
  const { rows } = await db.query(`SELECT id, avatar FROM users`);
  res.json(rows);
});

router.get("/me", requireAuth, async (req, res) => {
  const { rows } = await db.query(
    `SELECT id, username, nickname, avatar, created_at FROM users WHERE id = $1`,
    [req.user.id],
  );
  if (!rows[0]) return res.status(404).json({ error: "User not found" });
  res.json(rows[0]);
});

router.patch("/me", requireAuth, async (req, res) => {
  const { nickname, avatar, currentPassword, newPassword } = req.body;

  if (avatar !== undefined) {
    if (avatar && avatar.length > 700000)
      return res
        .status(400)
        .json({ error: "Avatar image too large (max ~500KB)" });
    await db.query(`UPDATE users SET avatar = $1 WHERE id = $2`, [
      avatar || null,
      req.user.id,
    ]);
  }

  if (nickname !== undefined) {
    const clean = nickname.trim().slice(0, 50);
    await db.query(`UPDATE users SET nickname = $1 WHERE id = $2`, [
      clean || null,
      req.user.id,
    ]);
  }

  if (newPassword) {
    if (!currentPassword)
      return res
        .status(400)
        .json({ error: "Current password required to set new password" });
    const { rows } = await db.query(
      `SELECT password_hash FROM users WHERE id = $1`,
      [req.user.id],
    );
    const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!valid)
      return res.status(400).json({ error: "Current password is incorrect" });
    if (newPassword.length < 6)
      return res
        .status(400)
        .json({ error: "New password must be at least 6 characters" });
    const hashed = await bcrypt.hash(newPassword, 10);
    await db.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [
      hashed,
      req.user.id,
    ]);
  }

  const { rows } = await db.query(
    `SELECT id, username, nickname, avatar FROM users WHERE id = $1`,
    [req.user.id],
  );
  res.json(rows[0]);
});

router.get("/local-nicknames", requireAuth, async (req, res) => {
  const { rows } = await db.query(
    `SELECT ln.target_id, ln.nickname, u.username AS original_username
     FROM local_nicknames ln JOIN users u ON ln.target_id = u.id
     WHERE ln.owner_id = $1`,
    [req.user.id],
  );
  res.json(rows);
});

router.put("/:targetId/local-nickname", requireAuth, async (req, res) => {
  const targetId = parseInt(req.params.targetId);
  if (isNaN(targetId))
    return res.status(400).json({ error: "Invalid user id" });
  if (targetId === req.user.id)
    return res
      .status(400)
      .json({ error: "Cannot set local nickname for yourself" });

  const nickname = (req.body.nickname || "").trim().slice(0, 50);

  if (!nickname) {
    await db.query(
      `DELETE FROM local_nicknames WHERE owner_id = $1 AND target_id = $2`,
      [req.user.id, targetId],
    );
  } else {
    await db.query(
      `INSERT INTO local_nicknames (owner_id, target_id, nickname) VALUES ($1, $2, $3)
       ON CONFLICT (owner_id, target_id) DO UPDATE SET nickname = $3`,
      [req.user.id, targetId, nickname],
    );
  }

  res.json({ ok: true, targetId, nickname: nickname || null });
});

export default router;
