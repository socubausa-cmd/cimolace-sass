/**
 * Types — LIRI Audio Scene Engine (scènes rituel / cours / culte immersif).
 */

export type SmartboardPayload = {
  type: 'text' | 'image' | 'slide' | 'video' | 'prayer' | 'custom'
  content?: string
  url?: string
  meta?: Record<string, unknown>
}

export type LiriAudioEngineState =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'fading'
  | 'paused'
  | 'stopped'
  | 'error'

export type AudioScene = {
  id: string
  name: string
  /** Lien optionnel vers `smartboard_element_scenes[].id` (wizard live) */
  smartboardSceneId?: string
  audioUrl?: string
  /** 0–1, appliqué au gain de scène (avant master) */
  volume?: number
  loop?: boolean
  fadeInMs?: number
  fadeOutMs?: number
  /** Cible de ducking manuel (0–1), ou niveau conseillé */
  ducking?: number
  autoAdvance?: boolean
  /** Durée avant auto scène suivante (si autoAdvance) */
  durationMs?: number
  smartboardPayload?: SmartboardPayload
}

export type AudioSceneEvent = {
  type:
    | 'scene:loading'
    | 'scene:started'
    | 'scene:ended'
    | 'scene:changed'
    | 'scene:error'
    | 'scene:paused'
    | 'scene:resumed'
    | 'scene:autoAdvance'
  sceneId?: string
  sceneName?: string
  payload?: SmartboardPayload
  timestamp: number
  details?: Record<string, unknown> & {
    audioState?: LiriAudioEngineState
    message?: string
  }
}
