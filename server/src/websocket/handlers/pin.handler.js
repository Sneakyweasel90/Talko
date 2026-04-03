import db from "../../db/postgres.js";

export async function handlePin({ msg, user, broadcast }) {
  if (user.role !== "admin") return;
  const { messageId, channelId } = msg;
  if (!messageId || !channelId) return;
  try {
    await db.query(
      `INSERT INTO pinned_messages (channel_name, message_id, pinned_by)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [channelId, messageId, user.id]
    );
    broadcast(channelId, { type: "message_pinned", messageId, channelId, pinnedBy: user.username });
  } catch { /* ignore duplicate */ }
}

export async function handleUnpin({ msg, user, broadcast }) {
  if (user.role !== "admin") return;
  const { messageId, channelId } = msg;
  if (!messageId || !channelId) return;
  await db.query(
    `DELETE FROM pinned_messages WHERE channel_name = $1 AND message_id = $2`,
    [channelId, messageId]
  );
  broadcast(channelId, { type: "message_unpinned", messageId, channelId });
}