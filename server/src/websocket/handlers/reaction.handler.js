import db from "../../db/postgres.js";

async function getReactions(messageId) {
  const { rows } = await db.query(
    `SELECT r.emoji, COUNT(*)::int AS count, array_agg(u.username) AS users
     FROM reactions r
     JOIN users u ON r.user_id = u.id
     WHERE r.message_id = $1
     GROUP BY r.emoji
     ORDER BY MIN(r.created_at)`,
    [messageId]
  );
  return rows;
}

export async function handleReact({ msg, user, broadcast, isRateLimited }) {
  if (await isRateLimited(user.id, "react")) return;
  const { messageId, emoji } = msg;
  if (!messageId || !emoji) return;

  const { rows: msgRows } = await db.query(
    `SELECT channel_id FROM messages WHERE id = $1`,
    [messageId]
  );
  if (!msgRows[0]) return;
  const channelId = msgRows[0].channel_id;

  const { rows: existing } = await db.query(
    `SELECT id FROM reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3`,
    [messageId, user.id, emoji]
  );

  if (existing.length > 0) {
    await db.query(
      `DELETE FROM reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3`,
      [messageId, user.id, emoji]
    );
  } else {
    await db.query(
      `INSERT INTO reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)
       ON CONFLICT (message_id, user_id, emoji) DO NOTHING`,
      [messageId, user.id, emoji]
    );
  }

  const reactions = await getReactions(messageId);
  broadcast(channelId, { type: "reaction_update", messageId, reactions });
}