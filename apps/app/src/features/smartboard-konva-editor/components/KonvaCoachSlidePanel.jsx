/**
 * Coach slide Konva (Edge liri-coach-slide) + Agent Architect J4 (seuils 80 / 50 / 30).
 */
import React, { useCallback, useState } from 'react';
import { Loader2, Sparkles, Compass } from 'lucide-react';
import { cn } from '@/lib/utils';
import { tryArchitectRedesign, tryCoachSlideAnalysis } from '../lib/callLiriCoachSlide';
import { tryParseCoachArchitectHandoffFromText } from '../lib/parseCoachArchitectHandoff';
import { useCourseCopilotStore } from '../store/useCourseCopilotStore';
import { useSmartboardKonvaStore } from '../store/useSmartboardKonvaStore';
import { useDesignerCopilotPresenceStore } from '../store/useDesignerCopilotPresenceStore';

/** @type {Record<string, string>} */
const COACH_TIER_LABEL_FR = {
  light: 'Léger (≥80)',
  medium: 'Moyen (50–79)',
  deep: 'Poussé (30–49)',
  full: 'Complet (<30)',
};

/** @param {{ className?: string; contextExtra?: string }} props */
export default function KonvaCoachSlidePanel({ className, contextExtra = '' }) {
  const getActiveScene = useSmartboardKonvaStore((s) => s.getActiveScene);
  const courseTitle = useCourseCopilotStore((s) => s.course?.title);
  const pendingCoachHandoffForDesigner = useDesignerCopilotPresenceStore((s) => s.pendingCoachArchitectHandoff);
  const setPendingCoachHandoffForDesigner = useDesignerCopilotPresenceStore(
    (s) => s.setPendingCoachArchitectHandoff,
  );
  const clearPendingHandoffForDesigner = useCallback(() => {
    setPendingCoachHandoffForDesigner(null);
  }, [setPendingCoachHandoffForDesigner]);

  const [coachDraft, setCoachDraft] = useState('');
  const [coachBusy, setCoachBusy] = useState(false);
  const [coachErr, setCoachErr] = useState('');
  const [coachResult, setCoachResult] = useState('');
  const [coachScore, setCoachScore] = useState(/** @type {number | null} */ (null));
  const [coachTier, setCoachTier] = useState(/** @type {null | 'light' | 'medium' | 'deep' | 'full'} */ (null));

  const [architectBusy, setArchitectBusy] = useState(false);
  const [architectErr, setArchitectErr] = useState('');
  const [architectResult, setArchitectResult] = useState('');
  const [architectDepth, setArchitectDepth] = useState(
    /** @type {'auto' | 'light' | 'medium' | 'deep' | 'full'} */ ('auto'),
  );
  /** JSON `design_update` extrait de la réponse Coach (validé à l'appel Architecte). */
  const [coachHandoffJson, setCoachHandoffJson] = useState(/** @type {Record<string, unknown> | null} */ (null));
  const [handoffExtractHint, setHandoffExtractHint] = useState('');
  const [architectHandoffValidated, setArchitectHandoffValidated] = useState(false);

  const fillCoachFromScene = useCallback(() => {
    const scene = getActiveScene();
    const parts = [];
    for (const o of scene?.objects || []) {
      if (o.type === 'text' && o.content?.text) parts.push(String(o.content.text));
    }
    setCoachDraft(parts.join('\n\n').trim());
  }, [getActiveScene]);

  const runCoach = useCallback(async () => {
    const t = coachDraft.trim();
    if (!t) {
      setCoachErr('Collez ou remplissez un texte.');
      return;
    }
    setCoachBusy(true);
    setCoachErr('');
    setCoachResult('');
    setCoachScore(null);
    setCoachTier(null);
    setCoachHandoffJson(null);
    setHandoffExtractHint('');
    setPendingCoachHandoffForDesigner(null);
    setArchitectResult('');
    setArchitectErr('');
    const ctx = [courseTitle, 'SmartBoard Konva', contextExtra].filter(Boolean).join(' — ');
    try {
      const out = await tryCoachSlideAnalysis(t, { lang: 'fr', context: ctx });
      if (!out?.analysis) {
        setCoachErr('Coach indisponible (session ou Edge liri-coach-slide).');
        return;
      }
      setCoachResult(out.analysis);
      if (typeof out.score === 'number') setCoachScore(out.score);
      if (out.coachTier) setCoachTier(out.coachTier);
    } catch {
      setCoachErr('Erreur réseau.');
    } finally {
      setCoachBusy(false);
    }
  }, [coachDraft, courseTitle, contextExtra]);

  const runArchitect = useCallback(async () => {
    const t = coachDraft.trim();
    if (!t) {
      setArchitectErr('Collez ou remplissez un texte (identique au Coach).');
      return;
    }
    setArchitectBusy(true);
    setArchitectErr('');
    setArchitectResult('');
    setArchitectHandoffValidated(false);
    const ctx = [courseTitle, 'SmartBoard Konva — Agent Architecte', contextExtra].filter(Boolean).join(' — ');
    try {
      const opts = { lang: 'fr', context: ctx };
      if (architectDepth !== 'auto') {
        Object.assign(opts, { architectTier: architectDepth });
      } else if (typeof coachScore === 'number') {
        Object.assign(opts, { coachScore });
      }
      if (coachHandoffJson && typeof coachHandoffJson === 'object') {
        Object.assign(opts, { coachArchitectHandoff: coachHandoffJson });
      }
      const out = await tryArchitectRedesign(t, opts);
      if (!out?.analysis) {
        setArchitectErr('Architecte indisponible (session ou Edge liri-coach-slide).');
        return;
      }
      setArchitectResult(out.analysis);
      if (out.coachHandoffValidated === true) setArchitectHandoffValidated(true);
    } catch (e) {
      setArchitectErr(e instanceof Error ? e.message : 'Erreur réseau.');
    } finally {
      setArchitectBusy(false);
    }
  }, [coachDraft, courseTitle, contextExtra, architectDepth, coachScore, coachHandoffJson]);

  const extractHandoffFromCoach = useCallback(() => {
    setHandoffExtractHint('');
    const h = tryParseCoachArchitectHandoffFromText(coachResult);
    if (h) {
      setCoachHandoffJson(h);
      setHandoffExtractHint('JSON détecté — sera validé par l\'Edge à l\'appel Architecte.');
    } else {
      setCoachHandoffJson(null);
      setHandoffExtractHint('Aucun bloc `action: design_update` trouvé dans la réponse Coach.');
    }
  }, [coachResult]);

  const queueHandoffForDesignerCopilot = useCallback(() => {
    if (coachHandoffJson && typeof coachHandoffJson === 'object') {
      setPendingCoachHandoffForDesigner(coachHandoffJson);
    }
  }, [coachHandoffJson, setPendingCoachHandoffForDesigner]);

  return (
    <div className={cn('space-y-2 rounded-xl border border-white/[0.08] bg-black/25 p-2.5', className)}>
      <p className="text-[9px] font-semibold uppercase tracking-wider text-white/50">Coach slide</p>
      <p className="text-[7px] leading-snug text-white/35">
        Edge `liri-coach-slide` — analyse puis score pour l'Agent Architecte (seuils 80 / 50 / 30).
      </p>
      <textarea
        value={coachDraft}
        onChange={(e) => setCoachDraft(e.target.value)}
        placeholder="Collez le texte du slide…"
        rows={4}
        className="w-full resize-y rounded border border-white/10 bg-black/35 px-1.5 py-1 text-[10px] text-white/90 placeholder:text-white/30"
      />
      <div className="flex gap-1">
        <button
          type="button"
          onClick={fillCoachFromScene}
          className="flex-1 rounded border border-white/12 bg-black/30 py-1 text-[9px] text-white/70 hover:bg-white/10"
        >
          Depuis la scène
        </button>
        <button
          type="button"
          disabled={coachBusy}
          onClick={() => void runCoach()}
          className="flex flex-1 items-center justify-center gap-0.5 rounded border border-cyan-500/40 bg-cyan-600/25 py-1 text-[9px] font-medium text-cyan-100 hover:bg-cyan-600/35 disabled:opacity-50"
        >
          {coachBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          Coach IA
        </button>
      </div>
      {coachErr ? <p className="text-[8px] text-rose-300/90">{coachErr}</p> : null}
      {coachResult ? (
        <>
          {(typeof coachScore === 'number' || coachTier) ? (
            <div className="flex flex-wrap items-center gap-1.5 rounded border border-[#D4AF37]/25 bg-[#1a1510]/50 px-2 py-1 text-[8px] text-[#e8c76b]/90">
              {typeof coachScore === 'number' ? (
                <span>
                  Score <strong className="text-[#f5dd8a]">{coachScore}</strong>
                  /100
                </span>
              ) : null}
              {coachTier ? (
                <span className="text-white/50">
                  Palier <span className="text-[#f5dd8a]/90">{COACH_TIER_LABEL_FR[coachTier] || coachTier}</span>
                </span>
              ) : null}
            </div>
          ) : null}
          <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded border border-white/8 bg-black/40 p-2 text-[9px] leading-snug text-white/75 [scrollbar-width:thin]">
            {coachResult}
          </pre>
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={extractHandoffFromCoach}
              className="self-start rounded border border-white/15 bg-black/30 px-2 py-0.5 text-[8px] text-white/70 hover:bg-white/10"
            >
              Extraire JSON Coach→Architect
            </button>
            {handoffExtractHint ? (
              <p className="text-[7px] text-white/45">{handoffExtractHint}</p>
            ) : null}
            {coachHandoffJson ? (
              <p className="text-[7px] text-cyan-200/70">Handoff prêt — envoyé avec « Lancer l'architecte ».</p>
            ) : null}
            {coachHandoffJson ? (
              <button
                type="button"
                onClick={queueHandoffForDesignerCopilot}
                className="self-start rounded border border-cyan-500/30 bg-cyan-950/30 px-2 py-0.5 text-[8px] text-cyan-100/90 hover:bg-cyan-900/40"
              >
                Joindre au prochain message Copilot designer
              </button>
            ) : null}
            {pendingCoachHandoffForDesigner ? (
              <div className="flex flex-wrap items-center gap-1">
                <p className="text-[7px] text-emerald-200/75">
                  Handoff en file pour le Copilot (prochain envoi du chat designer).
                </p>
                <button
                  type="button"
                  onClick={clearPendingHandoffForDesigner}
                  className="rounded border border-white/15 bg-black/40 px-1.5 py-0.5 text-[7px] text-white/55 hover:bg-white/10"
                >
                  Annuler la file
                </button>
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      <div className="space-y-1.5 rounded-lg border border-amber-500/20 bg-amber-950/15 p-2">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-amber-200/80">Agent Architecte</p>
        <p className="text-[7px] leading-snug text-white/35">
          Profondeur auto selon le score (≥80 léger, ≥50 moyen, ≥30 poussé, sinon complet). Vous pouvez forcer le palier.
        </p>
        <select
          value={architectDepth}
          onChange={(e) =>
            setArchitectDepth(/** @type {'auto' | 'light' | 'medium' | 'deep' | 'full'} */ (e.target.value))
          }
          className="w-full rounded border border-white/12 bg-black/40 px-1.5 py-1 text-[9px] text-white"
        >
          <option value="auto">Auto (selon score Coach)</option>
          <option value="light">Forcer : léger</option>
          <option value="medium">Forcer : moyen</option>
          <option value="deep">Forcer : poussé</option>
          <option value="full">Forcer : complet</option>
        </select>
        <button
          type="button"
          disabled={architectBusy}
          onClick={() => void runArchitect()}
          className="flex w-full items-center justify-center gap-1 rounded border border-amber-500/35 bg-amber-800/25 py-1.5 text-[9px] font-medium text-amber-100 hover:bg-amber-800/40 disabled:opacity-50"
        >
          {architectBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Compass className="h-3 w-3" />}
          Lancer l'architecte
        </button>
        {architectDepth === 'auto' && coachScore == null && coachResult && !coachHandoffJson ? (
          <p className="text-[7px] text-amber-200/60">Score absent — palier moyen côté serveur (sauf si handoff JSON avec palier).</p>
        ) : null}
        {architectErr ? <p className="text-[8px] text-rose-300/90">{architectErr}</p> : null}
        {architectHandoffValidated ? (
          <p className="text-[7px] text-emerald-300/80">Handoff JSON validé côté serveur.</p>
        ) : null}
        {architectResult ? (
          <pre className="max-h-44 overflow-y-auto whitespace-pre-wrap break-words rounded border border-amber-500/15 bg-black/35 p-2 text-[9px] leading-snug text-amber-50/90 [scrollbar-width:thin]">
            {architectResult}
          </pre>
        ) : null}
      </div>
    </div>
  );
}
