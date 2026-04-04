import express from "express";
import db from "../db/postgres.js";
import { authenticateToken } from "../middleware/auth.js";
import {
  requireMember,
  requirePermission,
  canViewChannel,
} from "../middleware/communityAuth.js";

const router = express.Router({ mergeParams: true });

router.use(authenticateToken);
router.use(requireMember);

// ─── Get all channels (filtered by what user can see) ─────────────────────────
router.get("/", async (req, res) => {
  const communityId = req.params.id;
  const userId = req.user.id;

  try {
    // Get all channels with their categories
    const result = await db.query(
      `SELECT
         ch.id, ch.name, ch.type, ch.topic,
         ch.position, ch.is_private, ch.is_afk,
         cat.id as category_id, cat.name as category_name, cat.position as category_position,
         -- Check if user has access to private channels
         CASE
           WHEN ch.is_private = false THEN true
           WHEN com.owner_id = $2 THEN true
           WHEN EXISTS (
             SELECT 1 FROM channel_role_access cra
             JOIN member_roles mr ON mr.role_id = cra.role_id
             JOIN community_members cm ON cm.id = mr.member_id
             WHERE cra.channel_id = ch.id
               AND cm.user_id = $2
               AND cm.community_id = $1
           ) THEN true
           ELSE false
         END as can_view
       FROM channels ch
       LEFT JOIN categories cat ON cat.id = ch.category_id
       JOIN communities com ON com.id = ch.community_id
       WHERE ch.community_id = $1
       ORDER BY cat.position ASC, ch.position ASC`,
      [communityId, userId],
    );

    // Only return channels the user can see
    const visible = result.rows.filter((ch) => ch.can_view);

    // Group by category
    const grouped = {};
    for (const ch of visible) {
      const catKey = ch.category_id || "uncategorized";
      if (!grouped[catKey]) {
        grouped[catKey] = {
          id: ch.category_id,
          name: ch.category_name,
          position: ch.category_position,
          channels: [],
        };
      }
      grouped[catKey].channels.push({
        id: ch.id,
        name: ch.name,
        type: ch.type,
        topic: ch.topic,
        position: ch.position,
        is_private: ch.is_private,
      });
    }

    res.json(Object.values(grouped).sort((a, b) => a.position - b.position));
  } catch (err) {
    console.error("Get channels error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Create a channel ─────────────────────────────────────────────────────────
router.post("/", requirePermission("manage_channels"), async (req, res) => {
  const communityId = req.params.id;
  const {
    name,
    type = "text",
    category_id,
    topic,
    is_private = false,
    role_ids = [],
  } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({ error: "Channel name is required" });
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    // Get the highest position in this category
    const pos = await client.query(
      `SELECT COALESCE(MAX(position), -1) + 1 as next_pos
       FROM channels
       WHERE community_id = $1 AND category_id IS NOT DISTINCT FROM $2`,
      [communityId, category_id || null],
    );

    const channel = await client.query(
      `INSERT INTO channels (name, type, community_id, category_id, topic, is_private, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        name.trim().toLowerCase().replace(/\s+/g, "-"),
        type,
        communityId,
        category_id || null,
        topic || null,
        is_private,
        pos.rows[0].next_pos,
      ],
    );

    // If private, set up role access
    if (is_private && role_ids.length > 0) {
      for (const roleId of role_ids) {
        await client.query(
          `INSERT INTO channel_role_access (channel_id, role_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [channel.rows[0].id, roleId],
        );
      }
    }

    await client.query("COMMIT");
    res.status(201).json(channel.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Create channel error:", err);
    res.status(500).json({ error: "Failed to create channel" });
  } finally {
    client.release();
  }
});

// ─── Update a channel ─────────────────────────────────────────────────────────
router.patch(
  "/:channelId",
  requirePermission("manage_channels"),
  async (req, res) => {
    const { channelId } = req.params;
    const { name, topic, is_private, role_ids } = req.body;

    const client = await db.connect();
    try {
      await client.query("BEGIN");

      const result = await client.query(
        `UPDATE channels
       SET name       = COALESCE($1, name),
           topic      = COALESCE($2, topic),
           is_private = COALESCE($3, is_private)
       WHERE id = $4 AND community_id = $5
       RETURNING *`,
        [name, topic, is_private, channelId, req.params.id],
      );

      if (!result.rows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Channel not found" });
      }

      // Update role access if provided
      if (role_ids !== undefined) {
        await client.query(
          "DELETE FROM channel_role_access WHERE channel_id = $1",
          [channelId],
        );

        for (const roleId of role_ids) {
          await client.query(
            `INSERT INTO channel_role_access (channel_id, role_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
            [channelId, roleId],
          );
        }
      }

      await client.query("COMMIT");
      res.json(result.rows[0]);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Update channel error:", err);
      res.status(500).json({ error: "Server error" });
    } finally {
      client.release();
    }
  },
);

// ─── Delete a channel ─────────────────────────────────────────────────────────
router.delete(
  "/:channelId",
  requirePermission("manage_channels"),
  async (req, res) => {
    const { channelId, id: communityId } = req.params;

    try {
      const result = await db.query(
        `DELETE FROM channels
       WHERE id = $1 AND community_id = $2
       RETURNING id`,
        [channelId, communityId],
      );

      if (!result.rows.length) {
        return res.status(404).json({ error: "Channel not found" });
      }

      res.json({ success: true });
    } catch (err) {
      console.error("Delete channel error:", err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

export default router;
