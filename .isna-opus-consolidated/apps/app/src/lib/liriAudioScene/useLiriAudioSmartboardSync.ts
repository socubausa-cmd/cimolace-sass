import { useEffect } from 'react'
import { sceneBus } from './scene-bus'
import type { AudioSceneEvent, SmartboardPayload } from './scene-types'

/**
 * Phase 2 — applique le contenu SmartBoard quand une scène audio démarre ou change.
 * Brancher `onApply` sur setState diapo / overlay / texte liturgique, etc.
 */
export function useLiriAudioSmartboardSync(
  onApply: (payload: SmartboardPayload | undefined, event: AudioSceneEvent) => void,
) {
  useEffect(() => {
    return sceneBus.subscribe((ev) => {
      if (
        (ev.type === 'scene:started' || ev.type === 'scene:changed') &&
        ev.payload !== undefined
      ) {
        onApply(ev.payload, ev)
      }
    })
  }, [onApply])
}
