import {
  LONGIA_GOVERNOR_MODE,
  LONGIA_NOTIF_CATEGORY,
} from '@/lib/longiaLiveCopilot';

/**
 * Convertit une notification renvoyée par `longia-live-realtime` en payload pour `pushLongiaHostNotif`.
 * @param {object} n
 * @returns {{ category: string, headline: string, detail?: string, urgent: boolean, sourceMode: string, longiaRealtimeId?: string, longiaRealtimeActions?: unknown[] }}
 */
export function mapLongiaRealtimeNotificationToPanelPayload(n) {
  const type = String(n?.type || 'system');
  let category = LONGIA_NOTIF_CATEGORY.CONTENT;
  let sourceMode = LONGIA_GOVERNOR_MODE.SMARTBOARD_ASSISTANT;

  if (type === 'pedagogical') {
    category = LONGIA_NOTIF_CATEGORY.PEDAGOGY;
    sourceMode = LONGIA_GOVERNOR_MODE.COACH;
  } else if (type === 'chat') {
    category = LONGIA_NOTIF_CATEGORY.CHAT;
    sourceMode = LONGIA_GOVERNOR_MODE.CHAT_MODERATOR;
  } else if (type === 'audience') {
    category = LONGIA_NOTIF_CATEGORY.AUDIENCE;
    sourceMode = LONGIA_GOVERNOR_MODE.COACH;
  } else if (type === 'content') {
    category = LONGIA_NOTIF_CATEGORY.CONTENT;
    sourceMode = LONGIA_GOVERNOR_MODE.SMARTBOARD_ASSISTANT;
  }

  return {
    category,
    headline: String(n?.title || 'LONGIA'),
    detail: String(n?.message || ''),
    urgent: String(n?.priority || '') === 'high',
    sourceMode,
    longiaRealtimeId: typeof n?.id === 'string' ? n.id : undefined,
    longiaRealtimeActions: Array.isArray(n?.actions) ? n.actions : undefined,
  };
}

export function mapLongiaRealtimeNotificationsToPanelPayloads(notifications) {
  if (!Array.isArray(notifications)) return [];
  return notifications.map(mapLongiaRealtimeNotificationToPanelPayload);
}
