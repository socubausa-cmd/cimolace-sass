import { useMemo } from 'react';
import { getMockSlidesNormalized, shouldMergeLiriHostMocks } from '@/lib/liriHostUiMocks';
import { normalizeLiveSceneToSlide } from '@/lib/liveSceneNormalize';

/**
 * Valeurs dérivées pour le compositor mobile (aperçu maquette) :
 * diapositives normalisées, participants flux caméra 2, et affichage des cadres.
 */
export function useLiveHostMaquetteDisplay({
  liveParticipants,
  promotedId,
  step,
  liveScenes,
  liveKitMediaEpoch,
  roomRef,
  userFullName,
}) {
  const liriBoardMocks = shouldMergeLiriHostMocks(true, liveScenes.length);

  const displaySlidesHost = useMemo(() => {
    const normalized = (liveScenes || []).map((s) => normalizeLiveSceneToSlide(s)).filter(Boolean);
    if (normalized.length > 0) return normalized;
    if (liriBoardMocks) return getMockSlidesNormalized();
    return [];
  }, [liveScenes, liriBoardMocks]);

  const lhMaquetteLocalRow = useMemo(
    () => liveParticipants.find((p) => p.isLocal) || null,
    [liveParticipants],
  );

  const lhMaquetteIncomingRow = useMemo(() => {
    const byPromo = liveParticipants.find(
      (p) => String(p.id) === String(promotedId) && !p.isLocal,
    );
    if (byPromo) return byPromo;
    return liveParticipants.find((p) => !p.isLocal) || null;
  }, [liveParticipants, promotedId]);

  const lhMaquetteMainDisplay = useMemo(
    () => (lhMaquetteIncomingRow
      ? {
          name: lhMaquetteIncomingRow.name,
          panelLabel: lhMaquetteIncomingRow.isHost ? 'Hôte' : 'Flux entrant',
          panelSubtitle: String(lhMaquetteIncomingRow.id),
        }
      : {
          name: 'Salle',
          panelLabel: 'Flux entrant',
          panelSubtitle: 'En attente de participants',
        }),
    [lhMaquetteIncomingRow],
  );

  const lhMaquetteMiniDisplay = useMemo(
    () => (lhMaquetteLocalRow
      ? {
          name: lhMaquetteLocalRow.name,
          panelLabel: 'Vous',
          panelSubtitle: String(lhMaquetteLocalRow.id),
        }
      : null),
    [lhMaquetteLocalRow],
  );

  const lhMaquetteRemoteWaiting = !liveParticipants.some((p) => !p.isLocal);

  const lhMaquetteCompositorSlide = useMemo(() => {
    if (!displaySlidesHost.length) return null;
    const i = Math.min(Math.max(0, step), displaySlidesHost.length - 1);
    return displaySlidesHost[i] || null;
  }, [displaySlidesHost, step]);

  const camera2FluxParticipants = useMemo(() => {
    const room = roomRef.current;
    if (!room?.localParticipant) return [];
    const list = [{
      id: room.localParticipant.identity,
      name: room.localParticipant.name || userFullName || 'Hôte',
      isLocal: true,
    }];
    room.remoteParticipants.forEach((p) => {
      list.push({
        id: p.identity,
        name: p.name || p.identity,
        isLocal: false,
      });
    });
    return list;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveParticipants, liveKitMediaEpoch, userFullName]);

  return {
    displaySlidesHost,
    lhMaquetteLocalRow,
    lhMaquetteIncomingRow,
    lhMaquetteMainDisplay,
    lhMaquetteMiniDisplay,
    lhMaquetteRemoteWaiting,
    lhMaquetteCompositorSlide,
    camera2FluxParticipants,
  };
}
