import { useEffect, useState } from 'react';

/**
 * Secondes restantes avant la limite de durée d'un live (palier gratuit = 3 min).
 *
 * @param {string|Date|null} startedAt  Début du live (live_sessions.started_at).
 * @param {number|null} maxLiveMinutes  Limite (LIRI_FREE_LIMITS.maxLiveMinutes=3) ;
 *                                       null/0 = illimité (palier payant) → renvoie null.
 * @returns {number|null} secondes restantes (>=0), ou null si pas de limite / pas démarré.
 *
 * Sert au compte à rebours visible côté hôte + au stop gracieux à 0 (le serveur cape
 * déjà le token LiveKit à 3 min — ceci ne fait que le rendre lisible et propre).
 */
export function useLiveRemainingSeconds(startedAt, maxLiveMinutes) {
  const limitSec = maxLiveMinutes ? Number(maxLiveMinutes) * 60 : null;
  const compute = () => {
    if (!startedAt || !limitSec) return null;
    const started = new Date(startedAt).getTime();
    if (!Number.isFinite(started)) return null;
    const elapsed = Math.floor((Date.now() - started) / 1000);
    return Math.max(0, limitSec - elapsed);
  };
  const [remaining, setRemaining] = useState(compute);

  useEffect(() => {
    if (!startedAt || !limitSec) {
      setRemaining(null);
      return undefined;
    }
    setRemaining(compute());
    const id = setInterval(() => setRemaining(compute()), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedAt, limitSec]);

  return remaining;
}

export default useLiveRemainingSeconds;
