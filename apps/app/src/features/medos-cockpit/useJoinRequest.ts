// ─────────────────────────────────────────────────────────────────────────────
// Signal « l'invité est PRÉSENT sur le lien, en attente d'être admis ».
//
// PROBLÈME résolu : une invitation « proche » naît en statut `consent_requested`
// DÈS SA CRÉATION (RGPD, fail-closed). Si le host/patient affichent le bandeau
// « souhaite rejoindre » / la modale de consentement sur ce seul statut, ils le
// voient IMMÉDIATEMENT à la création — AVANT même que l'invité ait cliqué le lien.
//
// Solution : l'invité, tant qu'il patiente sur l'écran pré-join (`consent_requested`),
// DIFFUSE périodiquement `join_request` sur `med-cockpit:<sessionId>`. Le host et le
// patient n'affichent leur invite QUE pour un inviteId dont ils ont reçu ce signal
// récemment. Best-effort (re-ping toutes les 2,5 s) + TTL → le bandeau s'efface tout
// seul si l'invité ferme l'onglet. Cf [[medos-teleconsult-invitations]].
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

const CHANNEL = (sessionId: string) => `med-cockpit:${sessionId}`;
const PING_MS = 2500; // cadence de ré-émission (broadcast Realtime = best-effort)
const TTL_MS = 8000; // au-delà, l'invité est considéré parti (a fermé le lien)

/**
 * INVITÉ (pré-join) : diffuse « je suis là, en attente » tant que `active` est vrai
 * (typiquement `status === 'consent_requested'`). S'arrête au démontage / dès que
 * `active` repasse à faux (autorisé, refusé, rejoint…).
 */
export function useBroadcastJoinRequest(
  sessionId: string | null | undefined,
  inviteId: string | null | undefined,
  active: boolean,
) {
  useEffect(() => {
    if (!sessionId || !inviteId || !active) return undefined;
    const channel = supabase.channel(CHANNEL(sessionId), { config: { broadcast: { self: false } } });
    const ping = () =>
      channel.send({ type: 'broadcast', event: 'join_request', payload: { inviteId } });
    channel.subscribe((s: string) => {
      if (s === 'SUBSCRIBED') ping();
    });
    const t = window.setInterval(ping, PING_MS);
    return () => {
      window.clearInterval(t);
      try {
        supabase.removeChannel(channel);
      } catch {
        /* ignore */
      }
    };
  }, [sessionId, inviteId, active]);
}

/**
 * HOST / PATIENT : renvoie l'ensemble des `inviteId` actuellement PRÉSENTS sur le
 * lien (signal `join_request` reçu dans les TTL_MS dernières ms). Se vide tout seul
 * quand l'invité cesse de pinguer (fermeture d'onglet, admission…).
 */
export function useJoinRequests(sessionId: string | null | undefined): Set<string> {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const seenRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!sessionId) return undefined;
    const channel = supabase.channel(CHANNEL(sessionId), { config: { broadcast: { self: false } } });

    channel.on('broadcast', { event: 'join_request' }, (msg: any) => {
      const id = msg?.payload?.inviteId;
      if (typeof id === 'string' && id) {
        seenRef.current.set(id, Date.now());
        setIds(new Set(seenRef.current.keys()));
      }
    });
    channel.subscribe();

    // Balayage TTL : retire les invités qui ne pinguent plus.
    const sweep = window.setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [id, ts] of seenRef.current) {
        if (now - ts > TTL_MS) {
          seenRef.current.delete(id);
          changed = true;
        }
      }
      if (changed) setIds(new Set(seenRef.current.keys()));
    }, 2000);

    return () => {
      window.clearInterval(sweep);
      try {
        supabase.removeChannel(channel);
      } catch {
        /* ignore */
      }
    };
  }, [sessionId]);

  return ids;
}
