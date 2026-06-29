// ─────────────────────────────────────────────────────────────────────────────
// Canal de partage du cockpit clinique (host ↔ patient), via Supabase Realtime.
//
// Isolé du rail live existant : canal dédié `med-cockpit:<sessionId>`. Le host
// pousse une scène (`shareScene`) ; le patient la reçoit (`scene`). Quand le
// patient rejoint, il demande l'état courant (`request_state`) pour ne pas
// rester sur un écran vide si le host a déjà partagé quelque chose.
//
// Phase 3 : porte aussi les TRAITS D'ANNOTATION (`strokes`) — le host dessine
// par-dessus l'artefact partagé, le patient les reçoit. Coords RELATIVES [0,1]
// → indépendantes de la taille d'écran. Remis à zéro à chaque nouvel artefact.
//
// Le descripteur de scène est SELF-CONTAINED (jumeau déjà résolu, SOAP avec son
// texte) → le patient ne fait AUCUN appel API clinique.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import type { CockpitScene } from './cockpit-api';

export interface AnnotStroke {
  /** [x0,y0,x1,y1,…] en coords RELATIVES [0,1] (indépendant de la taille). */
  points: number[];
  color?: string;
}

export function useCockpitChannel(
  sessionId: string | null,
  mode: 'host' | 'patient',
) {
  const [scene, setScene] = useState<CockpitScene | null>(null);
  const [strokes, setStrokes] = useState<AnnotStroke[]>([]);
  const channelRef = useRef<any>(null);
  const lastSentRef = useRef<CockpitScene | null>(null);
  const lastStrokesRef = useRef<AnnotStroke[]>([]);

  useEffect(() => {
    if (!sessionId) return undefined;
    const channel = supabase.channel(`med-cockpit:${sessionId}`, {
      config: { broadcast: { self: false } },
    });

    // Patient : applique la scène poussée par le host (+ reset des annotations).
    channel.on('broadcast', { event: 'scene' }, (msg: any) => {
      if (msg?.payload) {
        setScene(msg.payload as CockpitScene);
        setStrokes([]);
        lastStrokesRef.current = [];
      }
    });

    // Traits d'annotation poussés par le host.
    channel.on('broadcast', { event: 'strokes' }, (msg: any) => {
      setStrokes((msg?.payload?.strokes as AnnotStroke[]) || []);
    });

    // Host : un patient demande l'état courant → on renvoie scène + annotations.
    channel.on('broadcast', { event: 'request_state' }, () => {
      if (mode === 'host' && lastSentRef.current) {
        channel.send({ type: 'broadcast', event: 'scene', payload: lastSentRef.current });
        if (lastStrokesRef.current.length) {
          channel.send({ type: 'broadcast', event: 'strokes', payload: { strokes: lastStrokesRef.current } });
        }
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

  /** Host : partage une scène (et repart d'annotations propres). */
  const shareScene = useCallback((s: CockpitScene) => {
    lastSentRef.current = s;
    lastStrokesRef.current = [];
    channelRef.current?.send({ type: 'broadcast', event: 'scene', payload: s });
    setScene(s); // reflet local (le host voit « ce que voit le patient »)
    setStrokes([]);
  }, []);

  /** Host : arrête le partage (écran patient nettoyé). */
  const clearScene = useCallback(() => {
    const s: CockpitScene = { kind: 'clear' };
    lastSentRef.current = null;
    lastStrokesRef.current = [];
    channelRef.current?.send({ type: 'broadcast', event: 'scene', payload: s });
    setScene(null);
    setStrokes([]);
  }, []);

  /** Host : pousse les traits d'annotation sur l'artefact courant. */
  const shareStrokes = useCallback((s: AnnotStroke[]) => {
    lastStrokesRef.current = s;
    channelRef.current?.send({ type: 'broadcast', event: 'strokes', payload: { strokes: s } });
    setStrokes(s); // reflet local immédiat
  }, []);

  /** Host : efface les annotations (chez tous). */
  const clearStrokes = useCallback(() => {
    lastStrokesRef.current = [];
    channelRef.current?.send({ type: 'broadcast', event: 'strokes', payload: { strokes: [] } });
    setStrokes([]);
  }, []);

  return { scene, shareScene, clearScene, strokes, shareStrokes, clearStrokes };
}
