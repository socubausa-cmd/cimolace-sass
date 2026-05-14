import { useEffect } from 'react';
import { PHASE } from '@/features/live/host/liveHostConstants';

/**
 * Initialisation AudioContext hôte (arm après interaction) et reprise audio LiveKit.
 */
export function useLiveHostAudioContextInit({ phase, hostSfxCtxRef, hostSfxArmedRef, roomRef }) {
  useEffect(() => {
    const arm = () => {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx || hostSfxArmedRef.current) return;
      try {
        if (!hostSfxCtxRef.current) hostSfxCtxRef.current = new Ctx();
        hostSfxCtxRef.current.resume?.().catch(() => {});
        hostSfxArmedRef.current = true;
      } catch { /* ignore */ }
    };
    window.addEventListener('pointerdown', arm, { passive: true });
    window.addEventListener('keydown', arm, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', arm);
      window.removeEventListener('keydown', arm);
    };
  }, [hostSfxCtxRef, hostSfxArmedRef]);

  useEffect(() => {
    if (phase !== PHASE.LIVE) return;
    const resume = () => {
      try { roomRef.current?.startAudio?.().catch(() => {}); } catch { /* ignore */ }
    };
    window.addEventListener('pointerdown', resume, { passive: true });
    window.addEventListener('keydown', resume, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', resume);
      window.removeEventListener('keydown', resume);
    };
  }, [phase, roomRef]);
}
