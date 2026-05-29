import { LIVE_HOST_RAIL_COLLAPSED_PX } from '@/features/live/host/liveHostConstants';

/**
 * Style inline de la grille live principale (rails + centre), selon compact / invité / hub LONGIA.
 * Logique inchangée par rapport à l'historique dans `LiveHostPage.jsx`.
 */
export function computeHostLiveGridStyle({
  liveShellGap,
  lhNarrowDesktop,
  lhStageFocusLayout,
  longiaHubPushesLayout,
  lhLayoutCompact,
  liveLeftRailOpen,
  liveRightRailOpen,
  isGuestUi,
  longiaHubDrawerWidthPx,
}) {
  const g = `${liveShellGap}px`;
  /** Colonne signaux / hub embarqué. */
  const leftColWidth = lhNarrowDesktop ? 272 : 320;
  const rightColWidth = lhNarrowDesktop ? 320 : 350;
  const lc =
    lhStageFocusLayout || longiaHubPushesLayout
      ? 0
      : lhLayoutCompact
        ? 0
        : liveLeftRailOpen
          ? leftColWidth
          : LIVE_HOST_RAIL_COLLAPSED_PX;
  const rc =
    lhStageFocusLayout
      ? 0
      : lhLayoutCompact
        ? 0
        : liveRightRailOpen
          ? rightColWidth
          : LIVE_HOST_RAIL_COLLAPSED_PX;
  /** Invité mobile : SmartBoard puis colonne formateur+LONGIA */
  if (isGuestUi && lhLayoutCompact) {
    return {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr)',
      gridTemplateRows: 'minmax(0, 1fr) auto',
      gap: g,
      flex: 1,
      minHeight: 0,
      minWidth: 0,
      width: '100%',
      maxWidth: '100%',
      boxSizing: 'border-box',
    };
  }
  /** Invité desktop : 3 colonnes — info-session | SmartBoard | LONGIA (même grille que l'hôte) */
  if (isGuestUi) {
    return {
      display: 'grid',
      gridTemplateColumns: `${lc}px minmax(0, 1fr) ${rc}px`,
      gap: g,
      flex: 1,
      minHeight: 0,
      minWidth: 0,
      width: '100%',
      maxWidth: '100%',
      boxSizing: 'border-box',
      transition: 'grid-template-columns .25s ease',
    };
  }
  if (lhLayoutCompact) {
    return {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr)',
      gridTemplateRows: 'minmax(0, 1fr) auto auto',
      gap: g,
      flex: 1,
      minHeight: 0,
      minWidth: 0,
      width: '100%',
      maxWidth: '100%',
      boxSizing: 'border-box',
    };
  }
  if (longiaHubPushesLayout) {
    const hubTw =
      'margin-left .28s cubic-bezier(0.22, 1, 0.36, 1), width .28s cubic-bezier(0.22, 1, 0.36, 1), max-width .28s cubic-bezier(0.22, 1, 0.36, 1)';
    return {
      display: 'grid',
      gridTemplateColumns:
        rc > 0 ? `minmax(0, 1fr) ${rc}px` : 'minmax(0, 1fr)',
      gap: g,
      flex: 1,
      minHeight: 0,
      minWidth: 0,
      marginLeft: longiaHubDrawerWidthPx,
      width: `calc(100% - ${longiaHubDrawerWidthPx}px)`,
      maxWidth: `calc(100% - ${longiaHubDrawerWidthPx}px)`,
      boxSizing: 'border-box',
      transition: `grid-template-columns .25s ease, ${hubTw}`,
    };
  }
  return {
    display: 'grid',
    gridTemplateColumns: `${lc}px minmax(0, 1fr) ${rc}px`,
    gap: g,
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box',
    transition: 'grid-template-columns .25s ease',
  };
}
