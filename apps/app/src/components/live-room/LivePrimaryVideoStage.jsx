import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSegmentedVideo } from '@/hooks/useSegmentedVideo';
import { applyChromaKeyToImageData, hexToRgb } from '@/lib/chromaKeyPixels';
import { cn } from '@/lib/utils';

export default function LivePrimaryVideoStage({
  videoRef,
  title,
  subtitle,
  blur   = false,
  beauty = false,
  vbg    = 'none',
  onClick,
  clickable = false,
  panelLabel = 'Panel',
  waiting = false,
  waitingName = 'votre interlocuteur',
  onPipCanvasRef,
  privileged = false,
  /** Fond vert / couleur — détourage sans MediaPipe */
  chromaKey = false,
  chromaColor = '#00B140',
  chromaSens = 100,
  /** Messagerie immersive : carte verre, fond de l'UI visible derrière la vidéo */
  immersiveGlass = false,
}) {
  const canvasRef = useRef(null);
  const chromaCanvasRef = useRef(null);
  const chromaAnimRef = useRef(null);

  const segActive = blur || vbg !== 'none';

  const { segmentationReady, segmentationFailed, hasFrame } = useSegmentedVideo({
    videoRef,
    canvasRef,
    blur,
    beauty,
    vbg,
    active: segActive,
  });
  // Monter le canvas dès que MediaPipe est prêt (sans attendre hasFrame) : sinon onResults
  // ne peut jamais dessiner → hasFrame reste false à jamais.
  const mountSegCanvas = segActive && segmentationReady && !segmentationFailed;
  const useSegCanvas = segActive && segmentationReady && hasFrame && !segmentationFailed;

  useEffect(() => {
    if (useSegCanvas) onPipCanvasRef?.(canvasRef.current);
  }, [useSegCanvas, onPipCanvasRef]);

  const rawFilter = beauty && !segActive && !chromaKey
    ? 'saturate(1.32) brightness(1.12) contrast(0.9)'
    : 'saturate(1.05) contrast(1.06)';

  const keyRgb = hexToRgb(chromaColor);
  const greenishKey = keyRgb.g > keyRgb.r + 25 && keyRgb.g > keyRgb.b + 25;

  useEffect(() => {
    if (!chromaKey || segActive) {
      if (chromaAnimRef.current) cancelAnimationFrame(chromaAnimRef.current);
      return;
    }
    const video = videoRef?.current;
    const canvas = chromaCanvasRef.current;
    if (!video || !canvas) return;

    const tick = () => {
      if (!video.videoWidth) {
        chromaAnimRef.current = requestAnimationFrame(tick);
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      applyChromaKeyToImageData(frame, keyRgb, chromaSens, greenishKey);
      ctx.putImageData(frame, 0, 0);
      chromaAnimRef.current = requestAnimationFrame(tick);
    };
    chromaAnimRef.current = requestAnimationFrame(tick);
    return () => {
      if (chromaAnimRef.current) cancelAnimationFrame(chromaAnimRef.current);
    };
  }, [chromaKey, chromaColor, chromaSens, videoRef, keyRgb, greenishKey, segActive]);

  const showChromaCanvas = chromaKey && !useSegCanvas;

  useEffect(() => {
    if (!showChromaCanvas && !useSegCanvas) onPipCanvasRef?.(null);
  }, [showChromaCanvas, useSegCanvas, onPipCanvasRef]);

  const shellClass = immersiveGlass
    ? cn(
        'relative w-full aspect-[3/4] overflow-hidden rounded-[28px]',
        'border border-white/22 bg-white/[0.04] shadow-[0_24px_80px_-40px_rgba(212,175,55,0.35)]',
        'backdrop-blur-md supports-[backdrop-filter]:bg-white/[0.03]',
      )
    : 'relative w-full aspect-[3/4] rounded-[28px] overflow-hidden bg-black/45 shadow-[0_26px_80px_-45px_rgba(96,116,255,0.68)]';

  return (
    <motion.div
      layout
      className={shellClass}
      style={immersiveGlass ? undefined : { border: '1px solid rgba(255,255,255,0.18)' }}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      onClick={onClick}
    >
      {!segActive && !immersiveGlass && !chromaKey && (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_20%,rgba(140,133,255,0.38),transparent_40%),radial-gradient(circle_at_82%_20%,rgba(70,142,255,0.24),transparent_36%),radial-gradient(circle_at_54%_84%,rgba(118,82,255,0.16),transparent_40%),linear-gradient(180deg,rgba(9,16,34,0.88),rgba(8,13,28,0.94))]" />
      )}

      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
        style={{
          zIndex: 2,
          filter: rawFilter,
          opacity: (useSegCanvas || showChromaCanvas) ? 0 : 1,
          pointerEvents: 'none',
        }}
      />

      {mountSegCanvas && (
        <canvas
          ref={(el) => {
            canvasRef.current = el;
          }}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ zIndex: 2, opacity: useSegCanvas ? 1 : 0 }}
        />
      )}

      {showChromaCanvas && (
        <canvas
          ref={(el) => {
            chromaCanvasRef.current = el;
            onPipCanvasRef?.(el || null);
          }}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ zIndex: 2, filter: rawFilter }}
        />
      )}

      {!immersiveGlass && (
        <>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_46%_43%,rgba(157,190,255,0.24),transparent_42%)]" style={{ zIndex: 3 }} />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_90%,rgba(0,0,0,0.34),transparent_42%)]" style={{ zIndex: 3 }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/38 via-transparent to-black/8" style={{ zIndex: 4 }} />
        </>
      )}
      {immersiveGlass && (
        <div
          className="pointer-events-none absolute inset-0 rounded-[28px] bg-gradient-to-t from-black/25 via-transparent to-white/[0.06]"
          style={{ zIndex: 3 }}
        />
      )}
      <div className="absolute inset-0 rounded-[28px] ring-1 ring-white/15" style={{ zIndex: 5 }} />

      <AnimatePresence>
        {waiting && (
          <motion.div
            key="waiting-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5"
            style={{ background: 'radial-gradient(circle at 50% 45%, rgba(212,175,55,0.07), transparent 65%), linear-gradient(180deg, rgba(9,16,34,0.9), rgba(8,13,28,0.97))' }}
          >
            <div className="relative flex items-center justify-center">
              <motion.div
                animate={{ scale: [1, 1.22, 1], opacity: [0.18, 0.06, 0.18] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute h-24 w-24 rounded-full bg-[#D4AF37]/30"
              />
              <motion.div
                animate={{ scale: [1, 1.14, 1], opacity: [0.28, 0.1, 0.28] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
                className="absolute h-20 w-20 rounded-full bg-[#D4AF37]/40"
              />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-[#D4AF37]/30 bg-gradient-to-br from-[#D4AF37]/30 to-[#1f2d41]">
                <span className="text-lg font-bold text-[#D4AF37]">
                  {(waitingName || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
                </span>
              </div>
            </div>

            <div className="space-y-1 text-center">
              <p className="text-sm font-medium text-white/90">{waitingName}</p>
              <div className="flex items-center justify-center gap-1.5">
                <span className="mt-px text-[11px] text-white/45">Connexion en cours</span>
                <span className="mt-px flex gap-0.5">
                  {[0, 0.2, 0.4].map((delay, i) => (
                    <motion.span
                      key={i}
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay }}
                      className="h-1 w-1 rounded-full bg-white/40"
                    />
                  ))}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute bottom-4 left-4" style={{ zIndex: 6 }}>
        <div className="mb-0.5 flex items-center gap-1.5">
          <p className="text-sm text-white/95 drop-shadow-md">{title}</p>
          {privileged && (
            <span className="flex h-4 items-center gap-0.5 rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/20 px-1.5 text-[8px] font-semibold text-[#D4AF37]">
              ★ Intervenant
            </span>
          )}
        </div>
        <p className="text-xs text-gray-200/90 drop-shadow-md">{subtitle}</p>
      </div>

      <div className="absolute left-4 top-4 z-[7] flex items-center gap-2">
        <div className="h-6 rounded-full border border-white/20 bg-black/40 px-2.5 text-[10px] font-semibold tracking-wide text-white/85 backdrop-blur-md">
          {panelLabel}
        </div>
        {clickable ? (
          <div className="h-6 rounded-full border border-white/15 bg-black/35 px-2.5 text-[10px] text-white/60 backdrop-blur-md">
            Cliquer pour permuter
          </div>
        ) : null}
      </div>

      {(segActive || chromaKey) && (
        <div className="absolute right-3 top-3 z-[7] flex h-5 items-center gap-1.5 rounded-full border border-white/15 bg-black/45 px-2 backdrop-blur-md">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#D4AF37]" />
          <span className="text-[9px] text-white/75">
            {chromaKey && !useSegCanvas ? 'Fond vert' : blur ? 'Flou IA' : vbg === 'immersive' ? 'Transparence IA' : vbg === 'blur' ? 'Flou (fond)' : `VBG: ${vbg}`}
          </span>
        </div>
      )}
    </motion.div>
  );
}
