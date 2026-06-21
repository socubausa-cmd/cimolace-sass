import React from 'react';
import { ChevronRight, DoorOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LIRI_HOST_EVENT_CARD } from './liriHostUiTheme';

const panelShell = cn(
  LIRI_HOST_EVENT_CARD,
  'backdrop-blur-[2px] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]',
);

export function WaitingRoomPanel({
  entries = [],
  expanded,
  onToggle,
  onApprove,
  onReject,
  readOnly = false,
}) {
  const n = entries.length;
  const summary =
    n === 0
      ? 'Personne en salle d\'attente'
      : n === 1
        ? '1 personne attend d\'entrer'
        : `${n} personnes attendent d'entrer`;

  return (
    <div className={cn(panelShell, 'flex min-h-[7.5rem] flex-col overflow-hidden')}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 border-b border-white/[0.06] px-2.5 py-2 text-left transition-colors hover:bg-white/[0.04]"
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-200 ring-1 ring-[color-mix(in_srgb,var(--school-accent)_30%,transparent)]">
            <DoorOpen className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55">Salle d&apos;attente</p>
            <p className="truncate text-[11px] text-white/80">{expanded ? 'Liste détaillée' : summary}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-md bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[var(--school-accent)]">
            {readOnly ? 0 : n}
          </span>
          <ChevronRight className={cn('h-4 w-4 text-white/35 transition-transform', expanded && 'rotate-90')} />
        </div>
      </button>

      {!expanded ? (
        <div className="flex flex-1 items-center px-2.5 py-2">
          <p className="text-[11px] leading-snug text-white/50">{readOnly ? 'Réservé à l&apos;hôte' : summary}</p>
        </div>
      ) : (
        <div className="max-h-[min(32vh,280px)] flex-1 space-y-1.5 overflow-y-auto p-2 [scrollbar-width:thin]">
          {readOnly ? (
            <p className="px-1 py-3 text-center text-[11px] text-white/40">Réservé à l&apos;hôte</p>
          ) : n === 0 ? (
            <p className="px-1 py-3 text-center text-[11px] text-white/40">Personne en salle d&apos;attente</p>
          ) : (
            entries.map((entry) => (
              <div
                key={entry.id}
                className="space-y-2 rounded-lg border border-amber-400/18 bg-amber-500/[0.06] p-2"
              >
                <div className="flex items-center gap-2">
                  {entry.profiles?.avatar_url ? (
                    <img
                      src={entry.profiles.avatar_url}
                      alt=""
                      className="h-8 w-8 shrink-0 rounded-full border border-white/10 object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] text-[10px] font-bold text-[var(--school-accent)]">
                      {(entry.profiles?.name || '?').slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium text-white/90">
                      {entry.profiles?.name || 'Participant'}
                    </p>
                  </div>
                </div>
                {onApprove && onReject ? (
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => onApprove(entry.id)}
                      className="h-7 min-w-0 flex-1 rounded-lg border border-amber-500/30 bg-amber-500/15 text-[9px] font-semibold text-amber-300 hover:bg-amber-500/25"
                    >
                      Accepter
                    </button>
                    <button
                      type="button"
                      onClick={() => onApprove(entry.id, { videoOff: true })}
                      className="h-7 rounded-lg border border-white/10 bg-white/[0.05] px-1.5 text-[9px] text-white/55 hover:text-white"
                      title="Sans caméra"
                    >
                      📷✗
                    </button>
                    <button
                      type="button"
                      onClick={() => onApprove(entry.id, { audioOnly: true })}
                      className="h-7 rounded-lg border border-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] px-1.5 text-[9px] text-[var(--school-accent)] hover:bg-[color-mix(in_srgb,var(--school-accent)_18%,transparent)]"
                      title="Auditeur"
                    >
                      🎧
                    </button>
                    <button
                      type="button"
                      onClick={() => onReject(entry.id)}
                      className="h-7 rounded-lg border border-red-500/25 bg-red-500/10 px-2 text-[9px] text-red-400 hover:bg-red-500/18"
                    >
                      Refuser
                    </button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
