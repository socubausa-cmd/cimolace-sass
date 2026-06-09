/**
 * WeekGrammarTemplateSelector
 * Affiche 3 templates de grammaire hebdomadaire (standard_5j, intensive_3j, decouverte_1j),
 * permet d'en appliquer un à une semaine (week_id) via Supabase.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/customSupabaseClient';
import { createWeekDay, createPedagogicalBlock } from '@/lib/schoolPathsApi';

/* ─── couleurs par type de bloc ─────────────────────────────────────────── */
const BLOCK_COLOR = {
  previsualisation_video: 'bg-blue-500/20 border-blue-500/30 text-blue-200/90',
  opening_live:           'bg-teal-500/20 border-teal-500/30 text-teal-200/90',
  smartboard_session:     'bg-cyan-500/20 border-cyan-500/30 text-cyan-200/90',
  friction_block:         'bg-orange-500/20 border-orange-500/30 text-orange-200/90',
  doctrinal_video:        'bg-violet-500/20 border-violet-500/30 text-violet-200/90',
  experiment_block:       'bg-emerald-500/20 border-emerald-500/30 text-emerald-200/90',
  closure_live:           'bg-pink-500/20 border-pink-500/30 text-pink-200/90',
  recall_block:           'bg-amber-500/20 border-amber-500/30 text-amber-200/90',
  quiz_block:             'bg-lime-500/20 border-lime-500/30 text-lime-200/90',
  mindmap_block:          'bg-sky-500/20 border-sky-500/30 text-sky-200/90',
  summary_block:          'bg-slate-500/20 border-slate-500/30 text-slate-200/90',
};

const BLOCK_LABELS = {
  previsualisation_video: 'Prévisualisation vidéo',
  opening_live:           "Live d'ouverture",
  smartboard_session:     'Session SmartBoard',
  friction_block:         'Friction pédagogique',
  doctrinal_video:        'Vidéo doctrinale',
  experiment_block:       'Expérimentation',
  closure_live:           'Live de clôture',
  recall_block:           'Recall / mémo',
  quiz_block:             'Quiz',
  mindmap_block:          'Mindmap',
  summary_block:          'Synthèse',
};

function BlockPill({ type }) {
  const cls = BLOCK_COLOR[type] || 'bg-white/10 border-white/20 text-white/60';
  return (
    <span className={cn('inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium leading-snug', cls)}>
      {BLOCK_LABELS[type] || type}
    </span>
  );
}

function DayCard({ day }) {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-2">
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-teal-500/20 text-[9px] font-bold text-teal-300/90">
          {day.day_number}
        </span>
        <span className="text-[11px] font-medium text-white/80 truncate">{day.title}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {(day.blocks || []).map((b, i) => (
          <BlockPill key={i} type={b.type} />
        ))}
      </div>
    </div>
  );
}

const TEMPLATE_ACCENT = {
  standard_5j:    { border: 'border-teal-500/30',   glow: 'hover:shadow-[0_0_18px_rgba(45,212,191,0.22)]',   badge: 'bg-teal-500/15 text-teal-300/90' },
  intensive_3j:   { border: 'border-violet-500/30', glow: 'hover:shadow-[0_0_18px_rgba(167,139,250,0.22)]', badge: 'bg-violet-500/15 text-violet-300/90' },
  decouverte_1j:  { border: 'border-amber-500/30',  glow: 'hover:shadow-[0_0_18px_rgba(251,191,36,0.22)]',  badge: 'bg-amber-500/15 text-amber-300/90' },
};

function TemplateCard({ templateKey, template, onApply, applying, applied }) {
  const accent = TEMPLATE_ACCENT[templateKey] || TEMPLATE_ACCENT.standard_5j;
  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border bg-white/[0.025] p-4 transition-all duration-200',
        accent.border,
        accent.glow,
        applied && 'ring-1 ring-teal-400/50',
      )}
    >
      {/* Header */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="text-[13px] font-semibold text-white/90">{template.title}</div>
          <p className="mt-0.5 text-[11px] leading-relaxed text-white/40">{template.description}</p>
        </div>
        <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold', accent.badge)}>
          {template.days?.length ?? 0}j
        </span>
      </div>

      {/* Jours */}
      <div className="mb-4 flex-1 space-y-2">
        {(template.days || []).map((day) => (
          <DayCard key={day.day_number} day={day} />
        ))}
      </div>

      {/* Bouton Apply */}
      <button
        type="button"
        onClick={() => onApply(templateKey, template)}
        disabled={applying || applied}
        className={cn(
          'flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[12px] font-semibold transition-all',
          applied
            ? 'border-teal-500/30 bg-teal-500/15 text-teal-300/90 cursor-default'
            : 'border-white/12 bg-white/[0.06] text-white/80 hover:border-teal-500/40 hover:bg-teal-500/10 hover:text-teal-200 disabled:opacity-40',
        )}
      >
        {applying ? (
          <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Application…</>
        ) : applied ? (
          <><CheckCircle2 className="h-3.5 w-3.5" /> Appliqué</>
        ) : (
          'Appliquer ce template'
        )}
      </button>
    </div>
  );
}

/* ─── composant principal ────────────────────────────────────────────────── */

export default function WeekGrammarTemplateSelector({ weekId, onApplied }) {
  const [templates, setTemplates] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [applying, setApplying] = useState(null); // templateKey en cours
  const [applied, setApplied] = useState(null);   // templateKey appliqué avec succès

  /* Fetch du schéma JSON au montage */
  const loadSchema = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const base = import.meta.env.BASE_URL || '/';
      const prefix = base.endsWith('/') ? base : `${base}/`;
      const url = `${prefix}liri-pedagogie-futur/weekly_grammar.schema.json`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Schéma introuvable (${res.status})`);
      const json = await res.json();
      const tpls = json?.templates || null;
      if (!tpls) throw new Error('Clé "templates" absente du schéma');
      setTemplates(tpls);
    } catch (err) {
      setError(err.message || 'Impossible de charger le schéma de grammaire');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSchema(); }, [loadSchema]);

  /* Application d'un template */
  const handleApply = useCallback(async (templateKey, template) => {
    if (!weekId || applying) return;
    setApplying(templateKey);
    setError(null);
    try {
      for (let di = 0; di < (template.days || []).length; di++) {
        const day = template.days[di];

        /* 1. Insérer le jour */
        const { data: dayRow, error: dayErr } = await createWeekDay(supabase, {
          weekId,
          dayNumber: day.day_number ?? di + 1,
          title: day.title || `Jour ${di + 1}`,
          pedagogyType: day.pedagogy_type || day.type || 'generic',
          sortOrder: di,
        });
        if (dayErr) throw new Error(`Jour ${di + 1} : ${dayErr.message}`);

        /* 2. Insérer les blocs du jour */
        const dayId = dayRow?.id;
        if (dayId) {
          for (let bi = 0; bi < (day.blocks || []).length; bi++) {
            const block = day.blocks[bi];
            const { error: blockErr } = await createPedagogicalBlock(supabase, {
              dayId,
              type: block.type || 'summary_block',
              title: block.title || null,
              data: {},
              sortOrder: bi,
            });
            if (blockErr) throw new Error(`Bloc ${bi + 1} du jour ${di + 1} : ${blockErr.message}`);
          }
        }
      }

      setApplied(templateKey);
      if (typeof onApplied === 'function') onApplied();
    } catch (err) {
      setError(err.message || 'Erreur lors de l\'application du template');
    } finally {
      setApplying(null);
    }
  }, [weekId, applying, onApplied]);

  /* ─── rendu ─────────────────────────────────────────────────────────── */

  if (!weekId) {
    return (
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-[12px] text-amber-300/70">
        Sélectionnez une semaine pour appliquer un template.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-4 text-[12px] text-white/40">
        <Loader2 className="h-4 w-4 animate-spin" />
        Chargement du schéma de grammaire…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/8 px-4 py-3 text-[12px] text-red-300/80">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  const templateEntries = templates ? Object.entries(templates) : [];

  if (templateEntries.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-[12px] text-white/35">
        Aucun template disponible dans le schéma.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-white/38">
        Choisissez un template pour pré-remplir la semaine sélectionnée avec des jours et des blocs.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        {templateEntries.map(([key, tpl]) => (
          <TemplateCard
            key={key}
            templateKey={key}
            template={tpl}
            onApply={handleApply}
            applying={applying === key}
            applied={applied === key}
          />
        ))}
      </div>
    </div>
  );
}
