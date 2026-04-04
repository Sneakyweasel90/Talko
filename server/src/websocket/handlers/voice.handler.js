export function handleVoiceJoin({
  ws,
  msg,
  user,
  channels,
  broadcastAll,
  wss,
}) {
  const { channelId } = msg;
  ws.voiceChannel = channelId;
  if (!channels.has(`voice:${channelId}`))
    channels.set(`voice:${channelId}`, new Set());
  channels.get(`voice:${channelId}`).add(ws);
  broadcastAll(wss, {
    type: "voice_presence_update",
    channelId,
    username: user.username,
    action: "join",
  });
}

export function handleVoiceLeave({ ws, user, channels, broadcastAll, wss }) {
  if (!ws.voiceChannel) return;
  const channelId = ws.voiceChannel;
  channels.get(`voice:${channelId}`)?.delete(ws);
  broadcastAll(wss, {
    type: "voice_presence_update",
    channelId,
    username: user.username,
    action: "leave",
  });
  ws.voiceChannel = null;
}
