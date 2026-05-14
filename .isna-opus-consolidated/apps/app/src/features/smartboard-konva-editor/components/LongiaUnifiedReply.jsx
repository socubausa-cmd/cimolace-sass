import { cn } from '@/lib/utils';

/**
 * Affichage ordonné : message → compréhension → actions → suggestions → détails (preview / explications).
 * @param {{
 *   msg: {
 *     id: string;
 *     text: string;
 *     suggestions?: Array<{ label: string; action: string; payload?: Record<string, unknown> }>;
 *     longiaComposed?: Record<string, unknown>;
 *     longiaUnified?: {
 *       message?: string;
 *       understanding?: Record<string, unknown> | null;
 *       actions?: Array<{ label: string; action: string; payload?: Record<string, unknown> }>;
 *       suggestions?: Array<{ label: string; action: string; payload?: Record<string, unknown> }>;
 *       preview?: string | Record<string, unknown> | null;
 *       explanations?: string | string[] | Array<{ label: string; content: string }> | null;
 *       composedV1?: Record<string, unknown>;
 *     };
 *   };
 *   onChip: (chip: { label: string; action: string; payload?: Record<string, unknown> }, msg: typeof msg) => void;
 *   maxPrimary?: number;
 *   maxSecondary?: number;
 *   variant?: 'full' | 'compact';
 *   hideResponseMeta?: boolean;
 * }} props
 */
export function LongiaUnifiedReply({
  msg,
  onChip,
  maxPrimary = 10,
  maxSecondary = 10,
  variant = 'full',
  hideResponseMeta = false,
}) {
  const u = msg.longiaUnified;
  const isCompact = variant === 'compact';
  const composed = msg.longiaComposed || u?.composedV1;
  const renderHints =
    composed && typeof composed === 'object' && composed.render_hints && typeof composed.render_hints === 'object'
      ? composed.render_hints
      : null;

  const primary = u?.actions?.length
    ? u.actions
    : Array.isArray(msg.suggestions)
      ? msg.suggestions
      : [];
  const secondary = u?.suggestions?.length ? u.suggestions : [];
  const understanding = u?.understanding && typeof u.understanding === 'object' ? u.understanding : null;
  const rawPreview = u?.preview;
  const previewText =
    typeof rawPreview === 'string' && rawPreview.trim()
      ? rawPreview.trim()
      : rawPreview &&
          typeof rawPreview === 'object' &&
          rawPreview !== null &&
          rawPreview.type === 'text_preview' &&
          typeof rawPreview.text === 'string'
        ? rawPreview.text.trim()
        : null;
  const previewObject =
    rawPreview && typeof rawPreview === 'object' && rawPreview !== null && !previewText ? rawPreview : null;
  const expl = u?.explanations;

  const labelPrimary = isCompact ? 'Actions' : 'Actions principales';
  const labelSecondary = isCompact ? 'Plus' : 'Suggestions';
  const labelUnderstanding = 'Compréhension';
  const labelDetails = 'Détails';

  const chipClassPrimary = isCompact
    ? 'rounded-md border border-amber-500/30 bg-amber-500/12 px-1.5 py-0.5 text-[9px] font-semibold text-amber-100/90 hover:bg-amber-500/22'
    : 'rounded-lg border border-amber-500/35 bg-amber-500/15 px-2.5 py-1 text-[10px] font-semibold text-amber-100/95 shadow-sm transition-colors hover:border-amber-400/50 hover:bg-amber-500/25';

  const chipClassSecondary = isCompact
    ? 'rounded-md border border-violet-500/25 bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-violet-100/90 hover:bg-violet-500/18'
    : 'rounded-lg border border-violet-500/30 bg-violet-500/12 px-2.5 py-1 text-[10px] font-semibold text-violet-100/90 transition-colors hover:border-violet-400/45 hover:bg-violet-500/20';

  const chipClassGhost = isCompact
    ? 'rounded-md border border-white/[0.1] bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-medium text-white/45 hover:bg-white/[0.07]'
    : 'rounded-lg border border-white/[0.12] bg-white/[0.05] px-2.5 py-1 text-[10px] font-medium text-white/50 hover:bg-white/[0.08]';

  const chipClassForAction = (item) => {
    const v = item?.payload?.variant || item?.variant;
    if (v === 'ghost') return chipClassGhost;
    return chipClassPrimary;
  };

  const sectionTitle = (t) => (
    <p
      className={cn(
        'font-bold uppercase tracking-wider text-white/40',
        isCompact ? 'mb-1 text-[8px]' : 'mb-1.5 text-[9px]',
      )}
    >
      {t}
    </p>
  );

  const renderUnderstanding = () => {
    if (isCompact) return null;
    if (!understanding || !Object.keys(understanding).length) return null;
    const entries = Object.entries(understanding).filter(
      ([, v]) => v !== undefined && v !== null && String(v).trim() !== '',
    );
    if (!entries.length) return null;
    return (
      <div className={cn('rounded-lg border border-white/[0.06] bg-black/20', isCompact ? 'mt-1.5 px-2 py-1.5' : 'mt-2 px-2.5 py-2')}>
        {sectionTitle(labelUnderstanding)}
        <ul className={cn('space-y-0.5 text-white/45', isCompact ? 'text-[8px]' : 'text-[9px]')}>
          {entries.slice(0, 8).map(([k, v]) => (
            <li key={k} className="break-words">
              <span className="font-semibold text-white/55">{k}</span>
              {': '}
              {typeof v === 'object' ? JSON.stringify(v) : String(v)}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const renderChipRow = (items, className, prefix, useVariant = false) =>
    items.length ? (
      <div className={cn('flex flex-wrap gap-1.5', isCompact ? 'mt-1' : 'mt-2')}>
        {items.map((s, i) => (
          <button
            key={`${msg.id}_${prefix}_${i}`}
            type="button"
            title={
              s.payload?.description || s.payload?.why
                ? [s.payload?.description, s.payload?.why].filter(Boolean).join(' — ')
                : undefined
            }
            onClick={() => onChip(s, msg)}
            className={useVariant ? chipClassForAction(s) : className}
          >
            {s.label}
          </button>
        ))}
      </div>
    ) : null;

  const hasSplit = Boolean(u && (u.actions?.length || u.suggestions?.length));
  const showLegacyActions =
    !hasSplit && Array.isArray(msg.suggestions) && msg.suggestions.length > 0;

  const toneBadge =
    !hideResponseMeta &&
    composed &&
    typeof composed.tone_mode === 'string' &&
    composed.tone_mode &&
    !isCompact ? (
      <span className="mb-1.5 inline-block rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-white/40">
        {composed.tone_mode}
      </span>
    ) : null;

  const hintsLine =
    !hideResponseMeta && renderHints && !isCompact && typeof renderHints.open_tab === 'string' ? (
      <p className="mb-1 text-[8px] text-white/30">
        UI · onglet {String(renderHints.open_tab)}
        {renderHints.highlight_selection ? ' · sélection' : ''}
        {renderHints.show_preview_panel ? ' · aperçu' : ''}
      </p>
    ) : null;

  return (
    <>
      {toneBadge}
      {hintsLine}
      <p className={cn('whitespace-pre-wrap break-words', isCompact ? 'line-clamp-6' : '')}>{msg.text}</p>

      {renderUnderstanding()}

      {hasSplit ? (
        <>
          {primary.length > 0 ? (
            <div className={cn('border-t border-white/[0.06]', isCompact ? 'mt-1.5 pt-1.5' : 'mt-2.5 pt-2')}>
              {sectionTitle(labelPrimary)}
              {renderChipRow(primary.slice(0, maxPrimary), chipClassPrimary, 'p', true)}
            </div>
          ) : null}
          {secondary.length > 0 ? (
            <div className={cn('border-t border-white/[0.06]', isCompact ? 'mt-1.5 pt-1.5' : 'mt-2 pt-2')}>
              {sectionTitle(labelSecondary)}
              {renderChipRow(secondary.slice(0, maxSecondary), chipClassSecondary, 's')}
            </div>
          ) : null}
        </>
      ) : showLegacyActions ? (
        <div className={cn('border-t border-white/[0.06]', isCompact ? 'mt-1.5 pt-1.5' : 'mt-2.5 pt-2')}>
          {sectionTitle(labelPrimary)}
          {renderChipRow(
            msg.suggestions.slice(0, maxPrimary),
            chipClassPrimary,
            'l',
          )}
        </div>
      ) : null}

      {(previewText || previewObject || expl) && !isCompact ? (
        <details className="mt-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-1.5">
          <summary className="cursor-pointer text-[9px] font-semibold uppercase tracking-wide text-white/35">
            {labelDetails}
          </summary>
          {previewText ? (
            <p className="mt-1.5 text-[10px] leading-relaxed text-white/50">{previewText}</p>
          ) : null}
          {previewObject ? (
            <pre className="mt-1.5 max-h-32 overflow-auto text-[9px] leading-relaxed text-white/45">
              {JSON.stringify(previewObject, null, 2)}
            </pre>
          ) : null}
          {expl ? (
            <div className="mt-1.5 text-[10px] leading-relaxed text-white/45">
              {Array.isArray(expl) &&
              expl.length > 0 &&
              typeof expl[0] === 'object' &&
              expl[0] !== null &&
              'content' in expl[0] ? (
                <ul className="space-y-2">
                  {expl.map((row, i) => (
                    <li key={i}>
                      <span className="font-semibold text-white/55">
                        {typeof row.label === 'string' ? row.label : '—'}
                      </span>
                      <p className="mt-0.5 pl-0">{typeof row.content === 'string' ? row.content : ''}</p>
                    </li>
                  ))}
                </ul>
              ) : Array.isArray(expl) ? (
                <ul className="list-disc space-y-1 pl-4">
                  {expl.map((line, i) => (
                    <li key={i}>{typeof line === 'string' ? line : JSON.stringify(line)}</li>
                  ))}
                </ul>
              ) : (
                <p>{typeof expl === 'string' ? expl : JSON.stringify(expl)}</p>
              )}
            </div>
          ) : null}
        </details>
      ) : null}
    </>
  );
}
