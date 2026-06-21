import React from 'react';
import { ChevronRight, Hand } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRaisedHandSince } from './arenaNotificationFormat';
import { LIRI_HOST_EVENT_CARD } from './liriHostUiTheme';

const panelShell = cn(
  LIRI_HOST_EVENT_CARD,
  'backdrop-blur-[2px] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]',
);

export function RaisedHandsPanel({
  hands = [],
  expanded,
  onToggle,
  onGrantSpeech,
  onIgnore,
}) {
  const n = hands.length;
  const summary =
    n === 0
      ? 'Aucune main levée pour le moment'
      : n === 1
        ? `${hands[0]?.name || 'Un participant'} attend une prise de parole`
        : `${n} participants attendent une prise de parole`;

  return (
    <div className={cn(panelShell, 'flex min-h-[7.5rem] flex-col overflow-hidden')}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 border-b border-white/[0.06] px-2.5 py-2 text-left transition-colors hover:bg-white/[0.04]"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-500/15 text-red-300 ring-1 ring-amber-400/35">
            <Hand className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55">Mains levées</p>
            <p className="truncate text-[11px] text-white/80">{expanded ? 'Liste détaillée' : summary}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-md bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[var(--school-accent)]">
            {n}
          </span>
          <ChevronRight className={cn('h-4 w-4 text-white/35 transition-transform', expanded && 'rotate-90')} />
        </div>
      </button>

      {!expanded ? (
        <div className="flex flex-1 items-center px-2.5 py-2">
          <p className="text-[11px] leading-snug text-white/50">{summary}</p>
        </div>
      ) : (
        <div className="max-h-[min(32vh,280px)] flex-1 space-y-1.5 overflow-y-auto p-2 [scrollbar-width:thin]">
          {n === 0 ? (
            <p className="px-1 py-3 text-center text-[11px] text-white/40">Aucune main levée pour le moment</p>
          ) : (
            hands.map((h) => (
              <div
                key={String(h.userId)}
                className="rounded-lg border border-white/10 bg-white/[0.04] p-2"
              >
                <div className="flex items-center gap-2">
                  {h.avatar_url ? (
                    <img src={h.avatar_url} alt="" className="h-8 w-8 shrink-0 rounded-full border border-white/10 object-cover" />
                  ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_12%,transparent)] text-[10px] font-bold text-[var(--school-accent)]">
                      {(h.name || '?').slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium text-white/90">{h.name || 'Participant'}</p>
                    <p className="text-[9px] text-white/40">{formatRaisedHandSince(h.at)}</p>
                  </div>
                </div>
                <div className="mt-2 flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => onGrantSpeech?.(h.userId)}
                    className="h-8 min-w-0 flex-1 rounded-lg bg-[var(--school-accent)] text-[10px] font-semibold text-black hover:bg-[#e5c04a]"
                  >
                    Donner la parole
                  </button>
                  <button
                    type="button"
                    onClick={() => onIgnore?.(h.userId)}
                    className="h-8 min-w-0 flex-1 rounded-lg border border-white/12 bg-white/[0.06] text-[10px] font-medium text-white/75 hover:bg-white/10"
                  >
                    Ignorer
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
