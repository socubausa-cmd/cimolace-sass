/**
 * Centre de pilotage de construction de cours — interface logicielle unifiée.
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

// ── Charte LIRI ────────────────────────────────────────────────────────────
// Palette de la page, entièrement chaude. Deux rôles, jamais mélangés :
//   corail #d97757 (encre claire #e08a5f / #e8a97f) → sélection + actions
//   or     #e6cc92                                  → badge, repères non cliquables
// Fonds : page (fournie par la coque) #262624 · panneau #30302e · bloc #1f1e1c.
// Encre #f5f4ee · filet #f5f4ee/10.
//
// Les ids ('assist' / 'manual' / 'hybrid') pilotent getStartRoute : ce sont des
// identifiants, ils ne changent PAS. Seuls les libellés visibles sont corrigés.
const BUILD_MODES = [
  { id: 'assist', title: 'Assisté par IA', hint: 'Génération automatique + validation humaine' },
  { id: 'manual', title: 'Manuel', hint: 'Conception complète par le professeur' },
  { id: 'hybrid', title: 'Mixte', hint: 'IA + édition manuelle continue' },
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
    title: 'Construction pédagogique',
    subtitle: 'Structure, scripts, checkpoints',
    options: [
      // « Course Builder », « Formation Builder », « SmartBoard Designer » sont
      // les NOMS des produits du studio, employés tels quels dans tout le
      // portail et dans les routes : on ne les traduit pas, on traduit les
      // qualificatifs qui les accompagnent.
      { label: 'Agent LIRI', to: '/studio/liri-agent' },
      { label: 'Course Builder Studio (vidéo)', to: '/studio/course-builder' },
      { label: 'Course Builder Pro (arbre)', to: '/studio/course-builder-pro' },
    ],
  },
  {
    id: 'design',
    title: 'Mise en scène visuelle',
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
          ? 'border-[#d97757]/40 bg-[#d97757]/[0.14]'
          : 'border-[#f5f4ee]/10 bg-[#f5f4ee]/[0.03] hover:border-[#d97757]/30',
      )}
    >
      <p className="text-[12px] font-semibold text-[#f5f4ee]">{item.title}</p>
      {/* Sous-titre du dock : /45 valait 3,0:1 sur ce composite → /65 = 6,1:1. */}
      <p className="mt-0.5 text-[11px] text-[#f5f4ee]/65">{item.subtitle}</p>
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
      pageLabel="Centre de pilotage"
      // La coque expose des alias CHAUDS (coral/terre/or/ambre/brique/argile) :
      // l'accent de page passe toujours par l'un de ces noms chauds.
      pageAccent="coral"
      TitleIcon={Compass}
      titleLine="Nouveau hub logiciel"
      topBarCenter={(
        <Link
          to="/studio/liri/constructeurs/guide"
          className="whitespace-nowrap rounded-lg border border-[#f5f4ee]/10 bg-[#f5f4ee]/[0.05] px-2.5 py-1 text-[11px] font-medium text-[#f5f4ee]/65 transition-all hover:border-[#d97757]/40 hover:text-[#f5f4ee]"
        >
          Guide
        </Link>
      )}
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6">
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 rounded-2xl border border-[#f5f4ee]/10 bg-[#30302e] px-5 py-4"
        >
          {/* Badge en OR : repère non cliquable. Il doit rester distinct du
              corail, qui est réservé à ce qui est actionnable. */}
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#e6cc92]/35 bg-[#e6cc92]/[0.14] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#e6cc92]">
            <Sparkles className="h-3 w-3" />
            Interface logicielle de construction de cours
          </div>
          <h1 className="text-[24px] font-bold text-[#f5f4ee]">Centre de pilotage de construction de cours</h1>
          <p className="mt-1 text-[13px] text-[#f5f4ee]/80">
            Une seule logique : choisir le mode de construction, bâtir le contenu, puis l'envoyer au Designer pour la mise en scène visuelle.
          </p>
        </motion.div>

        <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-[#f5f4ee]/10 bg-[#30302e] p-3">
            <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#f5f4ee]/65">
              <BookOpen className="h-3.5 w-3.5" />
              Constructeurs connectés
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
            <div className="rounded-2xl border border-[#f5f4ee]/10 bg-[#30302e] p-4">
              <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#f5f4ee]/65">
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
                        ? 'border-[#d97757]/40 bg-[#d97757]/[0.14]'
                        : 'border-[#f5f4ee]/10 bg-[#f5f4ee]/[0.03] hover:border-[#d97757]/30',
                    )}
                  >
                    <p className="text-[13px] font-semibold text-[#f5f4ee]">{m.title}</p>
                    <p className="mt-0.5 text-[11px] text-[#f5f4ee]/65">{m.hint}</p>
                  </button>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {/* CTA principal : corail plein + encre sombre #1f1e1c (5,3:1).
                    Sur un aplat corail l'encre DOIT être sombre — le blanc n'y
                    donne que 2,8:1, sous le seuil de lisibilité. */}
                <Link
                  to={startRoute}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#d97757] px-4 py-2 text-[12px] font-semibold text-[#1f1e1c] transition hover:bg-[#e08a5f]"
                >
                  Ouvrir l'outil recommandé
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to={DESIGNER_HREF}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#f5f4ee]/15 bg-[#f5f4ee]/[0.04] px-4 py-2 text-[12px] font-medium text-[#f5f4ee]/80 transition hover:bg-[#f5f4ee]/[0.08]"
                >
                  Ouvrir Designer
                  <LayoutGrid className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-[#f5f4ee]/10 bg-[#30302e] p-4">
              <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#f5f4ee]/65">
                <Workflow className="h-3.5 w-3.5" />
                Chaîne connectée
              </p>
              <div className="grid gap-3 md:grid-cols-3">
                {PIPELINE.map((step, idx) => (
                  <div key={step.id} className="relative rounded-xl border border-[#f5f4ee]/10 bg-[#f5f4ee]/[0.03] p-3">
                    {/* « Étape N » est un repère de lecture, pas une action : OR. */}
                    <p className="text-[10px] uppercase tracking-[0.14em] text-[#e6cc92]">Étape {idx + 1}</p>
                    <p className="mt-1 text-[14px] font-semibold text-[#f5f4ee]">{step.title}</p>
                    <p className="mt-0.5 text-[11px] text-[#f5f4ee]/65">{step.subtitle}</p>
                    <div className="mt-2 space-y-1.5">
                      {step.options.map((opt) => (
                        <Link
                          key={opt.to}
                          to={opt.to}
                          className="flex items-center justify-between rounded-lg border border-[#f5f4ee]/10 bg-[#1f1e1c] px-2.5 py-2 text-[11px] text-[#f5f4ee]/80 transition hover:border-[#d97757]/40 hover:text-[#e8a97f]"
                        >
                          <span>{opt.label}</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      ))}
                    </div>
                    {idx < PIPELINE.length - 1 ? (
                      <div className="pointer-events-none absolute -right-2 top-1/2 hidden h-px w-4 bg-[#d97757]/45 md:block" />
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-[#f5f4ee]/10 bg-[#30302e] p-4">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#f5f4ee]/65">Focus constructeur</p>
              <h2 className="text-[18px] font-semibold text-[#f5f4ee]">{focused?.title}</h2>
              <p className="mt-1 text-[13px] text-[#f5f4ee]/80">{focused?.subtitle}</p>
              <p className="mt-2 text-[12px] text-[#f5f4ee]/65">{focused?.cahierDesCharges}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  to={focused?.href || '/studio/liri/cours'}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#d97757]/35 bg-[#d97757]/10 px-3 py-1.5 text-[12px] font-medium text-[#e8a97f] transition hover:bg-[#d97757]/20"
                >
                  Ouvrir ce constructeur
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  to="/studio/liri/constructeurs/guide"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#f5f4ee]/15 bg-[#f5f4ee]/[0.04] px-3 py-1.5 text-[12px] font-medium text-[#f5f4ee]/80 transition hover:bg-[#f5f4ee]/[0.08]"
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
