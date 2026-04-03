import { WebSocketServer, WebSocket } from "ws";
import { verifyWsToken } from "../middleware/auth.js";
import db from "../db/postgres.js";
import redis from "../redis/redisClient.js";

const channels = new Map();

const RATE_LIMITS = {
  message: { max: 20, windowSec: 10 },
  react:   { max: 30, windowSec: 10 },
  edit:    { max: 10, windowSec: 10 },
  typing:  { max: 15, windowSec: 10 },
  default: { max: 20, windowSec: 10 },
};

async function isRateLimited(userId, action = "default") {
  const { max, windowSec } = RATE_LIMITS[action] || RATE_LIMITS.default;
  const key = `rl:ws:${action}:${userId}`;
  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, windowSec);
    return count > max;
  } catch {
    return false;
  }
}

function broadcast(channelId, data, excludeWs = null) {
  const clients = channels.get(channelId);
  if (!clients) return;
  const payload = JSON.stringify(data);
  for (const client of clients) {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

function broadcastAll(wss, data) {
  const payload = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN && !client._yakk_closed) {
      client.send(payload);
    }
  }
}

let wssInstance = null;
export function getWss() { return wssInstance; }
async function broadcastPresence(wss) {
  const liveUserIds = new Set();
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN && !client._yakk_closed && client.user?.id) {
      liveUserIds.add(String(client.user.id));
    }
  }
  const redisIds = await redis.sMembers("online_users");
  for (const id of redisIds) {
    if (!liveUserIds.has(id)) await redis.sRem("online_users", id);
  }
  for (const id of liveUserIds) await redis.sAdd("online_users", id);

  if (liveUserIds.size === 0) {
    const payload = JSON.stringify({ type: "presence", users: [] });
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(payload);
    }
    return;
  }

  const { rows } = await db.query(
    `SELECT id, COALESCE(nickname, username) AS username FROM users WHERE id = ANY($1::int[])`,
    [[...liveUserIds].map(Number)]
  );

  // Merge in live status from ws clients
  const statusMap = {};
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN && client.user?.id) {
      statusMap[client.user.id] = {
        status: client.user.status || "online",
        statusText: client.user.statusText || null,
      };
    }
  }
  const usersWithStatus = rows.map(u => ({
    ...u,
    status: statusMap[u.id]?.status ?? "online",
    statusText: statusMap[u.id]?.statusText ?? null,
  }));

  const payload = JSON.stringify({ type: "presence", users: usersWithStatus });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  }
}

function getVoiceState() {
  const state = {};
  for (const [key, clients] of channels.entries()) {
    if (!key.startsWith("voice:")) continue;
    const channelId = key.replace("voice:", "");
    const names = [...clients].map(c => c.user?.username).filter(Boolean);
    if (names.length > 0) state[channelId] = names;
  }
  return state;
}

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

async function attachReactions(messages) {
  if (messages.length === 0) return messages;
  const ids = messages.map(m => m.id);
  const { rows } = await db.query(
    `SELECT r.message_id, r.emoji, COUNT(*)::int AS count, array_agg(u.username) AS users
     FROM reactions r
     JOIN users u ON r.user_id = u.id
     WHERE r.message_id = ANY($1::int[])
     GROUP BY r.message_id, r.emoji
     ORDER BY MIN(r.created_at)`,
    [ids]
  );
  const byMsg = {};
  for (const row of rows) {
    if (!byMsg[row.message_id]) byMsg[row.message_id] = [];
    byMsg[row.message_id].push({ emoji: row.emoji, count: row.count, users: row.users });
  }
  return messages.map(m => ({ ...m, reactions: byMsg[m.id] || [] }));
}

function broadcastDM(channelId, data, wss) {
  const payload = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN && !client._yakk_closed) {
      client.send(payload);
    }
  }
}

export async function initWebSocket(server) {
  await redis.del("online_users");
  const wss = new WebSocketServer({ server });
  wssInstance = wss;

  wss.on("connection", async (ws, req) => {
    const token = new URL(req.url, "http://localhost:4000").searchParams.get("token");
    const user = verifyWsToken(token);

    if (!user) { ws.close(1008, "Unauthorized"); return; }

    const { rows: nickRow } = await db.query(
      `SELECT nickname FROM users WHERE id = $1`, [user.id]
    );
    ws.user = { ...user, nickname: nickRow[0]?.nickname || null, status: "online", statusText: null };
    ws.channels = new Set();

    await redis.sAdd("online_users", String(user.id));
    await broadcastPresence(wss);

    ws.on("message", async (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      // JOIN
      if (msg.type === "join") {
        const { channelId } = msg;
        if (!channels.has(channelId)) channels.set(channelId, new Set());
        channels.get(channelId).add(ws);
        ws.channels.add(channelId);

        const { rows } = await db.query(
          `SELECT m.*, u.username AS raw_username, u.role AS user_role, u.custom_role_name AS user_custom_role_name,
             rm.username AS reply_to_username, rm.content AS reply_to_content
           FROM messages m
           JOIN users u ON m.user_id = u.id
           LEFT JOIN messages rm ON m.reply_to_id = rm.id
           WHERE m.channel_id = $1
           ORDER BY m.id DESC LIMIT 50`,
          [channelId]
        );
        const messages = await attachReactions(rows.reverse());
        ws.send(JSON.stringify({
          type: "history",
          messages,
          hasMore: rows.length === 50,
          oldestId: messages.length > 0 ? messages[0].id : null,
        }));

        const voiceState = getVoiceState();
        if (Object.keys(voiceState).length > 0) {
          ws.send(JSON.stringify({ type: "voice_state", channels: voiceState }));
        }

        // Send unread counts for all text channels
        const { rows: unreadRows } = await db.query(
          `SELECT c.name, COUNT(m.id)::int AS unread
           FROM channels c
           LEFT JOIN messages m ON m.channel_id = c.name
           LEFT JOIN channel_last_read clr ON clr.channel_name = c.name AND clr.user_id = $1
           WHERE c.type = 'text'
             AND (clr.last_read_at IS NULL OR m.created_at > clr.last_read_at)
           GROUP BY c.name`,
          [user.id]
        );
        const unreadMap = {};
        for (const row of unreadRows) unreadMap[row.name] = row.unread;
        ws.send(JSON.stringify({ type: "channel_unread_counts", counts: unreadMap }));
      }

      // LOAD MORE
      if (msg.type === "load_more") {
        const { channelId, beforeId } = msg;
        if (!channelId || !beforeId) return;
        const { rows } = await db.query(
          `SELECT m.*, u.username AS raw_username, u.role AS user_role, u.custom_role_name AS user_custom_role_name,
             rm.username AS reply_to_username, rm.content AS reply_to_content
           FROM messages m
           JOIN users u ON m.user_id = u.id
           LEFT JOIN messages rm ON m.reply_to_id = rm.id
           WHERE m.channel_id = $1 AND m.id < $2
           ORDER BY m.id DESC LIMIT 50`,
          [channelId, beforeId]
        );
        const messages = await attachReactions(rows.reverse());
        ws.send(JSON.stringify({
          type: "history_prepend",
          messages,
          hasMore: rows.length === 50,
          oldestId: messages.length > 0 ? messages[0].id : null,
        }));
      }

      // VOICE join — presence only, no signalling
      if (msg.type === "voice_join") {
        const { channelId } = msg;
        ws.voiceChannel = channelId;
        if (!channels.has(`voice:${channelId}`)) channels.set(`voice:${channelId}`, new Set());
        channels.get(`voice:${channelId}`).add(ws);
        broadcastAll(wss, { type: "voice_presence_update", channelId, username: user.username, action: "join" });
      }

      // VOICE leave — presence only, no signalling
      if (msg.type === "voice_leave") {
        if (ws.voiceChannel) {
          const channelId = ws.voiceChannel;
          channels.get(`voice:${channelId}`)?.delete(ws);
          broadcastAll(wss, { type: "voice_presence_update", channelId, username: user.username, action: "leave" });
          ws.voiceChannel = null;
        }
      }

      // SEND message
      if (msg.type === "message") {
        if (await isRateLimited(user.id, "message")) {
          ws.send(JSON.stringify({ type: "error", message: "Rate limited — slow down" }));
          return;
        }
        const { channelId, content, replyToId } = msg;
        if (!content?.trim()) return;
        const { rows: uRows } = await db.query(
          `SELECT COALESCE(nickname, username) AS display_name FROM users WHERE id = $1`,
          [user.id]
        );
        const displayName = uRows[0]?.display_name || user.username;
        const { rows } = await db.query(
          `INSERT INTO messages (channel_id, user_id, username, content, reply_to_id)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [channelId, user.id, displayName, content.trim(), replyToId || null]
        );
        const { rows: uRaw } = await db.query(`SELECT username, custom_role_name FROM users WHERE id = $1`, [user.id]);
        let reply_to_username = null, reply_to_content = null;
        if (replyToId) {
          const { rows: replyRows } = await db.query(`SELECT username, content FROM messages WHERE id = $1`, [replyToId]);
          if (replyRows[0]) { reply_to_username = replyRows[0].username; reply_to_content = replyRows[0].content; }
        }
        const outMsg = {
          type: "message",
          message: {
            ...rows[0],
            raw_username: uRaw[0]?.username || user.username,
            user_role: user.role || 'user',
            user_custom_role_name: uRaw[0]?.custom_role_name || null,
            reactions: [],
            reply_to_username,
            reply_to_content,
          }
        };
        if (channelId.startsWith("dm:")) broadcastDM(channelId, outMsg, wss);
        else broadcast(channelId, outMsg);

        // Increment unread for clients not in this channel
        if (!channelId.startsWith("dm:")) {
          for (const client of wss.clients) {
            if (client.readyState !== WebSocket.OPEN || client._yakk_closed) continue;
            if (client.user?.id === user.id) continue;
            if (client.channels?.has(channelId)) continue;
            client.send(JSON.stringify({ type: "channel_unread_increment", channelName: channelId }));
          }
        }

        // @mention notifications
        const mentionRegex = /@([\w\s]+?)(?=\s|$|[^a-zA-Z0-9_\s])/g;
        const mentionedNames = [...content.trim().matchAll(mentionRegex)].map(m => m[1].trim().toLowerCase());
        if (mentionedNames.length > 0) {
          for (const client of wss.clients) {
            if (client.readyState !== WebSocket.OPEN || client._yakk_closed) continue;
            if (client.user?.id === user.id) continue;
            const clientUsername = client.user?.username?.toLowerCase();
            const clientNickname = client.user?.nickname?.toLowerCase();
            const isMentioned = mentionedNames.some(n => n === clientUsername || n === clientNickname);
            if (isMentioned) {
              client.send(JSON.stringify({
                type: "mention",
                channelId,
                senderName: displayName,
                content: content.trim().slice(0, 100),
              }));
            }
          }
        }
      }

      // PIN message
      if (msg.type === "pin_message") {
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

      // UNPIN message
      if (msg.type === "unpin_message") {
        if (user.role !== "admin") return;
        const { messageId, channelId } = msg;
        if (!messageId || !channelId) return;
        await db.query(
          `DELETE FROM pinned_messages WHERE channel_name = $1 AND message_id = $2`,
          [channelId, messageId]
        );
        broadcast(channelId, { type: "message_unpinned", messageId, channelId });
      }

      // REACT
      if (msg.type === "react") {
        if (await isRateLimited(user.id, "react")) return;
        const { messageId, emoji } = msg;
        if (!messageId || !emoji) return;
        const { rows: msgRows } = await db.query(`SELECT channel_id FROM messages WHERE id = $1`, [messageId]);
        if (!msgRows[0]) return;
        const channelId = msgRows[0].channel_id;
        const { rows: existing } = await db.query(
          `SELECT id FROM reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3`,
          [messageId, user.id, emoji]
        );
        if (existing.length > 0) {
          await db.query(`DELETE FROM reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3`, [messageId, user.id, emoji]);
        } else {
          await db.query(
            `INSERT INTO reactions (message_id, user_id, emoji) VALUES ($1, $2, $3) ON CONFLICT (message_id, user_id, emoji) DO NOTHING`,
            [messageId, user.id, emoji]
          );
        }
        const reactions = await getReactions(messageId);
        broadcast(channelId, { type: "reaction_update", messageId, reactions });
      }

      // EDIT message
      if (msg.type === "edit_message") {
        if (await isRateLimited(user.id, "edit")) return;
        const { messageId, content } = msg;
        if (!messageId || !content?.trim()) return;
        const { rows } = await db.query(
          `UPDATE messages SET content = $1, edited_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING channel_id`,
          [content.trim(), messageId, user.id]
        );
        if (!rows[0]) return;
        broadcast(rows[0].channel_id, { type: "message_edited", messageId, content: content.trim() });
      }

      // DELETE message
      if (msg.type === "delete_message") {
        const { messageId } = msg;
        if (!messageId) return;
        const query = user.role === "admin"
          ? `DELETE FROM messages WHERE id = $1 RETURNING channel_id`
          : `DELETE FROM messages WHERE id = $1 AND user_id = $2 RETURNING channel_id`;
        const params = user.role === "admin" ? [messageId] : [messageId, user.id];
        const { rows } = await db.query(query, params);
        if (!rows[0]) return;
        broadcast(rows[0].channel_id, { type: "message_deleted", messageId });
      }

      // TYPING
      if (msg.type === "typing") {
        if (await isRateLimited(user.id, "typing")) return;
        broadcast(msg.channelId, { type: "typing", userId: user.id, username: user.username }, ws);
      }

      // SET STATUS
      if (msg.type === "set_status") {
        const { status, statusText } = msg;
        if (!["online", "away", "dnd"].includes(status)) return;
        ws.user.status = status;
        ws.user.statusText = (statusText ?? "").slice(0, 60) || null;
        await broadcastPresence(wss);
      }

      // AVATAR UPDATE
      if (msg.type === "avatar_update") {
        const { avatar } = msg;
        broadcastAll(wss, { type: "avatar_update", userId: user.id, avatar: avatar || null });
      }

      // PING
      if (msg.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
      }
    });

    ws.on("close", async () => {
      ws._yakk_closed = true;
      for (const channelId of ws.channels) channels.get(channelId)?.delete(ws);

      if (ws.voiceChannel) {
        const channelId = ws.voiceChannel;
        channels.get(`voice:${channelId}`)?.delete(ws);
        broadcastAll(wss, { type: "voice_presence_update", channelId, username: user.username, action: "leave" });
      }
      
      await redis.sRem("online_users", String(user.id));
      await broadcastPresence(wss);
      setTimeout(() => broadcastPresence(wss), 500);
    });
  });

  console.log("WebSocket gateway ready");
}