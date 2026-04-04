import express from "express";
import db from "../db/postgres.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// GET /api/search?q=hello&channel=general&limit=30
router.get("/", requireAuth, async (req, res) => {
  const { q, channel, limit = 30 } = req.query;
  if (!q || String(q).trim().length < 2)
    return res
      .status(400)
      .json({ error: "Query must be at least 2 characters" });

  const safeLimit = Math.min(Number(limit) || 30, 100);

  try {
    let query, params;

    if (channel) {
      query = `
        SELECT m.id, m.channel_id, m.username, m.content, m.created_at,
               ts_rank(to_tsvector('english', m.content), plainto_tsquery('english', $1)) AS rank
        FROM messages m
        WHERE m.channel_id = $2
          AND to_tsvector('english', m.content) @@ plainto_tsquery('english', $1)
        ORDER BY rank DESC, m.created_at DESC
        LIMIT $3
      `;
      params = [q, channel, safeLimit];
    } else {
      query = `
        SELECT m.id, m.channel_id, m.username, m.content, m.created_at,
               ts_rank(to_tsvector('english', m.content), plainto_tsquery('english', $1)) AS rank
        FROM messages m
        WHERE to_tsvector('english', m.content) @@ plainto_tsquery('english', $1)
        ORDER BY rank DESC, m.created_at DESC
        LIMIT $2
      `;
      params = [q, safeLimit];
    }

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch {
    res.status(500).json({ error: "Search failed" });
  }
});

// GET /api/search/context?messageId=123&channel=general&around=4
// Returns N messages before and after the given message ID in the same channel.
router.get("/context", requireAuth, async (req, res) => {
  const { messageId, channel, around = 4 } = req.query;
  if (!messageId || !channel)
    return res.status(400).json({ error: "messageId and channel required" });

  const id = parseInt(String(messageId));
  const n = Math.min(parseInt(String(around)) || 4, 10);

  if (isNaN(id)) return res.status(400).json({ error: "Invalid messageId" });

  try {
    // Fetch n before, the message itself, and n after — all in one query using window logic
    const { rows } = await db.query(
      `(
        SELECT m.id, m.channel_id, m.user_id, m.username, m.content, m.created_at,
               m.edited_at, m.reply_to_id, 'before' AS position
        FROM messages m
        WHERE m.channel_id = $1 AND m.id < $2
        ORDER BY m.id DESC
        LIMIT $3
      )
      UNION ALL
      (
        SELECT m.id, m.channel_id, m.user_id, m.username, m.content, m.created_at,
               m.edited_at, m.reply_to_id, 'target' AS position
        FROM messages m
        WHERE m.id = $2
      )
      UNION ALL
      (
        SELECT m.id, m.channel_id, m.user_id, m.username, m.content, m.created_at,
               m.edited_at, m.reply_to_id, 'after' AS position
        FROM messages m
        WHERE m.channel_id = $1 AND m.id > $2
        ORDER BY m.id ASC
        LIMIT $3
      )
      ORDER BY id ASC`,
      [channel, id, n],
    );

    res.json(rows);
  } catch (err) {
    console.error("Context fetch error:", err);
    res.status(500).json({ error: "Context fetch failed" });
  }
});

export default router;
