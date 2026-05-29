import { sceneBus } from './scene-bus'
import type { AudioScene, LiriAudioEngineState } from './scene-types'

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}

async function fetchArrayBuffer(url: string, signal?: AbortSignal) {
  const res = await fetch(url, { signal, mode: 'cors' })
  if (!res.ok) throw new Error(`Audio fetch failed: ${res.status}`)
  return res.arrayBuffer()
}

const MAX_CACHE_ENTRIES = 24

type ActiveNodes = {
  source: AudioBufferSourceNode
  gain: GainNode
  stopAt: number
}

export class LiriAudioEngine {
  private ctx: AudioContext
  private masterGain: GainNode
  private currentNodes: ActiveNodes | null = null
  private previousNodes: ActiveNodes | null = null
  private currentScene: AudioScene | null = null
  private nextBufferCache = new Map<string, AudioBuffer>()
  private startedAt = 0
  private pausedAt = 0
  private isPaused = false
  private currentBuffer: AudioBuffer | null = null
  private engineState: LiriAudioEngineState = 'idle'
  private loadAbort: AbortController | null = null

  constructor() {
    this.ctx = new AudioContext()
    this.masterGain = this.ctx.createGain()
    this.masterGain.gain.value = 1
    this.masterGain.connect(this.ctx.destination)
  }

  private setState(s: LiriAudioEngineState) {
    this.engineState = s
  }

  async resumeContext() {
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume()
    }
  }

  setMasterVolume(volume: number) {
    const now = this.ctx.currentTime
    this.masterGain.gain.cancelScheduledValues(now)
    this.masterGain.gain.setValueAtTime(clamp(volume), now)
  }

  private trimCache() {
    while (this.nextBufferCache.size > MAX_CACHE_ENTRIES) {
      const first = this.nextBufferCache.keys().next().value
      if (first === undefined) break
      this.nextBufferCache.delete(first)
    }
  }

  async preloadScene(scene: AudioScene) {
    if (!scene.audioUrl) return
    if (this.nextBufferCache.has(scene.audioUrl)) return
    try {
      const arrayBuffer = await fetchArrayBuffer(scene.audioUrl)
      const copy = arrayBuffer.slice(0)
      const decoded = await this.ctx.decodeAudioData(copy)
      this.nextBufferCache.set(scene.audioUrl, decoded)
      this.trimCache()
    } catch (e) {
      console.warn('[LiriAudioEngine] preload failed', scene.audioUrl, e)
    }
  }

  private async getBuffer(scene: AudioScene, signal?: AbortSignal) {
    if (!scene.audioUrl) return null
    const cached = this.nextBufferCache.get(scene.audioUrl)
    if (cached) return cached
    const arrayBuffer = await fetchArrayBuffer(scene.audioUrl, signal)
    const decoded = await this.ctx.decodeAudioData(arrayBuffer.slice(0))
    this.nextBufferCache.set(scene.audioUrl, decoded)
    this.trimCache()
    return decoded
  }

  private disconnectPreviousScheduled() {
    const prev = this.previousNodes
    if (!prev) return
    const t = this.ctx.currentTime
    if (t >= prev.stopAt - 0.02) {
      try {
        prev.source.disconnect()
        prev.gain.disconnect()
      } catch {
        /* ignore */
      }
      this.previousNodes = null
    }
  }

  private createSource(buffer: AudioBuffer, loop = false, volume = 1) {
    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    source.loop = loop

    const gain = this.ctx.createGain()
    gain.gain.value = clamp(volume)

    source.connect(gain)
    gain.connect(this.masterGain)

    return { source, gain }
  }

  async playScene(scene: AudioScene) {
    this.loadAbort?.abort()
    this.loadAbort = new AbortController()
    const signal = this.loadAbort.signal

    await this.resumeContext()
    this.disconnectPreviousScheduled()
    this.setState('loading')

    sceneBus.emit({
      type: 'scene:loading',
      sceneId: scene.id,
      sceneName: scene.name,
      payload: scene.smartboardPayload,
      timestamp: Date.now(),
      details: { audioState: 'loading' },
    })

    let buffer: AudioBuffer | null = null
    try {
      buffer = await this.getBuffer(scene, signal)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      this.setState('error')
      sceneBus.emit({
        type: 'scene:error',
        sceneId: scene.id,
        sceneName: scene.name,
        payload: scene.smartboardPayload,
        timestamp: Date.now(),
        details: { audioState: 'error', message },
      })
      return
    }

    if (signal.aborted) return

    if (!buffer) {
      this.stopInternal(false)
      this.currentScene = scene
      this.setState('stopped')
      sceneBus.emit({
        type: 'scene:changed',
        sceneId: scene.id,
        sceneName: scene.name,
        payload: scene.smartboardPayload,
        timestamp: Date.now(),
        details: { audioState: 'stopped', message: 'no_audio_url' },
      })
      return
    }

    const now = this.ctx.currentTime
    const targetVolume = clamp(scene.volume ?? 0.8)
    const fadeInSec = Math.max(0.05, (scene.fadeInMs ?? 1500) / 1000)
    const fadeOutSec = Math.max(0.05, (this.currentScene?.fadeOutMs ?? 1500) / 1000)

    const next = this.createSource(buffer, scene.loop ?? true, 0)
    this.setState('fading')

    next.gain.gain.cancelScheduledValues(now)
    next.gain.gain.setValueAtTime(0, now)
    next.gain.gain.linearRampToValueAtTime(targetVolume, now + fadeInSec)

    const old = this.currentNodes
    if (old) {
      old.gain.gain.cancelScheduledValues(now)
      old.gain.gain.setValueAtTime(old.gain.gain.value, now)
      old.gain.gain.linearRampToValueAtTime(0.0001, now + fadeOutSec)
      const stopAt = now + fadeOutSec + 0.08
      try {
        old.source.stop(stopAt)
      } catch {
        /* ignore */
      }
      this.previousNodes = { ...old, stopAt }
    }

    next.source.start(now)

    next.source.onended = () => {
      if (this.isPaused) return
      if (scene.loop) return
      sceneBus.emit({
        type: 'scene:ended',
        sceneId: scene.id,
        sceneName: scene.name,
        payload: scene.smartboardPayload,
        timestamp: Date.now(),
        details: { audioState: 'stopped' },
      })
    }

    this.currentNodes = { source: next.source, gain: next.gain, stopAt: Infinity }
    this.currentScene = scene
    this.currentBuffer = buffer
    this.startedAt = now
    this.pausedAt = 0
    this.isPaused = false
    this.setState('playing')

    sceneBus.emit({
      type: 'scene:started',
      sceneId: scene.id,
      sceneName: scene.name,
      payload: scene.smartboardPayload,
      timestamp: Date.now(),
      details: { audioState: 'playing' },
    })

    sceneBus.emit({
      type: 'scene:changed',
      sceneId: scene.id,
      sceneName: scene.name,
      payload: scene.smartboardPayload,
      timestamp: Date.now(),
      details: { audioState: 'playing' },
    })
  }

  pause() {
    if (!this.currentNodes?.source || !this.currentBuffer || this.isPaused) return
    const elapsed = this.ctx.currentTime - this.startedAt
    this.pausedAt = Math.max(0, elapsed)
    this.isPaused = true
    this.setState('paused')
    try {
      this.currentNodes.source.stop()
    } catch {
      /* ignore */
    }
    this.currentNodes = null
    sceneBus.emit({
      type: 'scene:paused',
      sceneId: this.currentScene?.id,
      sceneName: this.currentScene?.name,
      payload: this.currentScene?.smartboardPayload,
      timestamp: Date.now(),
      details: { audioState: 'paused' },
    })
  }

  async resume() {
    if (!this.currentScene || !this.currentBuffer || !this.isPaused) return
    await this.resumeContext()

    const vol = clamp(this.currentScene.volume ?? 0.8)
    const resumed = this.createSource(
      this.currentBuffer,
      this.currentScene.loop ?? true,
      vol,
    )

    const now = this.ctx.currentTime
    resumed.gain.gain.cancelScheduledValues(now)
    resumed.gain.gain.setValueAtTime(vol, now)

    resumed.source.start(0, this.pausedAt)
    this.currentNodes = { source: resumed.source, gain: resumed.gain, stopAt: Infinity }
    this.startedAt = this.ctx.currentTime - this.pausedAt
    this.isPaused = false
    this.setState('playing')

    resumed.source.onended = () => {
      if (this.isPaused) return
      if (this.currentScene?.loop) return
      sceneBus.emit({
        type: 'scene:ended',
        sceneId: this.currentScene?.id,
        sceneName: this.currentScene?.name,
        payload: this.currentScene?.smartboardPayload,
        timestamp: Date.now(),
        details: { audioState: 'stopped' },
      })
    }

    sceneBus.emit({
      type: 'scene:resumed',
      sceneId: this.currentScene.id,
      sceneName: this.currentScene.name,
      payload: this.currentScene.smartboardPayload,
      timestamp: Date.now(),
      details: { audioState: 'playing' },
    })
  }

  /**
   * Ducking : baisse le gain de la piste courante (ex. prise de parole).
   * `target` peut venir de `scene.ducking` ou défaut 0.25.
   */
  duckTo(targetVolume = 0.25, durationMs = 400) {
    if (!this.currentNodes?.gain) return
    const now = this.ctx.currentTime
    const t = clamp(targetVolume)
    this.currentNodes.gain.gain.cancelScheduledValues(now)
    this.currentNodes.gain.gain.setValueAtTime(this.currentNodes.gain.gain.value, now)
    this.currentNodes.gain.gain.linearRampToValueAtTime(t, now + durationMs / 1000)
  }

  /** Ducking selon `currentScene.ducking` (ou 0.25) — micro ouvert, même logique que le panneau. */
  duckToSceneDefault(durationMs = 400) {
    const d = this.currentScene?.ducking
    this.duckTo(d !== undefined ? d : 0.25, durationMs)
  }

  restoreSceneVolume(durationMs = 400) {
    if (!this.currentNodes?.gain || !this.currentScene) return
    const now = this.ctx.currentTime
    const target = clamp(this.currentScene.volume ?? 0.8)
    this.currentNodes.gain.gain.cancelScheduledValues(now)
    this.currentNodes.gain.gain.setValueAtTime(this.currentNodes.gain.gain.value, now)
    this.currentNodes.gain.gain.linearRampToValueAtTime(target, now + durationMs / 1000)
  }

  /**
   * Ajuste le gain de la scène en cours par rapport à `scene.volume` (écoute live, 0–2).
   */
  setScenePlaybackFactor(factor: number, rampMs = 80) {
    if (!this.currentNodes?.gain || !this.currentScene) return
    const base = clamp(this.currentScene.volume ?? 0.8)
    const v = clamp(base * clamp(factor, 0, 2))
    const now = this.ctx.currentTime
    const dur = Math.max(0, rampMs) / 1000
    this.currentNodes.gain.gain.cancelScheduledValues(now)
    this.currentNodes.gain.gain.setValueAtTime(this.currentNodes.gain.gain.value, now)
    this.currentNodes.gain.gain.linearRampToValueAtTime(v, now + dur)
  }

  stop() {
    this.stopInternal(true)
  }

  private stopInternal(emit: boolean) {
    this.loadAbort?.abort()
    this.loadAbort = null
    try {
      this.currentNodes?.source.stop()
    } catch {
      /* ignore */
    }
    try {
      this.previousNodes?.source.stop()
    } catch {
      /* ignore */
    }
    this.currentNodes = null
    this.previousNodes = null
    this.currentScene = null
    this.currentBuffer = null
    this.startedAt = 0
    this.pausedAt = 0
    this.isPaused = false
    this.setState('stopped')
    if (emit) {
      sceneBus.emit({
        type: 'scene:ended',
        timestamp: Date.now(),
        details: { audioState: 'stopped', message: 'user_stop' },
      })
    }
  }

  getState() {
    return {
      scene: this.currentScene,
      paused: this.isPaused,
      contextState: this.ctx.state,
      engineState: this.engineState,
    }
  }
}

export const liriAudioEngine = new LiriAudioEngine()
