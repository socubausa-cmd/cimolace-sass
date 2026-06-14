import React, { useMemo } from 'react';
import { GitBranch } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Plan de cours type « mindmap » : nœuds cliquables pour naviguer les slides.
 */
export function CourseMindmapPanel({
  coursePlanSplit,
  slides = [],
  slideIndex = 0,
  activeScene = 'smartboard',
  onPickCoursePlanSlide,
  onGoToSlide,
  railTitleClass,
  /** Salle d'attente : titres / structure seuls, pas de navigation */
  readOnly = false,
}) {
  const nodes = useMemo(() => {
    const out = [];
    if (coursePlanSplit?.native && coursePlanSplit?.import) {
      const nat = Array.isArray(coursePlanSplit.native.slides) ? coursePlanSplit.native.slides : [];
      const imp = Array.isArray(coursePlanSplit.import.slides) ? coursePlanSplit.import.slides : [];
      nat.forEach((s, idx) => {
        const active =
          activeScene === 'smartboard' && idx === (coursePlanSplit.native.index ?? 0);
        out.push({
          id: `native-${idx}`,
          title: s?.title || s?.label || s?.name || `Slide IA ${idx + 1}`,
          active,
          onClick: readOnly ? undefined : () => onPickCoursePlanSlide?.('native', idx),
        });
      });
      imp.forEach((s, idx) => {
        const active = activeScene === 'diapo' && idx === (coursePlanSplit.import.index ?? 0);
        out.push({
          id: `import-${idx}`,
          title: s?.title || s?.label || s?.name || `Diapo ${idx + 1}`,
          active,
          onClick: readOnly ? undefined : () => onPickCoursePlanSlide?.('import', idx),
        });
      });
      return { branches: [
        { label: 'SmartBoard IA', color: 'from-violet-500/25 to-[color-mix(in_srgb,var(--school-accent)_10%,transparent)]', children: out.filter((n) => n.id.startsWith('native-')) },
        { label: 'Diapo importé', color: 'from-sky-500/20 to-white/5', children: out.filter((n) => n.id.startsWith('import-')) },
      ] };
    }
    const arr = Array.isArray(slides) ? slides : [];
    return {
      branches: [
        {
          label: 'Déroulé',
          color: 'from-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] to-violet-500/10',
          children: arr.map((s, idx) => ({
            id: `s-${idx}`,
            title: s?.title || s?.label || `Slide ${idx + 1}`,
            active: idx === slideIndex,
            onClick: readOnly ? undefined : () => onGoToSlide?.(idx),
          })),
        },
      ],
    };
  }, [coursePlanSplit, slides, slideIndex, activeScene, onPickCoursePlanSlide, onGoToSlide, readOnly]);

  return (
    <div className="flex min-h-0 flex-col rounded-xl border border-white/[0.09] bg-black/22 p-2 backdrop-blur-md">
      <div className="mb-2 flex items-center gap-2 px-0.5">
        <GitBranch className="h-3.5 w-3.5 text-[color-mix(in_srgb,var(--school-accent)_80%,transparent)]" />
        <p className={cn(railTitleClass, 'text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55')}>
          Mindmap{readOnly ? ' · repérage' : ''}
        </p>
      </div>
      <div className="max-h-[min(28vh,260px)] min-h-[5rem] space-y-2 overflow-y-auto pr-0.5 [scrollbar-width:thin]">
        {nodes.branches.map((br) => (
          <div key={br.label} className="space-y-1">
            <div
              className={cn(
                'rounded-lg border border-white/10 bg-gradient-to-r px-2 py-1',
                br.color,
              )}
            >
              <p className="text-[9px] font-semibold uppercase tracking-wide text-white/65">{br.label}</p>
            </div>
            <div className="ml-2 space-y-1 border-l border-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] pl-2">
              {br.children.length === 0 ? (
                <p className="py-2 text-[10px] text-white/35">Aucune slide</p>
              ) : (
                br.children.map((node) => {
                  const rowClass = cn(
                    'w-full rounded-lg border px-2 py-1.5 text-left text-[10px] transition-colors',
                    node.active
                      ? 'border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_14%,transparent)] font-medium text-[#f5dd8a] shadow-[0_0_0_1px_rgba(212,175,55,0.15)]'
                      : readOnly
                        ? 'border-white/10 bg-white/[0.03] text-white/80'
                        : 'border-white/10 bg-white/[0.03] text-white/80 hover:border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] hover:bg-[color-mix(in_srgb,var(--school-accent)_8%,transparent)]',
                  );
                  if (readOnly) {
                    return (
                      <div key={node.id} className={rowClass}>
                        {node.title}
                      </div>
                    );
                  }
                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={node.onClick}
                      className={rowClass}
                    >
                      {node.title}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
