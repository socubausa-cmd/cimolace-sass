import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Globe2, PlayCircle } from 'lucide-react';

/** Diaporama hero — visuels dédiés + libellés courts. */
export const PRORASCIENCE_HERO_CAROUSEL_SLIDES = [
  {
    src: '/image-pro/hero-vitrine-prorascience-accueil.png',
    alt: 'Héritage, feu de village, ordinateur et ville de nuit : savoir traditionnel et visioconférence.',
    kicker: 'Prorascience',
    footer: 'Visible et invisible. Réel initiatique.',
    objectPosition: '50% 50%',
  },
  {
    src: '/image-pro/hero-liri-village-visio-connaissance.png',
    alt: 'LIRI : village, visioconférence, globe connecté, ville de nuit.',
    kicker: 'LIRI',
    footer: 'La connaissance sans frontière. Un réseau, une révolution.',
    objectPosition: '50% 12%',
  },
  {
    src: '/image-pro/hero-carousel-guerison-rituel.png',
    alt: 'Transmission : rituel, géométrie sacrée, lumière et atelier spirituel.',
    kicker: 'Transmission',
    footer: 'Présence, symbole, lumière.',
    objectPosition: '50% 50%',
  },
];

const AUTO_MS = 6500;

const DEFAULT_EASE = [0.22, 1, 0.36, 1];

/**
 * @param {{ prefersReducedMotion: boolean; onOpenVideo: () => void; easePremium?: number[] }} props
 */
export function ProrascienceHomeHeroCarousel({ prefersReducedMotion, onOpenVideo, easePremium = DEFAULT_EASE }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const slides = PRORASCIENCE_HERO_CAROUSEL_SLIDES;
  const active = slides[index] ?? slides[0];

  const go = useCallback(
    (dir) => {
      setIndex((i) => {
        const n = slides.length;
        if (dir === 'next') return (i + 1) % n;
        return (i - 1 + n) % n;
      });
    },
    [slides.length],
  );

  useEffect(() => {
    if (prefersReducedMotion || paused || slides.length < 2) return undefined;
    const t = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, AUTO_MS);
    return () => window.clearInterval(t);
  }, [prefersReducedMotion, paused, slides.length]);

  return (
    <div
      className="relative aspect-[4/3] w-full overflow-hidden bg-[#0B0B0F] md:aspect-[16/11]"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.img
          key={active.src}
          src={active.src}
          alt={active.alt}
          className="prs-hero-img absolute inset-0 h-full w-full object-contain object-center"
          style={active.objectPosition ? { objectPosition: active.objectPosition } : undefined}
          loading={index === 0 ? 'eager' : 'lazy'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.2 : 0.55, ease: easePremium }}
        />
      </AnimatePresence>

      <div className="pointer-events-none absolute inset-x-0 top-3 z-[2] flex justify-center px-3">
        <span className="max-w-[95%] rounded-full border border-[#D4AF37]/35 bg-black/55 px-3 py-1 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-[#ebca5e] backdrop-blur-md">
          {active.kicker}
        </span>
      </div>

      <div className="absolute inset-0 bg-gradient-to-t from-[#070b12] via-[#070b12]/25 to-transparent" />

      <div className="absolute left-2 top-1/2 z-[2] -translate-y-1/2 md:left-3">
        <button
          type="button"
          onClick={() => go('prev')}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur-md transition-colors hover:bg-black/60"
          aria-label="Image précédente"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      </div>
      <div className="absolute right-2 top-1/2 z-[2] -translate-y-1/2 md:right-3">
        <button
          type="button"
          onClick={() => go('next')}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white backdrop-blur-md transition-colors hover:bg-black/60"
          aria-label="Image suivante"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <motion.button
        type="button"
        onClick={onOpenVideo}
        className="absolute left-1/2 top-1/2 z-[2] flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/50 text-white backdrop-blur-md"
        aria-label="Lire la présentation vidéo"
        whileHover={prefersReducedMotion ? undefined : { scale: 1.08 }}
        whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
        animate={
          prefersReducedMotion
            ? undefined
            : { boxShadow: ['0 0 0 0 rgba(212,175,55,0)', '0 0 28px 4px rgba(212,175,55,0.28)', '0 0 0 0 rgba(212,175,55,0)'] }
        }
        transition={{ boxShadow: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' } }}
      >
        <PlayCircle className="h-8 w-8 text-[#D4AF37]" />
      </motion.button>

      <div className="absolute bottom-4 left-4 right-4 z-[2] space-y-2">
        <div className="flex justify-center gap-1.5">
          {slides.map((s, i) => (
            <button
              key={s.src}
              type="button"
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all ${i === index ? 'w-6 bg-[#D4AF37]' : 'w-1.5 bg-white/35 hover:bg-white/55'}`}
              aria-label={`Voir la diapositive ${i + 1} sur ${slides.length}`}
              aria-current={i === index ? 'true' : undefined}
            />
          ))}
        </div>
        <div className="flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-black/45 px-3 py-2 text-center text-[11px] font-medium leading-snug text-white/88 backdrop-blur-md sm:text-xs">
          <Globe2 className="h-3.5 w-3.5 shrink-0 text-[#D4AF37]" aria-hidden />
          <span>{active.footer}</span>
        </div>
      </div>
    </div>
  );
}
