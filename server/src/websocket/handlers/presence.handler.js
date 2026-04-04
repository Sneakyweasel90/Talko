export async function handleSetStatus({ ws, msg, broadcastPresence, wss }) {
  const { status, statusText } = msg;
  if (!["online", "away", "dnd"].includes(status)) return;
  ws.user.status = status;
  ws.user.statusText = (statusText ?? "").slice(0, 60) || null;
  await broadcastPresence(wss);
}

export function handleAvatarUpdate({ msg, user, broadcastAll, wss }) {
  const { avatar } = msg;
  broadcastAll(wss, {
    type: "avatar_update",
    userId: user.id,
    avatar: avatar || null,
  });
}

export function handlePing({ ws }) {
  ws.send(JSON.stringify({ type: "pong" }));
}
