import type { AudioScene } from './scene-types'

export type LiriAudioConfigSlice = {
  liri_audio_enabled: boolean
  liri_audio_scenes: AudioScene[]
}

/**
 * Tranche `config` à fusionner dans `live_sessions.config` (wizard + préparation prod).
 */
export function buildLiriAudioConfigPatch(enabled: boolean, scenes: AudioScene[]): LiriAudioConfigSlice {
  if (!enabled) {
    return { liri_audio_enabled: false, liri_audio_scenes: [] }
  }
  const liri_audio_scenes = (Array.isArray(scenes) ? scenes : [])
    .filter((s) => s && typeof s === 'object' && String(s.name || '').trim())
    .map((s) => {
      const id = String(s.id || '').trim() || `liri_${Math.random().toString(36).slice(2, 10)}`
      const name = String(s.name).trim()
      const row: AudioScene = {
        id,
        name,
        volume: typeof s.volume === 'number' && Number.isFinite(s.volume) ? s.volume : 0.35,
        loop: s.loop !== false,
      }
      if (typeof s.audioUrl === 'string' && s.audioUrl.trim()) row.audioUrl = s.audioUrl.trim()
      if (typeof s.smartboardSceneId === 'string') {
        const sid = s.smartboardSceneId.trim()
        if (sid) row.smartboardSceneId = sid
      }
      if (typeof s.fadeInMs === 'number' && Number.isFinite(s.fadeInMs)) row.fadeInMs = s.fadeInMs
      if (typeof s.fadeOutMs === 'number' && Number.isFinite(s.fadeOutMs)) row.fadeOutMs = s.fadeOutMs
      if (s.smartboardPayload && typeof s.smartboardPayload === 'object') row.smartboardPayload = s.smartboardPayload
      if (typeof s.ducking === 'number' && Number.isFinite(s.ducking)) row.ducking = s.ducking
      if (s.autoAdvance === true && typeof s.durationMs === 'number') {
        row.autoAdvance = true
        row.durationMs = s.durationMs
      }
      return row
    })
  return { liri_audio_enabled: true, liri_audio_scenes }
}
