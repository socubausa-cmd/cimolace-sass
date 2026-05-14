import { useEffect, useRef } from 'react';
import { PHASE } from '@/features/live/host/liveHostConstants';
import { nt } from '@/features/live/host/liveHostUtils';
import { playLiriHostEventChime } from '@/lib/liriHostEventChime';

/**
 * Fil notifications antenne hôte : détecte les changements de promotedId et
 * publie un événement panel + chime (aligné LiveArenaPage).
 */
export function useLiveHostAntennaFeed({
  isGuestUi,
  phase,
  promotedId,
  liveParticipants,
  setPanels,
  arenaHostAlertSoundRef,
  hostSfxCtxRef,
}) {
  const prevLhPromotedRef = useRef(null);
  const lhPromoteFeedBootRef = useRef(false);

  useEffect(() => {
    if (isGuestUi || phase !== PHASE.LIVE) return;
    const cur = promotedId;
    const prev = prevLhPromotedRef.current;
    if (!lhPromoteFeedBootRef.current) {
      lhPromoteFeedBootRef.current = true;
      prevLhPromotedRef.current = cur;
      return;
    }
    if (String(prev ?? '') !== String(cur ?? '')) {
      if (cur != null) {
        const p = liveParticipants.find((x) => String(x.id) === String(cur));
        const name = p?.name || 'Un membre';
        setPanels((pan) => pan.map((panel, i) => (i === 2 ? {
          ...panel,
          events: [...panel.events, { avatar: name, msg: `${name} est à l'antenne`, type: 'promote', time: nt() }],
        } : panel)));
        if (arenaHostAlertSoundRef.current) playLiriHostEventChime(hostSfxCtxRef.current, 'promote');
      } else {
        setPanels((pan) => pan.map((panel, i) => (i === 2 ? {
          ...panel,
          events: [...panel.events, { avatar: 'Antenne', msg: "L'antenne est libérée", type: 'info', time: nt() }],
        } : panel)));
        if (arenaHostAlertSoundRef.current) playLiriHostEventChime(hostSfxCtxRef.current, 'default');
      }
    }
    prevLhPromotedRef.current = cur;
  }, [isGuestUi, phase, promotedId, liveParticipants, setPanels, arenaHostAlertSoundRef, hostSfxCtxRef]);
}
