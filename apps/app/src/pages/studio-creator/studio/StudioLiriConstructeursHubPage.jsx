/**
 * Course Building Control Room — interface logiciel unifiée.
 * Route : /studio/liri/constructeurs
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, BookOpen, Compass, LayoutGrid, Sparkles, Wand2, GraduationCap, Workflow, SlidersHorizontal,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import StudioDesignerLikeShell from '@/components/liri/liri-ecosystem/StudioDesignerLikeShell';
import { CONSTRUCTEURS_CATALOG, DESIGNER_HREF } from '@/lib/liriConstructeursCatalog';

const BUILD_MODES = [
  { id: 'assist', title: 'Assiste IA', hint: 'Generation auto + validation humaine' },
  { id: 'manual', title: 'Manuel', hint: 'Conception complete par le professeur' },
  { id: 'hybrid', title: 'Mixte', hint: 'IA + edition manuelle continue' },
];

const PIPELINE = [
  {
    id: 'macro',
    title: 'Cadre du cours',
    subtitle: 'Programme ou cours unitaire',
    options: [
      { label: 'Formation Builder', to: '/studio/liri/formation' },
      { label: 'Course Builder LIRI', to: '/studio/liri/cours' },
    ],
  },
  {
    id: 'content',
    title: 'Construction pedagogique',
    subtitle: 'Structure, scripts, checkpoints',
    options: [
      { label: 'Agent LIRI', to: '/studio/liri-agent' },
      { label: 'Course Builder Studio (video)', to: '/studio/course-builder' },
      { label: 'Course Builder Pro (arbre)', to: '/studio/course-builder-pro' },
    ],
  },
  {
    id: 'design',
    title: 'Mise en scene visuelle',
    subtitle: 'Slides, canvas, diffusion',
    options: [
      { label: 'SmartBoard Designer', to: DESIGNER_HREF },
    ],
  },
];

function getStartRoute(mode) {
  if (mode === 'assist') return '/studio/liri-agent';
  if (mode === 'manual') return '/studio/liri/cours';
  return '/studio/liri/cours';
}

function ConstructorDock({ item, active, onPick }) {
  return (
    <button
      type="button"
      onClick={() => onPick(item.id)}
      className={cn(
        'w-full rounded-xl border px-3 py-2.5 text-left transition',
        active
          ? 'border-cyan-400/35 bg-cyan-500/[0.12]'
          : 'border-white/10 bg-white/[0.03] hover:border-white/20',
      )}
    >
      <p className="text-[12px] font-semibold text-white/90">{item.title}</p>
      <p className="mt-0.5 text-[11px] text-white/45">{item.subtitle}</p>
    </button>
  );
}

export default function StudioLiriConstructeursHubPage() {
  const [mode, setMode] = useState('hybrid');
  const [focusedConstructorId, setFocusedConstructorId] = useState('liri-cours');
  const focused = useMemo(
    () => CONSTRUCTEURS_CATALOG.find((c) => c.id === focusedConstructorId) || CONSTRUCTEURS_CATALOG[0],
    [focusedConstructorId],
  );
  const startRoute = useMemo(() => getStartRoute(mode), [mode]);
  const allCourseConstructors = useMemo(
    () => CONSTRUCTEURS_CATALOG.filter((c) => ['programme', 'cours', 'video', 'arbre', 'scolaire'].includes(c.kind)),
    [],
  );

  return (
    <StudioDesignerLikeShell
      railActiveKey="constructeurs"
      pageLabel="Course Building Control Room"
      pageAccent="violet"
      TitleIcon={Compass}
      titleLine="Nouveau hub logiciel"
      topBarCenter={(
        <Link
          to="/studio/liri/constructeurs/guide"
          className="whitespace-nowrap rounded-lg border border-white/12 bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium text-white/55 transition-all hover:border-violet-500/30 hover:text-white/85"
        >
          Guide
        </Link>
      )}
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6">
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 rounded-2xl border border-white/10 bg-[#0b1020] px-5 py-4"
        >
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/[0.12] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-200">
            <Sparkles className="h-3 w-3" />
            Course Builder Software UI
          </div>
          <h1 className="text-[24px] font-bold text-white">Centre de pilotage de construction de cours</h1>
          <p className="mt-1 text-[13px] text-white/60">
            Une seule logique: choisir le mode de build, construire le contenu, puis envoyer au Designer pour la scene visuelle.
          </p>
        </motion.div>

        <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-white/10 bg-[#0b1020] p-3">
            <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
              <BookOpen className="h-3.5 w-3.5" />
              Constructeurs connectes
            </p>
            <div className="space-y-2">
              {allCourseConstructors.map((item) => (
                <ConstructorDock
                  key={item.id}
                  item={item}
                  active={item.id === focused?.id}
                  onPick={setFocusedConstructorId}
                />
              ))}
            </div>
          </aside>

          <section className="min-w-0 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-[#0b1020] p-4">
              <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Mode de construction
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {BUILD_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    className={cn(
                      'rounded-xl border px-3 py-2.5 text-left transition',
                      mode === m.id
                        ? 'border-cyan-400/35 bg-cyan-500/[0.12]'
                        : 'border-white/10 bg-white/[0.03] hover:border-white/20',
                    )}
                  >
                    <p className="text-[13px] font-semibold text-white">{m.title}</p>
                    <p className="mt-0.5 text-[11px] text-white/50">{m.hint}</p>
                  </button>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  to={startRoute}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-500 px-4 py-2 text-[12px] font-semibold text-black transition hover:bg-cyan-400"
                >
                  Ouvrir l outil recommande
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to={DESIGNER_HREF}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2 text-[12px] font-medium text-white/85 transition hover:bg-white/[0.08]"
                >
                  Ouvrir Designer
                  <LayoutGrid className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0b1020] p-4">
              <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
                <Workflow className="h-3.5 w-3.5" />
                Pipeline connecte
              </p>
              <div className="grid gap-3 md:grid-cols-3">
                {PIPELINE.map((step, idx) => (
                  <div key={step.id} className="relative rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-white/35">Etape {idx + 1}</p>
                    <p className="mt-1 text-[14px] font-semibold text-white/90">{step.title}</p>
                    <p className="mt-0.5 text-[11px] text-white/50">{step.subtitle}</p>
                    <div className="mt-2 space-y-1.5">
                      {step.options.map((opt) => (
                        <Link
                          key={opt.to}
                          to={opt.to}
                          className="flex items-center justify-between rounded-lg border border-white/10 bg-[#0a0f1d] px-2.5 py-2 text-[11px] text-white/80 transition hover:border-cyan-400/35 hover:text-cyan-200"
                        >
                          <span>{opt.label}</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      ))}
                    </div>
                    {idx < PIPELINE.length - 1 ? (
                      <div className="pointer-events-none absolute -right-2 top-1/2 hidden h-px w-4 bg-cyan-400/40 md:block" />
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0b1020] p-4">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">Focus constructeur</p>
              <h2 className="text-[18px] font-semibold text-white">{focused?.title}</h2>
              <p className="mt-1 text-[13px] text-white/60">{focused?.subtitle}</p>
              <p className="mt-2 text-[12px] text-white/50">{focused?.cahierDesCharges}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  to={focused?.href || '/studio/liri/cours'}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5 text-[12px] font-medium text-cyan-200 transition hover:bg-cyan-500/20"
                >
                  Ouvrir ce constructeur
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  to="/studio/liri/constructeurs/guide"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[12px] font-medium text-white/75 transition hover:bg-white/[0.08]"
                >
                  Voir le guide complet
                  <BookOpen className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
    </StudioDesignerLikeShell>
  );
}
