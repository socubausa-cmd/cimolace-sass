import type { AudioScene, SmartboardPayload } from './scene-types'

const PAYLOAD_TYPES = new Set(['text', 'image', 'slide', 'video', 'prayer', 'custom'])

function normalizePayload(raw: unknown): SmartboardPayload | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const type = typeof o.type === 'string' && PAYLOAD_TYPES.has(o.type) ? o.type : undefined
  if (!type) return undefined
  const content = typeof o.content === 'string' ? o.content : undefined
  const url = typeof o.url === 'string' ? o.url : undefined
  const meta = o.meta && typeof o.meta === 'object' ? (o.meta as Record<string, unknown>) : undefined
  return { type, content, url, meta }
}

/**
 * Valide `live_sessions.config.liri_audio_scenes` (JSON) → liste de scènes moteur.
 * Champs optionnels ignorés s'ils sont mal typés.
 */
export function normalizeLiriAudioScenes(raw: unknown): AudioScene[] {
  if (!Array.isArray(raw)) return []
  const out: AudioScene[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : null
    if (!id) continue
    const name = typeof o.name === 'string' && o.name.trim() ? o.name.trim() : id
    const smartboardSceneId =
      typeof o.smartboardSceneId === 'string' && o.smartboardSceneId.trim()
        ? o.smartboardSceneId.trim()
        : undefined
    const scene: AudioScene = {
      id,
      name,
      ...(smartboardSceneId ? { smartboardSceneId } : {}),
      audioUrl: typeof o.audioUrl === 'string' ? o.audioUrl : undefined,
      volume: typeof o.volume === 'number' && Number.isFinite(o.volume) ? o.volume : undefined,
      loop: typeof o.loop === 'boolean' ? o.loop : undefined,
      fadeInMs: typeof o.fadeInMs === 'number' && Number.isFinite(o.fadeInMs) ? o.fadeInMs : undefined,
      fadeOutMs: typeof o.fadeOutMs === 'number' && Number.isFinite(o.fadeOutMs) ? o.fadeOutMs : undefined,
      ducking: typeof o.ducking === 'number' && Number.isFinite(o.ducking) ? o.ducking : undefined,
      autoAdvance: typeof o.autoAdvance === 'boolean' ? o.autoAdvance : undefined,
      durationMs: typeof o.durationMs === 'number' && Number.isFinite(o.durationMs) ? o.durationMs : undefined,
      smartboardPayload: normalizePayload(o.smartboardPayload),
    }
    out.push(scene)
  }
  return out
}
