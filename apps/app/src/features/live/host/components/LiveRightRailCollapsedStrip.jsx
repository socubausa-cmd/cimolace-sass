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
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/14 bg-white/[0.06] text-white/85 transition hover:border-amber-400/35 hover:bg-white/[0.1] hover:text-white"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={2} aria-hidden />
      </button>
      {liveRightRailCollapsedStrip && phase === PHASE.LIVE ? (
        <button
          type="button"
          onClick={() => setLiveRightRailOpen(true)}
          title="MasterScript et contenu du panneau"
          aria-label="Ouvrir MasterScript et le panneau droit"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-white/[0.04] text-amber-200/90 transition hover:border-amber-400/35 hover:bg-amber-500/10"
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
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-white/[0.04] text-amber-200/90 transition hover:border-amber-400/35 hover:bg-amber-500/10"
          >
            <Users className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setLiveRightRailOpen(true)}
            title="LONGIA — agrandir le panneau"
            aria-label="Agrandir le panneau LONGIA"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-white/[0.04] text-amber-300/90 transition hover:border-amber-400/35 hover:bg-amber-500/10"
          >
            <Sparkles className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
          {canUsePersonalNotes ? (
            <button
              type="button"
              onClick={() => setLiveRightRailOpen(true)}
              title="Notes personnelles — agrandir le panneau"
              aria-label="Agrandir le panneau notes"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/12 bg-white/[0.04] text-slate-200/90 transition hover:border-slate-400/35 hover:bg-white/[0.08]"
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
