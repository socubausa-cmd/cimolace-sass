import { useEffect, useMemo, useState } from 'react';
import { livesApi } from '@/lib/api-v2';

/**
 * Lien de PARTAGE d'une session live : renvoie l'URL INVITÉ PUBLIQUE (`/live/:id/invite/:pass`),
 * qui ouvre le live SANS COMPTE (viewer), au lieu du lien membre (`/live/:id`) qui exige un login.
 *
 * L'hôte crée (ou réutilise) un access_pass public via `POST /lives/:id/public-link` (idempotent).
 * Tant que le pass n'est pas revenu — ou si l'appel échoue (droits/insuffisant) — on retombe sur le
 * lien membre pour ne jamais casser le partage. `enabled=false` (UI invité) n'appelle pas l'API.
 * Le `?tenant=` de la salle est propagé pour garder le bon branding.
 */
export function useLivePublicInviteUrl(sessionId, enabled = true) {
  const [passId, setPassId] = useState('');

  useEffect(() => {
    setPassId('');
    if (!enabled || !sessionId || typeof window === 'undefined') return;
    let alive = true;
    livesApi
      .publicLink(sessionId)
      .then((r) => { if (alive && r?.passId) setPassId(String(r.passId)); })
      .catch(() => { /* fallback = lien membre */ });
    return () => { alive = false; };
  }, [sessionId, enabled]);

  return useMemo(() => {
    if (!sessionId) return '';
    if (typeof window === 'undefined') return `/live/${sessionId}`;
    const t = new URLSearchParams(window.location.search).get('tenant');
    const q = t ? `?tenant=${encodeURIComponent(t)}` : '';
    return passId
      ? `${window.location.origin}/live/${sessionId}/invite/${passId}${q}`
      : `${window.location.origin}/live/${sessionId}${q}`;
  }, [sessionId, passId]);
}
