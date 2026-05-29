import { useCallback, useEffect } from 'react';
import { PHASE } from '@/features/live/host/liveHostConstants';
import { LIRI_LIVE_LONGIA_HUB_EXPAND_EVENT } from '@/components/live-room/LiveHostLongiaHubDrawer';
import { LIRI_HOST_EXPAND_NOTIFICATIONS_EVENT } from '@/lib/longiaLiveCopilot';

/**
 * Navigation hub LONGIA : listeners d'expansion et callbacks d'ouverture des sous-vues
 * (Signaux, Control Mesh, Coach, aperçu layout, salle d'attente).
 */
export function useLiveHostLongiaHubNav({
  phase,
  isGuestUi,
  lhLayoutCompact,
  setLongiaHubOpen,
  setLongiaSignalSubDrawer,
  setMeshPanelOpen,
  setLiveLeftRailOpen,
}) {
  useEffect(() => {
    if (phase !== PHASE.LIVE || isGuestUi) return undefined;
    const onExpand = () => {
      setLongiaHubOpen(true);
      setLongiaSignalSubDrawer('journal');
      if (typeof window !== 'undefined') {
        window.setTimeout(() => {
          window.dispatchEvent(new CustomEvent(LIRI_LIVE_LONGIA_HUB_EXPAND_EVENT));
        }, 0);
      }
    };
    window.addEventListener(LIRI_HOST_EXPAND_NOTIFICATIONS_EVENT, onExpand);
    return () => window.removeEventListener(LIRI_HOST_EXPAND_NOTIFICATIONS_EVENT, onExpand);
  }, [phase, isGuestUi, setLongiaHubOpen, setLongiaSignalSubDrawer]);

  const expandLongiaHubUi = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent(LIRI_LIVE_LONGIA_HUB_EXPAND_EVENT));
    }, 0);
  }, []);

  const openLongiaHubSignauxHome = useCallback(() => {
    setLongiaHubOpen(true);
    setLongiaSignalSubDrawer(null);
    setMeshPanelOpen(false);
    if (lhLayoutCompact) setLiveLeftRailOpen(true);
    expandLongiaHubUi();
  }, [expandLongiaHubUi, lhLayoutCompact, setLongiaHubOpen, setLongiaSignalSubDrawer, setMeshPanelOpen, setLiveLeftRailOpen]);

  const openLongiaHubControlMesh = useCallback(() => {
    setLongiaHubOpen(true);
    setLongiaSignalSubDrawer('mesh');
    setMeshPanelOpen(true);
    if (lhLayoutCompact) setLiveLeftRailOpen(true);
    expandLongiaHubUi();
  }, [expandLongiaHubUi, lhLayoutCompact, setLongiaHubOpen, setLongiaSignalSubDrawer, setMeshPanelOpen, setLiveLeftRailOpen]);

  const openLongiaHubCoachPanel = useCallback(() => {
    setLongiaHubOpen(true);
    setMeshPanelOpen(false);
    setLongiaSignalSubDrawer('host_coach');
    if (lhLayoutCompact) setLiveLeftRailOpen(true);
    expandLongiaHubUi();
  }, [expandLongiaHubUi, lhLayoutCompact, setLongiaHubOpen, setLongiaSignalSubDrawer, setMeshPanelOpen, setLiveLeftRailOpen]);

  const openLayoutPreviewInHub = useCallback(() => {
    setLongiaHubOpen(true);
    setLongiaSignalSubDrawer('layout_preview');
    if (lhLayoutCompact) setLiveLeftRailOpen(true);
    expandLongiaHubUi();
  }, [expandLongiaHubUi, lhLayoutCompact, setLongiaHubOpen, setLongiaSignalSubDrawer, setLiveLeftRailOpen]);

  const toggleLayoutPreviewHubPanel = useCallback(() => {
    setLongiaHubOpen(true);
    setLongiaSignalSubDrawer((p) => (p === 'layout_preview' ? null : 'layout_preview'));
    if (lhLayoutCompact) setLiveLeftRailOpen(true);
    expandLongiaHubUi();
  }, [expandLongiaHubUi, lhLayoutCompact, setLongiaHubOpen, setLongiaSignalSubDrawer, setLiveLeftRailOpen]);

  const openLongiaHubWaitingRoom = useCallback(() => {
    setLongiaHubOpen(true);
    setLongiaSignalSubDrawer('waiting');
    setMeshPanelOpen(false);
    if (lhLayoutCompact) setLiveLeftRailOpen(true);
    expandLongiaHubUi();
  }, [expandLongiaHubUi, lhLayoutCompact, setLongiaHubOpen, setLongiaSignalSubDrawer, setMeshPanelOpen, setLiveLeftRailOpen]);

  return {
    expandLongiaHubUi,
    openLongiaHubSignauxHome,
    openLongiaHubControlMesh,
    openLongiaHubCoachPanel,
    openLayoutPreviewInHub,
    toggleLayoutPreviewHubPanel,
    openLongiaHubWaitingRoom,
  };
}
