export async function handleLiveKitWebhook(payload: Record<string, unknown>) {
  return {
    ok: true,
    received: payload?.event || 'unknown',
  };
}
