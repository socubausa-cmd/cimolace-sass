/**
 * Filtre et liens pour bandeaux / tableau de bord live (LIRI).
 * Gère : vrais directs, salles d'attente, immersif, replays Neuro Recall publiés en formation,
 * et « fantômes » live_sessions encore en status live alors que la séance est passée.
 */

/** Après ce délai sans ended_at, un status=live est traité comme terminé (données non finalisées). */
const ARENA_STALE_MS = 24 * 60 * 60 * 1000;

/**
 * Messagerie immersive : même principe — une ligne `active` / `pending` non mise à jour en base
 * ne doit plus passer pour un « live en cours » après ce délai.
 */
const IMMERSIVE_ALERT_MAX_AGE_MS = ARENA_STALE_MS;

/** Replay consultable par tous (élèves / invités). */
const NEURO_REPLAY_PUBLIC = new Set(['approved', 'published']);

function getNeuro(s) {
  return s?.neuroRecall ?? s?.neuro_recall ?? null;
}

/**
 * Live arène encore joignable (pas replay Neuro Recall publié, pas brouillon hôte, pas ended, pas « fantôme »).
 * @param {string|null} viewerUserId — requis pour exclure « Rejoindre » si l'hôte a un brouillon Neuro Recall.
 */
export function isArenaLiveJoinable(s, viewerUserId = null) {
  if (!s || s.source === 'immersive' || s.source === 'waiting_approval') return false;
  if (String(s.status || '').toLowerCase() !== 'live') return false;
  if (s.ended_at) return false;
  const nr = getNeuro(s);
  if (nr?.postproduction_content_id) {
    const w = String(nr.workflow_status || '');
    if (NEURO_REPLAY_PUBLIC.has(w)) return false;
    if (w === 'draft_generated' && viewerUserId && s.teacher_id === viewerUserId) return false;
  }
  const started = s.started_at ? new Date(s.started_at).getTime() : 0;
  if (started > 0 && Date.now() - started > ARENA_STALE_MS) return false;
  return true;
}

/**
 * Neuro Recall : contenu post-prod lié et consultable.
 * - `approved` / `published` : tout le monde.
 * - `draft_generated` : uniquement l'animateur (`teacher_id`).
 */
export function hasNeuroFormationReplay(s, viewerUserId = null) {
  const nr = getNeuro(s);
  if (!nr?.postproduction_content_id) return false;
  const w = String(nr.workflow_status || '');
  if (NEURO_REPLAY_PUBLIC.has(w)) return true;
  if (w === 'draft_generated' && viewerUserId && s.teacher_id === viewerUserId) return true;
  return false;
}

/** True si le replay visible pour ce viewer est encore au stade brouillon Neuro Recall. */
export function isNeuroReplayDraftForViewer(s, viewerUserId = null) {
  if (!hasNeuroFormationReplay(s, viewerUserId)) return false;
  const w = String(getNeuro(s)?.workflow_status || '');
  return w === 'draft_generated';
}

/**
 * Live messagerie (immersive_live_sessions) encore pertinent pour l'UI « en cours ».
 * Exclut les séances terminées (ended_at) et les lignes actives/pending trop anciennes.
 */
export function isImmersiveLiveAlertable(s) {
  if (!s || s.source !== 'immersive') return false;
  if (s.ended_at) return false;
  const st = s.immersive_status;
  if (st !== 'active' && st !== 'pending') return false;
  const now = Date.now();
  const tCreated = s.immersive_created_at ? new Date(s.immersive_created_at).getTime() : 0;
  const tUpdated = s.immersive_updated_at ? new Date(s.immersive_updated_at).getTime() : 0;
  const tStarted = s.started_at ? new Date(s.started_at).getTime() : 0;
  const ref =
    st === 'active'
      ? (tStarted || tUpdated || tCreated)
      : (tUpdated || tCreated);
  if (!ref || Number.isNaN(ref)) return false;
  return now - ref <= IMMERSIVE_ALERT_MAX_AGE_MS;
}

/**
 * Au moins un direct réel (arène joignable ou messagerie immersive récente), hors replay / file d'attente / post-live.
 * Pour badges type « LIVE » sur l'accueil mobile.
 */
export function hasAnyDirectLiveAlert(sessions = [], viewerUserId = null) {
  return filterActionableLiveSessions(sessions, viewerUserId).some((s) => {
    if (hasNeuroFormationReplay(s, viewerUserId)) return false;
    if (s.source === 'waiting_approval') return false;
    if (s.source === 'immersive') return isImmersiveLiveAlertable(s);
    if (isArenaLiveJoinable(s, viewerUserId)) return true;
    const st = String(s.status || '').toLowerCase();
    if (st === 'live' && viewerUserId && s.teacher_id === viewerUserId && !isArenaLiveJoinable(s, viewerUserId)) {
      return false;
    }
    return false;
  });
}

/**
 * Badge « Live » accès rapide : séance **en direct** (on air) pour ce contexte.
 * Inclut : arène joignable, live public, invitation vers une salle live, file d'attente
 * quand la salle est déjà live, messagerie immersive active.
 * S'appuie sur les sessions rafraîchies par `useLiveAlertsForUser` (requêtes + postgres_changes).
 */
export function hasQuickAccessLiveSignal(sessions = [], viewerUserId = null) {
  return pickQuickAccessLiveSession(sessions, viewerUserId) != null;
}

/**
 * Même logique que l'ancien `hasQuickAccessLiveSignal` : première session « badge Live »
 * (direct utile pour la carte d'accueil mobile).
 * @returns {object|null}
 */
export function pickQuickAccessLiveSession(sessions = [], viewerUserId = null) {
  for (const s of sessions) {
    if (!s) continue;
    if (s.source === 'immersive') {
      if (isImmersiveLiveAlertable(s)) return s;
      continue;
    }
    const st = String(s.status || '').toLowerCase();
    if (st !== 'live' || s.ended_at) continue;
    if (hasNeuroFormationReplay(s, viewerUserId)) continue;
    if (s.source === 'waiting_approval') return s;
    if (isArenaLiveJoinable(s, viewerUserId)) return s;
    if (s.source === 'public') return s;
    if (s.source === 'invited' && viewerUserId) return s;
  }
  return null;
}

/** Fenêtre « bientôt » (invit. / salle) — identique `hasQuickAccessLiveSoonSignal`. */
const LIVE_SOON_WINDOW_MS = 48 * 60 * 60 * 1000;

/**
 * Session considérée « en direct » pour la bannière / carrousel accueil (mêmes règles que `pickQuickAccessLiveSession`, mais toutes).
 */
export function isHomeOnAirSession(s, viewerUserId) {
  if (!s) return false;
  if (s.source === 'immersive') return isImmersiveLiveAlertable(s);
  const st = String(s.status || '').toLowerCase();
  if (st !== 'live' || s.ended_at) return false;
  if (hasNeuroFormationReplay(s, viewerUserId)) return false;
  if (s.source === 'waiting_approval') return true;
  if (isArenaLiveJoinable(s, viewerUserId)) return true;
  if (s.source === 'public') return true;
  if (s.source === 'invited' && viewerUserId) return true;
  return false;
}

/**
 * Prochaine séance (invit. / salle d'attente) programmée dans la fenêtre « bientôt » (hors on-air).
 */
export function isHomeUpcomingSession(s, viewerUserId) {
  if (!s || !viewerUserId) return false;
  if (s.source === 'immersive' || s.source === 'public') return false;
  const st = String(s.status || '').toLowerCase();
  if (st !== 'scheduled') return false;
  const t = s.scheduled_at ? new Date(s.scheduled_at).getTime() : 0;
  if (!t || Number.isNaN(t)) return false;
  const now = Date.now();
  if (t <= now) return false;
  if (t > now + LIVE_SOON_WINDOW_MS) return false;
  return s.source === 'invited' || s.source === 'waiting_approval';
}

/**
 * Lives et prochains à afficher en carrousel : **on-air d'abord** (public + perso, tri stables), puis **programmés** (plus proche d'abord).
 * @param {object[]} sessions
 * @param {string|null|undefined} viewerUserId
 * @returns {object[]}
 */
export function orderHomeLiveSessions(sessions = [], viewerUserId = null) {
  if (!Array.isArray(sessions) || sessions.length === 0) return [];
  const onAir = sessions.filter((s) => s && isHomeOnAirSession(s, viewerUserId));
  const onAirId = new Set(onAir.map((s) => s.id).filter(Boolean));
  onAir.sort((a, b) => {
    const ta = a.started_at ? new Date(a.started_at).getTime() : 0;
    const tb = b.started_at ? new Date(b.started_at).getTime() : 0;
    if (ta !== tb) return ta - tb;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
  const upcoming = sessions
    .filter((s) => s && !onAirId.has(s.id) && isHomeUpcomingSession(s, viewerUserId));
  upcoming.sort((a, b) => {
    const ta = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0;
    const tb = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
    return ta - tb;
  });
  return [...onAir, ...upcoming];
}

/**
 * Live programmé dans les prochaines 48 h (invitation ou file d'attente), sans live on air détecté ailleurs.
 * À combiner avec : `!hasQuickAccessLiveSignal(...) && hasQuickAccessLiveSoonSignal(...)`.
 */
export function hasQuickAccessLiveSoonSignal(sessions = [], viewerUserId = null) {
  if (!viewerUserId) return false;
  const now = Date.now();
  const horizon = now + LIVE_SOON_WINDOW_MS;
  for (const s of sessions) {
    if (!s || s.source === 'immersive' || s.source === 'public') continue;
    const st = String(s.status || '').toLowerCase();
    if (st !== 'scheduled') continue;
    const t = s.scheduled_at ? new Date(s.scheduled_at).getTime() : 0;
    if (!t || Number.isNaN(t) || t <= now || t > horizon) continue;
    if (s.source === 'invited' || s.source === 'waiting_approval') return true;
  }
  return false;
}

/**
 * Sessions à afficher dans le dashboard / bandeaux.
 * @param {object[]} sessions
 * @param {string|null} viewerUserId — pour montrer aux hôtes les séances « fantômes » (post-live) et brouillons replay.
 */
export function filterActionableLiveSessions(sessions = [], viewerUserId = null) {
  return sessions.filter((s) => {
    if (s.source === 'waiting_approval') return true;
    if (s.source === 'immersive') {
      return isImmersiveLiveAlertable(s);
    }
    if (hasNeuroFormationReplay(s, viewerUserId)) return true;
    if (isArenaLiveJoinable(s, viewerUserId)) return true;
    const st = String(s.status || '').toLowerCase();
    if (st === 'live' && !isArenaLiveJoinable(s, viewerUserId) && viewerUserId && s.teacher_id === viewerUserId) {
      return true;
    }
    return false;
  });
}

export function isExternalLiveHref(href) {
  return /^https?:\/\//i.test(String(href || ''));
}

/**
 * CTA principal : messagerie, attente, replay formation / URL, live, post-live studio.
 * @param {string|null} viewerUserId
 */
export function liveSessionPrimaryHref(s, viewerUserId = null) {
  if (s.source === 'immersive') return '/messages';
  if (s.source === 'waiting_approval') return `/live/waiting/${s.id}`;
  if (hasNeuroFormationReplay(s, viewerUserId)) {
    const nr = getNeuro(s);
    if (s.neuro_replay_formation_id) {
      return `/formation/${s.neuro_replay_formation_id}/learn`;
    }
    if (nr?.replay_public_url) return String(nr.replay_public_url);
    return `/studio/live-post/${s.id}`;
  }
  const st = String(s.status || '').toLowerCase();
  if (st === 'scheduled') {
    return `/live/waiting/${s.id}`;
  }
  if (st === 'live' && !isArenaLiveJoinable(s, viewerUserId)) {
    return `/studio/live-post/${s.id}`;
  }
  return `/live/${s.id}`;
}

/** @param {string|null} viewerUserId */
export function liveSessionPrimaryCtaLabel(s, viewerUserId = null) {
  if (s.source === 'immersive') return 'Ouvrir';
  if (s.source === 'waiting_approval') return 'File d\'attente';
  if (hasNeuroFormationReplay(s, viewerUserId)) {
    return isNeuroReplayDraftForViewer(s, viewerUserId) ? 'Voir le brouillon' : 'Consulter le replay';
  }
  const st = String(s.status || '').toLowerCase();
  if (st === 'live' && !isArenaLiveJoinable(s, viewerUserId)) return 'Post-live';
  if (st === 'scheduled') return 'Voir';
  return 'Rejoindre maintenant';
}
