/**
 * SubchapterEditor — éditeur d'un sous-chapitre :
 * idée centrale, idée générale, cible de connaissance, cible de compétence.
 */
import React from 'react';
import { Layers } from 'lucide-react';
import { useCourseBuilderStore } from '@/stores/course-builder.store';

function Field({ label, hint, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium uppercase tracking-wider text-white/40">{label}</label>
      {hint && <p className="text-[10px] text-white/25">{hint}</p>}
      {children}
    </div>
  );
}

function Textarea({ value, onChange, rows = 2, placeholder }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="w-full resize-none rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] text-white/80 placeholder-white/25 outline-none transition-colors focus:border-[color:var(--school-accent,#D4AF37)] focus:bg-white/[0.06]"
    />
  );
}

export default function SubchapterEditor() {
  const activeSubchapterId = useCourseBuilderStore((s) => s.activeSubchapterId);
  const getActiveSubchapter = useCourseBuilderStore((s) => s.getActiveSubchapter);
  const updateSubchapter = useCourseBuilderStore((s) => s.updateSubchapter);

  const sub = getActiveSubchapter();

  if (!activeSubchapterId || !sub) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
        <Layers className="h-8 w-8 text-white/20" />
        <p className="text-[12px] text-white/40">Sélectionnez un sous-chapitre pour l'éditer.</p>
      </div>
    );
  }

  const up = (patch) => updateSubchapter(activeSubchapterId, patch);

  return (
    <div className="flex flex-col gap-4 overflow-y-auto p-3">
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 text-[var(--school-accent,#D4AF37)]" />
        <span className="text-[13px] font-semibold text-white/90">{sub.title}</span>
      </div>

      <Field label="Titre">
        <textarea
          value={sub.title}
          onChange={(e) => up({ title: e.target.value })}
          rows={1}
          className="w-full resize-none rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] text-white/80 placeholder-white/25 outline-none focus:border-[color:var(--school-accent,#D4AF37)]"
        />
      </Field>

      <Field
        label="Idée centrale"
        hint="La thèse principale que l'apprenant doit retenir."
      >
        <Textarea value={sub.centralIdea} onChange={(v) => up({ centralIdea: v })} rows={2} placeholder="Ex: La lumière est à la fois onde et particule..." />
      </Field>

      <Field
        label="Idée générale"
        hint="Le contexte plus large du sous-chapitre."
      >
        <Textarea value={sub.generalIdea} onChange={(v) => up({ generalIdea: v })} rows={2} placeholder="Ex: Dans le cadre de la physique quantique..." />
      </Field>

      <Field
        label="Cible de connaissance"
        hint="Ce que l'apprenant doit savoir."
      >
        <Textarea value={sub.knowledgeTarget} onChange={(v) => up({ knowledgeTarget: v })} rows={2} placeholder="Ex: Définir le principe de dualité..." />
      </Field>

      <Field
        label="Cible de compétence"
        hint="Ce que l'apprenant doit être capable de faire."
      >
        <Textarea value={sub.competencyTarget} onChange={(v) => up({ competencyTarget: v })} rows={2} placeholder="Ex: Analyser un phénomène d'interférence..." />
      </Field>
    </div>
  );
}
