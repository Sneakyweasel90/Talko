import db from "../db/postgres.js";

// Check if user is a member of the community
async function requireMember(req, res, next) {
  const communityId = req.params.communityId || req.params.id;
  const userId = req.user.id;
  try {
    const result = await db.query(
      `SELECT cm.id, c.owner_id
       FROM community_members cm
       JOIN communities c ON c.id = cm.community_id
       WHERE cm.community_id = $1 AND cm.user_id = $2`,
      [communityId, userId],
    );
    if (!result.rows.length) {
      return res.status(403).json({ error: "Not a member of this community" });
    }
    req.communityMember = result.rows[0];
    req.isOwner = result.rows[0].owner_id === userId;
    next();
  } catch (err) {
    console.error("requireMember error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

function requirePermission(permission) {
  return async (req, res, next) => {
    const communityId = req.params.communityId || req.params.id;
    const userId = req.user.id;
    try {
      const community = await db.query(
        "SELECT owner_id FROM communities WHERE id = $1",
        [communityId],
      );
      if (!community.rows.length) {
        return res.status(404).json({ error: "Community not found" });
      }
      if (community.rows[0].owner_id === userId) {
        return next();
      }
      const member = await db.query(
        `SELECT id FROM community_members
         WHERE community_id = $1 AND user_id = $2`,
        [communityId, userId],
      );
      if (!member.rows.length) {
        return res
          .status(403)
          .json({ error: "Not a member of this community" });
      }
      const perms = await db.query(
        `SELECT cr.permissions
         FROM member_roles mr
         JOIN community_roles cr ON cr.id = mr.role_id
         WHERE mr.member_id = $1`,
        [member.rows[0].id],
      );
      const hasPermission = perms.rows.some(
        (r) => r.permissions[permission] === true,
      );
      if (!hasPermission) {
        return res
          .status(403)
          .json({ error: `Missing permission: ${permission}` });
      }
      next();
    } catch (err) {
      console.error("requirePermission error:", err);
      res.status(500).json({ error: "Server error" });
    }
  };
}

async function canViewChannel(userId, channelId) {
  const result = await db.query(
    `SELECT c.is_private, c.community_id,
            cm.id as member_id,
            com.owner_id
     FROM channels c
     JOIN communities com ON com.id = c.community_id
     LEFT JOIN community_members cm ON cm.community_id = c.community_id
       AND cm.user_id = $2
     WHERE c.id = $1`,
    [channelId, userId],
  );
  if (!result.rows.length) return false;
  const { is_private, member_id, owner_id } = result.rows[0];
  if (!member_id) return false;
  if (owner_id === userId) return true;
  if (!is_private) return true;
  const access = await db.query(
    `SELECT 1 FROM channel_role_access cra
     JOIN member_roles mr ON mr.role_id = cra.role_id
     WHERE cra.channel_id = $1 AND mr.member_id = $2`,
    [channelId, member_id],
  );
  return access.rows.length > 0;
}

export { requireMember, requirePermission, canViewChannel };
