// ─────────────────────────────────────────────────────────────────────────────
// Canal de partage du cockpit clinique (host ↔ patient), via Supabase Realtime.
//
// Isolé du rail live existant : canal dédié `med-cockpit:<sessionId>`. Le host
// pousse une scène (`shareScene`) ; le patient la reçoit (`scene`). Quand le
// patient rejoint, il demande l'état courant (`request_state`) pour ne pas
// rester sur un écran vide si le host a déjà partagé quelque chose.
//
// Le descripteur de scène est SELF-CONTAINED (jumeau déjà résolu, SOAP avec
// son texte) → le patient ne fait AUCUN appel API clinique.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import type { CockpitScene } from './cockpit-api';

export function useCockpitChannel(
  sessionId: string | null,
  mode: 'host' | 'patient',
) {
  const [scene, setScene] = useState<CockpitScene | null>(null);
  const channelRef = useRef<any>(null);
  const lastSentRef = useRef<CockpitScene | null>(null);

  useEffect(() => {
    if (!sessionId) return undefined;
    const channel = supabase.channel(`med-cockpit:${sessionId}`, {
      config: { broadcast: { self: false } },
    });

    // Patient : applique la scène poussée par le host.
    channel.on('broadcast', { event: 'scene' }, (msg: any) => {
      if (msg?.payload) setScene(msg.payload as CockpitScene);
    });

    // Host : un patient demande l'état courant → on le lui renvoie.
    channel.on('broadcast', { event: 'request_state' }, () => {
      if (mode === 'host' && lastSentRef.current) {
        channel.send({
          type: 'broadcast',
          event: 'scene',
          payload: lastSentRef.current,
        });
      }
    });

    channel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED' && mode === 'patient') {
        channel.send({ type: 'broadcast', event: 'request_state', payload: {} });
      }
    });

    channelRef.current = channel;
    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {
        /* ignore */
      }
      channelRef.current = null;
    };
  }, [sessionId, mode]);

  /** Host : partage une scène à tous les participants (et la garde en mémoire). */
  const shareScene = useCallback((s: CockpitScene) => {
    lastSentRef.current = s;
    channelRef.current?.send({ type: 'broadcast', event: 'scene', payload: s });
    setScene(s); // reflet local (le host voit « ce que voit le patient »)
  }, []);

  /** Host : arrête le partage (écran patient nettoyé). */
  const clearScene = useCallback(() => {
    const s: CockpitScene = { kind: 'clear' };
    lastSentRef.current = null;
    channelRef.current?.send({ type: 'broadcast', event: 'scene', payload: s });
    setScene(null);
  }, []);

  return { scene, shareScene, clearScene };
}
