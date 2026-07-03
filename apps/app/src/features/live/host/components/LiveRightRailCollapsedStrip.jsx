import React from 'react';
import { ChevronLeft, BookOpen, Users, Sparkles } from 'lucide-react';
import { PHASE } from '@/features/live/host/liveHostConstants';

export const LiveRightRailCollapsedStrip = ({
  liveRightRailCollapsedStrip,
  liveRightGuestCollapsedStrip,
  setLiveRightRailOpen,
  phase,
  canUsePersonalNotes,
}) => {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-3.5 py-1">
      <button
        type="button"
        onClick={() => setLiveRightRailOpen(true)}
        title="Agrandir le panneau droit"
        aria-label="Agrandir le panneau droit"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-transparent text-white/55 transition hover:bg-white/[0.06] hover:text-white/90"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={2} aria-hidden />
      </button>
      {liveRightRailCollapsedStrip && phase === PHASE.LIVE ? (
        <button
          type="button"
          onClick={() => setLiveRightRailOpen(true)}
          title="MasterScript et contenu du panneau"
          aria-label="Ouvrir MasterScript et le panneau droit"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-transparent text-white/55 transition hover:bg-white/[0.06] hover:text-white/90"
        >
          <BookOpen className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>
      ) : null}
      {liveRightGuestCollapsedStrip && phase === PHASE.LIVE ? (
        <>
          <button
            type="button"
            onClick={() => setLiveRightRailOpen(true)}
            title="Participants et LONGIA — agrandir le panneau"
            aria-label="Agrandir le panneau (participants, LONGIA)"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-transparent text-white/55 transition hover:bg-white/[0.06] hover:text-white/90"
          >
            <Users className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setLiveRightRailOpen(true)}
            title="LONGIA — agrandir le panneau"
            aria-label="Agrandir le panneau LONGIA"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-transparent text-white/55 transition hover:bg-white/[0.06] hover:text-white/90"
          >
            <Sparkles className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
          {canUsePersonalNotes ? (
            <button
              type="button"
              onClick={() => setLiveRightRailOpen(true)}
              title="Notes personnelles — agrandir le panneau"
              aria-label="Agrandir le panneau notes"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-transparent text-white/55 transition hover:bg-white/[0.06] hover:text-white/90"
            >
              <BookOpen className="h-4 w-4" strokeWidth={2} aria-hidden />
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  );
};

export default LiveRightRailCollapsedStrip;
