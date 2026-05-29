import { PHASE } from '@/features/live/host/liveHostConstants';

export function LiveHostPreviewOverlays({
  phase,
  isGuestUi,
  lhLayoutCompact,
  lhCompactByWidthOnly,
  previewMobileMaquette,
  previewProjectorLayout,
  focusMode,
  onOpenLayoutPreview,
  onCloseMobilePreview,
  onCloseProjectorPreview,
}) {
  if (phase !== PHASE.LIVE || isGuestUi) return null;

  return (
    <>
      {lhLayoutCompact && !previewMobileMaquette && !previewProjectorLayout ? (
        <button
          type="button"
          onClick={onOpenLayoutPreview}
          className="pointer-events-auto fixed bottom-[5.5rem] right-3 z-[305] rounded-full border border-white/15 bg-[#14131c]/90 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-white/75 shadow-lg backdrop-blur-md transition hover:border-violet-400/35 hover:text-violet-100 sm:right-4"
        >
          Aperçu diffusion
        </button>
      ) : null}

      {previewMobileMaquette && !lhCompactByWidthOnly ? (
        <div className="pointer-events-auto fixed left-1/2 top-3 z-[305] flex max-w-[min(92vw,420px)] -translate-x-1/2 items-center gap-2 rounded-full border border-violet-400/35 bg-[#0c0a18]/95 px-3 py-1.5 text-[11px] text-violet-100 shadow-lg backdrop-blur-md">
          <span className="truncate font-medium text-white/85">Vue mobile (aperçu)</span>
          <button
            type="button"
            onClick={onCloseMobilePreview}
            className="shrink-0 rounded-lg bg-violet-500/25 px-2 py-0.5 text-[10px] font-semibold hover:bg-violet-500/40"
          >
            Fermer
          </button>
        </div>
      ) : null}

      {previewProjectorLayout && !focusMode ? (
        <div className="pointer-events-auto fixed left-1/2 top-3 z-[305] flex max-w-[min(92vw,420px)] -translate-x-1/2 items-center gap-2 rounded-full border border-amber-400/40 bg-[#14100c]/95 px-3 py-1.5 text-[11px] text-amber-100 shadow-lg backdrop-blur-md">
          <span className="truncate font-medium text-white/85">Vue projecteur (aperçu)</span>
          <button
            type="button"
            onClick={onCloseProjectorPreview}
            className="shrink-0 rounded-lg bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold hover:bg-amber-500/35"
          >
            Fermer
          </button>
        </div>
      ) : null}
    </>
  );
}
