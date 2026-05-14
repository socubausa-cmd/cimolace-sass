/**
 * LONGIA — co-pilote du live : taxonomie des notifications et modes « gouverneur ».
 * Les événements sont poussés dans le journal hôte (panel Notifications) avec `type` longia_*.
 */

/** Familles de notifications (filtre UI + routage futur edge). */
export const LONGIA_NOTIF_CATEGORY = {
  CONTENT: 'content',
  PEDAGOGY: 'pedagogy',
  AUDIENCE: 'audience',
  CHAT: 'chat',
  PRODUCTION: 'production',
};

export const LONGIA_NOTIF_CATEGORY_LABELS = {
  [LONGIA_NOTIF_CATEGORY.CONTENT]: { short: 'Contenu', full: 'Notification contenu' },
  [LONGIA_NOTIF_CATEGORY.PEDAGOGY]: { short: 'Pédagogie', full: 'Notification pédagogie' },
  [LONGIA_NOTIF_CATEGORY.AUDIENCE]: { short: 'Audience', full: 'Notification audience' },
  [LONGIA_NOTIF_CATEGORY.CHAT]: { short: 'Chat', full: 'Notification chat' },
  [LONGIA_NOTIF_CATEGORY.PRODUCTION]: { short: 'Production', full: 'Notification production' },
};

/**
 * Modes présence / compétences du gouverneur (l’hôte choisit ce qui est autorisé à remonter).
 * Observer = analyse silencieuse sans notification (réservé pipeline futur).
 */
export const LONGIA_GOVERNOR_MODE = {
  OBSERVER: 'observer',
  COACH: 'coach',
  CHAT_MODERATOR: 'chatModerator',
  SMARTBOARD_ASSISTANT: 'smartboardAssistant',
  RECALL_PRODUCER: 'recallProducer',
};

export const LONGIA_GOVERNOR_MODE_LABELS = {
  [LONGIA_GOVERNOR_MODE.OBSERVER]: 'Observation',
  [LONGIA_GOVERNOR_MODE.COACH]: 'Coach',
  [LONGIA_GOVERNOR_MODE.CHAT_MODERATOR]: 'Modération chat',
  [LONGIA_GOVERNOR_MODE.SMARTBOARD_ASSISTANT]: 'Assistant SmartBoard',
  [LONGIA_GOVERNOR_MODE.RECALL_PRODUCER]: 'Recall / post-live',
};

/** Défaut : tous les modes actifs sauf observer seul (observer gère le pipeline sans UI). */
export const DEFAULT_LONGIA_GOVERNOR_MODES = {
  [LONGIA_GOVERNOR_MODE.OBSERVER]: true,
  [LONGIA_GOVERNOR_MODE.COACH]: true,
  [LONGIA_GOVERNOR_MODE.CHAT_MODERATOR]: true,
  [LONGIA_GOVERNOR_MODE.SMARTBOARD_ASSISTANT]: true,
  [LONGIA_GOVERNOR_MODE.RECALL_PRODUCER]: true,
};

/** Émis par LONGIA (live) pour ouvrir / focaliser le journal hôte — écouté par LiveEventsSidebar, LiveRoomShell, LiveHostPage. */
export const LIRI_HOST_EXPAND_NOTIFICATIONS_EVENT = 'liri-host-expand-notifications';

export const LONGIA_PANEL_FILTER = {
  ALL: 'all',
  URGENT: 'urgent',
  CONTENT: LONGIA_NOTIF_CATEGORY.CONTENT,
  PEDAGOGY: LONGIA_NOTIF_CATEGORY.PEDAGOGY,
  AUDIENCE: LONGIA_NOTIF_CATEGORY.AUDIENCE,
  CHAT: LONGIA_NOTIF_CATEGORY.CHAT,
  PRODUCTION: LONGIA_NOTIF_CATEGORY.PRODUCTION,
};

/**
 * @param {object} p
 * @param {keyof typeof LONGIA_NOTIF_CATEGORY} p.category
 * @param {string} p.headline
 * @param {string} [p.detail]
 * @param {boolean} [p.urgent]
 * @param {string} p.timeLabel — ex. retour de nt() côté LiveHost
 * @param {keyof typeof LONGIA_GOVERNOR_MODE} [p.sourceMode] — si le mode est off, l’appelant peut ignorer l’insertion
 */
export function buildLongiaPanelEvent({
  category,
  headline,
  detail,
  urgent = false,
  timeLabel,
  sourceMode,
}) {
  const safeCat = LONGIA_NOTIF_CATEGORY_LABELS[category] ? category : LONGIA_NOTIF_CATEGORY.CONTENT;
  const label = LONGIA_NOTIF_CATEGORY_LABELS[safeCat].short;
  const msg = detail ? `${headline} — ${detail}` : headline;
  return {
    avatar: 'LONGIA',
    msg: `${label} : ${msg}`,
    type: `longia_${safeCat}`,
    time: timeLabel,
    longiaCategory: safeCat,
    longiaUrgent: Boolean(urgent),
    longiaSourceMode: sourceMode || null,
  };
}

/** Filtre journal : ids `longia_*` alignés sur NotificationsPanel / LiveRoomShell. */
const LONGIA_FILTER_ID_TO_CATEGORY = {
  longia_content: LONGIA_NOTIF_CATEGORY.CONTENT,
  longia_pedagogy: LONGIA_NOTIF_CATEGORY.PEDAGOGY,
  longia_audience: LONGIA_NOTIF_CATEGORY.AUDIENCE,
  longia_chat: LONGIA_NOTIF_CATEGORY.CHAT,
  longia_production: LONGIA_NOTIF_CATEGORY.PRODUCTION,
};

export function longiaPanelEventMatchesFilter(ev, filterId) {
  if (!filterId || filterId === LONGIA_PANEL_FILTER.ALL) return true;
  const longia = isLongiaPanelEvent(ev);
  if (filterId === LONGIA_PANEL_FILTER.URGENT) return longia && Boolean(ev.longiaUrgent);
  const mapped = LONGIA_FILTER_ID_TO_CATEGORY[filterId];
  if (mapped) {
    return longia && (ev.longiaCategory === mapped || ev.type === `longia_${mapped}`);
  }
  if (Object.values(LONGIA_NOTIF_CATEGORY).includes(filterId)) {
    return longia && (ev.longiaCategory === filterId || ev.type === `longia_${filterId}`);
  }
  return true;
}

export function isLongiaPanelEvent(ev) {
  return typeof ev?.type === 'string' && ev.type.startsWith('longia_');
}
