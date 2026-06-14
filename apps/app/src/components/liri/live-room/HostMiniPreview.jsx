import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mic, Video, Plus, Maximize, Minimize } from 'lucide-react';
import { useSegmentedVideo } from '@/hooks/useSegmentedVideo';
import { applyChromaKeyToImageData, hexToRgb } from '@/lib/chromaKeyPixels';
import { cn } from '@/lib/utils';

export default function HostMiniPreview({
  videoRef,
  name   = 'Host',
  subtitle = '',
  blur   = false,
  beauty = false,
  vbg    = 'none',
  extraFilter = '',
  chromaKey = false,
  chromaColor = '#00B140',
  chromaSens = 100,
  onClick,
  panelLabel = 'Sous-panel',
  privileged = false,
  embedded = false,
  symmetricStage = false,
  onPipCanvasRef = null,
  immersiveGlass = false,
  /** Badge rouge « LIVE » (coin haut droit) — hôte Arena */
  showLiveBadge = false,
  /** Double liséré or type maquette LIRI (panneau local hôte) */
  arenaHostGoldFrame = false,
  /** `hero` = grande vignette colonne droite maquette hôte (LIRI verrouillée) */
  embeddedSize = 'standard',
  /** Barre micro / cam / layout / plus sur la vignette héro (maquette LIRI) */
  heroMediaControls = false,
  muted = false,
  cameraOff = false,
  onHeroToggleMuted,
  onHeroToggleCamera,
  onHeroOpenSettings,
  onHeroLayoutToggle,
  heroCinemaActive = false,
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
  const mountSegCanvas = segActive && segmentationReady && !segmentationFailed;
  const useSegCanvas = segActive && segmentationReady && hasFrame && !segmentationFailed;

  useEffect(() => {
    if (useSegCanvas) onPipCanvasRef?.(canvasRef.current);
  }, [useSegCanvas, onPipCanvasRef]);

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

  const baseFilter = beauty && !segActive && !chromaKey
    ? 'saturate(1.28) brightness(1.1) contrast(0.92)'
    : 'saturate(1.02) contrast(1.04)';
  const rawFilter = [baseFilter, extraFilter].filter(Boolean).join(' ');

  const showChromaCanvas = chromaKey && !useSegCanvas;

  useEffect(() => {
    if (!showChromaCanvas && !useSegCanvas) onPipCanvasRef?.(null);
  }, [showChromaCanvas, useSegCanvas, onPipCanvasRef]);

  const boxClass = symmetricStage
    ? immersiveGlass
      ? cn(
          'relative z-20 mx-auto aspect-[3/4] w-full max-h-[min(48vh,560px)] overflow-hidden rounded-[28px]',
          'border border-white/22 bg-white/[0.04] shadow-[0_24px_80px_-40px_rgba(212,175,55,0.3)] backdrop-blur-md',
        )
      : 'relative z-20 mx-auto aspect-[3/4] w-full max-h-[min(48vh,560px)] overflow-hidden rounded-[28px] border border-white/[0.18] shadow-[0_26px_80px_-45px_rgba(96,116,255,0.68)]'
    : embedded
      ? immersiveGlass
        ? cn(
            embeddedSize === 'hero'
              ? 'relative z-20 min-h-[min(200px,28vh)] h-[min(34vh,320px)] max-h-[min(42vh,400px)] w-full overflow-hidden rounded-xl sm:rounded-2xl'
              : 'relative z-20 h-[156px] w-full max-h-[30vh] overflow-hidden rounded-2xl',
            'border border-white/20 bg-white/[0.04] shadow-[0_12px_36px_-20px_rgba(212,175,55,0.28)] backdrop-blur-md',
            embeddedSize === 'hero' &&
              'shadow-[0_8px_40px_-12px_rgba(139,92,246,0.25),0_12px_48px_-18px_rgba(212,175,55,0.32)]',
            arenaHostGoldFrame &&
              'border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] shadow-[0_12px_40px_-18px_rgba(212,175,55,0.42),inset_0_0_0_1px_rgba(212,175,55,0.15)] ring-2 ring-[color-mix(in_srgb,var(--school-accent)_45%,transparent)] ring-offset-2 ring-offset-[#070a10]',
          )
        : cn(
            embeddedSize === 'hero'
              ? 'relative z-20 min-h-[min(200px,28vh)] h-[min(34vh,320px)] max-h-[min(42vh,400px)] w-full overflow-hidden rounded-xl sm:rounded-2xl shadow-[0_10px_30px_-18px_rgba(0,0,0,0.9)]'
              : 'relative z-20 h-[156px] w-full max-h-[30vh] overflow-hidden rounded-2xl shadow-[0_10px_30px_-18px_rgba(0,0,0,0.9)]',
            arenaHostGoldFrame &&
              'ring-2 ring-[color-mix(in_srgb,var(--school-accent)_45%,transparent)] ring-offset-2 ring-offset-[#070a10] shadow-[0_14px_40px_-16px_rgba(212,175,55,0.35)]',
          )
      : 'absolute bottom-4 left-4 z-20 h-28 w-44 cursor-pointer overflow-hidden rounded-2xl shadow-[0_10px_30px_-18px_rgba(0,0,0,0.9)]';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={boxClass}
      title={embedded || symmetricStage ? 'Prévisualisation locale' : 'Preview host'}
      onClick={embedded || symmetricStage ? undefined : onClick}
    >
      {!segActive && !immersiveGlass && !chromaKey && (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_26%,rgba(120,115,240,0.26),transparent_44%),radial-gradient(circle_at_72%_24%,rgba(60,128,255,0.16),transparent_40%),linear-gradient(180deg,rgba(11,17,30,0.90),rgba(9,14,25,0.95))]" />
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

      {mountSegCanvas && !chromaKey && (
        <canvas
          ref={(el) => {
            canvasRef.current = el;
          }}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ zIndex: 2, opacity: useSegCanvas ? 1 : 0, filter: extraFilter || undefined }}
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
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(140,170,255,0.14),transparent_44%)]"
          style={{ zIndex: 3 }}
        />
      )}
      {immersiveGlass && (
        <div
          className={cn(
            'pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-white/[0.06]',
            symmetricStage ? 'rounded-[28px]' : 'rounded-2xl',
          )}
          style={{ zIndex: 3 }}
        />
      )}
      <div
        className={cn('absolute inset-0 ring-1 ring-white/15', symmetricStage ? 'rounded-[28px]' : 'rounded-2xl')}
        style={{ zIndex: 4 }}
      />
      {!(heroMediaControls && embedded && embeddedSize === 'hero') ? (
        <div className="absolute left-2 top-2 z-[5] h-5 rounded-full border border-white/20 bg-black/40 px-2 text-[9px] text-white/85 backdrop-blur-md">
          {panelLabel}
        </div>
      ) : null}
      {showLiveBadge ? (
        <div
          className="absolute right-2 top-2 z-[6] flex items-center gap-1 rounded border border-red-500/40 bg-red-600/95 px-1.5 py-0.5 shadow-[0_2px_10px_rgba(220,38,38,0.45)]"
          aria-label="En direct"
        >
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-200 opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
          </span>
          <span className="text-[8px] font-bold uppercase tracking-[0.08em] text-white">Live</span>
        </div>
      ) : null}
      {heroMediaControls && embedded && embeddedSize === 'hero' ? (
        <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-[7] bg-gradient-to-t from-black/88 via-black/45 to-transparent px-2 pb-2 pt-8">
          <div className="mb-1 flex items-center justify-center gap-2">
            {onHeroToggleMuted ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onHeroToggleMuted();
                }}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/50 backdrop-blur-sm transition-colors',
                  muted ? 'text-red-200 ring-1 ring-red-400/40' : 'text-white/90 hover:bg-white/15',
                )}
                title={muted ? 'Réactiver le micro' : 'Couper le micro'}
                aria-pressed={muted}
              >
                <Mic className="h-3.5 w-3.5" />
              </button>
            ) : null}
            {onHeroToggleCamera ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onHeroToggleCamera();
                }}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/50 backdrop-blur-sm transition-colors',
                  cameraOff ? 'text-red-200 ring-1 ring-red-400/40' : 'text-white/90 hover:bg-white/15',
                )}
                title={cameraOff ? 'Réactiver la caméra' : 'Couper la caméra'}
                aria-pressed={cameraOff}
              >
                <Video className="h-3.5 w-3.5" />
              </button>
            ) : null}
            {onHeroLayoutToggle ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onHeroLayoutToggle();
                }}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/50 backdrop-blur-sm transition-colors',
                  heroCinemaActive ? 'text-[#f5dd8a] ring-1 ring-[color-mix(in_srgb,var(--school-accent)_45%,transparent)]' : 'text-white/90 hover:bg-white/15',
                )}
                title={heroCinemaActive ? 'Quitter le mode cinéma' : 'Mode cinéma'}
              >
                {heroCinemaActive ? (
                  <Minimize className="h-3.5 w-3.5" />
                ) : (
                  <Maximize className="h-3.5 w-3.5" />
                )}
              </button>
            ) : null}
            {onHeroOpenSettings ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onHeroOpenSettings();
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white/90 backdrop-blur-sm transition-colors hover:bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] hover:text-[#f5dd8a]"
                title="Réglages et effets"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          <div className="flex items-center justify-center gap-1">
            <p className="truncate text-center text-[9px] font-medium text-white/88 drop-shadow-sm">{name}</p>
            {privileged ? (
              <span className="flex-shrink-0 text-[7px] font-bold text-[var(--school-accent)]">★</span>
            ) : null}
          </div>
          {subtitle ? <p className="truncate text-center text-[8px] text-white/55">{subtitle}</p> : null}
        </div>
      ) : (
        <div className="absolute inset-x-0 bottom-0 z-[5] bg-gradient-to-t from-black/70 to-transparent px-2 py-1">
          <div className="flex items-center gap-1">
            <p className="truncate text-[10px] text-white drop-shadow-sm">{name}</p>
            {privileged && (
              <span className="flex-shrink-0 text-[7px] font-bold text-[var(--school-accent)]">★</span>
            )}
          </div>
          {subtitle ? (
            <p className="truncate text-[9px] text-white/70">{subtitle}</p>
          ) : null}
        </div>
      )}
    </motion.div>
  );
}
