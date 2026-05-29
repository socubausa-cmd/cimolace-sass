export type {
  AudioScene,
  AudioSceneEvent,
  LiriAudioEngineState,
  SmartboardPayload,
} from './scene-types'
export { sceneBus } from './scene-bus'
export { LiriAudioEngine, liriAudioEngine } from './audio-engine'
export { useSceneAudio } from './useSceneAudio'
export type { UseSceneAudioOptions } from './useSceneAudio'
export { normalizeLiriAudioScenes } from './normalizeLiriAudioScenes'
export { buildLiriAudioConfigPatch } from './buildLiriAudioConfigPatch'
export type { LiriAudioConfigSlice } from './buildLiriAudioConfigPatch'
export { useLiriAudioSmartboardSync } from './useLiriAudioSmartboardSync'
export { useLiriAudioMicDuck } from './useLiriAudioMicDuck'
export { LiriAudioMicDuckBridge } from './LiriAudioMicDuckBridge.jsx'
export { AudioScenePanel } from './AudioScenePanel.jsx'
export { LiriAudioSceneOverlay } from './LiriAudioSceneOverlay.jsx'
export { demoLiriAudioScenes } from './demoScenes'
