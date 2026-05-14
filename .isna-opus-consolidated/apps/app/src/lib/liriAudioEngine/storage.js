import { DEFAULT_LIRI_AUDIO_SETTINGS, LIRI_AUDIO_STORAGE_KEY } from './constants';

export function loadLiriAudioSettings() {
  try {
    const raw = localStorage.getItem(LIRI_AUDIO_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_LIRI_AUDIO_SETTINGS };
    const o = JSON.parse(raw);
    return { ...DEFAULT_LIRI_AUDIO_SETTINGS, ...o };
  } catch {
    return { ...DEFAULT_LIRI_AUDIO_SETTINGS };
  }
}

export function saveLiriAudioSettings(partial) {
  try {
    const cur = loadLiriAudioSettings();
    const next = { ...cur, ...partial };
    localStorage.setItem(LIRI_AUDIO_STORAGE_KEY, JSON.stringify(next));
    return next;
  } catch {
    return { ...DEFAULT_LIRI_AUDIO_SETTINGS, ...partial };
  }
}
