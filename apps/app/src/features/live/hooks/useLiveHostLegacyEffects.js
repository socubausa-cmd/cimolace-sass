import { useEffect } from 'react';
import { nt } from '@/features/live/host/liveHostUtils';
import { NQ_TEND } from '@/features/live/host/liveSmartboardLegacySlides';

/**
 * Effets hérités : timer micro, auto-frappe du script (body MasterScript),
 * et simulation NeuronQ (pour mode démo sans vraie base d'élèves).
 */
export function useLiveHostLegacyEffects({
  micOn,
  neuronQActive,
  step,
  activeEtapes,
  activeMembers,
  timerRef,
  msBodyIvRef,
  setTimerSec,
  setMsBody,
  setPanels,
  setNeuronQResponses,
  setNqAnalysis,
}) {
  useEffect(() => {
    if (micOn) {
      timerRef.current = setInterval(() => setTimerSec(s => s + 1), 1000);
    } else {
      clearInterval(timerRef.current);
      setTimerSec(0);
    }
    return () => clearInterval(timerRef.current);
  }, [micOn, timerRef, setTimerSec]);

  useEffect(() => {
    clearInterval(msBodyIvRef.current);
    setMsBody('');
    const e = activeEtapes[step];
    if (!e?.script) return;
    const words = e.script.split(' ');
    let i = 0;
    msBodyIvRef.current = setInterval(() => {
      if (i < words.length) { setMsBody(b => b + (i > 0 ? ' ' : '') + words[i++]); }
      else clearInterval(msBodyIvRef.current);
    }, 35);
    return () => clearInterval(msBodyIvRef.current);
  }, [step, activeEtapes, msBodyIvRef, setMsBody]);

  useEffect(() => {
    if (!neuronQActive) return;
    const online = activeMembers.filter(m => m.status === 'online');
    const handles = online.map((m, idx) => setTimeout(() => {
      setNeuronQResponses(prev => {
        if (prev.find(r => r.stepN === step && r.member === m.name)) return prev;
        const ans = (NQ_TEND[m.name] || ['A'])[step] || 'A';
        const next = [...prev, { member: m.name, ans, stepN: step, time: nt() }];
        setPanels(p => p.map((panel, i) => i === 2 ? { ...panel, events: [...panel.events, { avatar: m.name, msg: `${m.name} a repondu ${ans} — NeuronQ`, type: 'message', time: nt() }] } : panel));
        const cA = next.filter(r => r.stepN === step && r.ans === 'A').length;
        const cB = next.filter(r => r.stepN === step && r.ans === 'B').length;
        const tot = cA + cB;
        if (idx === online.length - 1 && tot > 0) {
          const pA = Math.round(cA / tot * 100);
          if (pA > 65) setNqAnalysis(`${cA} eleves (${pA}%) concordent. Vous pouvez avancer.`);
          else if (pA < 35) setNqAnalysis(`Majorite camp B (${cB}). Revenez sur l exemple.`);
          else setNqAnalysis(`Classe divisee (${cA} A / ${cB} B). Ideal pour un mini-debat.`);
        }
        return next;
      });
    }, (idx + 1) * 700 + Math.random() * 300));
    return () => handles.forEach(clearTimeout);
  }, [neuronQActive, step, activeMembers, setNeuronQResponses, setPanels, setNqAnalysis]);
}
