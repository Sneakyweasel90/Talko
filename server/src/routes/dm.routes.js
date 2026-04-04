import express from "express";
import db from "../db/postgres.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// Deterministic DM channel ID — always lower user id first
function dmChannelId(a, b) {
  return `dm:${Math.min(a, b)}:${Math.max(a, b)}`;
}

// POST /api/dm/open — open or create a DM conversation with another user
// Returns the conversation info including channel_id
router.post("/open", requireAuth, async (req, res) => {
  const myId = req.user.id;
  const { userId } = req.body;
  if (!userId || userId === myId)
    return res.status(400).json({ error: "Invalid user" });

  const otherId = parseInt(userId);
  if (isNaN(otherId)) return res.status(400).json({ error: "Invalid user id" });

  // Verify other user exists
  const { rows: userRows } = await db.query(
    `SELECT id, username, nickname, avatar FROM users WHERE id = $1`,
    [otherId],
  );
  if (!userRows[0]) return res.status(404).json({ error: "User not found" });

  const u1 = Math.min(myId, otherId);
  const u2 = Math.max(myId, otherId);
  const channelId = dmChannelId(myId, otherId);

  // Upsert conversation
  await db.query(
    `INSERT INTO dm_conversations (user1_id, user2_id) VALUES ($1, $2)
     ON CONFLICT (user1_id, user2_id) DO NOTHING`,
    [u1, u2],
  );

  res.json({
    channelId,
    user: userRows[0],
  });
});

// GET /api/dm/conversations — list all DM conversations for current user
router.get("/conversations", requireAuth, async (req, res) => {
  const myId = req.user.id;

  const { rows } = await db.query(
    `SELECT
       dc.id,
       CASE WHEN dc.user1_id = $1 THEN dc.user2_id ELSE dc.user1_id END AS other_user_id,
       u.username, u.nickname, u.avatar,
       -- last message
       (SELECT content FROM messages WHERE channel_id = CONCAT('dm:', LEAST(dc.user1_id, dc.user2_id), ':', GREATEST(dc.user1_id, dc.user2_id)) ORDER BY id DESC LIMIT 1) AS last_message,
       (SELECT created_at FROM messages WHERE channel_id = CONCAT('dm:', LEAST(dc.user1_id, dc.user2_id), ':', GREATEST(dc.user1_id, dc.user2_id)) ORDER BY id DESC LIMIT 1) AS last_message_at,
       -- unread count
       (SELECT COUNT(*) FROM messages m
        WHERE m.channel_id = CONCAT('dm:', LEAST(dc.user1_id, dc.user2_id), ':', GREATEST(dc.user1_id, dc.user2_id))
        AND m.user_id != $1
        AND m.created_at > COALESCE(
          (SELECT last_read_at FROM dm_last_read WHERE user_id = $1 AND dm_channel_id = CONCAT('dm:', LEAST(dc.user1_id, dc.user2_id), ':', GREATEST(dc.user1_id, dc.user2_id))),
          '1970-01-01'
        )
       )::int AS unread_count
     FROM dm_conversations dc
     JOIN users u ON u.id = CASE WHEN dc.user1_id = $1 THEN dc.user2_id ELSE dc.user1_id END
     WHERE dc.user1_id = $1 OR dc.user2_id = $1
     ORDER BY last_message_at DESC NULLS LAST`,
    [myId],
  );

  // Add channel_id to each row
  const conversations = rows.map((r) => ({
    ...r,
    channelId: dmChannelId(myId, r.other_user_id),
  }));

  res.json(conversations);
});

// POST /api/dm/read — mark a DM channel as read
router.post("/read", requireAuth, async (req, res) => {
  const { channelId } = req.body;
  if (!channelId?.startsWith("dm:"))
    return res.status(400).json({ error: "Invalid channel" });

  await db.query(
    `INSERT INTO dm_last_read (user_id, dm_channel_id, last_read_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id, dm_channel_id) DO UPDATE SET last_read_at = NOW()`,
    [req.user.id, channelId],
  );

  res.json({ ok: true });
});

export default router;
