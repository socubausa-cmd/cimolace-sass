import { useCallback, useEffect } from 'react';
import { PHASE } from '@/features/live/host/liveHostConstants';
import { LIRI_LIVE_LONGIA_HUB_EXPAND_EVENT } from '@/components/liri/live-room/LiveHostLongiaHubDrawer';
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
  /** URL vue participant — l'aperçu s'ouvre dans un nouvel onglet (plus de panneau embarqué). */
  guestPreviewUrl,
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

  // Control Mesh MASQUÉ (aperçu produit non branché + roster « Sur scène » redondant avec la
  // barre membres et « Salle »). Ce lanceur ouvre désormais l'ACCUEIL Signaux du hub (salle
  // d'attente, Zone 3, NeuronQ, journal…) au lieu du sous-tiroir mesh. Le sous-tiroir reste
  // dormant dans le code (réactivable quand le Transfer Engine sera branché).
  const openLongiaHubControlMesh = useCallback(() => {
    setLongiaHubOpen(true);
    setLongiaSignalSubDrawer(null);
    setMeshPanelOpen(false);
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

  // Aperçu des vues = ouvrir la VUE PARTICIPANT dans un NOUVEL ONGLET — ça ne sature plus le hub
  // avec un panneau embarqué. Les deux entrées (œil du hub + raccourci scène) déclenchent ceci.
  const openGuestPreviewTab = useCallback(() => {
    if (!guestPreviewUrl || typeof window === 'undefined') return;
    try {
      window.open(guestPreviewUrl, '_blank', 'noopener,noreferrer');
    } catch {
      /* popup bloquée — ignore */
    }
  }, [guestPreviewUrl]);

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
    openLayoutPreviewInHub: openGuestPreviewTab,
    toggleLayoutPreviewHubPanel: openGuestPreviewTab,
    openLongiaHubWaitingRoom,
  };
}
