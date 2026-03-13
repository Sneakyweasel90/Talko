import express from "express";
import db from "../db/postgres.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// GET all channels
router.get("/", requireAuth, async (req, res) => {
  const { rows } = await db.query(
    `SELECT id, name, type, created_by, created_at FROM channels ORDER BY type, name`
  );
  res.json(rows);
});

// POST /api/channels/read — mark a text channel as read
router.post("/read", requireAuth, async (req, res) => {
  const { channelName } = req.body;
  if (!channelName) return res.status(400).json({ error: "Missing channelName" });

  await db.query(
    `INSERT INTO channel_last_read (user_id, channel_name, last_read_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id, channel_name) DO UPDATE SET last_read_at = NOW()`,
    [req.user.id, channelName]
  );
  res.json({ ok: true });
});

// GET /api/channels/:name/pins — fetch pinned messages for a channel
router.get("/:name/pins", requireAuth, async (req, res) => {
  const { rows } = await db.query(
    `SELECT m.id, m.content, m.username, m.created_at, m.user_id,
            u.username AS pinned_by_username, pm.pinned_at
     FROM pinned_messages pm
     JOIN messages m ON m.id = pm.message_id
     LEFT JOIN users u ON u.id = pm.pinned_by
     WHERE pm.channel_name = $1
     ORDER BY pm.pinned_at DESC`,
    [req.params.name]
  );
  res.json(rows);
});

// POST /api/channels/:name/pins — pin a message (admin only)
router.post("/:name/pins", requireAuth, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Admins only" });
  const { messageId } = req.body;
  if (!messageId) return res.status(400).json({ error: "Missing messageId" });
  try {
    await db.query(
      `INSERT INTO pinned_messages (channel_name, message_id, pinned_by)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [req.params.name, messageId, req.user.id]
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/channels/:name/pins/:messageId — unpin (admin only)
router.delete("/:name/pins/:messageId", requireAuth, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Admins only" });
  await db.query(
    `DELETE FROM pinned_messages WHERE channel_name = $1 AND message_id = $2`,
    [req.params.name, req.params.messageId]
  );
  res.json({ ok: true });
});

// POST create a new channel
router.post("/", requireAuth, async (req, res) => {
  const { name, type = "text" } = req.body;
  if (!name) return res.status(400).json({ error: "Channel name required" });

  const clean = name.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 50);
  const finalName = type === "voice" ? `voice-${clean.replace(/^voice-/, "")}` : clean;

  try {
    const { rows } = await db.query(
      `INSERT INTO channels (name, type, created_by) VALUES ($1, $2, $3) RETURNING *`,
      [finalName, type, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(400).json({ error: "Channel already exists" });
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE a channel (only creator or admin can delete — for now just creator)
router.delete("/:id", requireAuth, async (req, res) => {
  const { rows } = await db.query(
    `SELECT * FROM channels WHERE id = $1`, [req.params.id]
  );
  const ch = rows[0];
  if (!ch) return res.status(404).json({ error: "Not found" });
  if (ch.created_by !== req.user.id)
    return res.status(403).json({ error: "Only the channel creator can delete it" });

  // Don't allow deleting seeded defaults
  const defaults = ["general", "random", "yakking", "voice-general", "voice-chill"];
  if (defaults.includes(ch.name))
    return res.status(403).json({ error: "Cannot delete default channels" });

  await db.query(`DELETE FROM channels WHERE id = $1`, [req.params.id]);
  res.json({ ok: true });
});

export default router;