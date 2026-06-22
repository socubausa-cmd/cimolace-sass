import { PHASE } from '@/features/live/host/liveHostConstants';

/**
 * Le Hub LONGIA s'ouvre désormais en FENÊTRE FLOTTANTE par-dessus la scène
 * (cf. LiveHostLongiaHubDrawer) — il ne réserve plus de bande dans la grille.
 * Conséquence : la grille ne se réorganise JAMAIS à l'ouverture du hub → fini la
 * superposition / le « SmartBoard poussé » au clic sur IA. On renvoie donc toujours
 * `false` (l'argument est conservé pour ne pas casser les appelants).
 */
export function computeLongiaHubPushesLayout() {
  return false;
}

/**
 * Même maquette LIRI que l'Arène (LiriMobileMaquetteLayout) : compact + pas projecteur
 * + pas focus ⊞, et le hub ne réserve pas la bande (sinon on garde la grille 3 zones).
 */
export function computeHostLiriMobileHostBranch({
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
}) {
  return (
    phase === PHASE.LIVE
    && !isGuestUi
    && lhLayoutCompact
    && !previewProjectorLayout
    && !lhStageFocusLayout
    && !longiaHubPushesLayout
    && !arenaHostCameraCenter
    && !arenaGuestFocusCenter
    && !arenaPanelCenter
    && !arenaMembersWallCenter
  );
}

/** Desktop : panneau replié en bandeau à icônes (pas masqué à 0 px). */
export function computeLiveRailCollapsedStripFlags({
  phase,
  isGuestUi,
  lhStageFocusLayout,
  longiaHubPushesLayout,
  lhLayoutCompact,
  liveLeftRailOpen,
  liveRightRailOpen,
}) {
  const liveLeftRailCollapsedStrip =
    phase === PHASE.LIVE
    && !isGuestUi
    && !lhStageFocusLayout
    && !longiaHubPushesLayout
    && !lhLayoutCompact
    && !liveLeftRailOpen;
  const liveRightRailCollapsedStrip =
    phase === PHASE.LIVE
    && !isGuestUi
    && !lhStageFocusLayout
    && !lhLayoutCompact
    && !liveRightRailOpen;
  const liveLeftGuestCollapsedStrip =
    isGuestUi && phase === PHASE.LIVE && !lhStageFocusLayout && !lhLayoutCompact && !liveLeftRailOpen;
  const liveRightGuestCollapsedStrip =
    isGuestUi && phase === PHASE.LIVE && !lhStageFocusLayout && !lhLayoutCompact && !liveRightRailOpen;
  return {
    liveLeftRailCollapsedStrip,
    liveRightRailCollapsedStrip,
    liveLeftGuestCollapsedStrip,
    liveRightGuestCollapsedStrip,
  };
}

export function computeHostCompactColOrder({ lhStageFocusLayout, lhLayoutCompact }) {
  if (lhStageFocusLayout || !lhLayoutCompact) return { left: 0, center: 0, right: 0 };
  return { left: 2, center: 1, right: 3 };
}
