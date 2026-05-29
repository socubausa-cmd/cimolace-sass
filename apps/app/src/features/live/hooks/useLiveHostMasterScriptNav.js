import { useCallback, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { PHASE } from '@/features/live/host/liveHostConstants';

/**
 * Navigation MasterScript : gotoStep (persist + broadcast), raccourcis clavier hôte,
 * typeScript (auto-complétion), et toggle NeuronQ.
 */
export function useLiveHostMasterScriptNav({
  phase,
  isGuestUi,
  sessionId,
  stepCount,
  step,
  activeEtapes,
  msMode,
  neuronQActive,
  sendSmartboardHostPayload,
  setStep,
  setNeuronQActive,
  setNeuronQResponses,
  setShowMessagingPanel,
  setModal,
  setSpotlightOn,
  setMsTyped,
  stepRef,
  smartBoardStageRef,
  stepPersistTimerRef,
  msTypedIvRef,
}) {
  const gotoStep = useCallback((i, broadcastExtras = {}) => {
    const next = Math.min(Math.max(0, i), stepCount - 1);
    stepRef.current = next;
    setStep(next);
    setNeuronQActive(false);
    smartBoardStageRef.current?.syncFromHostStep?.(next);
    queueMicrotask(() => {
      sendSmartboardHostPayload(
        broadcastExtras && typeof broadcastExtras === 'object' ? broadcastExtras : {},
      );
    });
    if (sessionId) {
      clearTimeout(stepPersistTimerRef.current);
      stepPersistTimerRef.current = setTimeout(async () => {
        try {
          const { data: row } = await supabase.from('live_sessions').select('config').eq('id', sessionId).maybeSingle();
          if (!row) return;
          let c = {};
          try { c = typeof row?.config === 'string' ? JSON.parse(row.config) : (row?.config || {}); } catch { /* ignore */ }
          await supabase.from('live_sessions').update({ config: { ...c, current_step_index: next }, updated_at: new Date().toISOString() }).eq('id', sessionId);
        } catch { /* best effort */ }
      }, 1500);
    }
  }, [stepCount, sessionId, sendSmartboardHostPayload, stepRef, smartBoardStageRef, setStep, setNeuronQActive, stepPersistTimerRef]);

  useEffect(() => {
    if (phase !== PHASE.LIVE || isGuestUi) return;
    const onKey = (e) => {
      const tag = e.target?.tagName?.toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        gotoStep(stepRef.current + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        gotoStep(stepRef.current - 1);
      } else if (e.key === 'Escape') {
        setShowMessagingPanel(false);
        setModal(null);
      } else if (e.key === ' ') {
        e.preventDefault();
        setSpotlightOn(v => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, isGuestUi, gotoStep, stepRef, setShowMessagingPanel, setModal, setSpotlightOn]);

  const typeScript = useCallback(() => {
    clearInterval(msTypedIvRef.current);
    setMsTyped('');
    const e = activeEtapes[step];
    if (!e?.script) return;
    const words = e.script.split(' ');
    let i = 0;
    msTypedIvRef.current = setInterval(() => {
      if (i < words.length) { setMsTyped(t => t + (i > 0 ? ' ' : '') + words[i++]); }
      else clearInterval(msTypedIvRef.current);
    }, 38);
  }, [step, activeEtapes, msTypedIvRef, setMsTyped]);

  useEffect(() => { if (msMode === 'script') typeScript(); }, [msMode, step, typeScript]);

  const toggleNeuronQ = useCallback(() => {
    setNeuronQActive(v => !v);
    if (!neuronQActive) setNeuronQResponses([]);
  }, [setNeuronQActive, neuronQActive, setNeuronQResponses]);

  return { gotoStep, typeScript, toggleNeuronQ };
}
