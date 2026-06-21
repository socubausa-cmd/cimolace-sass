import React from 'react';
import { User } from 'lucide-react';
import { cn } from '@/lib/utils';
import ParticipantStripChip from '../ParticipantStripChip';
import { ArenaStripOverflowTile } from '../ArenaStripShellTiles';

const placeVideShell =
  'relative flex min-h-[56px] min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-dashed border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] bg-gradient-to-br from-[#1a1028]/90 via-[#0d0814]/85 to-black/80 shadow-[inset_0_0_24px_-8px_rgba(212,163,106,0.12),0_0_20px_-12px_rgba(212,175,55,0.08)]';

const REMOTE_SLOTS = 8;

/**
 * Bandeau maquette LIRI : 1 hôte + 8 cases (invités, débordement +N, ou places vides) — largeurs égales.
 */
export function LiriHostCenterSeatStrip({
  participants = [],
  remoteParticipants = [],
  liveKitRoomRef,
  promoted,
  canPromoteStrip,
  onPromoteParticipant,
  onOpenMemberPreview,
  onOpenMembersOverflow,
  /** Moins de marge extérieure quand le bandeau est dans un cadre dégradé parent */
  embedded = false,
}) {
  const local = participants.find((p) => p.isLocal);
  const hostDisplayName = local?.name?.trim() || 'Prof. LIRI';
  const hostId = local?.id ?? 'local-host';

  const remotes = remoteParticipants || [];
  let cells = [];
  if (remotes.length <= REMOTE_SLOTS) {
    cells = [...remotes, ...Array(REMOTE_SLOTS - remotes.length).fill(null)];
  } else {
    const shown = remotes.slice(0, REMOTE_SLOTS - 1);
    const extra = remotes.length - shown.length;
    cells = [...shown, { __overflow: true, extraCount: extra }];
  }

  return (
    <div className={cn('w-full', embedded ? 'px-0 pb-0 pt-0' : 'px-2 pb-2 pt-1')}>
      <div
        className="flex w-full items-stretch gap-1.5 sm:gap-2"
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0 flex-1" style={{ flex: '1 1 0%' }}>
          {local ? (
            <ParticipantStripChip
              roomRef={liveKitRoomRef}
              participant={{ id: hostId, name: hostDisplayName, isLocal: true }}
              isPromoted={false}
              canPromote={false}
              onOpenPreview={onOpenMemberPreview}
              fillSlot
              seatRole="host"
            />
          ) : (
            <div className={cn(placeVideShell, 'items-center justify-center px-1')}>
              <User className="h-4 w-4 text-[color-mix(in_srgb,var(--school-accent)_50%,transparent)]" />
              <span className="mt-0.5 text-center text-[7px] font-medium uppercase tracking-wide text-[color-mix(in_srgb,var(--school-accent)_65%,transparent)]">
                Hôte
              </span>
            </div>
          )}
        </div>

        {cells.map((p, i) => (
          <div key={p?.__overflow ? 'overflow' : p?.id ?? `empty-${i}`} className="min-w-0 flex-1" style={{ flex: '1 1 0%' }}>
            {p?.__overflow ? (
              <button
                type="button"
                onClick={onOpenMembersOverflow}
                className="h-full w-full border-0 bg-transparent p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--school-accent)_50%,transparent)]"
                title="Voir tous les membres"
              >
                <ArenaStripOverflowTile extraCount={p.extraCount} className="h-[56px] w-full" />
              </button>
            ) : p ? (
              <ParticipantStripChip
                roomRef={liveKitRoomRef}
                participant={{ id: p.id, name: p.name, isLocal: !!p.isLocal }}
                isPromoted={Boolean(promoted && p.id === promoted.id)}
                canPromote={canPromoteStrip}
                onPromote={onPromoteParticipant}
                onOpenPreview={onOpenMemberPreview}
                fillSlot
              />
            ) : (
              <div
                className={cn(placeVideShell, 'items-center justify-center px-1')}
                title="Place vide"
              >
                <User className="h-3.5 w-3.5 text-amber-300/45" />
                <span className="mt-0.5 text-center text-[7px] font-medium leading-tight text-[color-mix(in_srgb,var(--school-accent)_70%,transparent)]">
                  Place vide
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
