import { useCallback } from 'react';
import { useLiriAudioSmartboardSync } from '@/lib/liriAudioScene';
import { PHASE } from '@/features/live/host/liveHostConstants';

/**
 * Synchronise les événements LIRI Audio avec le SmartBoard hôte :
 * navigue vers la diapositive correspondante ou diffuse le payload audio.
 */
export function useLiveHostLiriAudioSync({
  isGuestUi,
  phase,
  liriAudioScenes,
  liveScenes,
  gotoStep,
  sendSmartboardHostPayload,
}) {
  useLiriAudioSmartboardSync(
    useCallback(
      (payload, event) => {
        if (isGuestUi) return;
        if (phase !== PHASE.LIVE || !payload) return;
        const liriBroadcast = {
          liriAudioSmartboard: payload,
          liriAudioSceneId: event.sceneId,
          liriAudioSceneName: event.sceneName,
        };
        let slideIdx = null;
        const audioScene = event.sceneId
          ? liriAudioScenes.find((s) => s.id === event.sceneId)
          : null;
        if (audioScene?.smartboardSceneId && liveScenes.length > 0) {
          const j = liveScenes.findIndex(
            (sl) => String(sl?.id) === String(audioScene.smartboardSceneId),
          );
          if (j >= 0) slideIdx = j;
        }
        if (slideIdx == null && payload.type === 'slide') {
          const m = payload.meta && typeof payload.meta === 'object' ? payload.meta : null;
          const raw = m?.slideIndex ?? m?.stepIndex ?? m?.index;
          const n = Number(raw);
          if (Number.isFinite(n)) slideIdx = Math.max(0, Math.floor(n));
        }
        if (slideIdx != null) {
          gotoStep(slideIdx, liriBroadcast);
        } else {
          sendSmartboardHostPayload(liriBroadcast);
        }
      },
      [phase, isGuestUi, liriAudioScenes, liveScenes, gotoStep, sendSmartboardHostPayload],
    ),
  );
}
