/**
 * Écran d'accueil — deux laboratoires du Studio Créateur (Cours / Live)
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Wand2, Clapperboard, ArrowRight, BookOpen, Video, Compass, BookMarked } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LiriWordmark } from '@/components/brand/LiriWordmark';

function cardKeyActivate(e, navigate, path) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    navigate(path);
  }
}

export function StudioLabsHero({ isActive, index, total, onEnterView }) {
  const navigate = useNavigate();

  return (
    <section
      id="studio-section-labs-hub"
      className="relative flex h-full min-h-0 items-center overflow-hidden"
      onMouseEnter={() => onEnterView(index)}
    >
      <div className="w-full max-w-7xl mx-auto px-6 md:px-10 lg:px-14">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0.5, y: 12 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12 md:mb-16"
        >
          <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-white drop-shadow-[0_10px_35px_rgba(0,0,0,0.35)] md:text-5xl lg:text-6xl">
            Deux laboratoires
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-white/55 md:text-lg">
            Le même espace d'accès pour concevoir vos <strong className="text-white/90">cours</strong> et vos{' '}
            <strong className="text-white/90">lives</strong> — outils distincts, expérience unifiée.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/30 backdrop-blur-xl px-3 py-1 text-[11px] text-white/50">
            <span className="text-[#D4AF37]">{String(index + 1).padStart(2, '0')}</span>
            <span>/</span>
            <span>{String(total).padStart(2, '0')}</span>
          </div>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 lg:gap-10 max-w-5xl mx-auto">
          {/* Laboratoire Cours */}
          <motion.div
            role="button"
            tabIndex={0}
            onClick={() => navigate('/studio/course-lab')}
            onKeyDown={(e) => cardKeyActivate(e, navigate, '/studio/course-lab')}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className={cn(
              'relative text-left rounded-3xl border p-8 md:p-10 transition-all overflow-hidden group backdrop-blur-xl cursor-pointer',
              'border-fuchsia-400/25 bg-gradient-to-br from-fuchsia-950/35 via-[#0a0908]/95 to-[#060504]',
              'hover:border-fuchsia-300/60 hover:shadow-[0_15px_60px_rgba(217,70,239,0.24)]',
            )}
          >
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-fuchsia-500/10 blur-3xl pointer-events-none" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-fuchsia-500/20 flex items-center justify-center text-fuchsia-300">
                  <Wand2 className="w-7 h-7" />
                </div>
                <span className="font-display text-[10px] font-semibold uppercase tracking-widest text-fuchsia-300/80">
                  Laboratoire 1
                </span>
              </div>
              <h2 className="font-display mb-3 text-2xl font-semibold tracking-tight text-white md:text-3xl">
                Constructeur de cours
              </h2>
              <p className="text-sm text-white/55 leading-relaxed mb-6">
                Course Builder IA, parcours formation, post-production — tout pour transformer vos contenus pédagogiques.
              </p>
              <div className="flex flex-wrap gap-2 mb-6">
                <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] text-white/65">Transcription IA</span>
                <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] text-white/65">SmartBoard</span>
                <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] text-white/65">Post-production</span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  className="rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/studio/course-lab');
                  }}
                >
                  Entrer
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <span className="inline-flex items-center gap-1.5 text-[11px] text-white/35">
                  <BookOpen className="w-3.5 h-3.5" />
                  Accès réservé aux rôles studio
                </span>
              </div>
            </div>
          </motion.div>

          {/* Laboratoire Live */}
          <motion.div
            role="button"
            tabIndex={0}
            onClick={() => navigate('/studio/live-lab')}
            onKeyDown={(e) => cardKeyActivate(e, navigate, '/studio/live-lab')}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className={cn(
              'relative text-left rounded-3xl border p-8 md:p-10 transition-all overflow-hidden group backdrop-blur-xl cursor-pointer',
              'border-[#D4AF37]/30 bg-gradient-to-br from-[#1a1510]/90 via-[#0a0908]/95 to-[#060504]',
              'hover:border-[#D4AF37]/50 hover:shadow-[0_15px_60px_rgba(212,175,55,0.22)]',
            )}
          >
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-200">
                  <Clapperboard className="w-7 h-7" />
                </div>
                <span className="font-display text-[10px] font-semibold uppercase tracking-widest text-[#D4AF37]/90">
                  Laboratoire 2
                </span>
              </div>
              <h2 className="font-display mb-3 text-2xl font-semibold tracking-tight text-white md:text-3xl">
                Constructeur de lives
              </h2>
              <p className="text-sm text-white/55 leading-relaxed mb-6">
                Blueprint production, scènes immersives SmartBoard, studio live — préparez vos sessions comme une vraie régie.
              </p>
              <div className="flex flex-wrap gap-2 mb-6">
                <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] text-white/65">Régie live</span>
                <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] text-white/65">Scènes immersives</span>
                <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] text-white/65">Messagerie</span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  className="rounded-xl bg-[#D4AF37] text-black hover:bg-[#e5c04a]"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/studio/live-lab');
                  }}
                >
                  Entrer
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <span className="inline-flex items-center gap-1.5 text-[11px] text-white/35">
                  <Video className="w-3.5 h-3.5" />
                  Messagerie & arène
                </span>
              </div>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={isActive ? { opacity: 1, y: 0 } : { opacity: 0.55, y: 8 }}
          transition={{ duration: 0.45, delay: 0.05 }}
          className="mt-10 md:mt-12 max-w-3xl mx-auto rounded-2xl border border-white/12 bg-black/35 backdrop-blur-xl px-5 py-4 md:px-6 md:py-5"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 text-left">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-200">
                <Compass className="h-5 w-5" />
              </div>
              <div>
                <LiriWordmark size="kicker" className="text-cyan-200/90" />
                <p className="mt-1 text-sm text-white/70 leading-snug">
                  Hub unifié : choisir le bon constructeur (programme, cours unique, parcours scolaire…) et lire le guide
                  comparatif.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl border-cyan-400/35 bg-cyan-950/20 text-cyan-100 hover:bg-cyan-500/15 hover:text-white"
                onClick={() => navigate('/studio/liri/constructeurs')}
              >
                <Compass className="w-4 h-4 mr-2" />
                Constructeurs
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="rounded-xl text-white/80 hover:bg-white/10 hover:text-white"
                onClick={() => navigate('/studio/liri/constructeurs/guide')}
              >
                <BookMarked className="w-4 h-4 mr-2" />
                Guide
              </Button>
            </div>
          </div>
        </motion.div>

        <p className="text-center text-[11px] text-white/35 mt-10 md:mt-14">
          Faites défiler pour parcourir tous les outils — ou choisissez un laboratoire ci-dessus.
        </p>
      </div>
    </section>
  );
}
