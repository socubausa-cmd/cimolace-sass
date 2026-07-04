/**
 * StudioLiriPedagogieFuturPage — « Pédagogie du futur »
 * Route : /studio/liri/pedagogie-futur
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Route, GraduationCap, Brain, LayoutGrid, Radio, Film, Sparkles,
  ArrowRight, Calendar, Clapperboard, Layers,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import { cn } from '@/lib/utils';
import StudioDesignerLikeShell from '@/components/liri/liri-ecosystem/StudioDesignerLikeShell';
import SchoolPathsParcoursPanel from '@/components/liri/liri-ecosystem/SchoolPathsParcoursPanel';
import WeekGrammarTemplateSelector from '@/components/liri/liri-ecosystem/WeekGrammarTemplateSelector';
import { useAuth } from '@/contexts/SupabaseAuthContext';

// WeekDayEditorPanel — à créer ; lazy pour ne pas bloquer le build tant que le fichier est absent
const WeekDayEditorPanel = React.lazy(() =>
  import('@/components/liri/liri-ecosystem/WeekDayEditorPanel').catch(() => ({ default: () => null }))
);

function assetUrl(filename) {
  const base = import.meta.env.BASE_URL || '/';
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return `${prefix}liri-pedagogie-futur/${filename}`;
}

const ACCENT = {
  teal: { text: 'text-teal-400', bg: 'bg-teal-500/15', border: 'border-teal-500/30', glow: 'shadow-[0_0_14px_rgba(224,151,106,0.3)]' },
  cyan: { text: 'text-cyan-400', bg: 'bg-cyan-500/15', border: 'border-cyan-500/30', glow: 'shadow-[0_0_14px_rgba(227,170,107,0.3)]' },
  violet: { text: 'text-violet-400', bg: 'bg-violet-500/15', border: 'border-violet-500/30', glow: 'shadow-[0_0_14px_rgba(236,174,144,0.3)]' },
  blue: { text: 'text-blue-400', bg: 'bg-blue-500/15', border: 'border-blue-500/30', glow: 'shadow-[0_0_14px_rgba(218,160,122,0.25)]' },
  amber: { text: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30', glow: 'shadow-[0_0_14px_rgba(251,191,36,0.25)]' },
};

const BLOCK_LABELS = {
  previsualisation_video: 'Prévisualisation vidéo',
  opening_live: 'Live d\'ouverture',
  smartboard_session: 'Session SmartBoard',
  friction_block: 'Friction pédagogique',
  doctrinal_video: 'Vidéo doctrinale',
  experiment_block: 'Expérimentation',
  closure_live: 'Live de clôture',
  recall_block: 'Recall / mémorisation',
  quiz_block: 'Quiz',
  mindmap_block: 'Mindmap',
  summary_block: 'Synthèse',
};

const ROADMAP_PHASES = [
  { title: 'Phase 1', items: ['Base de données parcours', 'UI parcours → cours → modules / semaines / jours / blocs', 'Weekly grammar (JSON)', 'Replay & analytics (tables)'] },
  { title: 'Phase 2', items: ['SmartBoard paginé', 'Contenus par type de bloc', 'Lives ouverture / clôture', 'Friction & recall'] },
  { title: 'Phase 3', items: ['Post-production IA', 'Replay enrichi', 'Quiz', 'Mindmap'] },
  { title: 'Phase 4', items: ['LONGIA pédagogique', 'Recommandation de parcours', 'Analytics'] },
];

function PedagogieFooter() {
  return (
    <footer
      className="flex h-14 flex-shrink-0 items-center gap-3 border-t border-white/[0.07] px-3"
      style={{ background: '#1f1e1c' }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2">
        <Sparkles className="h-4 w-4 shrink-0 text-amber-400/85" />
        <p className="truncate text-[11px] leading-snug text-white/38">
          <span className="text-white/55">Parcours scolaire</span>
          {' '}·           Tables{' '}
          <code className="rounded bg-white/[0.06] px-1 py-0.5 text-[10px] text-white/45">school_paths</code>
          {' '}— CRUD parcours & cours disponible sur cette page (modules / semaines à venir).
        </p>
      </div>
      <Link
        to="/studio/liri/formation"
        className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-blue-500/25 bg-blue-500/10 px-3 py-2 text-[11px] font-semibold text-blue-300/95 transition-all hover:bg-blue-500/18 sm:flex"
      >
        <GraduationCap className="h-3.5 w-3.5" />
        Formation
      </Link>
    </footer>
  );
}

function QuickLink({ to, icon: Icon, title, desc, accentKey }) {
  const a = ACCENT[accentKey] ?? ACCENT.cyan;
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 transition-all hover:border-white/14 hover:bg-white/[0.06]"
    >
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border', a.bg, a.border)}>
        <Icon className={cn('h-5 w-5', a.text)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-white/88">{title}</div>
        <div className="text-[11px] text-white/38">{desc}</div>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-white/22" />
    </Link>
  );
}

function SectionTitle({ icon: Icon, children, id: sectionId }) {
  return (
    <h2
      id={sectionId}
      className="mb-3 flex scroll-mt-24 items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.15em] text-white/35"
    >
      {Icon ? <Icon className="h-3.5 w-3.5 text-white/28" /> : null}
      {children}
    </h2>
  );
}

function TopBarSectionNav() {
  const tabs = [
    { id: 'pedago-parcours', label: 'Parcours', color: 'teal' },
    { id: 'pedago-atelier', label: 'Atelier', color: 'teal' },
    { id: 'pedago-semaine', label: 'Semaine', color: 'amber' },
    { id: 'pedago-blocs', label: 'Blocs', color: 'violet' },
    { id: 'pedago-roadmap', label: 'Roadmap', color: 'cyan' },
  ];
  return (
    <div className="flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl border border-white/[0.08] bg-white/[0.03] p-0.5">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => document.getElementById(t.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className={cn(
            'whitespace-nowrap rounded-lg border border-transparent px-2.5 py-1 text-[11px] font-semibold text-white/35 transition-all hover:bg-white/[0.06] hover:text-white/65',
            t.color === 'teal' && 'hover:border-teal-500/25',
            t.color === 'amber' && 'hover:border-amber-500/25',
            t.color === 'violet' && 'hover:border-violet-500/25',
            t.color === 'cyan' && 'hover:border-cyan-500/25',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export default function StudioLiriPedagogieFuturPage() {
  const { user } = useAuth();
  const [blockTypes, setBlockTypes] = useState([]);
  const [weeklyGrammar, setWeeklyGrammar] = useState(null);
  const [selectedWeekId, setSelectedWeekId] = useState(null);

  const load = useCallback(async () => {
    try {
      const [bt, wg] = await Promise.all([
        fetch(assetUrl('pedagogical_block_types.json')).then(r => (r.ok ? r.json() : {})),
        fetch(assetUrl('weekly_grammar.schema.json')).then(r => (r.ok ? r.json() : {})),
      ]);
      setBlockTypes(Array.isArray(bt?.block_types) ? bt.block_types : []);
      setWeeklyGrammar(wg?.weekly_grammar || null);
    } catch {
      setBlockTypes([]);
      setWeeklyGrammar(null);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const weekEntries = weeklyGrammar
    ? Object.entries(weeklyGrammar).sort(([a], [b]) => a.localeCompare(b))
    : [];

  return (
    <StudioDesignerLikeShell
      railActiveKey="pedagogie"
      pageLabel="Pédagogie du futur"
      pageAccent="teal"
      TitleIcon={Route}
      titleLine="Méthode & parcours"
      topBarCenter={<TopBarSectionNav />}
      footer={<PedagogieFooter />}
    >
      <div className="mx-auto max-w-5xl px-5 py-6 pb-10 lg:px-8">
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32 }} className="mb-8 space-y-4">
          <p className="max-w-2xl text-[14px] leading-relaxed text-white/42">
            Parcours scolaire structuré, weekly grammar, blocs pédagogiques et post-production IA — navigation et coque alignées sur le
            SmartBoard Designer.
          </p>
          <div className="max-w-2xl rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3.5">
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-teal-400/90 mb-2">Enchaînement produit</p>
            <p className="mb-3 text-[12px] text-white/38">
              Vue d'ensemble de tous les outils :{' '}
              <Link to="/studio/liri/constructeurs" className="text-teal-400/90 underline-offset-2 hover:underline">hub Constructeurs</Link>
              {' '}(choix guidé) ·{' '}
              <Link to="/studio/liri/constructeurs/guide" className="text-teal-400/90 underline-offset-2 hover:underline">guide comparatif</Link>.
            </p>
            <ol className="list-decimal space-y-2 pl-4 text-[13px] leading-relaxed text-white/50">
              <li>
                <strong className="text-white/78">Constructeurs</strong> —{' '}
                <Link to="/studio/liri/formation" className="text-blue-400/90 underline-offset-2 hover:underline">Formation</Link>,{' '}
                <Link to="/studio/liri/cours" className="text-amber-400/90 underline-offset-2 hover:underline">Cours</Link> : programmes,
                modules, les 10 étapes LIRI, scripts et intention pédagogique. Ce n'est pas encore la scène graphique.
              </li>
              <li>
                <span className="inline-flex items-end gap-1 font-semibold text-white/78">
                  <LiriWordmark size="kicker" className="text-white/78" subtleGlow />
                  <span>Designer</span>
                </span>{' '}
                —{' '}
                <Link to="/studio/smartboard-designer" className="text-cyan-400/90 underline-offset-2 hover:underline">SmartBoard Designer</Link>{' '}
                : une fois le cours construit, vous y concevez les slides, les objets, les fonds et toutes les couches designables du
                canevas, jusqu'à l\'export ou le live.
              </li>
            </ol>
          </div>
        </motion.div>

        <section className="mb-10" id="pedago-parcours">
          <SectionTitle icon={Route}>Parcours scolaires (cloud)</SectionTitle>
          <p className="mb-4 max-w-2xl text-[12px] leading-relaxed text-white/38">
            Créez des parcours <code className="rounded bg-white/[0.06] px-1 text-[10px]">school_paths</code>, des{' '}
            <code className="rounded bg-white/[0.06] px-1 text-[10px]">path_courses</code>, puis ouvrez la structure : modules, semaines, jours typés et blocs pédagogiques (données JSON par bloc).
          </p>
          <SchoolPathsParcoursPanel
            userId={user?.id ?? null}
            onWeekClick={(weekId) => setSelectedWeekId(weekId)}
          />
        </section>

        <section className="mb-10" id="pedago-atelier">
          <SectionTitle>Raccourcis atelier</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            <QuickLink
              to="/studio/liri/formation"
              icon={GraduationCap}
              title="Formation complète"
              desc="Programme multi-modules dans le temps"
              accentKey="blue"
            />
            <QuickLink
              to="/studio/liri/cours"
              icon={Brain}
              title="Cours unique"
              desc="10 étapes · MasterScript · SmartBoard"
              accentKey="amber"
            />
            <QuickLink
              to="/studio/smartboard-designer"
              icon={LayoutGrid}
              title="SmartBoard Designer"
              desc="Progressif · paginé (schéma JSON premium)"
              accentKey="cyan"
            />
            <QuickLink to="/studio/live" icon={Radio} title="Live classroom" desc="Ouverture / clôture · diffusion" accentKey="violet" />
          </div>
        </section>

        {weekEntries.length > 0 && (
          <section className="mb-10" id="pedago-semaine">
            <SectionTitle icon={Calendar}>Weekly grammar (7 jours)</SectionTitle>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {weekEntries.map(([key, day]) => (
                <div
                  key={key}
                  className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 backdrop-blur-sm"
                >
                  <div className="text-[10px] font-medium uppercase tracking-wider text-white/28">{key.replace(/_/g, ' ')}</div>
                  <div className="text-[12px] font-medium text-white/82">{BLOCK_LABELS[day?.type] || day?.type || '—'}</div>
                  {day?.goal ? <div className="mt-1 text-[11px] text-white/38">{day.goal}</div> : null}
                </div>
              ))}
            </div>

            {weeklyGrammar && (
              <div className="mt-6">
                <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-teal-400/80">
                  Appliquer un template à la semaine sélectionnée
                </p>
                <WeekGrammarTemplateSelector
                  weekId={selectedWeekId}
                  onApplied={() => setSelectedWeekId(null)}
                />
              </div>
            )}
          </section>
        )}

        {selectedWeekId && (
          <section className="mb-10" id="pedago-edition-semaine">
            <SectionTitle icon={Calendar}>Edition semaine</SectionTitle>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-[12px] text-amber-300/70">
              Semaine sélectionnée : <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-white/60">{selectedWeekId}</code>
            </div>
            <React.Suspense fallback={null}>
              <WeekDayEditorPanel weekId={selectedWeekId} />
            </React.Suspense>
          </section>
        )}

        <section className="mb-10" id="pedago-blocs">
          <SectionTitle icon={Layers}>Types de blocs pédagogiques</SectionTitle>
          <div className="flex flex-wrap gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 backdrop-blur-sm">
            {blockTypes.length === 0 ? (
              <span className="text-[12px] text-white/35">Chargement ou schéma indisponible — vérifiez public/liri-pedagogie-futur/.</span>
            ) : null}
            {blockTypes.map(type => (
              <span
                key={type}
                className="rounded-full border border-violet-500/22 bg-violet-500/10 px-3 py-1 text-[11px] text-violet-200/90"
              >
                {BLOCK_LABELS[type] || type}
              </span>
            ))}
          </div>
        </section>

        <section className="mb-10">
          <SectionTitle icon={Clapperboard}>Post-production IA</SectionTitle>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 backdrop-blur-sm">
            <p className="mb-3 text-[13px] text-white/40">
              Pipeline : transcription, segmentation, chapitres, résumé, points clés, quiz, mindmap, replays —{' '}
              <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-white/52">post_production_pipeline.json</code>.
            </p>
            <Link
              to="/studio/export-center"
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] text-white/58 transition-all hover:border-white/18 hover:text-white/85"
            >
              <Film className="h-3.5 w-3.5" />
              Export Center
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </section>

        <section id="pedago-roadmap">
          <SectionTitle icon={Sparkles}>Roadmap produit</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            {ROADMAP_PHASES.map(phase => (
              <div
                key={phase.title}
                className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 backdrop-blur-sm"
              >
                <div className="mb-2 text-[13px] font-semibold text-white/86">{phase.title}</div>
                <ul className="space-y-1.5 text-[12px] text-white/42">
                  {phase.items.map(item => (
                    <li key={item} className="flex gap-2">
                      <span className="text-teal-500/75">·</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>
    </StudioDesignerLikeShell>
  );
}
