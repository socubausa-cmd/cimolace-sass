import { Track } from 'livekit-client';

/**
 * Choisit la publication caméra à afficher (aperçu local ou distant).
 * Évite de s’appuyer uniquement sur getTrackPublication quand une publication muette
 * sans track masquerait une piste active.
 */
export function pickCameraPublicationForPreview(participant) {
  if (!participant) return null;
  const pubs = Array.from(participant.videoTrackPublications?.values?.() || []);
  const active = pubs.find(
    (p) => p.source === Track.Source.Camera && p.track && !p.isMuted,
  );
  const byGetter =
    typeof participant.getTrackPublication === 'function'
      ? participant.getTrackPublication(Track.Source.Camera)
      : null;
  if (active) return active;
  if (byGetter?.track && !byGetter.isMuted) return byGetter;
  return pubs.find((p) => p.source === Track.Source.Camera && p.track) || null;
}

export function describeLiveKitMediaError(err) {
  const name = err?.name || '';
  const msg = String(err?.message || '');
  if (name === 'NotAllowedError' || /Permission denied/i.test(msg)) {
    return 'Accès refusé par le navigateur ou le système. Autorisez micro, caméra ou partage d’écran pour ce site dans les réglages du navigateur.';
  }
  if (name === 'NotFoundError' || /no device|introuvable|not found/i.test(msg)) {
    return 'Aucun périphérique détecté. Branchez un micro ou une caméra, ou choisissez un autre appareil dans les paramètres du studio.';
  }
  if (name === 'NotReadableError' || /Could not start|busy|in use/i.test(msg)) {
    return 'Le périphérique est occupé par une autre application. Fermez l’autre appel vidéo puis réessayez.';
  }
  if (name === 'OverconstrainedError' || /Overconstrained/i.test(msg)) {
    return 'La caméra ne supporte pas la résolution demandée. Réessayez ou changez de périphérique dans les paramètres du studio.';
  }
  return msg || 'Une erreur est survenue. Réessayez ou ouvrez les paramètres du studio.';
}
