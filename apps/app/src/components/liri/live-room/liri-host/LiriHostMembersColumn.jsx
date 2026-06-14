import React from 'react';
import { Users, BookOpen, X } from 'lucide-react';
import { LIRI_HOST_EVENT_CARD, LIRI_HOST_SIDE_COLUMN } from './liriHostUiTheme';
import { cn } from '@/lib/utils';

/**
 * Colonne droite — remplace le panneau « cours » (mindmap / script) : sièges privilégiés + grille membres.
 */
export function LiriHostMembersColumn({
  railTitleClass,
  privilegedSeatsDisplay,
  isHost,
  onZone3RevokeSeat,
  stripMembers = [],
  currentUserId,
  promotedParticipantId,
  onPromoteParticipant,
  onSelectMember,
  memberCount,
  onOpenMembersOverview,
  onBackToCourse,
}) {
  return (
    <div
      className={cn(
        LIRI_HOST_SIDE_COLUMN,
        'gap-2 !pt-[7rem] pb-2 pl-0.5 pr-1 sm:pr-1.5',
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/[0.07] px-2.5 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Users className="h-4 w-4 shrink-0 text-[#D4AF37]" />
          <div className="min-w-0">
            <p className={cn(railTitleClass, 'text-[11px] font-semibold text-[#f5dd8a]')}>
              Membres & sièges privilégiés
            </p>
            <p className="text-[9px] text-white/45">
              Remplace le panneau cours — revenir via le bouton Membres dans la barre d&apos;actions
            </p>
          </div>
        </div>
        {onBackToCourse ? (
          <button
            type="button"
            onClick={onBackToCourse}
            className="flex h-8 shrink-0 items-center gap-1 rounded-lg border border-white/12 bg-black/35 px-2 text-[10px] text-white/80 hover:bg-white/10"
            title="Revenir au plan de cours et au script"
          >
            <BookOpen className="h-3.5 w-3.5 text-[#D4AF37]" />
            <span className="hidden sm:inline">Cours</span>
            <X className="h-3 w-3 opacity-60 sm:hidden" />
          </button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto [scrollbar-width:thin] pr-0.5">
        <div className={cn(LIRI_HOST_EVENT_CARD, 'p-2 backdrop-blur-sm')}>
          <p className={cn(railTitleClass, 'mb-2 uppercase tracking-wide text-white/70 text-[11px]')}>
            Sièges privilégiés
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {[1, 2, 3, 4].map((pos) => {
              const seat = privilegedSeatsDisplay?.find((s) => Number(s.position) === pos);
              const initial = (seat?.name || '?').slice(0, 1).toUpperCase();
              const seatState = seat?.status || 'connecté';
              return (
                <button
                  key={pos}
                  type="button"
                  disabled={!isHost}
                  onClick={() => isHost && seat?.userId && onZone3RevokeSeat?.(pos)}
                  className={cn(
                    'flex h-14 items-center gap-1.5 rounded-lg border px-1.5 text-left transition-all',
                    seat ? 'border-[#D4AF37]/45 bg-[#D4AF37]/10 text-white' : 'border-white/10 bg-white/[0.03] text-white/45',
                    !isHost && 'cursor-default opacity-80',
                  )}
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-[10px] font-semibold">
                    {initial}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[10px] font-medium">{seat?.name || 'Disponible'}</div>
                    <div className="text-[9px] text-white/55">{seat ? seatState : 'libre'}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className={cn(LIRI_HOST_EVENT_CARD, 'p-2 backdrop-blur-sm')}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className={cn(railTitleClass, 'uppercase tracking-wide text-white/70 text-[11px]')}>
              Membres connectés
            </p>
            {onOpenMembersOverview ? (
              <button
                type="button"
                onClick={onOpenMembersOverview}
                className="flex h-7 items-center gap-1 rounded-lg border border-white/12 bg-white/[0.04] px-2 text-[9px] text-white/75 hover:border-[#D4AF37]/30 hover:bg-[#D4AF37]/10"
                title="Vue grille complète"
              >
                <Users className="h-3 w-3 text-[#D4AF37]" />
                <span className="tabular-nums">{memberCount ?? stripMembers.length}</span>
              </button>
            ) : null}
          </div>
          <div className="grid max-h-[min(42vh,420px)] grid-cols-2 gap-1.5 overflow-y-auto [scrollbar-width:thin]">
            {stripMembers.map((m) => {
              const uid = String(m.userId || m.id || '');
              const initials = (m.name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
              const activeP = promotedParticipantId && String(promotedParticipantId) === uid;
              return (
                <div
                  key={uid || m.name}
                  className={cn(
                    'flex min-h-[3rem] items-stretch gap-0.5 rounded-lg border p-0.5',
                    activeP
                      ? 'border-[#D4AF37]/45 bg-[#D4AF37]/14'
                      : 'border-white/10 bg-white/[0.04]',
                  )}
                >
                  <button
                    type="button"
                    onClick={() =>
                      onSelectMember?.({
                        id: uid,
                        name: m.name,
                        isLocal: Boolean(currentUserId && uid === String(currentUserId)),
                      })
                    }
                    className={cn(
                      'flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-white/[0.06]',
                      activeP ? 'text-[#f5dd8a]' : 'text-white/90',
                    )}
                  >
                    {m.avatar_url ? (
                      <img
                        src={m.avatar_url}
                        alt=""
                        className="h-9 w-9 shrink-0 rounded-lg border border-white/10 object-cover"
                      />
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-gradient-to-br from-[#D4AF37]/28 to-[#1a2540] text-[10px] font-bold text-[#D4AF37]">
                        {initials}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-medium leading-tight">{m.name}</p>
                      <p className="truncate text-[9px] text-emerald-400/80">{m.role || 'connecté'}</p>
                    </div>
                  </button>
                  {onPromoteParticipant && uid && !activeP ? (
                    <button
                      type="button"
                      onClick={() => onPromoteParticipant(uid)}
                      className="shrink-0 self-center rounded-md border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-1.5 py-1 text-[8px] font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/20"
                    >
                      Antenne
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
