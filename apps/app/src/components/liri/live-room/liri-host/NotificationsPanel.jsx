import React from 'react';
import { ChevronRight, Bell, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatArenaNotificationLine } from './arenaNotificationFormat';
import { LIRI_HOST_EVENT_CARD } from './liriHostUiTheme';

const panelShell = cn(
  LIRI_HOST_EVENT_CARD,
  'backdrop-blur-[2px] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]',
);

const FILTER_OPTIONS = [
  { id: 'all', label: 'Tous' },
  { id: 'urgent', label: 'Urgent' },
  { id: 'longia_content', label: 'Contenu' },
  { id: 'longia_pedagogy', label: 'Pédagogie' },
  { id: 'longia_audience', label: 'Audience' },
  { id: 'longia_chat', label: 'Chat' },
  { id: 'longia_production', label: 'Production' },
  { id: 'hand', label: 'Mains' },
  { id: 'waiting', label: 'Attente' },
  { id: 'join', label: 'Entrées' },
  { id: 'leave', label: 'Sorties' },
  { id: 'promote', label: 'Antenne' },
  { id: 'default', label: 'Q&R' },
];

export function NotificationsPanel({
  items = [],
  expanded,
  onToggle,
  filter,
  onFilterChange,
  onClear,
}) {
  const filtered =
    filter === 'all'
      ? items
      : items.filter((item) => {
          const k = item.kind || 'default';
          if (filter === 'urgent') return typeof k === 'string' && k.startsWith('longia_') && item.longiaUrgent;
          if (typeof filter === 'string' && filter.startsWith('longia_')) return k === filter;
          return k === filter;
        });
  const chronological = [...filtered].sort((a, b) => (a.at || 0) - (b.at || 0));

  const latestLine =
    items.length === 0
      ? 'Aucune notification récente'
      : formatArenaNotificationLine(items[0]);

  return (
    <div className={cn(panelShell, 'flex min-h-[7.5rem] flex-col overflow-hidden')}>
      <div className="flex w-full items-stretch gap-1 border-b border-white/[0.06]">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center justify-between gap-2 px-2.5 py-2 text-left transition-colors hover:bg-white/[0.04]"
        >
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-200 ring-1 ring-violet-300/40">
              <Bell className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55">Notifications</p>
              <p className="line-clamp-2 text-[11px] text-white/80">
                {expanded ? 'Journal chronologique' : latestLine}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <span className="rounded-md bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[var(--school-accent)]">
              {items.length}
            </span>
            <ChevronRight className={cn('h-4 w-4 text-white/35 transition-transform', expanded && 'rotate-90')} />
          </div>
        </button>
        {items.length > 0 && onClear ? (
          <button
            type="button"
            onClick={() => {
              onClear();
              onFilterChange?.('all');
            }}
            className="my-1.5 mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-white/[0.04] text-white/55 hover:border-red-400/35 hover:bg-red-500/10 hover:text-red-300"
            title="Vider le journal"
            aria-label="Vider le journal des notifications"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {!expanded ? (
        <div className="flex flex-1 items-center px-2.5 py-2">
          <p className="text-[11px] leading-snug text-white/50">
            {items.length === 0 ? 'Aucune notification récente' : latestLine}
          </p>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {items.length > 0 ? (
            <div className="flex gap-1 overflow-x-auto border-b border-white/[0.05] px-2 py-1.5 [scrollbar-width:none]">
              {FILTER_OPTIONS.map((opt) => {
                const active = filter === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onFilterChange?.(opt.id)}
                    className={cn(
                      'shrink-0 rounded-md border px-2 py-0.5 text-[8px] font-medium transition-colors',
                      active
                        ? 'border-[color-mix(in_srgb,var(--school-accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_12%,transparent)] text-[#f5dd8a]'
                        : 'border-white/10 bg-white/[0.03] text-white/50 hover:text-white/75',
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          ) : null}
          <div className="max-h-[min(32vh,280px)] flex-1 space-y-1.5 overflow-y-auto p-2 [scrollbar-width:thin]">
            {items.length === 0 ? (
              <p className="px-1 py-3 text-center text-[11px] text-white/40">Aucune notification récente</p>
            ) : filtered.length === 0 ? (
              <div className="px-1 py-3 text-center">
                <p className="text-[11px] text-white/50">Aucun événement pour ce filtre</p>
                <button
                  type="button"
                  onClick={() => onFilterChange?.('all')}
                  className="mt-2 text-[9px] font-medium text-[color-mix(in_srgb,var(--school-accent)_85%,transparent)] underline"
                >
                  Afficher tout
                </button>
              </div>
            ) : (
              chronological.map((item) => (
                <div key={item.id} className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5">
                  <p className="text-[10px] leading-snug text-white/88">{formatArenaNotificationLine(item)}</p>
                  <p className="mt-0.5 text-[8px] tabular-nums text-white/35">
                    {typeof item.at === 'number'
                      ? new Date(item.at).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })
                      : ''}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
