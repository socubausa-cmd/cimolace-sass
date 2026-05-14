/**
 * Supabase Realtime broadcast without implicit REST fallback warnings:
 * uses the WebSocket push when the channel is joined and connected, otherwise httpSend().
 */
export async function broadcastRealtime(channel, event, payload) {
  if (!channel) return;
  const wsOk =
    channel.state === 'joined' && typeof channel.socket?.isConnected === 'function' && channel.socket.isConnected();
  try {
    if (wsOk) {
      await channel.send({ type: 'broadcast', event, payload });
    } else if (typeof channel.httpSend === 'function') {
      await channel.httpSend(event, payload);
    } else {
      await channel.send({ type: 'broadcast', event, payload });
    }
  } catch {
    // Fire-and-forget callers rely on silence
  }
}
