import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Bus audio **préécoute casque** — lecture locale uniquement (pas de capture LiveKit / pas de mix « salle »).
 * Utiliser pour valider un morceau, une ambiance ou un test avant envoi sur le flux public.
 */
export function useHostAudioMonitorBus() {
  const audioRef = useRef(null);
  const [previewVolume, setPreviewVolume] = useState(0.85);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [lastPreviewLabel, setLastPreviewLabel] = useState('');

  useEffect(() => {
    const a = audioRef.current;
    if (a) a.volume = Math.max(0, Math.min(1, previewVolume));
  }, [previewVolume]);

  const ensureAudio = useCallback(() => {
    if (!audioRef.current) {
      const el = new Audio();
      el.preload = 'auto';
      el.crossOrigin = 'anonymous';
      audioRef.current = el;
    }
    return audioRef.current;
  }, []);

  const playPreviewUrl = useCallback(
    (url, label = '') => {
      const u = String(url || '').trim();
      if (!u) return;
      const a = ensureAudio();
      a.src = u;
      a.volume = Math.max(0, Math.min(1, previewVolume));
      setLastPreviewLabel(label || 'Préécoute');
      void a.play().then(
        () => setIsPreviewPlaying(true),
        () => setIsPreviewPlaying(false),
      );
      a.onended = () => setIsPreviewPlaying(false);
    },
    [ensureAudio, previewVolume],
  );

  const stopPreview = useCallback(() => {
    const a = audioRef.current;
    if (a) {
      try {
        a.pause();
        a.removeAttribute('src');
        a.load();
      } catch {
        /* ignore */
      }
    }
    setIsPreviewPlaying(false);
  }, []);

  return {
    previewVolume,
    setPreviewVolume,
    playPreviewUrl,
    stopPreview,
    isPreviewPlaying,
    lastPreviewLabel,
  };
}
