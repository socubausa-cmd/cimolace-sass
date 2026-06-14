import React, { useState, useMemo } from 'react';
import { BookMarked } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Lecture synthétique vs mot à mot du script de session.
 */
export function ReadAloudScriptPanel({
  scriptSections = [],
  railTitleClass,
  className,
  /** Masquer icône + libellé (en-tête géré par un accordéon parent) */
  hideTitleLabel = false,
}) {
  const [mode, setMode] = useState('summary');

  const summaryText = useMemo(() => {
    if (!scriptSections?.length) return 'Aucun script chargé pour cette session.';
    return scriptSections
      .map((s, i) => {
        const one =
          (s.content || s.script || s.objective || s.description || s.title || '')
            .split('\n')
            .filter(Boolean)[0] || s.title || `Bloc ${i + 1}`;
        return `• ${s.title || s.name || `Section ${i + 1}`} : ${one}`;
      })
      .join('\n');
  }, [scriptSections]);

  const verbatimText = useMemo(() => {
    if (!scriptSections?.length) return '';
    return scriptSections
      .map((s, i) => {
        const body = s.content || s.script || s.objective || s.description || '';
        const head = s.title || s.name || `Section ${i + 1}`;
        return body.trim() ? `## ${head}\n${body.trim()}` : `## ${head}\n—`;
      })
      .join('\n\n');
  }, [scriptSections]);

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col rounded-xl border border-white/[0.09] bg-black/22 p-2 backdrop-blur-md',
        className,
      )}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-0.5">
        {!hideTitleLabel ? (
          <div className="flex items-center gap-2">
            <BookMarked className="h-3.5 w-3.5 text-[color-mix(in_srgb,var(--school-accent)_80%,transparent)]" />
            <p className={cn(railTitleClass, 'text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55')}>
              Script à dire
            </p>
          </div>
        ) : (
          <span className="min-w-0 flex-1" />
        )}
        <div className="flex rounded-lg border border-white/10 bg-black/30 p-0.5">
          <button
            type="button"
            onClick={() => setMode('summary')}
            className={cn(
              'rounded-md px-2 py-0.5 text-[9px] font-medium transition-colors',
              mode === 'summary' ? 'bg-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] text-[#f5dd8a]' : 'text-white/45 hover:text-white/75',
            )}
          >
            Résumé
          </button>
          <button
            type="button"
            onClick={() => setMode('verbatim')}
            className={cn(
              'rounded-md px-2 py-0.5 text-[9px] font-medium transition-colors',
              mode === 'verbatim' ? 'bg-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] text-[#f5dd8a]' : 'text-white/45 hover:text-white/75',
            )}
          >
            Mot à mot
          </button>
        </div>
      </div>
      <div className="min-h-[6rem] flex-1 overflow-y-auto rounded-lg border border-white/[0.06] bg-black/25 p-2 [scrollbar-width:thin]">
        <pre className="whitespace-pre-wrap font-serif text-[11px] leading-relaxed text-white/85">
          {mode === 'summary' ? summaryText : verbatimText || summaryText}
        </pre>
      </div>
    </div>
  );
}
