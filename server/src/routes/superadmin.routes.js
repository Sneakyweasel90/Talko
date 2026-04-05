import express from "express";
import db from "../db/postgres.js";
import { requireAuth } from "../middleware/auth.js";
import { getWss } from "../websocket/gateway.js";

const router = express.Router();

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin")
    return res.status(403).json({ error: "Admin only" });
  next();
}

// ─── GET /api/superadmin/stats ────────────────────────────────────────────────
router.get("/stats", requireAuth, requireAdmin, async (req, res) => {
  try {
    const [users, messages, communities, banned, recent, newUsers] =
      await Promise.all([
        db.query(
          `SELECT COUNT(*)::int AS count FROM users WHERE banned_at IS NULL`,
        ),
        db.query(`SELECT COUNT(*)::int AS count FROM messages`),
        db.query(`SELECT COUNT(*)::int AS count FROM communities`),
        db.query(
          `SELECT COUNT(*)::int AS count FROM users WHERE banned_at IS NOT NULL`,
        ),
        db.query(
          `SELECT COUNT(*)::int AS count FROM messages WHERE created_at > NOW() - INTERVAL '24 hours'`,
        ),
        db.query(
          `SELECT COUNT(*)::int AS count FROM users WHERE created_at > NOW() - INTERVAL '7 days'`,
        ),
      ]);
    res.json({
      totalUsers: users.rows[0].count,
      totalMessages: messages.rows[0].count,
      totalCommunities: communities.rows[0].count,
      bannedUsers: banned.rows[0].count,
      messagesLast24h: recent.rows[0].count,
      newUsersLast7d: newUsers.rows[0].count,
    });
  } catch (err) {
    console.error("Superadmin stats error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── GET /api/superadmin/activity ─────────────────────────────────────────────
router.get("/activity", requireAuth, requireAdmin, async (req, res) => {
  try {
    const [messages, users] = await Promise.all([
      db.query(
        `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
                COUNT(*)::int AS count
         FROM messages
         WHERE created_at > NOW() - INTERVAL '30 days'
         GROUP BY date_trunc('day', created_at)
         ORDER BY day ASC`,
      ),
      db.query(
        `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
                COUNT(*)::int AS count
         FROM users
         WHERE created_at > NOW() - INTERVAL '30 days'
         GROUP BY date_trunc('day', created_at)
         ORDER BY day ASC`,
      ),
    ]);
    res.json({ messages: messages.rows, users: users.rows });
  } catch (err) {
    console.error("Superadmin activity error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── GET /api/superadmin/communities ─────────────────────────────────────────
router.get("/communities", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT
         c.id, c.name, c.icon, c.created_at,
         u.username AS owner_username,
         (SELECT COUNT(*)::int FROM community_members WHERE community_id = c.id) AS member_count,
         (SELECT COUNT(*)::int FROM channels WHERE community_id = c.id) AS channel_count,
         (SELECT COUNT(*)::int
          FROM messages m
          JOIN channels ch ON m.channel_db_id = ch.id
          WHERE ch.community_id = c.id) AS message_count
       FROM communities c
       JOIN users u ON u.id = c.owner_id
       ORDER BY c.created_at DESC`,
    );
    res.json(rows);
  } catch (err) {
    console.error("Superadmin communities error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── GET /api/superadmin/users/:id/messages ───────────────────────────────────
router.get(
  "/users/:id/messages",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const userId = parseInt(req.params.id);
    if (isNaN(userId))
      return res.status(400).json({ error: "Invalid user id" });

    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const before = req.query.before ? parseInt(req.query.before) : null;

    try {
      const params = before ? [userId, limit, before] : [userId, limit];
      const { rows } = await db.query(
        `SELECT
         m.id, m.content, m.created_at, m.edited_at, m.channel_id,
         ch.name AS channel_name,
         co.name AS community_name,
         co.id   AS community_id
       FROM messages m
       LEFT JOIN channels ch ON m.channel_db_id = ch.id
       LEFT JOIN communities co ON ch.community_id = co.id
       WHERE m.user_id = $1
         ${before ? "AND m.id < $3" : ""}
       ORDER BY m.id DESC
       LIMIT $2`,
        params,
      );
      res.json({
        messages: rows,
        hasMore: rows.length === limit,
        oldestId: rows.length > 0 ? rows[rows.length - 1].id : null,
      });
    } catch (err) {
      console.error("Superadmin user messages error:", err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

// ─── DELETE /api/superadmin/messages/:id ─────────────────────────────────────
router.delete("/messages/:id", requireAuth, requireAdmin, async (req, res) => {
  const messageId = parseInt(req.params.id);
  if (isNaN(messageId))
    return res.status(400).json({ error: "Invalid message id" });
  try {
    const { rowCount } = await db.query(`DELETE FROM messages WHERE id = $1`, [
      messageId,
    ]);
    if (rowCount === 0)
      return res.status(404).json({ error: "Message not found" });
    res.json({ ok: true });
  } catch (err) {
    console.error("Superadmin delete message error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── DELETE /api/superadmin/communities/:id ───────────────────────────────────
// Deletes any community regardless of ownership, then notifies all connected
// members so they can leave voice and switch to another community immediately.
router.delete(
  "/communities/:id",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const communityId = parseInt(req.params.id);
    if (isNaN(communityId))
      return res.status(400).json({ error: "Invalid community id" });
    try {
      const { rowCount } = await db.query(
        `DELETE FROM communities WHERE id = $1`,
        [communityId],
      );
      if (rowCount === 0)
        return res.status(404).json({ error: "Community not found" });

      // Notify all connected clients who were in this community so they can
      // leave voice and remove it from their UI immediately.
      const wss = getWss();
      if (wss) {
        const payload = JSON.stringify({
          type: "community_deleted",
          communityId,
        });
        wss.clients.forEach((client) => {
          if (
            client.readyState === 1 &&
            client.communityIds?.includes(communityId)
          ) {
            // Remove from in-memory community list so future presence broadcasts
            // don't include this community.
            client.communityIds = client.communityIds.filter(
              (id) => id !== communityId,
            );
            client.send(payload);
          }
        });
      }

      res.json({ ok: true });
    } catch (err) {
      console.error("Superadmin delete community error:", err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

export default router;
