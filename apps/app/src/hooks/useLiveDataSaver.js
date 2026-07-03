import { useCallback, useEffect, useState } from 'react';
import {
  LIRI_LIVE_DATA_SAVER_KEY,
  LIRI_LIVE_DATA_SAVER_EVENT,
  readLiveDataSaver,
  writeLiveDataSaver,
} from '@/lib/liriLivePrefs';

/**
 * Mode « basse conso / audio-first » des salles live (préférence locale persistée).
 * Synchronisé entre onglets (`storage`) et dans l'onglet courant (événement custom
 * émis après écriture) — même modèle que `useLiriCompactLiveUiState`.
 *
 * @returns {{ dataSaver: boolean, setDataSaver: (v: boolean) => void, toggleDataSaver: () => void }}
 */
export function useLiveDataSaver() {
  const [dataSaver, setState] = useState(() => readLiveDataSaver());

  const setDataSaver = useCallback((next) => {
    const v = Boolean(next);
    setState(v);
    writeLiveDataSaver(v);
  }, []);

  const toggleDataSaver = useCallback(() => {
    setState((prev) => {
      const v = !prev;
      writeLiveDataSaver(v);
      return v;
    });
  }, []);

  useEffect(() => {
    const sync = () => setState(readLiveDataSaver());
    const onStorage = (e) => {
      if (e.key === LIRI_LIVE_DATA_SAVER_KEY || e.key === null) sync();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(LIRI_LIVE_DATA_SAVER_EVENT, sync);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(LIRI_LIVE_DATA_SAVER_EVENT, sync);
    };
  }, []);

  return { dataSaver, setDataSaver, toggleDataSaver };
}
