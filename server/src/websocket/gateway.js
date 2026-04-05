import { WebSocketServer, WebSocket } from "ws";
import { verifyWsToken } from "../middleware/auth.js";
import db from "../db/postgres.js";
import redis from "../redis/redisClient.js";
import {
  handleJoin,
  handleLoadMore,
  handleSendMessage,
  handleEditMessage,
  handleDeleteMessage,
  handleTyping,
} from "./handlers/message.handler.js";
import { handleVoiceJoin, handleVoiceLeave } from "./handlers/voice.handler.js";
import { handleReact } from "./handlers/reaction.handler.js";
import { handlePin, handleUnpin } from "./handlers/pin.handler.js";
import {
  handleSetStatus,
  handleAvatarUpdate,
  handlePing,
} from "./handlers/presence.handler.js";

const channels = new Map();

const RATE_LIMITS = {
  message: { max: 20, windowSec: 10 },
  react: { max: 30, windowSec: 10 },
  edit: { max: 10, windowSec: 10 },
  typing: { max: 15, windowSec: 10 },
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

function broadcastDM(channelId, data, wss) {
  const payload = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN && !client._yakk_closed) {
      client.send(payload);
    }
  }
}

let wssInstance = null;
export function getWss() {
  return wssInstance;
}

async function broadcastToCommunity(
  communityId,
  event,
  data,
  excludeUserId = null,
) {
  const wss = getWss();
  wss.clients.forEach((client) => {
    if (
      client.readyState === 1 &&
      client.communityIds?.includes(parseInt(communityId)) &&
      client.userId !== excludeUserId
    ) {
      client.send(JSON.stringify({ type: event, ...data }));
    }
  });
}

async function broadcastPresence(wss) {
  const liveUserIds = new Set();
  for (const client of wss.clients) {
    if (
      client.readyState === WebSocket.OPEN &&
      !client._yakk_closed &&
      client.user?.id
    ) {
      liveUserIds.add(String(client.user.id));
    }
  }
  const redisIds = await redis.sMembers("online_users");
  for (const id of redisIds) {
    if (!liveUserIds.has(id)) await redis.sRem("online_users", id);
  }
  for (const id of liveUserIds) await redis.sAdd("online_users", id);

  if (liveUserIds.size === 0) {
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: "presence", users: [] }));
      }
    }
    return;
  }

  const { rows } = await db.query(
    `SELECT id, COALESCE(nickname, username) AS username FROM users WHERE id = ANY($1::int[])`,
    [[...liveUserIds].map(Number)],
  );

  const statusMap = {};
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN && client.user?.id) {
      statusMap[client.user.id] = {
        status: client.user.status || "online",
        statusText: client.user.statusText || null,
      };
    }
  }
  const usersWithStatus = rows.map((u) => ({
    ...u,
    status: statusMap[u.id]?.status ?? "online",
    statusText: statusMap[u.id]?.statusText ?? null,
  }));

  const userCommunityMap = new Map();
  for (const client of wss.clients) {
    if (
      client.readyState === WebSocket.OPEN &&
      client.user?.id &&
      client.communityIds
    ) {
      userCommunityMap.set(client.user.id, new Set(client.communityIds));
    }
  }

  for (const client of wss.clients) {
    if (client.readyState !== WebSocket.OPEN) continue;

    const clientCommunities = new Set(client.communityIds ?? []);

    const filtered = usersWithStatus.filter((u) => {
      const theirCommunities = userCommunityMap.get(u.id);
      if (!theirCommunities) return false;
      for (const cId of theirCommunities) {
        if (clientCommunities.has(cId)) return true;
      }
      return false;
    });

    client.send(JSON.stringify({ type: "presence", users: filtered }));
  }
}

function getVoiceState() {
  const state = {};
  for (const [key, clients] of channels.entries()) {
    if (!key.startsWith("voice:")) continue;
    const channelId = key.replace("voice:", "");
    const names = [...clients].map((c) => c.user?.username).filter(Boolean);
    if (names.length > 0) state[channelId] = names;
  }
  return state;
}

export async function initWebSocket(server) {
  await redis.del("online_users");
  const wss = new WebSocketServer({ server });
  wssInstance = wss;

  wss.on("connection", async (ws, req) => {
    const token = new URL(req.url, "http://localhost:4000").searchParams.get(
      "token",
    );
    const user = verifyWsToken(token);
    if (!user) {
      ws.close(1008, "Unauthorized");
      return;
    }

    const { rows: nickRow } = await db.query(
      `SELECT nickname FROM users WHERE id = $1`,
      [user.id],
    );
    ws.user = {
      ...user,
      nickname: nickRow[0]?.nickname || null,
      status: "online",
      statusText: null,
    };
    ws.channels = new Set();

    ws.channels = new Set();

    const { rows: communityRows } = await db.query(
      `SELECT community_id FROM community_members WHERE user_id = $1`,
      [user.id],
    );
    ws.communityIds = communityRows.map((r) => r.community_id);
    ws.userId = user.id;

    await redis.sAdd("online_users", String(user.id));
    await broadcastPresence(wss);

    ws.on("message", async (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }

      const ctx = {
        ws,
        msg,
        user,
        channels,
        broadcast,
        broadcastAll,
        broadcastDM,
        broadcastPresence,
        wss,
        isRateLimited,
      };

      switch (msg.type) {
        case "join":
          await handleJoin(ctx);
          break;
        case "load_more":
          await handleLoadMore(ctx);
          break;
        case "message":
          await handleSendMessage(ctx);
          break;
        case "edit_message":
          await handleEditMessage(ctx);
          break;
        case "delete_message":
          await handleDeleteMessage(ctx);
          break;
        case "typing":
          await handleTyping(ctx);
          break;
        case "voice_join":
          handleVoiceJoin(ctx);
          break;
        case "voice_leave":
          handleVoiceLeave(ctx);
          break;
        case "react":
          await handleReact(ctx);
          break;
        case "pin_message":
          await handlePin(ctx);
          break;
        case "unpin_message":
          await handleUnpin(ctx);
          break;
        case "set_status":
          await handleSetStatus(ctx);
          break;
        case "avatar_update":
          handleAvatarUpdate(ctx);
          break;
        case "ping":
          handlePing(ctx);
          break;
      }

      // Send voice state after join
      if (msg.type === "join") {
        const voiceState = getVoiceState();
        if (Object.keys(voiceState).length > 0) {
          ws.send(
            JSON.stringify({ type: "voice_state", channels: voiceState }),
          );
        }
      }
    });

    ws.on("close", async () => {
      ws._yakk_closed = true;
      for (const channelId of ws.channels) channels.get(channelId)?.delete(ws);
      if (ws.voiceChannel) {
        const channelId = ws.voiceChannel;
        channels.get(`voice:${channelId}`)?.delete(ws);
        broadcastAll(wss, {
          type: "voice_presence_update",
          channelId,
          username: user.username,
          action: "leave",
        });
      }
      await redis.sRem("online_users", String(user.id));
      await broadcastPresence(wss);
      setTimeout(() => broadcastPresence(wss), 500);
    });
  });

  console.log("WebSocket gateway ready");
}
