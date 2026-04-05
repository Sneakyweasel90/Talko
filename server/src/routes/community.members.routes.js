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

// ─── Get all members ──────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  const communityId = req.params.id;

  try {
    const result = await db.query(
      `SELECT
         cm.id as member_id,
         cm.nickname,
         cm.joined_at,
         u.id as user_id,
         u.username,
         u.avatar,
         COALESCE(
           json_agg(
             json_build_object('id', cr.id, 'name', cr.name, 'color', cr.color)
           ) FILTER (WHERE cr.id IS NOT NULL),
           '[]'
         ) as roles
       FROM community_members cm
       JOIN users u ON u.id = cm.user_id
       LEFT JOIN member_roles mr ON mr.member_id = cm.id
       LEFT JOIN community_roles cr ON cr.id = mr.role_id AND cr.is_default = false
       WHERE cm.community_id = $1
       GROUP BY cm.id, u.id
       ORDER BY cm.joined_at ASC`,
      [communityId],
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Get members error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Update a member (nickname or roles) ─────────────────────────────────────
router.patch(
  "/:userId",
  requirePermission("kick_members"),
  async (req, res) => {
    const { userId, id: communityId } = req.params;
    const { nickname, role_ids } = req.body;

    const client = await db.connect();
    try {
      await client.query("BEGIN");

      // Update nickname if provided
      if (nickname !== undefined) {
        await client.query(
          `UPDATE community_members
         SET nickname = $1
         WHERE community_id = $2 AND user_id = $3`,
          [nickname || null, communityId, userId],
        );
      }

      // Update roles if provided
      if (role_ids !== undefined) {
        const member = await client.query(
          `SELECT id FROM community_members
         WHERE community_id = $1 AND user_id = $2`,
          [communityId, userId],
        );

        if (member.rows.length) {
          const memberId = member.rows[0].id;

          // Remove non-default roles
          await client.query(
            `DELETE FROM member_roles
           WHERE member_id = $1
             AND role_id IN (
               SELECT id FROM community_roles
               WHERE community_id = $2 AND is_default = false
             )`,
            [memberId, communityId],
          );

          // Add new roles
          for (const roleId of role_ids) {
            await client.query(
              `INSERT INTO member_roles (member_id, role_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
              [memberId, roleId],
            );
          }
        }
      }

      await client.query("COMMIT");
      res.json({ success: true });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Update member error:", err);
      res.status(500).json({ error: "Server error" });
    } finally {
      client.release();
    }
  },
);

// ─── Kick a member ────────────────────────────────────────────────────────────
router.delete(
  "/:userId",
  requirePermission("kick_members"),
  async (req, res) => {
    const { userId, id: communityId } = req.params;
    const requesterId = req.user.id;

    try {
      // Can't kick yourself
      if (parseInt(userId) === requesterId) {
        return res.status(400).json({ error: "Cannot kick yourself" });
      }

      // Can't kick the owner
      const community = await db.query(
        "SELECT owner_id FROM communities WHERE id = $1",
        [communityId],
      );

      if (parseInt(userId) === community.rows[0].owner_id) {
        return res
          .status(403)
          .json({ error: "Cannot kick the community owner" });
      }

      const result = await db.query(
        `DELETE FROM community_members
       WHERE community_id = $1 AND user_id = $2
       RETURNING id`,
        [communityId, userId],
      );

      if (!result.rows.length) {
        return res.status(404).json({ error: "Member not found" });
      }

      res.json({ success: true });
    } catch (err) {
      console.error("Kick member error:", err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

export default router;
