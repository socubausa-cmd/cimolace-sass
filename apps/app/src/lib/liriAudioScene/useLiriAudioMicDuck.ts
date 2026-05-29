import { useEffect, useRef } from 'react'
import { liriAudioEngine } from './audio-engine'
import { sceneBus } from './scene-bus'

function isPlayingish() {
  const st = liriAudioEngine.getState().engineState
  return st === 'playing' || st === 'fading'
}

/**
 * Baisse automatiquement le gain des scènes quand le micro local est ouvert (prise de parole),
 * et restaure quand il est coupé. Re-duck après chaque `scene:changed` si le micro reste ouvert
 * (nouveau crossfade remonte le gain).
 */
export function useLiriAudioMicDuck(options: { micCapturing: boolean; enabled?: boolean }) {
  const { micCapturing, enabled = true } = options
  const prevMic = useRef<boolean | null>(null)

  useEffect(() => {
    if (!enabled) {
      liriAudioEngine.restoreSceneVolume()
      prevMic.current = micCapturing
      return
    }

    const prev = prevMic.current
    prevMic.current = micCapturing

    if (micCapturing) {
      const shouldDuck = prev === false || (prev === null && isPlayingish())
      if (shouldDuck && isPlayingish()) {
        liriAudioEngine.duckToSceneDefault()
      }
    } else if (prev === true) {
      liriAudioEngine.restoreSceneVolume()
    }
  }, [micCapturing, enabled])

  useEffect(() => {
    if (!enabled || !micCapturing) return undefined
    return sceneBus.subscribe((ev) => {
      if (ev.type !== 'scene:changed') return
      if (!isPlayingish()) return
      requestAnimationFrame(() => {
        liriAudioEngine.duckToSceneDefault(320)
      })
    })
  }, [enabled, micCapturing])

  useEffect(() => {
    return () => {
      liriAudioEngine.restoreSceneVolume(200)
    }
  }, [])
}
