import express from "express";
import db from "../db/postgres.js";
import { authenticateToken } from "../middleware/auth.js";
import {
  requireMember,
  requirePermission,
} from "../middleware/communityAuth.js";

const router = express.Router({ mergeParams: true });

router.use(authenticateToken);
router.use(requireMember);

// ─── Get all roles ────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, name, color, position, is_default, permissions
       FROM community_roles
       WHERE community_id = $1
       ORDER BY position DESC`,
      [req.params.id],
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Get roles error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Create a role ────────────────────────────────────────────────────────────
router.post("/", requirePermission("manage_community"), async (req, res) => {
  const communityId = req.params.id;
  const { name, color = "#99aab5", permissions = {} } = req.body;

  if (!name?.trim()) {
    return res.status(400).json({ error: "Role name is required" });
  }

  const defaultPermissions = {
    view_channel: true,
    send_messages: true,
    manage_messages: false,
    kick_members: false,
    ban_members: false,
    manage_channels: false,
    manage_community: false,
    join_voice: true,
    mute_members: false,
  };

  try {
    // Get next position
    const pos = await db.query(
      `SELECT COALESCE(MAX(position), 0) + 1 as next_pos
       FROM community_roles
       WHERE community_id = $1`,
      [communityId],
    );

    const result = await db.query(
      `INSERT INTO community_roles (community_id, name, color, position, permissions)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        communityId,
        name.trim(),
        color,
        pos.rows[0].next_pos,
        JSON.stringify({ ...defaultPermissions, ...permissions }),
      ],
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Create role error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Update a role ────────────────────────────────────────────────────────────
router.patch(
  "/:roleId",
  requirePermission("manage_community"),
  async (req, res) => {
    const { roleId, id: communityId } = req.params;
    const { name, color, permissions } = req.body;

    try {
      // Can't rename the default everyone role
      const existing = await db.query(
        "SELECT is_default FROM community_roles WHERE id = $1 AND community_id = $2",
        [roleId, communityId],
      );

      if (!existing.rows.length) {
        return res.status(404).json({ error: "Role not found" });
      }

      if (existing.rows[0].is_default && name) {
        return res
          .status(400)
          .json({ error: "Cannot rename the default role" });
      }

      const result = await db.query(
        `UPDATE community_roles
       SET name        = COALESCE($1, name),
           color       = COALESCE($2, color),
           permissions = CASE WHEN $3::jsonb IS NOT NULL
                           THEN permissions || $3::jsonb
                           ELSE permissions
                         END
       WHERE id = $4 AND community_id = $5
       RETURNING *`,
        [
          name,
          color,
          permissions ? JSON.stringify(permissions) : null,
          roleId,
          communityId,
        ],
      );

      res.json(result.rows[0]);
    } catch (err) {
      console.error("Update role error:", err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

// ─── Delete a role ────────────────────────────────────────────────────────────
router.delete(
  "/:roleId",
  requirePermission("manage_community"),
  async (req, res) => {
    const { roleId, id: communityId } = req.params;

    try {
      const existing = await db.query(
        "SELECT is_default FROM community_roles WHERE id = $1 AND community_id = $2",
        [roleId, communityId],
      );

      if (!existing.rows.length) {
        return res.status(404).json({ error: "Role not found" });
      }

      if (existing.rows[0].is_default) {
        return res
          .status(400)
          .json({ error: "Cannot delete the default role" });
      }

      await db.query(
        "DELETE FROM community_roles WHERE id = $1 AND community_id = $2",
        [roleId, communityId],
      );

      res.json({ success: true });
    } catch (err) {
      console.error("Delete role error:", err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

export default router;
