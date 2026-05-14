import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Mini lecteur aparté WebRTC — `MediaStream` distant (audio ± vidéo).
 */
export default function LiveAsidePip({ stream, label = 'Aparté', onClose, className }) {
  const mediaRef = useRef(null);

  useEffect(() => {
    const el = mediaRef.current;
    if (!el || !stream) return undefined;
    el.srcObject = stream;
    void el.play().catch(() => {});
    return () => {
      el.srcObject = null;
    };
  }, [stream]);

  if (!stream) return null;

  const hasVideo = stream.getVideoTracks().length > 0;

  return (
    <div
      className={cn(
        'fixed bottom-24 right-4 z-[60] flex max-w-[min(100vw-2rem,320px)] flex-col overflow-hidden rounded-lg border border-amber-400/35 bg-black/90 shadow-2xl',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-2 py-1.5">
        <span className="truncate text-[10px] font-semibold uppercase tracking-wide text-amber-100/90">{label}</span>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-white/70 hover:bg-white/10 hover:text-white"
            aria-label="Fermer l’aparté"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      <video
        ref={mediaRef}
        playsInline
        className={cn('w-full bg-black object-cover', hasVideo ? 'aspect-video' : 'h-[72px]')}
      />
      {!hasVideo ? (
        <p className="border-t border-white/5 px-2 py-1.5 text-center text-[10px] text-white/45">
          Audio — pas de piste vidéo
        </p>
      ) : null}
    </div>
  );
}
