import { useMemo } from 'react';
import { computeHostLiveGridStyle } from '@/features/live/host/liveHostLiveGridLayoutStyle';
import {
  computeHostCompactColOrder,
  computeHostLiriMobileHostBranch,
  computeLiveRailCollapsedStripFlags,
} from '@/features/live/host/liveHostLiveLayoutFlags';
import { LONGIA_HOST_HUB_DRAWER_W_PX } from '@/features/live/host/liveHostConstants';

/**
 * Valeurs dérivées de la grille live : branche maquette mobile, flags rails repliés,
 * style CSS grille et ordre colonnes compact.
 */
export function useLiveHostLiveGridLayout({
  phase,
  isGuestUi,
  lhLayoutCompact,
  previewProjectorLayout,
  lhStageFocusLayout,
  longiaHubPushesLayout,
  arenaHostCameraCenter,
  arenaGuestFocusCenter,
  arenaPanelCenter,
  arenaMembersWallCenter,
  liveLeftRailOpen,
  liveRightRailOpen,
  lhNarrowDesktop,
  liveShellGap,
  longiaHubDrawerWidthPx,
}) {
  const hostLiriMobileHostBranch = useMemo(
    () =>
      computeHostLiriMobileHostBranch({
        phase,
        isGuestUi,
        lhLayoutCompact,
        previewProjectorLayout,
        lhStageFocusLayout,
        longiaHubPushesLayout,
        arenaHostCameraCenter,
        arenaGuestFocusCenter,
        arenaPanelCenter,
        arenaMembersWallCenter,
      }),
    [
      phase,
      isGuestUi,
      lhLayoutCompact,
      previewProjectorLayout,
      lhStageFocusLayout,
      longiaHubPushesLayout,
      arenaHostCameraCenter,
      arenaGuestFocusCenter,
      arenaPanelCenter,
      arenaMembersWallCenter,
    ],
  );

  const {
    liveLeftRailCollapsedStrip,
    liveRightRailCollapsedStrip,
    liveLeftGuestCollapsedStrip,
    liveRightGuestCollapsedStrip,
  } = computeLiveRailCollapsedStripFlags({
    phase,
    isGuestUi,
    lhStageFocusLayout,
    longiaHubPushesLayout,
    lhLayoutCompact,
    liveLeftRailOpen,
    liveRightRailOpen,
  });

  const drawerWidthPx = longiaHubDrawerWidthPx ?? LONGIA_HOST_HUB_DRAWER_W_PX;

  const hostLiveGridStyle = useMemo(
    () =>
      computeHostLiveGridStyle({
        liveShellGap,
        lhNarrowDesktop,
        lhStageFocusLayout,
        longiaHubPushesLayout,
        lhLayoutCompact,
        liveLeftRailOpen,
        liveRightRailOpen,
        isGuestUi,
        longiaHubDrawerWidthPx: drawerWidthPx,
      }),
    [
      liveLeftRailOpen,
      liveRightRailOpen,
      lhStageFocusLayout,
      lhLayoutCompact,
      isGuestUi,
      liveShellGap,
      lhNarrowDesktop,
      longiaHubPushesLayout,
      drawerWidthPx,
      phase,
    ],
  );

  const hostCompactColOrder = useMemo(
    () => computeHostCompactColOrder({ lhStageFocusLayout, lhLayoutCompact }),
    [lhStageFocusLayout, lhLayoutCompact],
  );

  return {
    hostLiriMobileHostBranch,
    liveLeftRailCollapsedStrip,
    liveRightRailCollapsedStrip,
    liveLeftGuestCollapsedStrip,
    liveRightGuestCollapsedStrip,
    hostLiveGridStyle,
    hostCompactColOrder,
  };
}
