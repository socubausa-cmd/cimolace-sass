import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Brain,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  Cuboid,
  Download,
  FileText,
  FolderOpen,
  GraduationCap,
  HelpCircle,
  Home,
  Layers,
  LayoutGrid,
  Lightbulb,
  ListOrdered,
  Loader2,
  MessageCircle,
  Monitor,
  Network,
  Pencil,
  Plus,
  RefreshCcw,
  Rocket,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Trophy,
  Upload,
  UserCircle2,
  Users,
  Zap,
} from 'lucide-react';
import {
  MASTERCLASS_STEPS,
  useMasterclassProject,
  DOCUMENT_ANALYZE_FIRST_WINDOW_CHARS,
} from '@/hooks/useMasterclassProject';
import { LiriPortalShell } from '@/components/liri/LiriPortalShell';
import { savePendingMasterclassForLiveStudio } from '@/lib/liriAgentExportToLiveStudio';
import { masterclassProjectToPrecepteurCourse } from '@/lib/precepteur/fromMasterclass';
import { enrichCourseWithCroquis, buildCroquisSeeds } from '@/lib/precepteur/enrichCroquis';
import { supabase } from '@/lib/supabaseCompat';
import { masterclassApi } from '@/lib/api-v2';

const EXAMPLE_TYPES = [
  'Cours théologique',
  'Transcription audio',
  'Enseignement',
  'Conférence',
  'Article',
  'Livre',
];

const GAINS = [
  // Col 1
  'Analyse complète du texte',
  'Découpage en blocs de sens',
  'Idées centrales & révélations',
  'Chapitres structurés',
  // Col 2
  'Objectifs pédagogiques',
  'Compétences à acquérir',
  'Mises en situation',
  'Tensions pédagogiques',
  // Col 3
  'Expériences de pensée',
  'Analogies & exemples',
  'Ateliers participatifs',
  'Leçon simple & développée',
  // Col 4
  'JE RETIENS (dictée)',
  'Tests de compréhension',
  'Cas pratiques & exercices',
  'Erreurs attendues & correction',
  // Col 5
  'Slides SmartBoard',
  'Script professeur',
  'Cahier élève',
  'Export multi-formats',
];

/** Répartition maquette « Ce que tu obtiens » — 5 colonnes × 4 lignes (alignée maquette) */
const GAINS_COLUMN_INDICES = [
  [0, 1, 2, 3],
  [4, 5, 6, 7],
  [8, 9, 10, 11],
  [12, 13, 14, 15],
  [16, 17, 18, 19],
];

/**
 * « Comment ça marche » — aligné maquette :
 * Doc → Network → Cuboid → liste → grille → Monitor (slides) → Upload.
 * Halos adoucis (~30 % opacité) + verre / bordure 1px — aligné maquette premium.
 */
const HOW_IT_WORKS_STEPS = [
  {
    label: 'Texte brut',
    sub: 'Tu fournis le contenu',
    Icon: FileText,
    border: 'border-[#d97757]/45',
    iconClass: 'text-[#e8b6a3]',
    halo: 'from-[#d97757]/50 via-[#d97757]/20 to-transparent',
    glow: 'shadow-[0_0_26px_-6px_rgba(217,119,87,0.55),inset_0_1px_0_rgba(255,255,255,0.14)]',
    glass: 'from-white/[0.14] to-[#1f1e1c]/25',
  },
  {
    label: 'Analyse IA',
    sub: 'L\'IA comprend',
    Icon: Network,
    border: 'border-[#d97757]/45',
    iconClass: 'text-[#e8b6a3]',
    halo: 'from-[#d97757]/45 via-[#c2683f]/20 to-transparent',
    glow: 'shadow-[0_0_26px_-6px_rgba(217,119,87,0.45),inset_0_1px_0_rgba(255,255,255,0.12)]',
    glass: 'from-white/[0.12] to-[#1f1e1c]/35',
  },
  {
    label: 'Blocs & idées',
    sub: 'Découpage intelligent',
    Icon: Cuboid,
    border: 'border-[#d97757]/40',
    iconClass: 'text-[#e8b6a3]',
    halo: 'from-[#d97757]/45 via-[#c2683f]/15 to-transparent',
    glow: 'shadow-[0_0_24px_-6px_rgba(217,119,87,0.4),inset_0_1px_0_rgba(255,255,255,0.12)]',
    glass: 'from-white/[0.12] to-[#1f1e1c]/35',
  },
  {
    label: 'Chapitres',
    sub: 'Structure logique',
    Icon: ListOrdered,
    border: 'border-amber-400/45',
    iconClass: 'text-amber-100',
    halo: 'from-amber-400/50 via-amber-500/18 to-transparent',
    glow: 'shadow-[0_0_24px_-6px_rgba(217,119,87,0.38),inset_0_1px_0_rgba(255,255,255,0.12)]',
    glass: 'from-white/[0.12] to-amber-950/25',
  },
  {
    label: 'Pédagogie',
    sub: 'Contenu complet',
    Icon: LayoutGrid,
    border: 'border-[#9fbf8f]/45',
    iconClass: 'text-[#9fbf8f]',
    halo: 'from-[#9fbf8f]/40 via-green-500/18 to-transparent',
    glow: 'shadow-[0_0_22px_-6px_rgba(122,155,108,0.42),inset_0_1px_0_rgba(255,255,255,0.1)]',
    glass: 'from-white/[0.1] to-[#7a9b6c]/28',
  },
  {
    label: 'Slides & Docs',
    sub: 'Supports prêts',
    Icon: Monitor,
    border: 'border-[#d97757]/42',
    iconClass: 'text-[#e8b6a3]',
    halo: 'from-[#d97757]/40 via-[#d97757]/14 to-transparent',
    glow: 'shadow-[0_0_24px_-6px_rgba(217,119,87,0.4),inset_0_1px_0_rgba(255,255,255,0.11)]',
    glass: 'from-white/[0.11] to-[#1f1e1c]/32',
  },
  {
    label: 'Export',
    sub: 'Prêt à enseigner',
    Icon: Upload,
    border: 'border-[#d97757]/45',
    iconClass: 'text-[#e8b6a3]',
    halo: 'from-[#d97757]/40 via-[#d97757]/22 to-transparent',
    glow: 'shadow-[0_0_26px_-6px_rgba(217,119,87,0.48),inset_0_1px_0_rgba(255,255,255,0.11)]',
    glass: 'from-white/[0.12] to-[#1f1e1c]/32',
  },
];

const PEDAGOGY_LABELS = [
  'Objectif du chapitre',
  'Compétence à acquérir',
  'Connaissance à transmettre',
  'Mise en situation',
  'Tension pédagogique',
  'Expérience de pensée',
  'Révélation',
  'Leçon simple',
  'Leçon développée',
  'Analogies',
  'Exemples',
  'Reformulation',
  'Atelier / Application',
  'Erreurs attendues',
  'Correction pédagogique',
  'JE RETIENS',
  'Test de compréhension',
  'Cas réel',
  'Lien conceptuel',
  'Niveau de maîtrise',
  'Transition',
];

const TYPE_COLORS = {
  sense_block: 'bg-[#7a9b6c]/10 text-[#9fbf8f]',
  chapter: 'bg-[#c2683f]/10 text-[#d97757]',
  doctrine: 'bg-[#d97757]/10 text-[#d97757]',
  definition: 'bg-[#c2683f]/10 text-[#d97757]',
  revelation: 'bg-amber-500/10 text-amber-300',
  analogy: 'bg-[#7a9b6c]/10 text-[#9fbf8f]',
  example: 'bg-pink-500/10 text-pink-300',
  practice: 'bg-[#c2683f]/10 text-[#d97757]',
  transition: 'bg-white/5 text-white/60',
};

/* ──────────────────────────── Sidebar ──────────────────────────── */

function FactorySidebar() {
  const location = useLocation();
  const masterclassFactoryPath = location.pathname.includes('/dev/masterclass-factory')
    ? '/dev/masterclass-factory'
    : '/dashboard/tools/masterclass-factory';

  const mainNav = [
    { label: 'Accueil', icon: Home, to: '/dashboard' },
    { label: 'Projets', icon: FolderOpen, to: '/projects' },
    { label: 'Liri Chat', icon: MessageCircle, to: '/messages' },
    { label: 'Liri Live', icon: Rocket, to: '/lives' },
    { label: 'Cours', icon: BookOpen, to: '/courses' },
    { label: 'Élèves', icon: Users, to: '/student-school-life/dashboard' },
    { label: 'SmartBoard', icon: Layers, to: '/studio/live-preparation' },
  ];

  const aiToolsNav = [
    {
      label: 'Masterclass Factory',
      icon: GraduationCap,
      to: masterclassFactoryPath,
      active: location.pathname.includes('masterclass-factory'),
    },
    { label: 'Analyses', icon: Brain, to: '/reports' },
    { label: 'Quiz & Tests', icon: Trophy, to: '/workshops' },
    { label: 'Médias IA', icon: ShieldCheck, to: '/resources' },
  ];

  const settingsNav = [
    { label: 'Paramètres', icon: Settings, to: '/settings' },
  ];

  const helpNav = [
    { label: 'Tutoriels', icon: HelpCircle, to: '/support' },
    { label: "Centre d'aide", icon: HelpCircle, to: '/faq' },
  ];

  const renderItem = (item, kind = 'main') => {
    const Icon = item.icon;
    const active =
      item.active !== undefined ? item.active : location.pathname === item.to;
    const variant =
      kind === 'tool' && active
        ? 'bg-gradient-to-r from-[#d97757] to-[#d97757] text-white shadow-[0_8px_22px_-10px_rgba(217,119,87,0.65)]'
        : active
          ? 'bg-white/10 text-white'
          : 'text-white/70 hover:bg-white/5 hover:text-white';
    return (
      <Link
        key={item.label}
        to={item.to}
        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition ${variant}`}
      >
        <Icon size={15} className="shrink-0" strokeWidth={1.85} />
        <span className="truncate text-[12px]">{item.label}</span>
      </Link>
    );
  };

  return (
    <aside className="premium-sidebar relative flex w-[200px] shrink-0 flex-col border-r border-white/10 bg-[#1f1e1c]/95 p-3">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_0%_0%,rgba(217,119,87,0.18),transparent_55%)]" />

      <div className="relative mb-4 flex items-center gap-2.5 px-1">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#c2683f]/45 to-[#c2683f]/25 text-white ring-1 ring-[#d97757]/40 shadow-[0_0_28px_-10px_rgba(217,119,87,0.85)]">
          <Sparkles size={20} strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <h1 className="text-[18px] font-bold leading-none tracking-tight text-white">LIRI</h1>
          <p className="mt-0.5 text-[10px] leading-tight text-white/55">Assistant pédagogique IA</p>
        </div>
      </div>

      <nav className="relative flex-1 space-y-0.5 overflow-y-auto pr-0.5 text-[12px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {mainNav.map((item) => renderItem(item, 'main'))}

        <div className="pt-3 pb-1 px-1 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-white/35">Outils IA</div>
        {aiToolsNav.map((item) => renderItem(item, 'tool'))}

        <div className="pt-3 pb-1 px-1 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-white/35">Paramètres</div>
        {settingsNav.map((item) => renderItem(item, 'main'))}

        <div className="pt-3 pb-1 px-1 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-white/35">Aide</div>
        {helpNav.map((item) => renderItem(item, 'main'))}
      </nav>

      <div className="relative mt-2 border-t border-white/10 pt-2.5">
        <button
          type="button"
          className="flex w-full items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-2 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:bg-white/[0.07]"
        >
          <span className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#d97757]/40 to-[#c2683f]/20 ring-1 ring-white/15">
            <UserCircle2 className="h-9 w-9 text-[#e8b6a3]/90" strokeWidth={1.4} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[12px] font-semibold leading-tight text-white">Professeur</p>
            <p className="mt-0.5 flex items-center gap-1 text-[10px] text-[#9fbf8f]/95">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#9fbf8f] shadow-[0_0_6px_rgba(122,155,108,0.9)]" />
              En ligne
            </p>
          </div>
        </button>
      </div>
    </aside>
  );
}

/* ──────────────────────────── Header & Progress ──────────────────────────── */

function FactoryHeader({ onReset, isRealBrain }) {
  return (
    <header className="mb-2.5 flex shrink-0 items-center justify-between gap-3 px-1">
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-[12.5px] font-semibold tracking-tight text-white/80">Masterclass Factory</span>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#d97757]/35 bg-[#d97757]/12 px-2 py-0.5 text-[10px] font-semibold text-[#e8b6a3]">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#d97757]" />
          Auto
        </span>
        {isRealBrain ? (
          <span className="shrink-0 text-[10px] text-[#9fbf8f]/90">● IA</span>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium text-white/55 transition hover:bg-white/[0.06] hover:text-white/85"
        >
          <Clock size={12} /> Historique
        </button>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#d97757] to-[#d97757] px-3 py-1.5 text-[11.5px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(217,119,87,0.7)] transition hover:brightness-110"
        >
          <Plus size={13} strokeWidth={2.5} />
          Nouveau projet
        </button>
      </div>
    </header>
  );
}

function FactoryProgress({ active, onJump, status }) {
  return (
    <div className="mb-3 flex shrink-0 items-center gap-1 overflow-x-auto px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {MASTERCLASS_STEPS.map((step, index) => {
        const done = index < active;
        const current = index === active;
        const reachable = index <= active || status === 'ready';
        return (
          <React.Fragment key={step.key}>
            <button
              type="button"
              onClick={() => reachable && onJump(index)}
              disabled={!reachable}
              className={`group flex shrink-0 items-center gap-1.5 rounded-lg px-1 py-0.5 transition ${
                reachable ? 'hover:bg-white/5' : 'cursor-not-allowed opacity-55'
              }`}
            >
              <div
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition ${
                  done
                    ? 'bg-[#7a9b6c]/25 text-[#9fbf8f]'
                    : current
                    ? 'bg-[#d97757] text-white shadow-[0_0_14px_-3px_rgba(217,119,87,0.85)]'
                    : 'bg-white/8 text-white/45'
                }`}
              >
                {done ? <Check size={11} strokeWidth={3} /> : index + 1}
              </div>
              <span
                className={`whitespace-nowrap text-[11px] transition ${
                  current ? 'font-semibold text-white' : done ? 'text-white/60' : 'text-white/35'
                }`}
              >
                {step.label}
              </span>
            </button>
            {index < MASTERCLASS_STEPS.length - 1 ? (
              <span
                aria-hidden
                className={`h-px min-w-[10px] flex-1 ${done ? 'bg-[#9fbf8f]/30' : 'bg-white/10'}`}
              />
            ) : null}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function OrchestratorLiveStrip({ orchestratorStatus, queues, chapterStatuses }) {
  if (!chapterStatuses?.length && orchestratorStatus !== 'running') return null;
  const phaseOrder = {
    draft: 1,
    structured: 2,
    ready_for_visual: 3,
    visual_mapped: 4,
    ready_for_smartboard: 5,
    smartboard_generating: 6,
    smartboard_completed: 7,
    completed: 8,
    failed: 9,
  };
  const orderedChapters = [...(chapterStatuses || [])].sort((a, b) => {
    const pa = phaseOrder[a?.status] || 99;
    const pb = phaseOrder[b?.status] || 99;
    if (pa !== pb) return pa - pb;
    return Number(a?.chapter_id || 0) - Number(b?.chapter_id || 0);
  });
  const groupedChapters = {
    Coach: orderedChapters.filter((c) => ['draft', 'structured'].includes(c?.status)),
    Visual: orderedChapters.filter((c) => ['ready_for_visual', 'visual_mapped'].includes(c?.status)),
    SmartBoard: orderedChapters.filter((c) => ['ready_for_smartboard', 'smartboard_generating', 'smartboard_completed'].includes(c?.status)),
    Quality: orderedChapters.filter((c) => ['completed', 'failed'].includes(c?.status)),
  };
  const total = chapterStatuses?.length || 0;
  const completed = chapterStatuses?.filter((c) => c.status === 'completed').length || 0;
  const failed = chapterStatuses?.filter((c) => c.status === 'failed').length || 0;
  const running = chapterStatuses?.filter((c) => c.status === 'smartboard_generating').length || 0;

  return (
    <div className="mb-2 shrink-0 rounded-lg border border-[#c2683f]/30 bg-[#c2683f]/10 px-3 py-2 text-[10px] text-[#e8b6a3]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold">Orchestrateur</span>
        <span>status: {orchestratorStatus}</span>
        <span>chapitres: {completed}/{total}</span>
        <span>running: {running}</span>
        <span>failed: {failed}</span>
        <span>Q coach: {queues?.coach_queue?.length || 0}</span>
        <span>Q visual: {queues?.visual_queue?.length || 0}</span>
        <span>Q smartboard: {queues?.smartboard_queue?.length || 0}</span>
        <span>Q quality: {queues?.quality_queue?.length || 0}</span>
      </div>
      {orderedChapters?.length ? (
        <div className="mt-2 grid grid-cols-1 gap-1.5 lg:grid-cols-4">
          {Object.entries(groupedChapters).map(([groupName, chapters]) => (
            <div key={groupName} className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5">
              <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-white/55">{groupName}</p>
              <div className="flex min-h-[22px] flex-wrap gap-1">
                {(chapters || []).map((chapter) => {
                  const status = chapter?.status || 'draft';
                  const statusClass =
                    status === 'completed'
                      ? 'border-[#9fbf8f]/50 bg-[#7a9b6c]/20 text-[#9fbf8f]'
                      : status === 'failed'
                      ? 'border-red-400/50 bg-red-500/20 text-red-100'
                      : status === 'smartboard_generating'
                      ? 'border-[#d97757]/50 bg-[#d97757]/20 text-[#e8b6a3]'
                      : status === 'ready_for_smartboard'
                      ? 'border-[#d97757]/50 bg-[#c2683f]/20 text-[#e8b6a3]'
                      : status === 'ready_for_visual' || status === 'visual_mapped'
                      ? 'border-amber-400/50 bg-amber-500/20 text-amber-100'
                      : 'border-white/20 bg-white/10 text-white/80';
                  const motionClass = status === 'smartboard_generating' ? 'animate-pulse' : '';

                  return (
                    <div
                      key={`${groupName}-${chapter.chapter_id}-${status}`}
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${statusClass} ${motionClass}`}
                      title={`${chapter.title || `Chapitre ${chapter.chapter_id}`} · ${status}`}
                    >
                      <span className="font-semibold">Ch {chapter.chapter_id}</span>
                      <span className="opacity-70">({chapter.slides_count || 0})</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ──────────────────────────── Helpers UI ──────────────────────────── */

function StatCard({ value, label }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#30302e] p-2.5 text-center">
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px] text-white/45">{label}</p>
    </div>
  );
}

/** Stats avec icône — étape 1 / aperçu (alignée maquette) */
function StatPreviewMini({ icon: Icon, value, label }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#30302e] px-2 py-2.5 text-center shadow-inner shadow-black/30">
      <div className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-lg bg-[#d97757]/12 text-[#d97757] ring-1 ring-[#d97757]/25">
        <Icon className="h-4 w-4" strokeWidth={1.85} />
      </div>
      <p className="text-[18px] font-bold tabular-nums leading-none text-white">{value}</p>
      <p className="mt-1 text-[10px] leading-tight text-white/50">{label}</p>
    </div>
  );
}

function Panel({ title, children, action, dense = false, className = '' }) {
  return (
    <section className={`rounded-2xl border border-white/10 bg-white/[0.04] ${dense ? 'p-3' : 'p-4'} ${className}`}>
      {title || action ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title ? <h3 className="text-base font-bold">{title}</h3> : <span />}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

function MiniList({ title, items, color }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className={`mb-2 text-[10px] font-bold uppercase tracking-wide ${color}`}>{title}</p>
      <div className="space-y-1">
        {(items || []).map((x, i) => (
          <p key={`${x}-${i}`} className="text-[11px] text-white/65">
            • {x}
          </p>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────── Step 1 — Texte brut (maquette) ──────────────────────────── */

function Step1Raw({ rawText, setRawText, onLaunch, status, onLoadDemo, MAX_RAW_CHARS,
  documentAnalyzeOptions, onDocumentAnalyzeOptionsChange }) {
  const [exampleTag, setExampleTag] = useState(EXAMPLE_TYPES[0]);
  const [showOptions, setShowOptions] = useState(false);
  const fileInputRef = useRef(null);
  const canLaunch = Boolean(rawText.trim()) && status !== 'running';

  const onPickFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setRawText(String(reader.result || '').slice(0, MAX_RAW_CHARS));
    reader.readAsText(f);
    e.target.value = '';
  };

  // Écran IMMERSIF (façon RDV) : une seule colonne centrée, de l'air, une action.
  // Pas d'aperçu vide « 0/0/0 » ni de liste d'éléments — ça n'apparaît qu'APRÈS.
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-72 w-[620px] -translate-x-1/2 opacity-70"
        style={{ background: 'radial-gradient(closest-side, rgba(217,119,87,0.12), transparent 72%)', filter: 'blur(60px)' }}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-[720px] flex-1 flex-col justify-center px-4 py-8">

        {/* En-tête épuré */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#d97757]/14 ring-1 ring-[#d97757]/30">
            <FileText className="h-6 w-6 text-[#d97757]" strokeWidth={1.7} />
          </div>
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#d97757]">Masterclass · Étape 1 sur 8</div>
          <h2 className="mt-1.5 text-[25px] font-extrabold leading-tight tracking-tight text-white" style={{ textWrap: 'balance' }}>
            Colle ton contenu
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-white/55">
            Texte, transcription, doctrine ou simple idée — LIRI s&apos;occupe de tout le reste.
          </p>
        </div>

        {/* Zone de saisie (warm, sans violet) */}
        <div className="relative rounded-2xl border border-[#d97757]/25 bg-[#1f1e1c] shadow-[0_0_0_1px_rgba(217,119,87,0.18),0_20px_50px_-30px_rgba(217,119,87,0.6)] transition focus-within:border-[#d97757]/60">
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={8}
            className="w-full resize-none bg-transparent p-4 text-[14px] leading-relaxed text-white outline-none placeholder:text-white/30"
            placeholder="Colle ici ton texte, ta transcription, ta doctrine, ton idée…"
          />
          <div className="flex items-center justify-between border-t border-white/[0.06] px-3 py-2">
            <div className="flex items-center gap-1.5">
              <input ref={fileInputRef} type="file" accept=".txt,.md,.text,text/plain" className="sr-only" onChange={onPickFile} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-2.5 py-1 text-[11.5px] font-medium text-white/70 transition hover:border-white/25 hover:text-white"
              >
                <Upload className="h-3.5 w-3.5" /> Importer
              </button>
              {rawText ? (
                <button
                  type="button"
                  onClick={() => setRawText('')}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11.5px] text-white/45 transition hover:text-white/75"
                >
                  <Trash2 size={12} /> Effacer
                </button>
              ) : null}
            </div>
            <span className="text-[11px] tabular-nums text-white/30">
              {rawText.length.toLocaleString()} / {MAX_RAW_CHARS.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Exemples + démo (subtil, centré) */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
          {EXAMPLE_TYPES.map((item) => {
            const on = exampleTag === item;
            return (
              <button
                key={item}
                type="button"
                onClick={() => setExampleTag(item)}
                className={`rounded-full border px-2.5 py-0.5 text-[11px] transition ${
                  on
                    ? 'border-[#d97757]/55 bg-[#d97757]/15 text-white'
                    : 'border-white/10 bg-white/[0.03] text-white/45 hover:border-white/20 hover:text-white/80'
                }`}
              >
                {item === 'Transcription audio' ? '🎙 ' : ''}{item}
              </button>
            );
          })}
          <button
            type="button"
            onClick={onLoadDemo}
            className="ml-1 text-[11px] text-[#d97757]/70 underline decoration-dotted underline-offset-2 transition hover:text-[#e8b6a3]"
          >
            démo
          </button>
        </div>

        {/* Action unique */}
        <button
          type="button"
          onClick={onLaunch}
          disabled={!canLaunch}
          className="group mt-6 flex h-[54px] w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#d97757] to-[#d97757] text-[13.5px] font-extrabold uppercase tracking-[0.09em] text-white shadow-[0_16px_40px_-14px_rgba(217,119,87,0.7)] transition duration-200 hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          <Rocket className="h-[18px] w-[18px] transition-transform group-hover:-rotate-12" strokeWidth={2.2} />
          {status === 'running' ? 'Transformation en cours…' : 'Lancer la transformation'}
          {status === 'running' ? null : <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.2} />}
        </button>

        {/* Options avancées — repliées par défaut (ne chargent pas l'écran) */}
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowOptions((v) => !v)}
            className="mx-auto flex items-center gap-1.5 text-[11.5px] text-white/40 transition hover:text-white/70"
          >
            <ChevronRight size={13} className={`transition-transform duration-200 ${showOptions ? 'rotate-90' : ''}`} />
            Options avancées
          </button>
          {showOptions ? (
            <div className="mx-auto mt-2 max-w-md space-y-2 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
              <label
                className={`flex items-start gap-2 ${
                  (rawText?.length ?? 0) > DOCUMENT_ANALYZE_FIRST_WINDOW_CHARS ? 'cursor-pointer' : 'cursor-not-allowed opacity-55'
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-white/20 bg-black/40"
                  checked={!!documentAnalyzeOptions?.secondWindow}
                  onChange={(e) => onDocumentAnalyzeOptionsChange?.({ secondWindow: e.target.checked })}
                  disabled={(rawText?.length ?? 0) <= DOCUMENT_ANALYZE_FIRST_WINDOW_CHARS}
                />
                <span className="text-[11px] leading-snug text-white/70">
                  2ᵉ fenêtre ({DOCUMENT_ANALYZE_FIRST_WINDOW_CHARS.toLocaleString('fr-FR')}+ car.) — utile pour longs textes ; plus lent.
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-white/20 bg-black/40"
                  checked={documentAnalyzeOptions?.gapFill !== false}
                  onChange={(e) => onDocumentAnalyzeOptionsChange?.({ gapFill: e.target.checked })}
                />
                <span className="text-[11px] leading-snug text-white/70">
                  Compléter les trous (gap-fill IA) pour la couverture des passages.
                </span>
              </label>
              {(documentAnalyzeOptions?.secondWindow && documentAnalyzeOptions?.gapFill !== false) && (
                <p className="text-[10px] leading-snug text-amber-200/90">
                  Les deux options combinées augmentent le risque de timeout réseau.
                </p>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function normalizeAnalysisView(analysis) {
  if (!analysis) return null;
  const sd = analysis.structured_document;
  const centralThemes =
    (sd?.topics?.length ? sd.topics.map((t) => t.label) : null) ||
    (Array.isArray(analysis.central_themes) ? analysis.central_themes : []) ||
    [];
  return {
    ...analysis,
    audience: analysis.target_audience ?? analysis.audience,
    estimated_total_duration: analysis.estimated_duration ?? analysis.estimated_total_duration,
    difficulty: analysis.level ?? analysis.difficulty,
    difficulty_score: analysis.difficulty_score ?? (analysis.level ? 0.45 : 0),
    global_revelations: analysis.key_revelations ?? analysis.global_revelations ?? [],
    intention:
      analysis.intention ??
      analysis.central_theme ??
      sd?.central_theme ??
      '',
    central_themes: centralThemes,
  };
}

function deriveFactoryStats(project) {
  const sd = project?.analysis?.structured_document;
  const chapters =
    project?.chapters?.length ||
    sd?.recommended_chapter_order?.length ||
    project?.analysis?.chapters_count ||
    0;
  const est = project?.analysis?.estimated_duration || project?.analysis?.estimated_total_duration || '';
  const minMatch = typeof est === 'string' ? est.match(/(\d+)\s*min/i) : null;
  const minutes = minMatch ? minMatch[1] : chapters ? String(Math.max(1, Number(chapters) * 20)) : '—';
  const slideCount = project?.slides?.length || 0;
  const revelationCount =
    (project?.blocks || []).reduce((a, b) => a + (Array.isArray(b.revelations) ? b.revelations.length : 0), 0) || '—';
  return {
    chapters: chapters || '—',
    minutes,
    slides: slideCount || '—',
    exercises: revelationCount,
    tests: '—',
  };
}

function derivePipelineStage(status, step) {
  if (status !== 'running') return null;
  const labels = { 1: 'analyse', 2: 'blocs', 3: 'chapitres', 4: 'pédagogie', 5: 'slides', 6: 'script', 7: 'export' };
  return labels[step] || 'traitement';
}

/* ──────────────────────────── Step 2 — Analyse ──────────────────────────── */

function Step2Analysis({ analysis, status, pipelineStage, onContinue, onRetry, stats }) {
  const av = normalizeAnalysisView(analysis);
  const running = status === 'running' && pipelineStage === 'analyse';
  const steps = analysis?.analysis_steps || [
    { label: 'Compréhension globale du sujet', done: false },
    { label: 'Extraction des idées principales', done: false },
    { label: 'Identification des blocs de sens', done: false },
    { label: 'Détection des révélations', done: false },
    { label: 'Évaluation de la pertinence pédagogique', done: false },
  ];

  const themes = av ? (av.central_themes || []).slice(0, 8) : [];
  const revelations = av?.global_revelations?.length ? av.global_revelations.slice(0, 6) : [];
  const topics = analysis?.structured_document?.topics || [];
  const docStats = analysis?.document_stats;
  const meta = analysis?.structure_meta;
  const quality = meta?.analysis_quality;
  const chapterOrder = analysis?.structured_document?.recommended_chapter_order || [];
  const searchIndex = analysis?.search_index || [];

  // Ligne de stats fine (remplace le panneau APERÇU 5-cases + l'anneau 100 %)
  const statLine = [
    stats.chapters ? `${stats.chapters} chapitres` : null,
    stats.minutes && stats.minutes !== '—' ? `${stats.minutes} min` : null,
    stats.slides && stats.slides !== '—' ? `${stats.slides} slides` : null,
    stats.exercises && stats.exercises !== '—' ? `${stats.exercises} révélations` : null,
  ].filter(Boolean);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-72 w-[620px] -translate-x-1/2 opacity-70"
        style={{ background: 'radial-gradient(closest-side, rgba(217,119,87,0.12), transparent 72%)', filter: 'blur(60px)' }}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-[760px] flex-1 flex-col justify-center px-4 py-8">

        {/* En-tête épuré */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#d97757]/14 ring-1 ring-[#d97757]/30">
            {running ? (
              <Loader2 className="h-6 w-6 animate-spin text-[#d97757]" strokeWidth={1.7} />
            ) : (
              <Brain className="h-6 w-6 text-[#d97757]" strokeWidth={1.7} />
            )}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#d97757]">Masterclass · Étape 2 sur 8</div>
          <h2 className="mt-1.5 text-[25px] font-extrabold leading-tight tracking-tight text-white" style={{ textWrap: 'balance' }}>
            {running ? 'Analyse en cours…' : 'Ce que LIRI a compris'}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-white/55">
            {running
              ? 'Lecture profonde du texte, détection des révélations et de la structure — 20 à 60 s.'
              : 'Voici le sens dégagé de ton contenu. Vérifie, puis laisse LIRI construire le cours.'}
          </p>
        </div>

        {/* Confirmation + ligne de stats fine */}
        {running ? (
          <div className="mx-auto mb-6 w-full max-w-md space-y-2.5">
            {steps.map(({ label, done }) => (
              <div key={label} className="flex items-center gap-2.5 text-[12.5px]">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full ${
                    done ? 'bg-[#9fbf8f]/18 text-[#9fbf8f]' : 'bg-white/5 text-white/30'
                  }`}
                >
                  {done ? <Check size={12} /> : '•'}
                </span>
                <span className={done ? 'text-white/80' : 'text-white/45'}>{label}</span>
              </div>
            ))}
          </div>
        ) : analysis ? (
          <div className="mb-6 flex flex-col items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#9fbf8f]/30 bg-[#9fbf8f]/10 px-3.5 py-1.5 text-[12px] font-semibold text-[#9fbf8f]">
              <CheckCircle2 size={14} /> Analyse terminée
            </div>
            {statLine.length ? (
              <p className="text-[12px] tabular-nums text-white/45">{statLine.join(' · ')}</p>
            ) : null}
          </div>
        ) : null}

        {/* Champs d'analyse — lecture aérée, une colonne */}
        <div className="space-y-3.5">
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
            <div className="mb-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#d97757]">
              <FileText size={13} strokeWidth={2} /> Sujet global
            </div>
            <p className="text-[13.5px] leading-relaxed text-white/75">
              {av?.global_subject || '— En attente —'}
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
            <div className="mb-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#d97757]">
              <Target size={13} strokeWidth={2} /> Intention du cours
            </div>
            <p className="text-[13.5px] leading-relaxed text-white/75">
              {av?.intention || '— En attente —'}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
              <div className="mb-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#d97757]">
                <Users size={13} strokeWidth={2} /> Public cible
              </div>
              <p className="text-[13.5px] leading-relaxed text-white/75">
                {av?.audience || '— En attente —'}
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
              <div className="mb-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#d97757]">
                <GraduationCap size={13} strokeWidth={2} /> Niveau de difficulté
              </div>
              <p className="text-[13.5px] capitalize leading-relaxed text-white/75">{av?.difficulty || '—'}</p>
              <div className="mt-2 h-1.5 rounded-full bg-white/10">
                <div
                  className="h-1.5 rounded-full bg-[#d97757]"
                  style={{ width: `${Math.round((av?.difficulty_score || 0) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Durée + chapitres — ligne fine, pas de dashboard */}
          {(av?.estimated_total_duration || stats.chapters) ? (
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-[13px] text-white/70">
              <span className="inline-flex items-center gap-2">
                <Clock size={14} className="text-[#d97757]" />
                <span className="font-semibold text-white">{av?.estimated_total_duration || '—'}</span>
                <span className="text-white/45">durée estimée</span>
              </span>
              <span className="inline-flex items-center gap-2">
                <Layers size={14} className="text-[#d97757]" />
                <span className="font-semibold text-white">{stats.chapters || '—'}</span>
                <span className="text-white/45">chapitres estimés</span>
              </span>
            </div>
          ) : null}

          {/* Grandes révélations */}
          {revelations.length ? (
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
              <div className="mb-2.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#d97757]">
                <Lightbulb size={13} strokeWidth={2} /> Grandes révélations détectées
              </div>
              <div className="space-y-1.5">
                {revelations.map((r, i) => (
                  <p key={i} className="flex gap-2 text-[12.5px] leading-relaxed text-white/70">
                    <Lightbulb size={14} className="mt-0.5 shrink-0 text-[#d97757]" /> {r}
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          {/* Structure détectée (thèmes centraux) */}
          {themes.length ? (
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
              <div className="mb-2.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#d97757]">
                <ListOrdered size={13} strokeWidth={2} /> Structure du cours détectée
              </div>
              <div className="space-y-1.5">
                {themes.map((title, index) => (
                  <div key={`${title}-${index}`} className="flex items-center gap-2.5 text-[12.5px] text-white/75">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#d97757]/18 text-[11px] font-semibold text-[#d97757]">
                      {index + 1}
                    </span>
                    <span className="leading-snug">{title}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : !analysis ? (
            <p className="text-center text-[12.5px] text-white/45">
              L&apos;analyse apparaîtra ici une fois la transformation lancée.
            </p>
          ) : null}

          {/* Cartographie & horodatage (blocs CDC) — détail structuré, préservé */}
          {topics.length ? (
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
              <div className="mb-2.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#d97757]">
                <Layers size={13} strokeWidth={2} /> Cartographie & horodatage (blocs CDC)
              </div>

              {docStats ? (
                <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-white/50">
                  <span>{docStats.word_count?.toLocaleString('fr-FR')} mots</span>
                  <span>{docStats.paragraph_count} paragraphes</span>
                  <span>{docStats.char_count?.toLocaleString('fr-FR')} car.</span>
                </div>
              ) : null}

              {meta?.truncated ? (
                <p className="mb-3 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200/90">
                  Analyse structurée sur les {meta.structure_char_end?.toLocaleString('fr-FR')} premiers caractères
                  uniquement.
                </p>
              ) : null}

              {quality ? (
                <div
                  className={`mb-3 rounded-xl border px-3 py-2 text-[11px] ${
                    quality.needs_review
                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-100/90'
                      : 'border-white/[0.07] bg-white/[0.02] text-white/60'
                  }`}
                >
                  <p className="mb-1 font-semibold text-white/80">Couverture (fragments déterministes)</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    <span>{Math.round((quality.coverage_ratio ?? 0) * 1000) / 10} % couvert</span>
                    {meta.fragment_count != null ? <span>{meta.fragment_count} fragments</span> : null}
                    <span>{quality.gap_count ?? 0} trou(s)</span>
                    <span>{quality.overlap_count ?? 0} chev.</span>
                  </div>
                  {meta.analysis_meta ? (
                    <p className="mt-1.5 text-[10px] text-white/45">
                      {meta.analysis_meta.window_count ?? 1} fenêtre(s)
                      {meta.analysis_meta.gap_fill_applied ? ' · gap-fill' : ''}
                    </p>
                  ) : null}
                  {quality.needs_review ? (
                    <p className="mt-1.5 text-amber-200/85">
                      Revue recommandée : ajuster les passages ou relancer l&apos;analyse.
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="space-y-1.5">
                {topics.map((t) => {
                  const passes =
                    analysis.structured_document.passages?.filter((p) => p.topic_id === t.id).length || 0;
                  return (
                    <div key={t.id} className="flex items-center justify-between gap-3 text-[12.5px]">
                      <span className="font-medium text-white/80">{t.label}</span>
                      <span className="shrink-0 text-[11px] tabular-nums text-white/40">
                        {passes} passage{passes > 1 ? 's' : ''}
                      </span>
                    </div>
                  );
                })}
              </div>

              {chapterOrder.length ? (
                <div className="mt-3">
                  <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-white/50">
                    Ordre d&apos;enseignement recommandé
                  </h4>
                  <ol className="list-inside list-decimal space-y-0.5 text-[11px] text-white/55">
                    {chapterOrder.map((tid) => {
                      const topic = topics.find((x) => x.id === tid);
                      return <li key={tid}>{topic?.label || tid}</li>;
                    })}
                  </ol>
                </div>
              ) : null}

              {analysis.pedagogical_reordering_rationale ? (
                <p className="mt-3 border-l-2 border-[#d97757]/40 pl-3 text-[11px] leading-relaxed text-white/50">
                  {analysis.pedagogical_reordering_rationale.slice(0, 1000)}
                  {analysis.pedagogical_reordering_rationale.length > 1000 ? '…' : ''}
                </p>
              ) : null}

              {searchIndex.length ? (
                <div className="mt-3">
                  <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-white/50">Index rapide</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {searchIndex.slice(0, 14).map((row) => (
                      <span
                        key={row.term}
                        className="rounded-md border border-[#d97757]/25 bg-[#d97757]/10 px-2 py-0.5 text-[10px] text-[#d97757]/90"
                      >
                        {row.term} ({row.hits?.length || 0})
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Actions : Relancer (secondaire) + Continuer (primaire) */}
        <div className="mt-7 flex flex-col-reverse items-center gap-3 sm:flex-row sm:justify-between">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-white/50 transition hover:text-white/85"
          >
            <RefreshCcw size={14} /> Relancer l&apos;analyse
          </button>

          <button
            type="button"
            onClick={onContinue}
            disabled={!analysis}
            className="group flex h-[52px] w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#d97757] to-[#d97757] px-6 text-[13.5px] font-extrabold uppercase tracking-[0.09em] text-white shadow-[0_16px_40px_-14px_rgba(217,119,87,0.7)] transition duration-200 hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none sm:w-auto"
          >
            Continuer vers Blocs &amp; idées
            <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </button>
        </div>
      </div>
    </div>
  );
}

function Step3Blocks({ blocks, onContinue, onPrev, stats }) {
  const list = blocks ?? [];
  const totalKeywords = list.reduce((acc, b) => acc + (Array.isArray(b.keywords) ? b.keywords.length : 0), 0);
  const totalRevelations = list.reduce((acc, b) => acc + (Array.isArray(b.revelations) ? b.revelations.length : 0), 0);
  const totalMinutes = list.reduce((acc, b) => acc + (Number(b.duration_minutes) || 0), 0);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-72 w-[620px] -translate-x-1/2 opacity-70"
        style={{ background: 'radial-gradient(closest-side, rgba(217,119,87,0.12), transparent 72%)', filter: 'blur(60px)' }}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-[760px] flex-1 flex-col justify-center px-4 py-8">

        {/* En-tête épuré */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#d97757]/14 ring-1 ring-[#d97757]/30">
            <Layers className="h-6 w-6 text-[#d97757]" strokeWidth={1.7} />
          </div>
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#d97757]">Masterclass · Étape 3 sur 8</div>
          <h2 className="mt-1.5 text-[25px] font-extrabold leading-tight tracking-tight text-white" style={{ textWrap: 'balance' }}>
            Blocs &amp; idées révélées
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-white/55">
            LIRI a découpé ton contenu en unités de sens — chaque bloc porte sa tension, ses révélations et ses mots-clés.
          </p>

          {/* Stat inline slim (pas de dashboard) */}
          {list.length ? (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-[12px] font-medium text-white/50">
              <span className="tabular-nums text-white/75">{list.length}</span> blocs
              <span className="text-white/20">·</span>
              <span className="tabular-nums text-white/75">{totalRevelations}</span> révélations
              <span className="text-white/20">·</span>
              <span className="tabular-nums text-white/75">{totalKeywords}</span> mots-clés
              <span className="text-white/20">·</span>
              <span className="tabular-nums text-white/75">{totalMinutes}</span> min
            </div>
          ) : null}
        </div>

        {/* Liste des blocs — aérée, une colonne */}
        <div className="space-y-3">
          {list.length === 0 ? (
            <p className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-8 text-center text-[13px] text-white/45">
              Aucun bloc détecté. Relance la transformation.
            </p>
          ) : null}

          {list.map((b) => (
            <article key={b.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-[#d97757]/20 px-2 py-0.5 text-[11px] font-bold text-[#e8b6a3]">{b.id}</span>
                <span className="rounded-lg bg-white/[0.04] px-2 py-0.5 text-[11px] text-white/55">{b.lines_label}</span>
                <span className="inline-flex items-center gap-1 rounded-lg bg-white/[0.04] px-2 py-0.5 text-[11px] text-white/55">
                  <Clock className="h-3 w-3" strokeWidth={1.9} /> {b.duration_minutes} min
                </span>
                {b.type ? (
                  <span className={`rounded-lg px-2 py-0.5 text-[11px] ${TYPE_COLORS[b.type] || 'bg-white/[0.04] text-white/55'}`}>
                    {b.type}
                  </span>
                ) : null}
                {b.subject_label ? (
                  <span
                    className="max-w-[180px] truncate rounded-lg bg-[#d97757]/12 px-2 py-0.5 text-[11px] text-[#d97757]"
                    title={b.subject_label}
                  >
                    {b.subject_label}
                  </span>
                ) : null}
              </div>

              <h4 className="mt-3 text-[15px] font-bold leading-snug text-white">{b.title}</h4>
              {b.central_idea ? (
                <p className="mt-1 text-[13px] leading-relaxed text-white/60">{b.central_idea}</p>
              ) : null}
              {b.new_elements ? (
                <p className="mt-2 border-l-2 border-[#d97757]/40 pl-2.5 text-[12px] leading-relaxed text-[#d97757]/90">
                  + {b.new_elements}
                </p>
              ) : null}

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <MiniList title="Révélations" items={b.revelations} color="text-[#d97757]" />
                <MiniList title="Tensions" items={b.tensions} color="text-[#d97757]" />
                <MiniList title="Mots-clés" items={b.keywords} color="text-[#9fbf8f]" />
              </div>
            </article>
          ))}
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={onContinue}
            disabled={!list.length}
            className="group flex h-[54px] w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#d97757] to-[#d97757] text-[13.5px] font-extrabold uppercase tracking-[0.09em] text-white shadow-[0_16px_40px_-14px_rgba(217,119,87,0.7)] transition duration-200 hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            Construire les chapitres
            <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </button>
          {onPrev ? (
            <button
              type="button"
              onClick={onPrev}
              className="inline-flex items-center gap-1.5 text-[12px] text-white/40 transition hover:text-white/70"
            >
              <ArrowLeft size={14} /> Précédent
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Step4Chapters({ chapters, onContinue, onPrev, stats }) {
  const list = chapters ?? [];
  const [activeId, setActiveId] = useState(list[0]?.chapter_id ?? 0);
  useEffect(() => {
    const exists = list.some((c, i) => (c.chapter_id ?? i + 1) === activeId);
    if (!exists && list.length) setActiveId(list[0].chapter_id ?? 1);
  }, [list, activeId]);

  const active =
    list.find((c, i) => (c.chapter_id ?? i + 1) === activeId) || list[0] || null;

  const PEDAGOGY_LOGIC = [
    'Tension → Révélation',
    'Atelier avant leçon',
    'Dictée JE RETIENS',
    'Validation par test',
    'Cas réel à appliquer',
    'Transition vers chapitre suivant',
  ];

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-72 w-[620px] -translate-x-1/2 opacity-70"
        style={{ background: 'radial-gradient(closest-side, rgba(217,119,87,0.12), transparent 72%)', filter: 'blur(60px)' }}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-[1040px] flex-1 flex-col justify-center px-4 py-8">

        {/* En-tête épuré */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#d97757]/14 ring-1 ring-[#d97757]/30">
            <ListOrdered className="h-6 w-6 text-[#d97757]" strokeWidth={1.7} />
          </div>
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#d97757]">Masterclass · Étape 4 sur 8</div>
          <h2 className="mt-1.5 text-[25px] font-extrabold leading-tight tracking-tight text-white" style={{ textWrap: 'balance' }}>
            Tes chapitres prennent forme
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-white/55">
            LIRI a structuré ton contenu en chapitres enseignables. Survole-les pour vérifier la trame.
          </p>

          {/* Une seule ligne de stats — pas de tableau de bord */}
          <div className="mt-4 inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[12px] text-white/55">
            <span className="tabular-nums text-white/80">{stats.chapters}</span> chapitres
            <span className="text-white/25">·</span>
            <span className="tabular-nums text-white/80">{stats.minutes}</span> min
            <span className="text-white/25">·</span>
            <span className="tabular-nums text-white/80">{stats.slides}</span> slides
            <span className="text-white/25">·</span>
            <span className="tabular-nums text-white/80">{stats.tests}</span> tests
          </div>
        </div>

        {list.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-8 text-center text-sm text-white/50">
            Aucun chapitre — relance la transformation.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
            {/* Colonne de sélection — légère */}
            <div className="space-y-1.5">
              {list.map((c, i) => {
                const id = c.chapter_id ?? i + 1;
                const on = id === activeId;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveId(id)}
                    className={`flex w-full items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition ${
                      on
                        ? 'border-[#d97757]/40 bg-[#d97757]/12'
                        : 'border-white/[0.07] bg-white/[0.02] hover:border-white/15'
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${
                        on ? 'bg-[#d97757] text-white' : 'bg-white/[0.05] text-white/55'
                      }`}
                    >
                      {id}
                    </span>
                    <span className={`min-w-0 flex-1 truncate text-[12.5px] ${on ? 'font-semibold text-white' : 'text-white/65'}`}>
                      {c.title}
                    </span>
                    <span className="shrink-0 text-[10px] tabular-nums text-white/35">
                      {c.recommended_duration_minutes || 0}′
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Détail — chapitre sélectionné */}
            <div className="min-w-0">
              {active ? (
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-lg bg-[#d97757]/15 px-2 py-1 text-[11px] font-bold text-[#e8b6a3]">
                        Ch. {active.chapter_id ?? (list.indexOf(active) + 1)}
                      </span>
                      <span className="rounded-lg bg-white/[0.04] px-2 py-1 text-[11px] text-white/60">
                        {active.recommended_duration_minutes || 0} min
                      </span>
                      <span className="rounded-lg bg-white/[0.04] px-2 py-1 text-[11px] capitalize text-white/60">
                        {active.difficulty || 'medium'}
                      </span>
                    </div>
                    <Pencil className="shrink-0 text-white/25" size={16} />
                  </div>

                  <h4 className="text-[17px] font-bold leading-snug text-white">{active.title}</h4>

                  <div className="mt-4 space-y-3">
                    <div>
                      <p className="mb-0.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[#d97757]">
                        <Target size={11} /> Objectif
                      </p>
                      <p className="text-[13px] leading-relaxed text-white/70">{active.objective || '—'}</p>
                    </div>
                    <div>
                      <p className="mb-0.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[#d97757]">
                        <Trophy size={11} /> Compétence à acquérir
                      </p>
                      <p className="text-[13px] leading-relaxed text-white/70">{active.skill_to_acquire || '—'}</p>
                    </div>
                    <div>
                      <p className="mb-0.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[#9fbf8f]">
                        <BookOpen size={11} /> Connaissance à transmettre
                      </p>
                      <p className="text-[13px] leading-relaxed text-white/70">{active.knowledge_to_transmit || '—'}</p>
                    </div>
                  </div>

                  <div className="mt-5 border-t border-white/[0.06] pt-4">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-white/40">
                      Logique pédagogique appliquée
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {PEDAGOGY_LOGIC.map((x) => (
                        <span
                          key={x}
                          className="rounded-full border border-white/[0.07] bg-white/[0.02] px-2.5 py-1 text-[11px] text-white/60"
                        >
                          {x}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Action unique + retour discret */}
        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={onContinue}
            disabled={!list.length}
            className="group flex h-[54px] w-full max-w-[420px] items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#d97757] to-[#d97757] text-[13.5px] font-extrabold uppercase tracking-[0.09em] text-white shadow-[0_16px_40px_-14px_rgba(217,119,87,0.7)] transition duration-200 hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            Continuer vers la pédagogie
            <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </button>
          <button
            type="button"
            onClick={onPrev}
            className="inline-flex items-center gap-1.5 text-[12px] text-white/40 transition hover:text-white/70"
          >
            <ArrowLeft size={14} /> Précédent
          </button>
        </div>
      </div>
    </div>
  );
}

function PedagogyRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
      <div className="mb-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#d97757]">
        {Icon ? <Icon size={13} strokeWidth={2} /> : null} {label}
      </div>
      <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-white/75">{value}</p>
    </div>
  );
}

function Step5Pedagogy({ chapters, onContinue, onPrev }) {
  const [activeId, setActiveId] = React.useState(chapters[0]?.chapter_id || null);
  React.useEffect(() => {
    if (!activeId && chapters[0]) setActiveId(chapters[0].chapter_id);
  }, [activeId, chapters]);
  const active = chapters.find((c) => c.chapter_id === activeId) || chapters[0] || null;

  const analogiesCount = active?.analogies?.length || 0;
  const examplesCount = active?.examples?.length || 0;
  const testsCount = active?.understanding_test?.length || 0;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-72 w-[620px] -translate-x-1/2 opacity-70"
        style={{ background: 'radial-gradient(closest-side, rgba(217,119,87,0.12), transparent 72%)', filter: 'blur(60px)' }}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-[1040px] flex-1 flex-col justify-center px-4 py-8">

        {/* En-tête épuré */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#d97757]/14 ring-1 ring-[#d97757]/30">
            <GraduationCap className="h-6 w-6 text-[#d97757]" strokeWidth={1.7} />
          </div>
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#d97757]">Masterclass · Étape 5 sur 8</div>
          <h2 className="mt-1.5 text-[25px] font-extrabold leading-tight tracking-tight text-white" style={{ textWrap: 'balance' }}>
            Pédagogie &amp; activités
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-white/55">
            Choisis un chapitre pour dérouler son scénario complet — situation, révélation, ateliers.
          </p>
        </div>

        {/* Sélecteur de chapitre — rangée de puces (pas de sidebar) */}
        {chapters.length ? (
          <div className="mb-5 flex flex-wrap items-center justify-center gap-1.5">
            {chapters.map((c) => {
              const on = activeId === c.chapter_id;
              return (
                <button
                  key={c.chapter_id}
                  type="button"
                  onClick={() => setActiveId(c.chapter_id)}
                  className={`inline-flex max-w-[240px] items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] transition ${
                    on
                      ? 'border-[#d97757]/55 bg-[#d97757]/15 text-white'
                      : 'border-white/10 bg-white/[0.03] text-white/50 hover:border-white/20 hover:text-white/80'
                  }`}
                >
                  <span className="font-bold text-[#d97757]">Ch. {c.chapter_id}</span>
                  <span className="truncate">{c.title}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        {active ? (
          <div className="space-y-6">
            {/* Titre du chapitre + stat inline slim */}
            <div className="text-center">
              <h3 className="text-[18px] font-extrabold text-white" style={{ textWrap: 'balance' }}>
                Chapitre {active.chapter_id} — {active.title}
              </h3>
              {(analogiesCount || examplesCount || testsCount) ? (
                <p className="mt-1.5 text-[11.5px] tabular-nums text-white/45">
                  {analogiesCount} analogie{analogiesCount > 1 ? 's' : ''} · {examplesCount} exemple{examplesCount > 1 ? 's' : ''} · {testsCount} test{testsCount > 1 ? 's' : ''}
                </p>
              ) : null}
            </div>

            {/* Scénario — colonne aérée */}
            <div className="space-y-3">
              <PedagogyRow icon={Target} label="Mise en situation" value={active.real_life_situation} />
              <PedagogyRow icon={Lightbulb} label="Tension pédagogique" value={active.pedagogical_tension} />
              <PedagogyRow icon={Brain} label="Expérience de pensée" value={active.thought_experiment} />
              <PedagogyRow icon={Sparkles} label="Révélation" value={active.revelation_moment || active.main_revelation} />
              <PedagogyRow icon={BookOpen} label="Leçon simple" value={active.simple_lesson} />
              <PedagogyRow icon={BookOpen} label="Leçon développée" value={active.deep_lesson} />
              <PedagogyRow icon={MessageCircle} label="Reformulation" value={active.reformulation} />
            </div>

            {/* Analogies + Exemples */}
            {(active.analogies?.length || active.examples?.length) ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <p className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#d97757]">
                    <Layers size={13} /> Analogies
                  </p>
                  <div className="space-y-2">
                    {(active.analogies || []).map((a, i) => (
                      <p key={i} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-[12.5px] leading-relaxed text-white/70">
                        <span className="font-semibold text-[#d97757]">{a.type || 'analogie'} ·</span> {a.content || ''}
                      </p>
                    ))}
                    {!active.analogies?.length && <p className="text-[12.5px] text-white/40">—</p>}
                  </div>
                </div>
                <div>
                  <p className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#9fbf8f]">
                    <ClipboardList size={13} /> Exemples
                  </p>
                  <div className="space-y-2">
                    {(active.examples || []).map((e, i) => (
                      <p key={i} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-[12.5px] leading-relaxed text-white/70">
                        <span className="font-semibold text-[#9fbf8f]">{e.type || 'exemple'} ·</span> {e.content || ''}
                      </p>
                    ))}
                    {!active.examples?.length && <p className="text-[12.5px] text-white/40">—</p>}
                  </div>
                </div>
              </div>
            ) : null}

            {/* Atelier participatif */}
            {active.workshop?.instructions ? (
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                <p className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#d97757]">
                  <Users size={13} /> Atelier participatif
                </p>
                <p className="text-[12.5px] leading-relaxed text-white/70">{active.workshop.instructions}</p>
                {active.workshop.questions?.length ? (
                  <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                    <MiniList title="Questions" items={active.workshop.questions} color="text-[#d97757]" />
                    <MiniList title="Réponses attendues" items={active.workshop.expected_answers} color="text-[#9fbf8f]" />
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* JE RETIENS */}
            {active.je_retiens?.length ? (
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                <p className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#d97757]">
                  <ShieldCheck size={13} /> JE RETIENS — à dicter
                </p>
                <ol className="list-decimal space-y-1 pl-5 text-[12.5px] leading-relaxed text-white/75">
                  {active.je_retiens.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              </div>
            ) : null}

            {/* Test de compréhension */}
            {active.understanding_test?.length ? (
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                <p className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#d97757]">
                  <HelpCircle size={13} /> Test de compréhension
                </p>
                <div className="space-y-2">
                  {active.understanding_test.map((t, i) => (
                    <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[12.5px]">
                      <p className="text-white/85">Q{i + 1}. {t.question}</p>
                      <p className="mt-1 text-[#9fbf8f]">→ {t.expected_answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <PedagogyRow icon={ArrowRight} label="Transition" value={active.transition_to_next} />
          </div>
        ) : (
          <p className="text-center text-sm text-white/45">Aucun chapitre.</p>
        )}

        {/* Action unique + Précédent */}
        <button
          type="button"
          onClick={onContinue}
          className="group mt-8 flex h-[54px] w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#d97757] to-[#d97757] text-[13.5px] font-extrabold uppercase tracking-[0.09em] text-white shadow-[0_16px_40px_-14px_rgba(217,119,87,0.7)] transition duration-200 hover:brightness-110 active:scale-[0.99]"
        >
          <Monitor className="h-[18px] w-[18px]" strokeWidth={2.1} />
          Générer les slides
          <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.2} />
        </button>

        <button
          type="button"
          onClick={onPrev}
          className="mx-auto mt-3 flex items-center gap-1.5 text-[12px] text-white/40 transition hover:text-white/70"
        >
          <ArrowLeft size={14} /> Précédent
        </button>
      </div>
    </div>
  );
}

function Step6Slides({ slides, chapters, onContinue, onPrev }) {
  const [activeIdx, setActiveIdx] = React.useState(0);
  const active = slides[activeIdx] || null;
  const activeChapter = active ? chapters.find((c) => c.chapter_id === active.chapter_id) : null;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-72 w-[620px] -translate-x-1/2 opacity-70"
        style={{ background: 'radial-gradient(closest-side, rgba(217,119,87,0.12), transparent 72%)', filter: 'blur(60px)' }}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-[1040px] flex-1 flex-col justify-center px-4 py-8">

        {/* En-tête épuré */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#d97757]/14 ring-1 ring-[#d97757]/30">
            <Monitor className="h-6 w-6 text-[#d97757]" strokeWidth={1.7} />
          </div>
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#d97757]">Masterclass · Étape 6 sur 8</div>
          <h2 className="mt-1.5 text-[25px] font-extrabold leading-tight tracking-tight text-white" style={{ textWrap: 'balance' }}>
            Slides Smartboard
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-white/55">
            {slides.length} slide{slides.length > 1 ? 's' : ''} généré{slides.length > 1 ? 's' : ''} — parcours-les avant de passer au script.
          </p>
        </div>

        {/* Maître-détail : liste + prévisualisation */}
        <div className="grid min-h-0 grid-cols-1 gap-4 xl:grid-cols-[32%_68%]">

          {/* Liste des slides */}
          <div className="min-h-0">
            <div className="max-h-[460px] space-y-1.5 overflow-y-auto pr-1">
              {slides.map((s, i) => (
                <button
                  key={s.slide_id || i}
                  type="button"
                  onClick={() => setActiveIdx(i)}
                  className={`flex w-full items-center justify-between rounded-2xl border px-3 py-2.5 text-left text-xs transition ${
                    i === activeIdx
                      ? 'border-[#d97757]/50 bg-[#d97757]/12 text-white'
                      : 'border-white/[0.07] bg-white/[0.02] text-white/60 hover:bg-white/[0.04]'
                  }`}
                >
                  <span className="truncate">
                    <span className="text-[#d97757]">#{i + 1}</span> {s.title}
                  </span>
                  <span className="ml-2 shrink-0 rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[10px] text-white/50">
                    {s.kind}
                  </span>
                </button>
              ))}
              {slides.length === 0 ? (
                <p className="rounded-2xl border border-white/[0.07] bg-white/[0.02] px-3 py-4 text-xs text-white/45">
                  Aucun slide. Relance la transformation.
                </p>
              ) : null}
            </div>
          </div>

          {/* Prévisualisation */}
          <div className="min-h-0">
            {active ? (
              <div className="flex h-[460px] flex-col justify-center rounded-2xl border border-[#d97757]/20 bg-gradient-to-br from-[#1f1e1c] via-[#1f1e1c] to-[#1f1e1c] p-9">
                <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#d97757]">
                  {String(active.kind || 'slide').toUpperCase()}
                  {activeChapter ? (
                    <span className="text-white/35">· Chapitre {activeChapter.chapter_id}</span>
                  ) : null}
                </div>
                <h3 className="text-3xl font-bold leading-tight md:text-4xl">{active.title}</h3>
                {active.subtitle ? <p className="mt-2 text-sm text-[#e8b6a3]/70">{active.subtitle}</p> : null}
                {active.body ? <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/75">{active.body}</p> : null}
                {active.bullets?.length ? (
                  <ul className="mt-6 max-w-2xl space-y-2">
                    {active.bullets.map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-white/80">
                        <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#9fbf8f]" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : (
              <div className="flex h-[460px] items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.02]">
                <p className="text-sm text-white/45">Aucun slide à afficher.</p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-7 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={onContinue}
            className="group flex h-[54px] w-full max-w-md items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#d97757] to-[#d97757] text-[13.5px] font-extrabold uppercase tracking-[0.09em] text-white shadow-[0_16px_40px_-14px_rgba(217,119,87,0.7)] transition duration-200 hover:brightness-110 active:scale-[0.99]"
          >
            Script &amp; Docs
            <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </button>
          <button
            type="button"
            onClick={onPrev}
            className="inline-flex items-center gap-1.5 text-[12px] text-white/40 transition hover:text-white/70"
          >
            <ArrowLeft size={14} /> Précédent
          </button>
        </div>
      </div>
    </div>
  );
}

function Step7Script({ scripts, chapters, onContinue, onPrev, onDownloadScript }) {
  const [activeId, setActiveId] = React.useState(scripts[0]?.chapter_id || null);
  React.useEffect(() => {
    if (!activeId && scripts[0]) setActiveId(scripts[0].chapter_id);
  }, [activeId, scripts]);
  const active = scripts.find((s) => s.chapter_id === activeId) || scripts[0] || null;
  const activeKnowledge = active
    ? chapters.find((c) => c.chapter_id === active.chapter_id)?.knowledge_to_transmit || ''
    : '';

  const docs = [
    { label: 'PDF Professeur', kind: 'professor', icon: GraduationCap },
    { label: 'PDF Élève', kind: 'student', icon: BookOpen },
    { label: "Cahier d'exercices", kind: 'exercises', icon: ClipboardList },
    { label: 'Notes SmartBoard', kind: 'smartboard', icon: Monitor },
    { label: 'Script live (Markdown)', kind: 'script', icon: FileText },
  ];

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-72 w-[620px] -translate-x-1/2 opacity-70"
        style={{ background: 'radial-gradient(closest-side, rgba(217,119,87,0.12), transparent 72%)', filter: 'blur(60px)' }}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-[1040px] flex-1 flex-col justify-center px-4 py-8">

        {/* En-tête épuré */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#d97757]/14 ring-1 ring-[#d97757]/30">
            <MessageCircle className="h-6 w-6 text-[#d97757]" strokeWidth={1.7} />
          </div>
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#d97757]">Masterclass · Étape 7 sur 8</div>
          <h2 className="mt-1.5 text-[25px] font-extrabold leading-tight tracking-tight text-white" style={{ textWrap: 'balance' }}>
            Ton script, chapitre par chapitre
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-white/55">
            Le texte prêt à dire en live, plus les documents à distribuer.
          </p>
        </div>

        {/* Sélecteur de chapitre (subtil, centré) */}
        <div className="mb-4 flex flex-wrap items-center justify-center gap-1.5">
          {scripts.map((s) => {
            const on = activeId === s.chapter_id;
            return (
              <button
                key={s.chapter_id}
                type="button"
                onClick={() => setActiveId(s.chapter_id)}
                className={`rounded-full border px-3 py-1 text-[11.5px] transition ${
                  on
                    ? 'border-[#d97757]/55 bg-[#d97757]/15 text-white'
                    : 'border-white/10 bg-white/[0.03] text-white/45 hover:border-white/20 hover:text-white/80'
                }`}
              >
                Ch. {s.chapter_id}
              </button>
            );
          })}
        </div>

        {/* Contenu master-detail : script (gauche) + documents (droite) */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">

          {/* Script du chapitre courant */}
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 leading-relaxed">
            {active ? (
              <>
                <h4 className="text-[17px] font-bold text-white" style={{ textWrap: 'balance' }}>{active.title}</h4>
                {activeKnowledge ? (
                  <p className="mt-1.5 text-[12px] italic leading-snug text-white/45">{activeKnowledge}</p>
                ) : null}
                <div className="mt-4 space-y-3 text-[13.5px] leading-relaxed text-white/75">
                  {active.lines.map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-[13.5px] text-white/45">Aucun script disponible.</p>
            )}
          </div>

          {/* Documents à télécharger */}
          <div>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">Documents générés</div>
            <div className="space-y-2">
              {docs.map((doc) => {
                const Icon = doc.icon;
                return (
                  <button
                    key={doc.kind}
                    type="button"
                    onClick={() => onDownloadScript(doc.kind)}
                    className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-3 text-left text-[13px] text-white/75 transition hover:border-[#d97757]/40 hover:text-white"
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon size={15} className="text-white/40 transition group-hover:text-[#d97757]" strokeWidth={1.8} />
                      {doc.label}
                    </span>
                    <Download size={14} className="text-[#d97757]" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Action unique + Précédent */}
        <button
          type="button"
          onClick={onContinue}
          className="group mt-8 flex h-[54px] w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#d97757] to-[#d97757] text-[13.5px] font-extrabold uppercase tracking-[0.09em] text-white shadow-[0_16px_40px_-14px_rgba(217,119,87,0.7)] transition duration-200 hover:brightness-110 active:scale-[0.99]"
        >
          Passer à l&apos;export
          <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.2} />
        </button>

        <button
          type="button"
          onClick={onPrev}
          className="mx-auto mt-3 flex items-center gap-1.5 text-[11.5px] text-white/40 transition hover:text-white/70"
        >
          <ArrowLeft size={13} /> Précédent
        </button>
      </div>
    </div>
  );
}

function Step8Export({ stats, project, onPrev, onReset, onDownloadJson, onDownloadMarkdown, onDownloadExport, precepteurLoading }) {
  const downloadable = project.exports?.downloadable || {};
  const exportDocs = [
    { label: 'Studio Live + SmartBoard', kind: 'smartboard-live', enabled: true },
    { label: 'Cours numérique (Précepteur)', kind: 'precepteur', enabled: true },
    { label: 'PDF Professeur', kind: 'pdf-professor', enabled: Boolean(downloadable.pdf_professor) },
    { label: 'PDF Élève', kind: 'pdf-student', enabled: Boolean(downloadable.pdf_student) },
    { label: 'SmartBoard', kind: 'smartboard', enabled: Boolean(downloadable.smartboard) },
    { label: 'Markdown complet', kind: 'markdown', enabled: Boolean(downloadable.markdown) },
    { label: 'JSON moteur', kind: 'json', enabled: Boolean(downloadable.json) },
    { label: 'Liri Live', kind: 'live', enabled: Boolean(downloadable.liri_live) },
  ];

  const subject = project.analysis?.global_subject || '—';
  const audience = project.analysis?.audience || 'mixed';
  const duration = project.analysis?.estimated_total_duration || '—';
  const revelations = (project.analysis?.global_revelations || []).length;
  const missing = project.quality?.missing_requirements || [];

  const statLine = [
    `${stats.chapters} chapitres`,
    `${stats.minutes} min`,
    `${stats.slides} slides`,
    `${stats.exercises} exercices`,
    `${stats.tests} tests`,
    revelations ? `${revelations} révélations` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-72 w-[620px] -translate-x-1/2 opacity-70"
        style={{ background: 'radial-gradient(closest-side, rgba(217,119,87,0.12), transparent 72%)', filter: 'blur(60px)' }}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-[760px] flex-1 flex-col justify-center px-4 py-8">

        {/* En-tête épuré — célébration */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#d97757]/14 ring-1 ring-[#d97757]/30">
            <Trophy className="h-6 w-6 text-[#d97757]" strokeWidth={1.7} />
          </div>
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#d97757]">Masterclass · Étape 8 sur 8</div>
          <h2 className="mt-1.5 text-[25px] font-extrabold leading-tight tracking-tight text-white" style={{ textWrap: 'balance' }}>
            Ton cours est prêt
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-white/55">
            Prêt à être enseigné, projeté, partagé ou exporté. Choisis le format qui te convient.
          </p>
        </div>

        {/* Récap sujet + stat line (une ligne, pas de tableau de bord) */}
        <div className="mb-5 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3.5 text-center">
          <div className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white">
            <CheckCircle2 className="h-4 w-4 text-[#9fbf8f]" strokeWidth={2} />
            <span style={{ textWrap: 'balance' }}>{subject}</span>
          </div>
          <p className="mt-1.5 text-[11.5px] tabular-nums text-white/50">{statLine}</p>
          <p className="mt-1 text-[11px] text-white/40">
            Public : {audience} · Durée : {duration}
          </p>
        </div>

        {/* Actions d'export */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {exportDocs.map((doc) => {
            const isPrecepteur = doc.kind === 'precepteur';
            const loading = isPrecepteur && precepteurLoading;
            const disabled = !doc.enabled || loading;
            return (
              <button
                key={doc.kind}
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (disabled) return;
                  if (doc.kind === 'json') onDownloadJson();
                  else if (doc.kind === 'markdown') onDownloadMarkdown();
                  else onDownloadExport?.(doc.kind);
                }}
                className={`rounded-2xl border p-3.5 text-left transition ${
                  disabled
                    ? 'border-white/[0.05] bg-white/[0.01] text-white/30'
                    : 'border-white/[0.07] bg-white/[0.02] text-white/85 hover:border-[#d97757]/50 hover:bg-[#d97757]/[0.06]'
                }`}
              >
                {loading
                  ? <Loader2 className="mb-2.5 h-4 w-4 animate-spin text-[#d97757]" />
                  : <Download className={`mb-2.5 h-4 w-4 ${disabled ? 'text-white/25' : 'text-[#d97757]'}`} strokeWidth={1.9} />}
                <p className="text-[12.5px] font-semibold leading-snug">{doc.label}</p>
                <p className="mt-1 text-[10.5px] text-white/40">
                  {loading
                    ? 'Génération des croquis…'
                    : (doc.enabled ? 'Téléchargement immédiat' : 'Bientôt disponible')}
                </p>
              </button>
            );
          })}
        </div>

        {/* Contrôle qualité (si points à renforcer) */}
        {missing.length ? (
          <div className="mt-4 rounded-2xl border border-[#d97757]/25 bg-[#d97757]/[0.06] p-4">
            <p className="text-[11.5px] font-semibold text-[#d97757]">Points à renforcer (contrôle qualité)</p>
            <ul className="mt-1.5 space-y-1">
              {missing.slice(0, 8).map((mReq) => (
                <li key={mReq} className="text-[11px] leading-snug text-white/60">• {mReq}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Action principale — nouveau projet */}
        <button
          type="button"
          onClick={onReset}
          className="group mt-7 flex h-[54px] w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#d97757] to-[#d97757] text-[13.5px] font-extrabold uppercase tracking-[0.09em] text-white shadow-[0_16px_40px_-14px_rgba(217,119,87,0.7)] transition duration-200 hover:brightness-110 active:scale-[0.99]"
        >
          <Plus className="h-[18px] w-[18px]" strokeWidth={2.4} />
          Nouveau projet
        </button>

        <button
          type="button"
          onClick={onPrev}
          className="mx-auto mt-4 flex items-center gap-1.5 text-[11.5px] text-white/40 transition hover:text-white/70"
        >
          <ArrowLeft size={13} /> Précédent
        </button>
      </div>
    </div>
  );
}

function MasterclassFactoryPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const m = useMasterclassProject();
  const [precepteurLoading, setPrecepteurLoading] = useState(false);
  const factoryStats = useMemo(() => deriveFactoryStats(m.project), [m.project]);
  const pipelineStage = useMemo(() => derivePipelineStage(m.status, m.step), [m.status, m.step]);

  /* Lecture/écriture URL pour partager une étape */
  useEffect(() => {
    const fromUrl = Number(searchParams.get('step'));
    if (Number.isFinite(fromUrl) && fromUrl >= 0 && fromUrl <= 7 && fromUrl !== m.step) {
      m.goToStep(fromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const cur = Number(searchParams.get('step'));
    if (cur !== m.step) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('step', String(m.step));
      setSearchParams(nextParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.step]);

  const handleLaunch = async () => {
    await m.launchPipeline();
  };

  const handleDownloadJson = () => {
    const payload = {
      engine_name: 'LIRI_MASTERCLASS_COACH',
      version: '1.0',
      generated_at: new Date().toISOString(),
      analysis: m.project.analysis,
      blocks: m.project.blocks,
      chapters: m.project.chapters,
      slides: m.project.slides,
      scripts: m.project.scripts,
      summary: m.project.summary,
      quality: m.project.quality,
      raw_engine_json: m.project.raw_engine_json,
    };
    const filename = `masterclass-${(m.project.analysis?.global_subject || 'projet').slice(0, 40).replace(/\W+/g, '-')}.json`;
    downloadBlob(JSON.stringify(payload, null, 2), filename, 'application/json');
  };

  const handleDownloadMarkdown = () => {
    const md = buildMarkdown(m.project);
    const filename = `masterclass-${(m.project.analysis?.global_subject || 'projet').slice(0, 40).replace(/\W+/g, '-')}.md`;
    downloadBlob(md, filename, 'text/markdown;charset=utf-8');
  };

  const handleDownloadScript = (kind) => {
    if (kind === 'script') {
      const md = buildScriptMarkdown(m.project.scripts || [], m.project.chapters || []);
      downloadBlob(md, 'script-professeur.md', 'text/markdown;charset=utf-8');
    } else if (kind === 'professor' || kind === 'student') {
      handleDownloadMarkdown();
    } else {
      handleDownloadJson();
    }
  };

  const handleDownloadExport = async (kind) => {
    if (kind === 'precepteur') {
      // Cours numérique « Le Précepteur ». On transforme le MasterclassProject en
      // PrecepteurCourse, on l'ENRICHIT avec de vraies scènes croquis vectorielles
      // générées par l'edge `liri-preceptor-course` (une par concept), puis on ouvre
      // le lecteur immersif. On vérifie d'abord qu'il produit un cours jouable.
      const course = masterclassProjectToPrecepteurCourse(m.project);
      const playable = course && Array.isArray(course.concepts)
        && course.concepts.some((c) => Array.isArray(c.scenes) && c.scenes.length > 0);
      if (!playable) {
        window.alert('Ce projet ne contient pas encore de contenu pédagogique jouable (leçons, atelier, analogies). Génère la Masterclass complète avant l’export Précepteur.');
        return;
      }

      // Appel authentifié de l'edge (même pattern que ttsFetch : getSession +
      // Authorization Bearer). L'edge renvoie TOUJOURS { sketch: { caption?, elements } }
      // en succès et { error } en échec. On déballe `data.sketch` et on renvoie
      // { caption, elements } | null — null sur TOUTE erreur (fail-safe, jamais de throw).
      const invokeEdge = async (seed) => {
        try {
          const { data: sess } = await supabase.auth.getSession();
          const token = sess?.session?.access_token;
          if (!token) return null; // pas de session → pas de croquis (jamais bloquant)
          const { data, error } = await supabase.functions.invoke('liri-preceptor-course', {
            body: {
              chapterTitle: seed?.chapterTitle,
              centralIdea: seed?.centralIdea,
              lessonText: seed?.lessonText,
            },
            headers: { Authorization: `Bearer ${token}` },
          });
          if (error || !data || data.error) return null;
          const sketch = data.sketch;
          if (!sketch || !Array.isArray(sketch.elements) || sketch.elements.length === 0) return null;
          return { caption: sketch.caption, elements: sketch.elements };
        } catch { return null; }
      };

      setPrecepteurLoading(true);
      let enriched = course; // GARDE-FOU : par défaut le cours NON enrichi (jamais bloquant)
      try {
        const seeds = buildCroquisSeeds(m.project);
        enriched = await enrichCourseWithCroquis(course, seeds, invokeEdge);
      } catch { /* enrichissement optionnel : on garde le cours non enrichi */ }
      finally { setPrecepteurLoading(false); }

      // On dépose le cours DÉJÀ enrichi (lu en priorité par PrecepteurCoursePage) ET on
      // garde l'écriture du MasterclassProject brut (fallback : transform sans croquis).
      // Ces écritures restent le CHEMIN DE REPLI (offline/mode privé, échec backend).
      try { window.localStorage.setItem('precepteur:sourceCourse', JSON.stringify(enriched)); } catch { /* quota/private mode */ }
      try { window.localStorage.setItem('precepteur:sourceProject', JSON.stringify(m.project)); } catch { /* quota/private mode */ }

      // On PERSISTE le cours enrichi côté backend (POST /masterclass-factory/precepteur).
      // Si ça réussit → route porteuse d'id (rechargeable, partageable). Sinon (ou exception)
      // → repli sur le flux localStorage ci-dessus. Ne bloque JAMAIS l'ouverture du cours.
      try {
        const saved = await masterclassApi.savePrecepteur({
          title: enriched?.title || m.project?.analysis?.global_subject || 'Cours du Précepteur',
          precepteurCourse: enriched,
          sourceText: m.project?.rawText || '',
        });
        if (saved?.id) {
          navigate(`/precepteur/cours/${saved.id}`);
          return;
        }
      } catch { /* persistance optionnelle : on retombe sur le flux localStorage */ }

      navigate('/precepteur/cours');
      return;
    }
    if (kind === 'smartboard-live') {
      const text = buildMarkdown(m.project);
      const title = m.project.analysis?.global_subject || 'Masterclass LIRI';
      const masterclass = {
        analysis_output: m.project.analysis || {},
        chapters: m.project.chapters || [],
        slides: m.project.slides || [],
        scripts: m.project.scripts || [],
        quality_check: m.project.quality || null,
      };
      savePendingMasterclassForLiveStudio({ title, text, masterclass });
      navigate('/studio/live?liriImport=1', {
        state: { liriAgentImport: { title, text, masterclass } },
      });
      return;
    }
    if (kind === 'pdf-professor' || kind === 'pdf-student') {
      const md = buildMarkdown(m.project);
      const suffix = kind === 'pdf-professor' ? 'professeur' : 'eleve';
      downloadBlob(md, `masterclass-${suffix}.md`, 'text/markdown;charset=utf-8');
      return;
    }
    if (kind === 'smartboard') {
      const pack = buildSmartboardPack(m.project);
      downloadBlob(pack, 'smartboard-pack.md', 'text/markdown;charset=utf-8');
      return;
    }
    if (kind === 'live') {
      const payload = {
        title: m.project.analysis?.global_subject || 'Masterclass Liri Live',
        summary: m.project.summary || null,
        chapters: m.project.chapters || [],
        scripts: m.project.scripts || [],
        slides: m.project.slides || [],
      };
      downloadBlob(JSON.stringify(payload, null, 2), 'liri-live-session.json', 'application/json');
    }
  };

  const screen = useMemo(() => {
    switch (m.step) {
      case 0:
        return (
          <Step1Raw
            rawText={m.project.rawText}
            setRawText={m.setRawText}
            onLaunch={handleLaunch}
            status={m.status}
            onLoadDemo={m.loadDemo}
            MAX_RAW_CHARS={m.MAX_RAW_CHARS}
            documentAnalyzeOptions={m.documentAnalyzeOptions}
            onDocumentAnalyzeOptionsChange={m.setDocumentAnalyzeOptions}
          />
        );
      case 1:
        return (
          <Step2Analysis
            analysis={m.project.analysis}
            status={m.status}
            pipelineStage={pipelineStage}
            onContinue={m.next}
            onRetry={handleLaunch}
            stats={factoryStats}
          />
        );
      case 2:
        return <Step3Blocks blocks={m.project.blocks ?? []} onContinue={m.next} onPrev={m.prev} stats={factoryStats} />;
      case 3:
        return (
          <Step4Chapters
            chapters={m.project.chapters ?? []}
            onContinue={m.next}
            onPrev={m.prev}
            stats={factoryStats}
          />
        );
      case 4:
        return <Step5Pedagogy chapters={m.project.chapters ?? []} onContinue={m.next} onPrev={m.prev} />;
      case 5:
        return (
          <Step6Slides
            slides={m.project.slides ?? []}
            chapters={m.project.chapters ?? []}
            onContinue={m.next}
            onPrev={m.prev}
          />
        );
      case 6:
        return (
          <Step7Script
            scripts={m.project.scripts ?? []}
            chapters={m.project.chapters ?? []}
            onContinue={m.next}
            onPrev={m.prev}
            onDownloadScript={handleDownloadScript}
          />
        );
      case 7:
        return (
          <Step8Export
            stats={factoryStats}
            project={m.project}
            onPrev={m.prev}
            onReset={m.reset}
            onDownloadJson={handleDownloadJson}
            onDownloadMarkdown={handleDownloadMarkdown}
            onDownloadExport={handleDownloadExport}
            precepteurLoading={precepteurLoading}
          />
        );
      default:
        return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.step, m.status, m.project, factoryStats, pipelineStage, precepteurLoading]);

  return (
    <LiriPortalShell active="studio">
      <div className="premium-dashboard-shell flex h-full min-h-0 text-white">
        <section className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-3 sm:p-4">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(75%_55%_at_50%_0%,rgba(217,119,87,0.12),transparent_68%)]" />
          <FactoryHeader onReset={m.reset} isRealBrain={m.isRealBrain} />

          <FactoryProgress active={m.step} onJump={m.goToStep} status={m.status} />

          {m.error ? (
            <div className="mb-2 shrink-0 rounded-lg border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-200">
              {m.error}
            </div>
          ) : null}

          {m.status === 'running' && pipelineStage ? (
            <div className="mb-2 flex shrink-0 items-center gap-2 rounded-lg border border-[#d97757]/30 bg-[#d97757]/10 px-2 py-1.5 text-[10px] text-[#e8b6a3]">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-[#d97757] border-t-transparent" />
              Pipeline LIRI · <strong>{pipelineStage}</strong>
            </div>
          ) : null}

          <OrchestratorLiveStrip
            orchestratorStatus={m.orchestratorStatus}
            queues={m.orchestratorQueues}
            chapterStatuses={m.orchestratorChapterStatuses}
          />

          <div className="premium-panel relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#30302e]/45 p-2 sm:p-2.5">
            {screen}
          </div>
        </section>
      </div>
    </LiriPortalShell>
  );
}
