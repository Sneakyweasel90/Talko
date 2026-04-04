import express from "express";
import db from "../db/postgres.js";
import { authenticateToken } from "../middleware/auth.js";
import {
  requireMember,
  requirePermission,
} from "../middleware/communityAuth.js";
import crypto from "crypto";

const router = express.Router();

router.use(authenticateToken);

// ─── Look up an invite (before joining) ──────────────────────────────────────
router.get("/:code", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
         ci.code, ci.max_uses, ci.uses, ci.expires_at,
         c.id as community_id, c.name as community_name,
         c.icon as community_icon, c.description as community_description,
         (SELECT COUNT(*) FROM community_members WHERE community_id = c.id) as member_count,
         u.username as created_by
       FROM community_invites ci
       JOIN communities c ON c.id = ci.community_id
       LEFT JOIN users u ON u.id = ci.created_by
       WHERE ci.code = $1`,
      [req.params.code],
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Invalid invite code" });
    }

    const invite = result.rows[0];

    // Check if expired
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return res.status(410).json({ error: "This invite has expired" });
    }

    // Check if max uses reached
    if (invite.max_uses !== null && invite.uses >= invite.max_uses) {
      return res
        .status(410)
        .json({ error: "This invite has reached its maximum uses" });
    }

    res.json(invite);
  } catch (err) {
    console.error("Get invite error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Join via invite ──────────────────────────────────────────────────────────
router.post("/:code/join", async (req, res) => {
  const userId = req.user.id;

  const client = await db.getClient();
  try {
    await client.query("BEGIN");

    const invite = await client.query(
      `SELECT ci.*, c.id as community_id
       FROM community_invites ci
       JOIN communities c ON c.id = ci.community_id
       WHERE ci.code = $1
       FOR UPDATE`,
      [req.params.code],
    );

    if (!invite.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Invalid invite code" });
    }

    const { community_id, expires_at, max_uses, uses } = invite.rows[0];

    if (expires_at && new Date(expires_at) < new Date()) {
      await client.query("ROLLBACK");
      return res.status(410).json({ error: "This invite has expired" });
    }

    if (max_uses !== null && uses >= max_uses) {
      await client.query("ROLLBACK");
      return res
        .status(410)
        .json({ error: "This invite has reached its maximum uses" });
    }

    // Check if already a member
    const existing = await client.query(
      `SELECT id FROM community_members
       WHERE community_id = $1 AND user_id = $2`,
      [community_id, userId],
    );

    if (existing.rows.length) {
      await client.query("ROLLBACK");
      return res
        .status(400)
        .json({ error: "Already a member of this community" });
    }

    // Add member
    const member = await client.query(
      `INSERT INTO community_members (community_id, user_id)
       VALUES ($1, $2)
       RETURNING id`,
      [community_id, userId],
    );

    // Assign default role
    const defaultRole = await client.query(
      `SELECT id FROM community_roles
       WHERE community_id = $1 AND is_default = true
       LIMIT 1`,
      [community_id],
    );

    if (defaultRole.rows.length) {
      await client.query(
        `INSERT INTO member_roles (member_id, role_id) VALUES ($1, $2)`,
        [member.rows[0].id, defaultRole.rows[0].id],
      );
    }

    // Increment invite uses
    await client.query(
      `UPDATE community_invites SET uses = uses + 1 WHERE code = $1`,
      [req.params.code],
    );

    await client.query("COMMIT");
    res.json({ success: true, community_id });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Join invite error:", err);
    res.status(500).json({ error: "Failed to join community" });
  } finally {
    client.release();
  }
});

// ─── Create an invite ─────────────────────────────────────────────────────────
router.post("/communities/:id/invites", requireMember, async (req, res) => {
  const communityId = req.params.id;
  const userId = req.user.id;
  const { max_uses = null, expires_in = null } = req.body;
  // expires_in in hours, null = permanent

  try {
    const code = crypto.randomBytes(4).toString("hex");
    const expiresAt = expires_in
      ? new Date(Date.now() + expires_in * 60 * 60 * 1000)
      : null;

    const result = await db.query(
      `INSERT INTO community_invites (community_id, code, created_by, max_uses, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [communityId, code, userId, max_uses, expiresAt],
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Create invite error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── List invites for a community ────────────────────────────────────────────
router.get("/communities/:id/invites", requireMember, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT ci.*, u.username as created_by_username
       FROM community_invites ci
       LEFT JOIN users u ON u.id = ci.created_by
       WHERE ci.community_id = $1
       ORDER BY ci.created_at DESC`,
      [req.params.id],
    );

    res.json(result.rows);
  } catch (err) {
    console.error("List invites error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Delete an invite ─────────────────────────────────────────────────────────
router.delete(
  "/communities/:id/invites/:code",
  requirePermission("manage_community"),
  async (req, res) => {
    try {
      await db.query(
        `DELETE FROM community_invites
       WHERE code = $1 AND community_id = $2`,
        [req.params.code, req.params.id],
      );

      res.json({ success: true });
    } catch (err) {
      console.error("Delete invite error:", err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

export default router;
