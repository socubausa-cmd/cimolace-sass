import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { liriAudioEngine } from './audio-engine'
import { sceneBus } from './scene-bus'
import type { AudioScene, AudioSceneEvent } from './scene-types'

export type UseSceneAudioOptions = {
  /** Appliqué une fois au chargement des scènes (ex. reprise depuis `config.liri_audio_state`). */
  initialIndex?: number
  /** Invalide la reprise d'index quand la session change (ex. `sessionId`). */
  sessionKey?: string | null
  /** Notifié à chaque changement d'index (navigation / lecture). */
  onIndexChange?: (index: number) => void
}

export function useSceneAudio(scenes: AudioScene[], options?: UseSceneAudioOptions) {
  const [index, setIndex] = useState(0)
  const [event, setEvent] = useState<AudioSceneEvent | null>(null)
  const [engineState, setEngineState] = useState(() => liriAudioEngine.getState().engineState)

  const sessionKeyRef = useRef<string | null>(null)
  const onIndexChangeRef = useRef(options?.onIndexChange)
  onIndexChangeRef.current = options?.onIndexChange

  const scenesRef = useRef(scenes)
  scenesRef.current = scenes

  useEffect(() => {
    const k = options?.sessionKey ?? null
    if (sessionKeyRef.current === k) return
    sessionKeyRef.current = k
    setIndex(0)
  }, [options?.sessionKey])

  useEffect(() => {
    if (scenes.length === 0) return
    if (options?.initialIndex == null) return
    const i = Math.min(Math.max(0, options.initialIndex), scenes.length - 1)
    setIndex(i)
  }, [scenes.length, options?.initialIndex])

  const currentScene = scenes[index] ?? null
  const nextScene = scenes[index + 1] ?? null
  const prevScene = index > 0 ? scenes[index - 1] ?? null : null

  useEffect(() => {
    return sceneBus.subscribe((ev) => {
      setEvent(ev)
      setEngineState(liriAudioEngine.getState().engineState)
    })
  }, [])

  useEffect(() => {
    onIndexChangeRef.current?.(index)
  }, [index])

  /** Précharge scène suivante (+ optionnellement la précédente pour retour rapide). */
  useEffect(() => {
    if (nextScene) {
      void liriAudioEngine.preloadScene(nextScene).catch(() => {})
    }
    if (prevScene) {
      void liriAudioEngine.preloadScene(prevScene).catch(() => {})
    }
  }, [nextScene, prevScene])

  /** Auto-advance après `durationMs` si `autoAdvance` sur la scène démarrée. */
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const unsub = sceneBus.subscribe((ev) => {
      if (ev.type !== 'scene:started' || !ev.sceneId) return
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      const sc = scenesRef.current.find((s) => s.id === ev.sceneId)
      if (!sc?.autoAdvance || !sc.durationMs || sc.durationMs <= 0) return
      timer = setTimeout(() => {
        sceneBus.emit({
          type: 'scene:autoAdvance',
          sceneId: sc.id,
          sceneName: sc.name,
          payload: sc.smartboardPayload,
          timestamp: Date.now(),
        })
      }, sc.durationMs)
    })
    return () => {
      unsub()
      if (timer) clearTimeout(timer)
    }
  }, [])

  const playAtIndex = useCallback(async (i: number) => {
    const list = scenesRef.current
    if (i < 0 || i >= list.length) return
    setIndex(i)
    const scene = list[i]
    await liriAudioEngine.playScene(scene)
  }, [])

  useEffect(() => {
    return sceneBus.subscribe((ev) => {
      if (ev.type !== 'scene:autoAdvance' || !ev.sceneId) return
      const list = scenesRef.current
      const i = list.findIndex((s) => s.id === ev.sceneId)
      if (i < 0 || i >= list.length - 1) return
      void playAtIndex(i + 1)
    })
  }, [playAtIndex])

  const playCurrent = useCallback(async () => {
    const scene = scenesRef.current[index]
    if (scene) await liriAudioEngine.playScene(scene)
  }, [index])

  const next = useCallback(async () => {
    const list = scenesRef.current
    const newIndex = Math.min(index + 1, list.length - 1)
    if (newIndex === index && list.length > 0) return
    await playAtIndex(newIndex)
  }, [index, playAtIndex])

  const previous = useCallback(async () => {
    const newIndex = Math.max(index - 1, 0)
    if (newIndex === index) return
    await playAtIndex(newIndex)
  }, [index, playAtIndex])

  const pause = useCallback(() => {
    liriAudioEngine.pause()
  }, [])

  const resume = useCallback(() => {
    void liriAudioEngine.resume()
  }, [])

  const stop = useCallback(() => {
    liriAudioEngine.stop()
  }, [])

  const duck = useCallback(() => {
    const d = scenesRef.current[index]?.ducking
    liriAudioEngine.duckTo(d !== undefined ? d : 0.25)
  }, [index])

  const restore = useCallback(() => {
    liriAudioEngine.restoreSceneVolume()
  }, [])

  const setMasterVolume = useCallback((volume: number) => {
    liriAudioEngine.setMasterVolume(volume)
  }, [])

  const setScenePlaybackFactor = useCallback((factor: number) => {
    liriAudioEngine.setScenePlaybackFactor(factor)
  }, [])

  return useMemo(
    () => ({
      currentScene,
      nextScene,
      prevScene,
      event,
      index,
      setIndex,
      playAtIndex,
      playCurrent,
      next,
      previous,
      pause,
      resume,
      stop,
      duck,
      restore,
      setMasterVolume,
      setScenePlaybackFactor,
      engineState,
    }),
    [
      currentScene,
      nextScene,
      prevScene,
      event,
      index,
      engineState,
      playAtIndex,
      playCurrent,
      next,
      previous,
      pause,
      resume,
      stop,
      duck,
      restore,
      setMasterVolume,
      setScenePlaybackFactor,
    ],
  )
}
