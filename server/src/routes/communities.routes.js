import express from "express";
import db from "../db/postgres.js";
import { requireAuth as authenticateToken } from "../middleware/auth.js";
import {
  requireMember,
  requirePermission,
} from "../middleware/communityAuth.js";
import crypto from "crypto";

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// ─── Create a community ───────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  const { name, description } = req.body;
  const userId = req.user.id;

  if (!name?.trim()) {
    return res.status(400).json({ error: "Name is required" });
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    // Create community
    const community = await client.query(
      `INSERT INTO communities (name, description, owner_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name.trim(), description || null, userId],
    );
    const communityId = community.rows[0].id;

    // Create default @everyone role
    const everyoneRole = await client.query(
      `INSERT INTO community_roles (community_id, name, is_default, position, permissions)
       VALUES ($1, 'everyone', true, 0, $2)
       RETURNING id`,
      [
        communityId,
        JSON.stringify({
          view_channel: true,
          send_messages: true,
          manage_messages: false,
          kick_members: false,
          ban_members: false,
          manage_channels: false,
          manage_community: false,
          join_voice: true,
          mute_members: false,
        }),
      ],
    );

    // Create default General category
    const category = await client.query(
      `INSERT INTO categories (community_id, name, position)
       VALUES ($1, 'General', 0)
       RETURNING id`,
      [communityId],
    );

    // Create default general channel
    await client.query(
      `INSERT INTO channels (name, type, community_id, category_id, position)
       VALUES ('general', 'text', $1, $2, 0)`,
      [communityId, category.rows[0].id],
    );

    // Add owner as member
    const member = await client.query(
      `INSERT INTO community_members (community_id, user_id)
       VALUES ($1, $2)
       RETURNING id`,
      [communityId, userId],
    );

    // Give owner the default role
    await client.query(
      `INSERT INTO member_roles (member_id, role_id) VALUES ($1, $2)`,
      [member.rows[0].id, everyoneRole.rows[0].id],
    );

    // Create a permanent invite code
    const code = crypto.randomBytes(4).toString("hex");
    await client.query(
      `INSERT INTO community_invites (community_id, code, created_by)
       VALUES ($1, $2, $3)`,
      [communityId, code, userId],
    );

    await client.query("COMMIT");
    res.status(201).json(community.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Create community error:", err);
    res.status(500).json({ error: "Failed to create community" });
  } finally {
    client.release();
  }
});

// ─── Get a community ─────────────────────────────────────────────────────────
router.get("/:id", requireMember, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.*,
              u.username as owner_username,
              (SELECT COUNT(*) FROM community_members WHERE community_id = c.id) as member_count
       FROM communities c
       JOIN users u ON u.id = c.owner_id
       WHERE c.id = $1`,
      [req.params.id],
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Community not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Get community error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Update a community ───────────────────────────────────────────────────────
router.patch(
  "/:id",
  requirePermission("manage_community"),
  async (req, res) => {
    const { name, description, icon, banner } = req.body;

    try {
      const result = await db.query(
        `UPDATE communities
       SET name        = COALESCE($1, name),
           description = COALESCE($2, description),
           icon        = COALESCE($3, icon),
           banner      = COALESCE($4, banner)
       WHERE id = $5
       RETURNING *`,
        [name, description, icon, banner, req.params.id],
      );

      res.json(result.rows[0]);
    } catch (err) {
      console.error("Update community error:", err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

// ─── Delete a community ───────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  const userId = req.user.id;

  try {
    // Only owner can delete
    const community = await db.query(
      "SELECT owner_id FROM communities WHERE id = $1",
      [req.params.id],
    );

    if (!community.rows.length) {
      return res.status(404).json({ error: "Community not found" });
    }

    if (community.rows[0].owner_id !== userId) {
      return res
        .status(403)
        .json({ error: "Only the owner can delete a community" });
    }

    await db.query("DELETE FROM communities WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Delete community error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Get all communities for the current user ─────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.id, c.name, c.icon, c.description, c.owner_id,
              (SELECT COUNT(*) FROM community_members WHERE community_id = c.id) as member_count
       FROM communities c
       JOIN community_members cm ON cm.community_id = c.id
       WHERE cm.user_id = $1
       ORDER BY cm.joined_at ASC`,
      [req.user.id],
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Get communities error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Leave a community ────────────────────────────────────────────────────────
router.delete("/:id/leave", requireMember, async (req, res) => {
  const userId = req.user.id;
  const communityId = req.params.id;

  try {
    // Owner can't leave — must transfer ownership or delete
    const community = await db.query(
      "SELECT owner_id FROM communities WHERE id = $1",
      [communityId],
    );

    if (community.rows[0].owner_id === userId) {
      return res.status(400).json({
        error:
          "Owner cannot leave. Transfer ownership or delete the community first.",
      });
    }

    await db.query(
      `DELETE FROM community_members
       WHERE community_id = $1 AND user_id = $2`,
      [communityId, userId],
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Leave community error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
