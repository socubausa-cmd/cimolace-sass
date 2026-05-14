/**
 * Panneau IA — LIRI Studio Image : suggestions contextuelles, journal d’activité, chat LONGIA.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, ScrollText, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/customSupabaseClient';
import { useSmartboardKonvaStore } from '../store/useSmartboardKonvaStore';
import { useCourseCopilotStore } from '../store/useCourseCopilotStore';
import { useDesignerCopilotPresenceStore } from '../store/useDesignerCopilotPresenceStore';
import { buildLongiaDesignerChatContext } from '../lib/buildLongiaDesignerChatContext';
import { applyLongiaDesignerCanvasActions } from '../lib/applyLongiaDesignerCanvasActions';
import LongiaDesignerChatSection from './LongiaDesignerChatSection';
import DesignerIaStudioGenerateBlock from './DesignerIaStudioGenerateBlock';

/** Pas de plafon fonctionnel — seule garde-fou mémoire (sessions extrêmes). */
const JOURNAL_SOFT_CAP = 500_000;
const EMPTY_OBJECTS = [];

function summarizeSelection(objs, ids) {
  if (!ids?.length) return 'Aucune sélection';
  const sel = objs.filter((o) => ids.includes(o.id));
  const types = [...new Set(sel.map((o) => o.type))];
  return `${ids.length} objet(s) · ${types.join(', ') || '—'}`;
}

function hasValidRegionMarquee(rm) {
  return (
    rm &&
    typeof rm === 'object' &&
    Number.isFinite(rm.x) &&
    Number.isFinite(rm.y) &&
    Number.isFinite(rm.width) &&
    Number.isFinite(rm.height) &&
    rm.width >= 3 &&
    rm.height >= 3
  );
}

/** Suggestions de base (sans région plan de travail). */
function coreStudioSuggestions(selectedCount, types) {
  const out = [];
  if (selectedCount === 0) {
    out.push({ id: 'add', label: 'Ajoute un bloc de texte ou une image', tone: 'neutral' });
    out.push({ id: 'pedagogy', label: 'Crée un schéma pédagogique simple pour expliquer un concept', tone: 'pedagogy' });
    return out;
  }
  if (selectedCount === 1) {
    if (types.includes('image')) {
      out.push({ id: 'cut', label: 'Détourer ou isoler le sujet principal', tone: 'image' });
      out.push({ id: 'style', label: 'Rendre cette image plus cinématique / cohérente avec la slide', tone: 'image' });
      out.push({ id: 'grade', label: 'Harmoniser exposition / teinte avec les calques (Propriétés → étalonnage & fusion)', tone: 'image' });
    }
    out.push({ id: 'typo', label: 'Améliorer la hiérarchie visuelle autour de la sélection', tone: 'layout' });
    return out;
  }
  out.push({ id: 'merge', label: 'Composer ou harmoniser les éléments sélectionnés', tone: 'multi' });
  out.push({ id: 'light', label: 'Harmoniser lumière / ombre entre les objets', tone: 'multi' });
  return out;
}

const MAX_SUGGESTIONS = 6;

/** Suggestions Studio Image : région plan de travail + sélection. */
function buildSuggestions(selectedCount, types, regionMarquee) {
  const extra = [];
  if (hasValidRegionMarquee(regionMarquee)) {
    const w = Math.round(regionMarquee.width);
    const h = Math.round(regionMarquee.height);
    const shapeHint = regionMarquee.kind === 'lasso' ? ', lasso' : '';
    extra.push({
      id: 'region-focus',
      label: `Améliorer le design dans la zone encadrée (${w}×${h} px plan de travail${shapeHint})`,
      tone: 'region',
    });
    extra.push({
      id: 'region-longia',
      label: 'Demander à LONGIA une idée pour cette zone (texte, image, mise en page)',
      tone: 'region',
    });
  }
  const core = coreStudioSuggestions(selectedCount, types);
  return [...extra, ...core].slice(0, MAX_SUGGESTIONS);
}

export default function LiriStudioImageIaPanel({ className }) {
  const project = useSmartboardKonvaStore((s) => s.project);
  const selectedIds = useSmartboardKonvaStore((s) => s.selectedIds);
  const getActiveScene = useSmartboardKonvaStore((s) => s.getActiveScene);
  const addObject = useSmartboardKonvaStore((s) => s.addObject);
  const pushHistory = useSmartboardKonvaStore((s) => s.pushHistory);
  const deleteSelected = useSmartboardKonvaStore((s) => s.deleteSelected);
  const groupSelected = useSmartboardKonvaStore((s) => s.groupSelected);
  const uniteSelected = useSmartboardKonvaStore((s) => s.uniteSelected);
  const interactionTool = useSmartboardKonvaStore((s) => s.interactionTool);
  const regionMarquee = useSmartboardKonvaStore((s) => s.regionMarquee);
  const course = useCourseCopilotStore((s) => s.course);
  const activeSlideIndex = useCourseCopilotStore((s) => s.activeSlideIndex);
  const setActiveSlideIndex = useCourseCopilotStore((s) => s.setActiveSlideIndex);

  const [journal, setJournal] = useState(() => [
    { t: Date.now(), kind: 'info', text: 'Studio Image prêt — sélectionnez un objet ou parlez à LONGIA.' },
  ]);
  const lastSigRef = useRef('');

  const activeScene = getActiveScene();
  const objects = activeScene?.objects ?? EMPTY_OBJECTS;

  const selectionTypes = useMemo(() => {
    const set = new Set();
    for (const id of selectedIds) {
      const o = objects.find((x) => x.id === id);
      if (o?.type) set.add(o.type);
    }
    return [...set];
  }, [selectedIds, objects]);

  const suggestions = useMemo(
    () => buildSuggestions(selectedIds.length, selectionTypes, regionMarquee),
    [selectedIds.length, selectionTypes, regionMarquee],
  );

  useEffect(() => {
    const sig = `${selectedIds.join(',')}|${objects.length}`;
    if (sig === lastSigRef.current) return;
    lastSigRef.current = sig;
    const line = summarizeSelection(objects, selectedIds);
    setJournal((prev) => {
      const next = [...prev, { t: Date.now(), kind: 'select', text: line }];
      return next.length > JOURNAL_SOFT_CAP ? next.slice(-JOURNAL_SOFT_CAP) : next;
    });
  }, [selectedIds, objects]);

  const getContext = useCallback(() => {
    const { centralIdea, activitySummary } = useDesignerCopilotPresenceStore.getState();
    return buildLongiaDesignerChatContext({
      project,
      activeScene,
      course,
      activeSlideIndex,
      selectedIds,
      centralIdea,
      activitySummary,
      interactionTool,
      regionMarquee,
    });
  }, [project, activeScene, course, activeSlideIndex, selectedIds, interactionTool, regionMarquee]);

  const onApplyCanvasActions = useCallback(
    (actions) => {
      setJournal((prev) => {
        const next = [
          ...prev,
          { t: Date.now(), kind: 'ia', text: `Action canvas : ${Array.isArray(actions) ? actions.length : 0} opération(s)` },
        ];
        return next.length > JOURNAL_SOFT_CAP ? next.slice(-JOURNAL_SOFT_CAP) : next;
      });
      return applyLongiaDesignerCanvasActions(actions, {
        addObject,
        pushHistory,
        setActiveSlideIndex,
        slideCount: course?.slides?.length ?? 0,
        deleteSelected,
        selectedIds,
        groupSelected,
        uniteSelected,
      });
    },
    [addObject, pushHistory, setActiveSlideIndex, course, deleteSelected, selectedIds, groupSelected, uniteSelected],
  );

  return (
    <aside
      className={cn(
        'flex min-h-0 w-[min(100%,380px)] shrink-0 flex-col border-l border-white/[0.08] bg-[#0a0c14]/95 backdrop-blur-md',
        className,
      )}
    >
      <div className="shrink-0 border-b border-violet-500/20 bg-gradient-to-r from-violet-950/50 to-transparent px-3 py-2.5">
        <div className="flex items-center gap-2 text-violet-200">
          <Wand2 className="h-4 w-4 shrink-0 text-violet-400" />
          <span className="text-[13px] font-semibold tracking-tight">Zone IA</span>
        </div>
        <p className="mt-1 text-[11px] leading-snug text-white/45">
          Suggestions · journal · LONGIA (prompts). Fusion / étalonnage / masque : onglet Propriétés (image sélectionnée).
        </p>
      </div>

      <DesignerIaStudioGenerateBlock addObject={addObject} className="shrink-0 border-b border-white/[0.06] px-3 pb-3" />

      <div className="shrink-0 space-y-2 border-b border-white/[0.06] p-3">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/40">
          <Sparkles className="h-3.5 w-3.5 text-amber-400/90" />
          Suggestions
        </div>
        <ul className="space-y-1.5">
          {suggestions.map((s) => (
            <li
              key={s.id}
              className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-2 text-[12px] leading-snug text-white/75"
            >
              {s.label}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex max-h-[min(55vh,720px)] min-h-[100px] shrink-0 flex-col border-b border-white/[0.06]">
        <div className="flex shrink-0 items-center gap-1.5 border-b border-white/[0.05] px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">
          <ScrollText className="h-3.5 w-3.5" />
          Journal
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2 [scrollbar-width:thin]">
          {journal.map((e, i) => (
            <p key={`${e.t}-${i}`} className="mb-1.5 text-[11px] leading-relaxed text-white/55">
              <span className="text-white/25">{new Date(e.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>{' '}
              {e.text}
            </p>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-2">
        <LongiaDesignerChatSection
          supabase={supabase}
          getContext={getContext}
          onApplyCanvasActions={onApplyCanvasActions}
          scopeType="designer"
          scopeId="liri-studio-image"
          className="h-full min-h-0 flex-1 border border-white/[0.08] bg-[#080b10]/85 shadow-none"
          messagesScrollClassName="min-h-[140px] max-h-none flex-1"
        />
      </div>
    </aside>
  );
}
