import { useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { PHASE } from '@/features/live/host/liveHostConstants';
import { devLogLiveHostEnded } from '@/features/live/host/liveHostUtils';
import { updateLiveSession } from '@/services/liveProduction/liveSession';
import { messagingApi } from '@/lib/api-v2';

/**
 * STOP / Quitter : finalise l'enregistrement, termine la session en DB,
 * déconnecte la salle LiveKit, redirige (hôte → post-prod ; invité → /app).
 */
export function useLiveHostSessionStop({
  sessionId,
  navigate,
  toast,
  stopRecording,
  roomRef,
  setPhase,
  setStopLiveBusy,
  stopLiveInProgressRef,
  liveDisconnectTimerRef,
  recordingRef,
  mediaRecRef,
  recFinalizeResolveRef,
}) {
  const handleStop = useCallback(async () => {
    if (stopLiveInProgressRef.current) return;
    stopLiveInProgressRef.current = true;
    setStopLiveBusy(true);
    clearTimeout(liveDisconnectTimerRef.current);
    liveDisconnectTimerRef.current = null;

    try {
      if (recordingRef.current && mediaRecRef.current?.state === 'recording') {
        await new Promise((resolve) => {
          recFinalizeResolveRef.current = resolve;
          stopRecording();
          window.setTimeout(() => {
            if (recFinalizeResolveRef.current === resolve) {
              recFinalizeResolveRef.current = null;
              resolve();
            }
          }, 28000);
        });
      }

      if (roomRef.current) {
        try { await roomRef.current.disconnect(); } catch { /* ignore */ }
        roomRef.current = null;
      }
      setPhase(PHASE.ENDED);

      if (sessionId) {
        const { error } = await updateLiveSession(sessionId, {
          status: 'ended',
          ended_at: new Date().toISOString(),
        });
        if (error) {
          console.error('[LiveHost] STOP — mise à jour live_sessions', error);
          toast({
            title: 'Session non enregistrée comme terminée',
            description:
              error.message
              || 'Vérifiez vos droits (enseignant / staff) ou réessayez. La salle vidéo est déconnectée.',
            variant: 'destructive',
          });
          navigate(`/studio/live-preparation/${sessionId}`);
          return;
        }
        // Phase D — consolidation post-live : recopie le chat éphémère du live
        // (live_session_chat) dans le Sujet durable kind='topic' du live → reste
        // consultable dans le forum après la session. Côté API : réservé encadrant
        // (l'hôte l'est) + idempotent (sentinelle). Non bloquant : ne retarde ni la
        // navigation ni le neurone, et un échec n'empêche pas de terminer le live.
        void messagingApi
          .publishLiveTopic({ liveSessionId: sessionId })
          .catch((err) => {
            console.warn('[LiveHost] publishLiveTopic (consolidation post-live) — échec non bloquant', err);
          });
        void supabase.functions.invoke('neuro-recall-bootstrap', { body: { sessionId } }).catch(() => {});
        // Agrégation forum : rassemble dans le Sujet du live TOUTES ses productions
        // (récap, questions NeuronQ, questions du live, chat, replay, transcript) —
        // « tout ce que recall fait est dans le forum ». Idempotent (sentinelles
        // `__live_*`), complémentaire de publishLiveTopic / neuro-recall-bootstrap,
        // non bloquant. NB : le replay (egress asynchrone) sera capté lors d'une
        // consolidation ultérieure, une fois live_recordings renseignée.
        void supabase.rpc('consolidate_live_to_forum', { p_live_id: sessionId }).catch(() => {});
        navigate(`/studio/live-post/${sessionId}`);
      } else {
        devLogLiveHostEnded('host_stop_without_session', { navigated: 'back' }, null);
        navigate(-1);
      }
    } finally {
      stopLiveInProgressRef.current = false;
      setStopLiveBusy(false);
    }
  }, [sessionId, navigate, stopRecording, toast, roomRef, setPhase, setStopLiveBusy, stopLiveInProgressRef, liveDisconnectTimerRef, recordingRef, mediaRecRef, recFinalizeResolveRef]);

  const handleGuestLeave = useCallback(async () => {
    if (stopLiveInProgressRef.current) return;
    stopLiveInProgressRef.current = true;
    setStopLiveBusy(true);
    clearTimeout(liveDisconnectTimerRef.current);
    liveDisconnectTimerRef.current = null;
    try {
      if (roomRef.current) {
        try { await roomRef.current.disconnect(); } catch { /* ignore */ }
        roomRef.current = null;
      }
      setPhase(PHASE.ENDED);
      toast({
        title: 'Vous avez quitté la salle',
        description: 'Le live continue pour les autres participants.',
      });
      navigate('/app');
    } finally {
      stopLiveInProgressRef.current = false;
      setStopLiveBusy(false);
    }
  }, [navigate, toast, roomRef, setPhase, setStopLiveBusy, stopLiveInProgressRef, liveDisconnectTimerRef]);

  return { handleStop, handleGuestLeave };
}
