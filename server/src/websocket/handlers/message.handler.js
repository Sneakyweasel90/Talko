import db from "../../db/postgres.js";
import { WebSocket } from "ws";

async function attachReactions(messages) {
  if (messages.length === 0) return messages;
  const ids = messages.map((m) => m.id);
  const { rows } = await db.query(
    `SELECT r.message_id, r.emoji, COUNT(*)::int AS count, array_agg(u.username) AS users
     FROM reactions r
     JOIN users u ON r.user_id = u.id
     WHERE r.message_id = ANY($1::int[])
     GROUP BY r.message_id, r.emoji
     ORDER BY MIN(r.created_at)`,
    [ids],
  );
  const byMsg = {};
  for (const row of rows) {
    if (!byMsg[row.message_id]) byMsg[row.message_id] = [];
    byMsg[row.message_id].push({
      emoji: row.emoji,
      count: row.count,
      users: row.users,
    });
  }
  return messages.map((m) => ({ ...m, reactions: byMsg[m.id] || [] }));
}

export async function handleJoin({
  ws,
  msg,
  user,
  channels,
  broadcast,
  broadcastDM,
  wss,
}) {
  const { channelId, communityId } = msg;

  // DMs use string keys like "dm:123", everything else uses "communityId:channelId"
  const roomKey = channelId.toString().startsWith("dm:")
    ? channelId
    : `${communityId}:${channelId}`;

  if (!channels.has(roomKey)) channels.set(roomKey, new Set());
  channels.get(roomKey).add(ws);
  ws.channels.add(roomKey);

  if (channelId.toString().startsWith("dm:")) {
    // DM history — channel_id is still a string like "dm:123"
    const { rows } = await db.query(
      `SELECT m.*, u.username AS raw_username, u.role AS user_role, u.custom_role_name AS user_custom_role_name,
         rm.username AS reply_to_username, rm.content AS reply_to_content
       FROM messages m
       JOIN users u ON m.user_id = u.id
       LEFT JOIN messages rm ON m.reply_to_id = rm.id
       WHERE m.channel_id = $1
       ORDER BY m.id DESC LIMIT 50`,
      [channelId],
    );
    const messages = await attachReactions(rows.reverse());
    ws.send(
      JSON.stringify({
        type: "history",
        messages,
        hasMore: rows.length === 50,
        oldestId: messages.length > 0 ? messages[0].id : null,
      }),
    );
    return;
  }

  // Regular channel history — use integer channel db id
  const { rows } = await db.query(
    `SELECT m.*, u.username AS raw_username, u.role AS user_role, u.custom_role_name AS user_custom_role_name,
       rm.username AS reply_to_username, rm.content AS reply_to_content
     FROM messages m
     JOIN users u ON m.user_id = u.id
     LEFT JOIN messages rm ON m.reply_to_id = rm.id
     WHERE m.channel_db_id = $1
     ORDER BY m.id DESC LIMIT 50`,
    [channelId],
  );
  const messages = await attachReactions(rows.reverse());
  ws.send(
    JSON.stringify({
      type: "history",
      messages,
      hasMore: rows.length === 50,
      oldestId: messages.length > 0 ? messages[0].id : null,
    }),
  );

  // Unread counts scoped to this community
  const { rows: unreadRows } = await db.query(
    `SELECT ch.id, ch.name, COUNT(m.id)::int AS unread
     FROM channels ch
     LEFT JOIN messages m ON m.channel_db_id = ch.id
     LEFT JOIN channel_last_read clr ON clr.channel_id = ch.id AND clr.user_id = $1
     WHERE ch.type = 'text'
       AND ch.community_id = $2
       AND (clr.last_read_at IS NULL OR m.created_at > clr.last_read_at)
     GROUP BY ch.id, ch.name`,
    [user.id, communityId],
  );
  const unreadMap = {};
  for (const row of unreadRows) unreadMap[row.id] = row.unread;
  ws.send(JSON.stringify({ type: "channel_unread_counts", counts: unreadMap }));
}

export async function handleLoadMore({ ws, msg }) {
  const { channelId, beforeId, communityId } = msg;
  if (!channelId || !beforeId) return;

  if (channelId.toString().startsWith("dm:")) {
    const { rows } = await db.query(
      `SELECT m.*, u.username AS raw_username, u.role AS user_role, u.custom_role_name AS user_custom_role_name,
         rm.username AS reply_to_username, rm.content AS reply_to_content
       FROM messages m
       JOIN users u ON m.user_id = u.id
       LEFT JOIN messages rm ON m.reply_to_id = rm.id
       WHERE m.channel_id = $1 AND m.id < $2
       ORDER BY m.id DESC LIMIT 50`,
      [channelId, beforeId],
    );
    const messages = await attachReactions(rows.reverse());
    ws.send(
      JSON.stringify({
        type: "history_prepend",
        messages,
        hasMore: rows.length === 50,
        oldestId: messages.length > 0 ? messages[0].id : null,
      }),
    );
    return;
  }

  const { rows } = await db.query(
    `SELECT m.*, u.username AS raw_username, u.role AS user_role, u.custom_role_name AS user_custom_role_name,
       rm.username AS reply_to_username, rm.content AS reply_to_content
     FROM messages m
     JOIN users u ON m.user_id = u.id
     LEFT JOIN messages rm ON m.reply_to_id = rm.id
     WHERE m.channel_db_id = $1 AND m.id < $2
     ORDER BY m.id DESC LIMIT 50`,
    [channelId, beforeId],
  );
  const messages = await attachReactions(rows.reverse());
  ws.send(
    JSON.stringify({
      type: "history_prepend",
      messages,
      hasMore: rows.length === 50,
      oldestId: messages.length > 0 ? messages[0].id : null,
    }),
  );
}

export async function handleSendMessage({
  ws,
  msg,
  user,
  broadcast,
  broadcastDM,
  wss,
  isRateLimited,
}) {
  if (await isRateLimited(user.id, "message")) {
    ws.send(
      JSON.stringify({ type: "error", message: "Rate limited — slow down" }),
    );
    return;
  }

  const { channelId, communityId, content, replyToId } = msg;
  if (!content?.trim()) return;

  const { rows: uRows } = await db.query(
    `SELECT COALESCE(nickname, username) AS display_name FROM users WHERE id = $1`,
    [user.id],
  );
  const displayName = uRows[0]?.display_name || user.username;

  let savedMessage;

  if (channelId.toString().startsWith("dm:")) {
    const { rows } = await db.query(
      `INSERT INTO messages (channel_id, user_id, username, content, reply_to_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [channelId, user.id, displayName, content.trim(), replyToId || null],
    );
    savedMessage = rows[0];
  } else {
    const { rows } = await db.query(
      `INSERT INTO messages (channel_id, channel_db_id, user_id, username, content, reply_to_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        channelId.toString(),
        channelId,
        user.id,
        displayName,
        content.trim(),
        replyToId || null,
      ],
    );
    savedMessage = rows[0];
  }

  const { rows: uRaw } = await db.query(
    `SELECT username, custom_role_name FROM users WHERE id = $1`,
    [user.id],
  );

  let reply_to_username = null,
    reply_to_content = null;
  if (replyToId) {
    const { rows: replyRows } = await db.query(
      `SELECT username, content FROM messages WHERE id = $1`,
      [replyToId],
    );
    if (replyRows[0]) {
      reply_to_username = replyRows[0].username;
      reply_to_content = replyRows[0].content;
    }
  }

  const outMsg = {
    type: "message",
    message: {
      ...savedMessage,
      raw_username: uRaw[0]?.username || user.username,
      user_role: user.role || "user",
      user_custom_role_name: uRaw[0]?.custom_role_name || null,
      reactions: [],
      reply_to_username,
      reply_to_content,
    },
  };

  if (channelId.toString().startsWith("dm:")) {
    broadcastDM(channelId, outMsg, wss);
  } else {
    const roomKey = `${communityId}:${channelId}`;
    broadcast(roomKey, outMsg);

    // Increment unread for clients not in this channel
    for (const client of wss.clients) {
      if (client.readyState !== WebSocket.OPEN || client._yakk_closed) continue;
      if (client.user?.id === user.id) continue;
      if (client.channels?.has(roomKey)) continue;
      client.send(
        JSON.stringify({
          type: "channel_unread_increment",
          channelId,
        }),
      );
    }

    // @mention notifications
    const mentionRegex = /@([\w\s]+?)(?=\s|$|[^a-zA-Z0-9_\s])/g;
    const mentionedNames = [...content.trim().matchAll(mentionRegex)].map((m) =>
      m[1].trim().toLowerCase(),
    );
    if (mentionedNames.length > 0) {
      for (const client of wss.clients) {
        if (client.readyState !== WebSocket.OPEN || client._yakk_closed)
          continue;
        if (client.user?.id === user.id) continue;
        const clientUsername = client.user?.username?.toLowerCase();
        const clientNickname = client.user?.nickname?.toLowerCase();
        const isMentioned = mentionedNames.some(
          (n) => n === clientUsername || n === clientNickname,
        );
        if (isMentioned) {
          client.send(
            JSON.stringify({
              type: "mention",
              channelId,
              senderName: displayName,
              content: content.trim().slice(0, 100),
            }),
          );
        }
      }
    }
  }
}

export async function handleEditMessage({
  msg,
  user,
  broadcast,
  isRateLimited,
}) {
  if (await isRateLimited(user.id, "edit")) return;
  const { messageId, content, communityId } = msg;
  if (!messageId || !content?.trim()) return;

  const { rows } = await db.query(
    `UPDATE messages SET content = $1, edited_at = NOW()
     WHERE id = $2 AND user_id = $3
     RETURNING channel_db_id, channel_id`,
    [content.trim(), messageId, user.id],
  );
  if (!rows[0]) return;

  const roomKey = rows[0].channel_db_id
    ? `${communityId}:${rows[0].channel_db_id}`
    : rows[0].channel_id;

  broadcast(roomKey, {
    type: "message_edited",
    messageId,
    content: content.trim(),
  });
}

export async function handleDeleteMessage({ msg, user, broadcast }) {
  const { messageId, communityId } = msg;
  if (!messageId) return;

  const query =
    user.role === "admin"
      ? `DELETE FROM messages WHERE id = $1 RETURNING channel_db_id, channel_id`
      : `DELETE FROM messages WHERE id = $1 AND user_id = $2 RETURNING channel_db_id, channel_id`;
  const params = user.role === "admin" ? [messageId] : [messageId, user.id];

  const { rows } = await db.query(query, params);
  if (!rows[0]) return;

  const roomKey = rows[0].channel_db_id
    ? `${communityId}:${rows[0].channel_db_id}`
    : rows[0].channel_id;

  broadcast(roomKey, { type: "message_deleted", messageId });
}

export async function handleTyping({
  ws,
  msg,
  user,
  broadcast,
  isRateLimited,
}) {
  if (await isRateLimited(user.id, "typing")) return;
  const { channelId, communityId } = msg;

  const roomKey = channelId.toString().startsWith("dm:")
    ? channelId
    : `${communityId}:${channelId}`;

  broadcast(
    roomKey,
    { type: "typing", userId: user.id, username: user.username },
    ws,
  );
}
