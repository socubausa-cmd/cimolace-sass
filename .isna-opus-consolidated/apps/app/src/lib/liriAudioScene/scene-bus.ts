import type { AudioSceneEvent } from './scene-types'

type Listener = (event: AudioSceneEvent) => void

class SceneBus {
  private listeners = new Set<Listener>()

  emit(event: AudioSceneEvent) {
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch (e) {
        console.warn('[LiriAudioScene] listener error', e)
      }
    }
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  clear() {
    this.listeners.clear()
  }
}

export const sceneBus = new SceneBus()
