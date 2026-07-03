import {
  LONGIA_GOVERNOR_MODE,
  LONGIA_GOVERNOR_MODE_LABELS,
  LONGIA_PANEL_FILTER,
} from '@/lib/longiaLiveCopilot';

/** Largeur du tiroir LONGIA (hôte, desktop) — aligner avec `LiveHostLongiaHubDrawer`. */
export const LONGIA_HOST_HUB_DRAWER_W_PX = 340;

/** Rail latéral replié (desktop) : bandeau icônes seulement */
export const LIVE_HOST_RAIL_COLLAPSED_PX = 52;

/** Hauteur au repos du cadre vidéo « Hôte en direct » (colonne droite) ; diminue au scroll de la colonne. */
export const LH_HOST_RIGHT_VIDEO_FRAME_REST_H_PX = 220;

export const LIVE_HOST_LONGIA_FILTER_CHIPS = [
  { id: LONGIA_PANEL_FILTER.ALL, label: 'Tous' },
  { id: LONGIA_PANEL_FILTER.URGENT, label: 'Urgent' },
  { id: 'longia_content', label: 'Contenu' },
  { id: 'longia_pedagogy', label: 'Pédagogie' },
  { id: 'longia_audience', label: 'Audience' },
  { id: 'longia_chat', label: 'Chat' },
  { id: 'longia_production', label: 'Production' },
];

export const LIVE_HOST_LONGIA_GOVERNOR_ORDER = [
  LONGIA_GOVERNOR_MODE.OBSERVER,
  LONGIA_GOVERNOR_MODE.COACH,
  LONGIA_GOVERNOR_MODE.CHAT_MODERATOR,
  LONGIA_GOVERNOR_MODE.SMARTBOARD_ASSISTANT,
  LONGIA_GOVERNOR_MODE.RECALL_PRODUCER,
];

/** Libellés courts dans le tiroir LONGIA (le mode produit reste dans `LONGIA_GOVERNOR_MODE_LABELS`). */
export const LIVE_HOST_HUB_GOVERNOR_LABELS = {
  [LONGIA_GOVERNOR_MODE.OBSERVER]: 'Observation',
  [LONGIA_GOVERNOR_MODE.COACH]: 'Coach',
  [LONGIA_GOVERNOR_MODE.CHAT_MODERATOR]: 'Modération',
  [LONGIA_GOVERNOR_MODE.SMARTBOARD_ASSISTANT]: 'Architecte',
  [LONGIA_GOVERNOR_MODE.RECALL_PRODUCER]: 'Recall',
};

export const LIVE_HOST_HUB_GOVERNOR_TITLE = {
  [LONGIA_GOVERNOR_MODE.OBSERVER]: `${LONGIA_GOVERNOR_MODE_LABELS[LONGIA_GOVERNOR_MODE.OBSERVER]} — filtrer les alertes « salle »`,
  [LONGIA_GOVERNOR_MODE.COACH]: `${LONGIA_GOVERNOR_MODE_LABELS[LONGIA_GOVERNOR_MODE.COACH]} — suggestions pédagogiques`,
  [LONGIA_GOVERNOR_MODE.CHAT_MODERATOR]: `${LONGIA_GOVERNOR_MODE_LABELS[LONGIA_GOVERNOR_MODE.CHAT_MODERATOR]} — file chat / discipline`,
  [LONGIA_GOVERNOR_MODE.SMARTBOARD_ASSISTANT]: `${LONGIA_GOVERNOR_MODE_LABELS[LONGIA_GOVERNOR_MODE.SMARTBOARD_ASSISTANT]} (Architecte live — visuels, scène)`,
  [LONGIA_GOVERNOR_MODE.RECALL_PRODUCER]: `${LONGIA_GOVERNOR_MODE_LABELS[LONGIA_GOVERNOR_MODE.RECALL_PRODUCER]} — mémo post-session`,
};

export const PHASE = {
  LOADING: 'loading',
  CONNECTING: 'connecting',
  LIVE: 'live',
  ERROR: 'error',
  ENDED: 'ended',
};
