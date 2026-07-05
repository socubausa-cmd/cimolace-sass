// ─────────────────────────────────────────────────────────────────────────────
// Canal de partage du cockpit clinique (host ↔ patient), via Supabase Realtime.
//
// Canal dédié `med-cockpit:<sessionId>`. Le host pousse :
//   - une SCÈNE clinique (`shareScene`) → l'artefact que voit le patient ;
//   - une VUE (`pushView`) → conversation (visages) / share (artefact) / board
//     (tableau blanc) ; synchronisée pour que le patient suive le praticien ;
//   - des TRAITS d'annotation (`shareStrokes`) → dessin par-dessus l'artefact/le
//     tableau (coords RELATIVES [0,1] → indépendantes de la taille d'écran).
// Quand le patient rejoint, il demande l'état courant (`request_state`).
//
// Le descripteur de scène est SELF-CONTAINED → le patient ne fait AUCUN appel API.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import type { CockpitScene } from './cockpit-api';

export type ConsultView = 'conversation' | 'share' | 'board';

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
  const [view, setViewState] = useState<ConsultView>('conversation');
  const [strokes, setStrokes] = useState<AnnotStroke[]>([]);
  // Nom du PRATICIEN (host) diffusé au patient → « avec qui je parle ».
  const [hostName, setHostName] = useState<string | null>(null);
  // État ACCUMULÉ du tableau intelligent (SmartBoard) : patchs incrémentaux de
  // l'hôte (annotationStrokes, activeScene, sharedImageIdx…) mergés → le patient
  // rejoue le dessin/la scène du praticien sur la vue Tableau.
  const [smartboard, setSmartboard] = useState<Record<string, unknown>>({});
  // Sous-titre LIVE : dernier segment de parole du praticien (STT) → chaque
  // participant le traduit dans SA langue. Éphémère (dernier segment seul).
  const [caption, setCaption] = useState<{ text: string; id: number } | null>(null);
  const channelRef = useRef<any>(null);
  const lastSentRef = useRef<CockpitScene | null>(null);
  const lastViewRef = useRef<ConsultView>('conversation');
  const lastStrokesRef = useRef<AnnotStroke[]>([]);
  const lastHostNameRef = useRef<string | null>(null);
  const lastSmartboardRef = useRef<Record<string, unknown>>({});

  useEffect(() => {
    if (!sessionId) return undefined;
    const channel = supabase.channel(`med-cockpit:${sessionId}`, {
      config: { broadcast: { self: false } },
    });

    // Scène poussée par le host (+ reset des annotations).
    channel.on('broadcast', { event: 'scene' }, (msg: any) => {
      if (msg?.payload) {
        setScene(msg.payload as CockpitScene);
        setStrokes([]);
        lastStrokesRef.current = [];
      }
    });

    // Vue poussée par le host (conversation / share / board).
    channel.on('broadcast', { event: 'view' }, (msg: any) => {
      const v = msg?.payload?.view as ConsultView;
      if (v) {
        setViewState(v);
        setStrokes([]);
        lastStrokesRef.current = [];
      }
    });

    // Traits d'annotation.
    channel.on('broadcast', { event: 'strokes' }, (msg: any) => {
      setStrokes((msg?.payload?.strokes as AnnotStroke[]) || []);
    });

    // Identité du praticien (host) → le patient sait avec qui il parle.
    channel.on('broadcast', { event: 'host_name' }, (msg: any) => {
      const n = msg?.payload?.name;
      if (typeof n === 'string' && n) setHostName(n);
    });

    // Patchs du tableau intelligent (SmartBoard) — mergés côté patient pour
    // rejouer dessin/scène du praticien (annotationStrokes, activeScene…).
    channel.on('broadcast', { event: 'smartboard' }, (msg: any) => {
      const patch = msg?.payload;
      if (patch && typeof patch === 'object') {
        lastSmartboardRef.current = { ...lastSmartboardRef.current, ...patch };
        setSmartboard(lastSmartboardRef.current);
      }
    });

    // Sous-titre live (segment de parole du praticien) → le participant le
    // traduit dans sa langue. Non ré-émis sur request_state (éphémère).
    channel.on('broadcast', { event: 'caption' }, (msg: any) => {
      const text = msg?.payload?.text;
      const id = msg?.payload?.id;
      if (typeof text === 'string' && text.trim()) {
        setCaption({ text: text.trim(), id: typeof id === 'number' ? id : Date.now() });
      }
    });

    // Host : un patient demande l'état → on renvoie vue + scène + annotations.
    channel.on('broadcast', { event: 'request_state' }, () => {
      if (mode !== 'host') return;
      channel.send({ type: 'broadcast', event: 'view', payload: { view: lastViewRef.current } });
      if (lastSentRef.current) {
        channel.send({ type: 'broadcast', event: 'scene', payload: lastSentRef.current });
      }
      if (lastStrokesRef.current.length) {
        channel.send({ type: 'broadcast', event: 'strokes', payload: { strokes: lastStrokesRef.current } });
      }
      if (lastHostNameRef.current) {
        channel.send({ type: 'broadcast', event: 'host_name', payload: { name: lastHostNameRef.current } });
      }
      if (Object.keys(lastSmartboardRef.current).length) {
        channel.send({ type: 'broadcast', event: 'smartboard', payload: lastSmartboardRef.current });
      }
    });

    const retryTimers: number[] = [];
    channel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED' && mode === 'patient') {
        // RETRY : si l'hôte vient de (re)monter et n'est pas encore SUBSCRIBED,
        // il perd notre 1re demande (broadcast Realtime = best-effort). On re-demande
        // l'état 2 fois → couvre la fenêtre de re-souscription (patient sur écran vide).
        const ask = () => channel.send({ type: 'broadcast', event: 'request_state', payload: {} });
        ask();
        retryTimers.push(window.setTimeout(ask, 1500));
        retryTimers.push(window.setTimeout(ask, 4000));
      }
    });

    channelRef.current = channel;
    return () => {
      retryTimers.forEach((t) => window.clearTimeout(t));
      try {
        supabase.removeChannel(channel);
      } catch {
        /* ignore */
      }
      channelRef.current = null;
    };
  }, [sessionId, mode]);

  /** Host : partage une scène clinique → bascule en vue « share », annotations propres. */
  const shareScene = useCallback((s: CockpitScene) => {
    lastSentRef.current = s;
    lastViewRef.current = 'share';
    lastStrokesRef.current = [];
    channelRef.current?.send({ type: 'broadcast', event: 'scene', payload: s });
    channelRef.current?.send({ type: 'broadcast', event: 'view', payload: { view: 'share' } });
    setScene(s);
    setViewState('share');
    setStrokes([]);
  }, []);

  /** Host : change la vue (conversation / share / board) — synchronisée. */
  const pushView = useCallback((v: ConsultView) => {
    lastViewRef.current = v;
    lastStrokesRef.current = [];
    channelRef.current?.send({ type: 'broadcast', event: 'view', payload: { view: v } });
    channelRef.current?.send({ type: 'broadcast', event: 'strokes', payload: { strokes: [] } });
    setViewState(v);
    setStrokes([]); // chaque vue repart d'annotations propres
  }, []);

  /** Host : arrête le partage (efface l'artefact, retour conversation). */
  const clearScene = useCallback(() => {
    lastSentRef.current = null;
    lastViewRef.current = 'conversation';
    lastStrokesRef.current = [];
    channelRef.current?.send({ type: 'broadcast', event: 'scene', payload: { kind: 'clear' } });
    channelRef.current?.send({ type: 'broadcast', event: 'view', payload: { view: 'conversation' } });
    setScene(null);
    setViewState('conversation');
    setStrokes([]);
  }, []);

  /** Host : pousse les traits d'annotation sur l'artefact / le tableau courant. */
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

  /** Host : diffuse son nom (identité praticien) au patient — idempotent. */
  const shareHostName = useCallback((name: string) => {
    const n = (name || '').trim();
    if (!n || lastHostNameRef.current === n) return;
    lastHostNameRef.current = n;
    channelRef.current?.send({ type: 'broadcast', event: 'host_name', payload: { name: n } });
  }, []);

  /** Host : relaie un patch du tableau intelligent (SmartBoard) au patient
   *  (annotationStrokes, activeScene, whiteboardPages, sbTacticalSync…). Mergé et
   *  rejoué à la demande d'état (request_state) d'un patient qui rejoint. */
  const shareSmartboard = useCallback((patch?: Record<string, unknown>) => {
    if (!patch || typeof patch !== 'object') return;
    lastSmartboardRef.current = { ...lastSmartboardRef.current, ...patch };
    channelRef.current?.send({ type: 'broadcast', event: 'smartboard', payload: patch });
  }, []);

  /** Host : diffuse un segment de parole (STT) → sous-titres live des participants. */
  const shareCaption = useCallback((text: string) => {
    const t = String(text || '').trim();
    if (!t) return;
    channelRef.current?.send({ type: 'broadcast', event: 'caption', payload: { text: t, id: Date.now() } });
  }, []);

  return { scene, view, strokes, hostName, smartboard, caption, shareScene, pushView, clearScene, shareStrokes, clearStrokes, shareHostName, shareSmartboard, shareCaption };
}
