/**
 * Lecture de fond MP3 (ambiance salle) — volume bas, boucle, sans couper le micro LiveKit.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

export default function AmbientAudioLayer({
  tracks = [],
  enabled = true,
  /** 0–1 master */
  masterVolume = 0.22,
  className = '',
}) {
  const audioRef = useRef(null);
  const [muted, setMuted] = useState(false);
  const [idx, setIdx] = useState(0);

  const list = Array.isArray(tracks) ? tracks.filter((t) => t?.url) : [];
  const current = list[idx] || null;

  useEffect(() => {
    setIdx(0);
  }, [tracks]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !current?.url || !enabled) return;
    const v = Number(current.volume);
    const trackGain = Number.isFinite(v) ? v : 1;
    el.volume = Math.min(1, Math.max(0, masterVolume * trackGain));
    el.loop = list.length <= 1;
    el.src = current.url;
    el.load();
    const play = () => {
      el.play().catch(() => {});
    };
    if (!muted) play();
    else el.pause();
  }, [current, enabled, list.length, masterVolume, muted]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return undefined;
    const next = () => {
      if (list.length <= 1) return;
      setIdx((i) => (i + 1) % list.length);
    };
    el.addEventListener('ended', next);
    return () => el.removeEventListener('ended', next);
  }, [list.length]);

  if (!list.length) return null;

  return (
    <div className={className}>
      <audio ref={audioRef} className="hidden" preload="auto" crossOrigin="anonymous" playsInline />
      <div className="pointer-events-auto absolute bottom-[100px] left-4 z-20 flex items-center gap-2 rounded-full border border-white/15 bg-black/55 px-2.5 py-1.5 backdrop-blur-md md:bottom-[88px]">
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/85 hover:bg-white/15"
          title={muted ? "Activer l'ambiance" : "Couper l'ambiance"}
        >
          {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
        </button>
        <span className="max-w-[140px] truncate text-[10px] text-white/70" title={current?.label || 'Ambiance'}>
          {current?.label || 'Ambiance'}
        </span>
        {list.length > 1 ? (
          <button
            type="button"
            onClick={() => setIdx((i) => (i + 1) % list.length)}
            className="text-[10px] text-amber-300/90 hover:underline"
          >
            Suivant
          </button>
        ) : null}
      </div>
    </div>
  );
}
