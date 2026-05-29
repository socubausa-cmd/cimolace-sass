/**
 * SegmentEditor — éditeur complet d'un segment :
 * titre, résumé, texte affiché, objectifs, mindmap JSON, script prof.
 */
import React, { useState } from 'react';
import { FileText, Brain, ScrollText, Loader2, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { useCourseBuilderStore } from '@/stores/course-builder.store';
import { useCourseBuilder } from '../hooks/useCourseBuilder';

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium uppercase tracking-wider text-white/40">{label}</label>
      {children}
    </div>
  );
}

function Textarea({ value, onChange, rows = 3, placeholder }) {
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

function Input({ value, onChange, placeholder }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] text-white/80 placeholder-white/25 outline-none transition-colors focus:border-[color:var(--school-accent,#D4AF37)]"
    />
  );
}

function Section({ title, icon: Icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.02]">
      <button
        className="flex w-full items-center gap-2 px-3 py-2.5 text-[12px] font-medium text-white/60 hover:text-white/80"
        onClick={() => setOpen((v) => !v)}
      >
        <Icon className="h-3.5 w-3.5 text-[var(--school-accent,#D4AF37)] opacity-70" />
        <span className="flex-1 text-left">{title}</span>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {open && <div className="flex flex-col gap-3 border-t border-white/8 px-3 py-3">{children}</div>}
    </div>
  );
}

export default function SegmentEditor() {
  const activeSegmentId = useCourseBuilderStore((s) => s.activeSegmentId);
  const getActiveSegment = useCourseBuilderStore((s) => s.getActiveSegment);
  const updateSegment = useCourseBuilderStore((s) => s.updateSegment);
  const generatingFor = useCourseBuilderStore((s) => s.generatingFor);
  const { generateMindmap, generateScript } = useCourseBuilder();

  const segment = getActiveSegment();

  if (!activeSegmentId || !segment) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
        <FileText className="h-8 w-8 text-white/20" />
        <p className="text-[12px] text-white/40">
          Sélectionnez un segment dans l'arbre pour l\'éditer.
        </p>
      </div>
    );
  }

  const busy = generatingFor === activeSegmentId;
  const up = (patch) => updateSegment(activeSegmentId, patch);

  return (
    <div className="flex flex-col gap-3 overflow-y-auto p-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-[var(--school-accent,#D4AF37)]" />
        <span className="text-[13px] font-semibold text-white/90">{segment.title}</span>
      </div>

      {/* Identity */}
      <Section title="Identité" icon={FileText}>
        <Field label="Titre">
          <Input value={segment.title} onChange={(v) => up({ title: v })} placeholder="Titre du segment" />
        </Field>
        <Field label="Résumé court">
          <Textarea value={segment.summary} onChange={(v) => up({ summary: v })} rows={2} placeholder="Résumé en 1-2 phrases..." />
        </Field>
        <Field label="Texte affiché (slide)">
          <Textarea value={segment.displayText} onChange={(v) => up({ displayText: v })} rows={4} placeholder="Texte qui apparaîtra sur le slide..." />
        </Field>
      </Section>

      {/* Mindmap */}
      <Section title="Mindmap" icon={Brain} defaultOpen={false}>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-white/40">
            {segment.mindmap?.root ? `Racine : "${segment.mindmap.root.label}"` : 'Aucun mindmap'}
          </span>
          <button
            disabled={busy}
            onClick={() => generateMindmap(activeSegmentId)}
            className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] transition-colors hover:bg-white/[0.06] disabled:opacity-50"
            style={{
              borderColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 30%, transparent)',
              color: 'var(--school-accent, #D4AF37)',
            }}
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Générer
          </button>
        </div>
        {segment.mindmap?.root && (
          <pre className="max-h-32 overflow-auto rounded-md bg-black/30 p-2 text-[10px] text-white/40">
            {JSON.stringify(segment.mindmap.root, null, 2)}
          </pre>
        )}
      </Section>

      {/* Master Script */}
      <Section title="Script prof" icon={ScrollText} defaultOpen={false}>
        <div className="flex justify-end">
          <button
            disabled={busy}
            onClick={() => generateScript(activeSegmentId)}
            className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] transition-colors hover:bg-white/[0.06] disabled:opacity-50"
            style={{
              borderColor: 'color-mix(in srgb, var(--school-accent, #D4AF37) 30%, transparent)',
              color: 'var(--school-accent, #D4AF37)',
            }}
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Générer script
          </button>
        </div>
        <Field label="Introduction">
          <Textarea value={segment.masterScript?.intro ?? ''} onChange={(v) => up({ masterScript: { ...segment.masterScript, intro: v } })} rows={2} placeholder="Intro du prof..." />
        </Field>
        <Field label="Points clés (un par ligne)">
          <Textarea
            value={segment.masterScript?.keyPoints?.join('\n') ?? ''}
            onChange={(v) => up({ masterScript: { ...segment.masterScript, keyPoints: v.split('\n').filter(Boolean) } })}
            rows={4}
            placeholder="Point 1&#10;Point 2&#10;..."
          />
        </Field>
        <Field label="Conclusion">
          <Textarea value={segment.masterScript?.conclusion ?? ''} onChange={(v) => up({ masterScript: { ...segment.masterScript, conclusion: v } })} rows={2} placeholder="Conclusion..." />
        </Field>
        <Field label="Notes prof (privé)">
          <Textarea value={segment.masterScript?.teacherNotes ?? ''} onChange={(v) => up({ masterScript: { ...segment.masterScript, teacherNotes: v } })} rows={2} placeholder="Notes internes..." />
        </Field>
      </Section>
    </div>
  );
}
