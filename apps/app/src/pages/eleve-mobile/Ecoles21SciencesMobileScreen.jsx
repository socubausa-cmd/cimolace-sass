import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { BookOpen, ChevronDown, Crown, GraduationCap, Sparkles } from 'lucide-react';
import { Ecoles21SciencesScienceCard } from '@/components/prorascience/Ecoles21SciencesScienceCard';
import { Button } from '@/components/ui/button';
import {
  ProrascienceMobileVitrineShell,
  ProrascienceVitrineImmersiveCard,
  ProrascienceVitrineMobileSectionTitle,
} from '@/components/eleve-mobile/ProrascienceMobileVitrineShell';
import { ECOLES_SCIENCE_COLOR_PALETTE, ECOLES_SCIENCE_ICONS, ECOLES_SCIENCES, ECOLES_CYCLES_DATA } from '@/data/ecoles21SciencesData';

const EASE_PREMIUM = [0.22, 1, 0.36, 1];

const staggerContainer = (reduce, stagger = 0.08) => ({
  hidden: {},
  show: { transition: { staggerChildren: reduce ? 0 : stagger, delayChildren: reduce ? 0 : 0.02 } },
});

const fadeUpItem = (reduce) => ({
  hidden: { opacity: reduce ? 1 : 0, y: reduce ? 0 : 14 },
  show: { opacity: 1, y: 0, transition: { duration: reduce ? 0 : 0.42, ease: EASE_PREMIUM } },
});

const btnPrimary =
  'h-10 w-full gap-2 rounded-2xl border-0 bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 text-[12px] font-bold text-white shadow-[0_6px_28px_-6px_rgba(56,189,248,0.5)] hover:brightness-110 sm:w-auto';

const btnPrimarySm = 'h-10 w-full gap-2 rounded-2xl border-0 bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 text-[12px] font-bold text-white shadow-[0_6px_28px_-6px_rgba(56,189,248,0.5)] hover:brightness-110';

const filterActive = 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-[0_0_20px_-4px_rgba(56,189,248,0.45)]';
const filterIdle = 'bg-white/5 text-slate-400 hover:bg-white/10';

/**
 * Les 21 sciences — coque vitrine Prorascience (alignée charte mobile : sky / indigo, pas d'or marketing).
 */
export default function Ecoles21SciencesMobileScreen() {
  const [activeFilter, setActiveFilter] = useState('all');
  const prefersReducedMotion = useReducedMotion();
  const sciences = ECOLES_SCIENCES;
  const cyclesData = ECOLES_CYCLES_DATA;
  const colorPalette = ECOLES_SCIENCE_COLOR_PALETTE;
  const iconsList = ECOLES_SCIENCE_ICONS;

  const itemV = useMemo(() => fadeUpItem(!!prefersReducedMotion), [prefersReducedMotion]);
  const stListV = useMemo(() => staggerContainer(!!prefersReducedMotion, 0.08), [prefersReducedMotion]);

  const filteredSciences =
    activeFilter === 'all'
      ? sciences
      : sciences.filter((s) => {
          const cycle = cyclesData.find((c) => c.number === parseInt(activeFilter, 10));
          return cycle && cycle.scienceNums.includes(s.number);
        });

  return (
    <ProrascienceMobileVitrineShell
      title="Les 21 sciences"
      lead="Curriculum — ISNA Prorascience, immersion LIRI"
    >
      <motion.div
        className="text-center"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.55, ease: EASE_PREMIUM }}
      >
        <ProrascienceVitrineImmersiveCard variant="default" className="mb-1 border-sky-500/25 p-4 text-center !shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-500/35 bg-sky-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-sky-200/95">
            <BookOpen className="h-3.5 w-3.5 text-sky-300" strokeWidth={2} />
            Curriculum officiel
          </span>
          <h1 className="mt-3 font-sans text-xl font-bold leading-tight tracking-tight text-white">
            Les 21 Sciences
            <span className="mt-0.5 block bg-gradient-to-r from-sky-200 via-cyan-200 to-sky-300 bg-clip-text font-bold text-transparent">
              Mystiques africaines
            </span>
          </h1>
          <p className="mt-2.5 text-[12px] leading-relaxed text-slate-400">
            La carte du savoir initiatique — base de l'Université Ngowazulu / Prorascience. Un nganga complet maîtrise ces
            21 domaines sacrés.
          </p>
        </ProrascienceVitrineImmersiveCard>
        <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
          <Button asChild className={btnPrimary} size="sm">
            <Link to="/ecoles/prorascience" className="inline-flex w-full items-center justify-center gap-2 sm:w-auto">
              <Sparkles className="h-4 w-4 shrink-0" />
              Page commerciale premium
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-10 w-full border-sky-500/35 bg-sky-500/[0.07] text-white hover:bg-sky-500/15 sm:w-auto" size="sm">
            <Link to="/signup" className="inline-flex w-full items-center justify-center sm:w-auto">
              Commencer maintenant
            </Link>
          </Button>
        </div>
        {prefersReducedMotion ? (
          <ChevronDown className="mx-auto mt-5 h-5 w-5 text-sky-500/50" />
        ) : (
          <motion.div
            animate={{ y: [0, 4, 0] }}
            transition={{ duration: 2.4, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
          >
            <ChevronDown className="mx-auto mt-5 h-5 w-5 text-sky-500/50" />
          </motion.div>
        )}
      </motion.div>

      <div className="mt-2">
        <ProrascienceVitrineMobileSectionTitle hint="Parcours initiatique">Les 4 cycles</ProrascienceVitrineMobileSectionTitle>
        <motion.div
          className="mt-1 space-y-2.5"
          variants={stListV}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-24px' }}
        >
          {cyclesData.map((cycle) => (
            <motion.div
              key={cycle.number}
              variants={itemV}
              className={`relative overflow-hidden rounded-2xl border ${cycle.border} bg-gradient-to-br from-slate-900/80 to-slate-950/95 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]`}
            >
              <div
                className={`absolute -right-1 -top-1 rounded-full bg-gradient-to-r px-2.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white ${cycle.accent}`}
              >
                Cycle {cycle.number}
              </div>
              <p className="pr-12 font-sans text-[15px] font-bold text-white">{cycle.name}</p>
              <p className="text-[10px] font-medium text-slate-500">{cycle.verb}</p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">{cycle.description}</p>
              <ul className="mt-2 space-y-1">
                {cycle.scienceNums.map((num) => {
                  const sc = sciences.find((s) => s.number === num);
                  const p = colorPalette[num - 1];
                  const Ic = iconsList[num - 1];
                  return (
                    <li
                      key={num}
                      className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.04] px-2.5 py-1.5"
                    >
                      {Ic && <Ic className={`h-3.5 w-3.5 shrink-0 ${p?.accent || 'text-sky-400'}`} />}
                      <span className="text-left text-[11px] text-slate-300">{sc?.name}</span>
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          ))}
        </motion.div>
      </div>

      <div className="mt-1">
        <ProrascienceVitrineMobileSectionTitle hint="Filtre par cycle">Les 21 sciences</ProrascienceVitrineMobileSectionTitle>
        <p className="mb-2 text-center text-[11px] text-slate-500">Chaque science ouvre une porte vers une dimension de la réalité.</p>
        <div className="mb-3 flex flex-wrap justify-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition-all ${activeFilter === 'all' ? filterActive : filterIdle}`}
          >
            Toutes (21)
          </button>
          {cyclesData.map((c) => (
            <button
              type="button"
              key={c.number}
              onClick={() => setActiveFilter(String(c.number))}
              className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition-all ${
                activeFilter === String(c.number) ? filterActive : filterIdle
              }`}
            >
              C{c.number} — {c.verb}
            </button>
          ))}
        </div>
      </div>

      <motion.div
        className="space-y-3.5"
        variants={stListV}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.1 }}
      >
        {filteredSciences.map((science) => (
          <motion.div key={science.number} variants={itemV}>
            <Ecoles21SciencesScienceCard science={science} />
          </motion.div>
        ))}
      </motion.div>

      <ProrascienceVitrineImmersiveCard variant="sky" className="mt-4 p-4 text-center">
        <GraduationCap className="mx-auto mb-2 h-7 w-7 text-sky-400/90" />
        <h2 className="font-sans text-base font-bold text-white">Une science complète de la réalité africaine</h2>
        <p className="mt-1.5 text-[11px] text-slate-400">
          Comprendre le monde, voir l'invisible, agir sur la réalité, guider la société.
        </p>
      </ProrascienceVitrineImmersiveCard>

      <div className="mt-4 text-center">
        <Crown className="mx-auto mb-2 h-8 w-8 text-sky-400/70" />
        <p className="text-[12px] leading-relaxed text-slate-400">
          Ce système est comparable aux grandes traditions : académie initiatique, université spirituelle, doctrine
          africaine.
        </p>
      </div>

      <ProrascienceVitrineImmersiveCard variant="default" className="mt-5 mb-2 p-4 text-center">
        <p className="font-sans text-base font-bold text-white">Prêt à entrer dans l'Académie ?</p>
        <p className="mt-1 text-[11px] text-slate-500">Formations, communauté, parcours initiatique.</p>
        <div className="mt-3 flex flex-col gap-2">
          <Button asChild className={btnPrimarySm} size="sm">
            <Link to="/formations" className="inline-flex w-full items-center justify-center gap-2">
              <BookOpen className="h-4 w-4" />
              Voir les formations
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-10 w-full border-sky-500/30 text-white hover:bg-sky-500/10" size="sm">
            <a href="/appointment/request" className="inline-flex w-full items-center justify-center">
              Prendre rendez-vous
            </a>
          </Button>
        </div>
      </ProrascienceVitrineImmersiveCard>
    </ProrascienceMobileVitrineShell>
  );
}
