import React from 'react';
import { Target, ListOrdered, Lightbulb, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * MasterScript structuré pour l'hôte : objectif, points clés, à faire comprendre, transition.
 */
export function MasterScriptBlocksPanel({
  scriptObjective = '',
  scriptSections = [],
  scriptCurrentSection = null,
  railTitleClass,
  className,
  /** Masquer le titre du panneau (ex. en-tête accordéon parent) */
  omitTitle = false,
}) {
  const active = scriptCurrentSection || scriptSections?.[0];
  const keyPoints = (scriptSections || []).slice(0, 6).map((s, i) => ({
    label: s.title || s.name || `Section ${i + 1}`,
    line: (s.content || s.script || s.objective || '').split('\n').filter(Boolean)[0] || '—',
  }));
  const toConvey =
    active?.master_agent?.message_central
    || active?.objective
    || active?.description
    || scriptObjective
    || '—';
  const transitionHint = (() => {
    const secs = scriptSections || [];
    const idx = secs.findIndex((s) => s?.id === active?.id);
    const next = idx >= 0 ? secs[idx + 1] : null;
    if (next) return `Enchaîner vers : ${next.title || next.name || 'section suivante'}`;
    return 'Clôturer ou ouvrir les questions.';
  })();

  const Block = ({ icon: Icon, label, children, className }) => (
    <div className={cn('rounded-lg border border-white/10 bg-white/[0.03] p-2', className)}>
      <p className="mb-1 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wide text-white/45">
        <Icon className="h-3 w-3 text-[color-mix(in_srgb,var(--school-accent)_75%,transparent)]" />
        {label}
      </p>
      <div className="text-[11px] leading-relaxed text-white/88">{children}</div>
    </div>
  );

  return (
    <div
      className={cn(
        'flex min-h-0 flex-col rounded-xl border border-white/[0.09] bg-black/22 p-2 backdrop-blur-md',
        className,
      )}
    >
      {!omitTitle ? (
        <p className={cn(railTitleClass, 'mb-2 px-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55')}>
          MasterScript
        </p>
      ) : null}
      <div
        className={cn(
          'max-h-[min(32vh,300px)] space-y-2 overflow-y-auto pr-0.5 [scrollbar-width:thin]',
          omitTitle && 'pt-1',
        )}
      >
        <Block icon={Target} label="Objectif pédagogique">
          {scriptObjective || 'Définir un objectif clair pour cette session.'}
        </Block>
        <Block icon={ListOrdered} label="Points clés">
          <ul className="list-inside list-disc space-y-1 text-[10px] text-white/80">
            {keyPoints.length === 0 ? (
              <li>—</li>
            ) : (
              keyPoints.map((k, i) => (
                <li key={i}>
                  <span className="font-medium text-white/90">{k.label}</span>
                  {' — '}
                  <span className="text-white/65">{k.line}</span>
                </li>
              ))
            )}
          </ul>
        </Block>
        <Block icon={Lightbulb} label="Ce que le prof doit faire comprendre">
          <p className="whitespace-pre-wrap font-serif">{toConvey}</p>
        </Block>
        <Block icon={ArrowRight} label="Transition">
          {transitionHint}
        </Block>
      </div>
    </div>
  );
}
