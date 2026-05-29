import type { AudioScene } from './scene-types'

/** Exemples avec pistes libres (Pixabay) — remplacer par vos MP3 hébergés. */
export const demoLiriAudioScenes: AudioScene[] = [
  {
    id: 'intro',
    name: 'Ouverture',
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_8cb749b581.mp3',
    volume: 0.35,
    loop: true,
    fadeInMs: 2000,
    fadeOutMs: 2000,
    smartboardPayload: {
      type: 'text',
      content: 'Bienvenue — culte / session immersive',
    },
  },
  {
    id: 'priere',
    name: 'Prière',
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d1718ab41b.mp3',
    volume: 0.22,
    loop: true,
    fadeInMs: 2500,
    fadeOutMs: 2000,
    ducking: 0.18,
    smartboardPayload: {
      type: 'prayer',
      content: 'Texte de prière affichable sur le SmartBoard',
    },
  },
  {
    id: 'intensite',
    name: 'Montée',
    audioUrl: 'https://cdn.pixabay.com/download/audio/2022/07/25/audio_b25d19c3f5.mp3',
    volume: 0.45,
    loop: true,
    fadeInMs: 3000,
    fadeOutMs: 2500,
    smartboardPayload: {
      type: 'text',
      content: 'Phase intense — musique plus présente',
    },
  },
]
