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
import { savePendingMasterclassForLiveStudio } from '@/lib/liriAgentExportToLiveStudio';

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
    border: 'border-violet-400/45',
    iconClass: 'text-violet-100',
    halo: 'from-violet-500/50 via-violet-400/20 to-transparent',
    glow: 'shadow-[0_0_26px_-6px_rgba(139,92,246,0.55),inset_0_1px_0_rgba(255,255,255,0.14)]',
    glass: 'from-white/[0.14] to-violet-950/25',
  },
  {
    label: 'Analyse IA',
    sub: 'L’IA comprend',
    Icon: Network,
    border: 'border-sky-400/45',
    iconClass: 'text-sky-100',
    halo: 'from-sky-400/45 via-blue-500/20 to-transparent',
    glow: 'shadow-[0_0_26px_-6px_rgba(56,189,248,0.45),inset_0_1px_0_rgba(255,255,255,0.12)]',
    glass: 'from-white/[0.12] to-sky-950/35',
  },
  {
    label: 'Blocs & idées',
    sub: 'Découpage intelligent',
    Icon: Cuboid,
    border: 'border-cyan-400/40',
    iconClass: 'text-cyan-100',
    halo: 'from-cyan-400/45 via-cyan-500/15 to-transparent',
    glow: 'shadow-[0_0_24px_-6px_rgba(34,211,238,0.4),inset_0_1px_0_rgba(255,255,255,0.12)]',
    glass: 'from-white/[0.12] to-cyan-950/35',
  },
  {
    label: 'Chapitres',
    sub: 'Structure logique',
    Icon: ListOrdered,
    border: 'border-amber-400/45',
    iconClass: 'text-amber-100',
    halo: 'from-amber-400/50 via-amber-500/18 to-transparent',
    glow: 'shadow-[0_0_24px_-6px_rgba(251,191,36,0.38),inset_0_1px_0_rgba(255,255,255,0.12)]',
    glass: 'from-white/[0.12] to-amber-950/25',
  },
  {
    label: 'Pédagogie',
    sub: 'Contenu complet',
    Icon: LayoutGrid,
    border: 'border-emerald-400/45',
    iconClass: 'text-emerald-100',
    halo: 'from-emerald-400/40 via-green-500/18 to-transparent',
    glow: 'shadow-[0_0_22px_-6px_rgba(52,211,153,0.42),inset_0_1px_0_rgba(255,255,255,0.1)]',
    glass: 'from-white/[0.1] to-emerald-950/28',
  },
  {
    label: 'Slides & Docs',
    sub: 'Supports prêts',
    Icon: Monitor,
    border: 'border-teal-400/42',
    iconClass: 'text-teal-100',
    halo: 'from-teal-400/40 via-cyan-400/14 to-transparent',
    glow: 'shadow-[0_0_24px_-6px_rgba(45,212,191,0.4),inset_0_1px_0_rgba(255,255,255,0.11)]',
    glass: 'from-white/[0.11] to-teal-950/32',
  },
  {
    label: 'Export',
    sub: 'Prêt à enseigner',
    Icon: Upload,
    border: 'border-fuchsia-400/45',
    iconClass: 'text-fuchsia-100',
    halo: 'from-fuchsia-500/40 via-violet-500/22 to-transparent',
    glow: 'shadow-[0_0_26px_-6px_rgba(192,38,211,0.48),inset_0_1px_0_rgba(255,255,255,0.11)]',
    glass: 'from-white/[0.12] to-fuchsia-950/32',
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
  sense_block: 'bg-emerald-500/10 text-emerald-300',
  chapter: 'bg-cyan-500/10 text-cyan-300',
  doctrine: 'bg-violet-500/10 text-violet-300',
  definition: 'bg-cyan-500/10 text-cyan-300',
  revelation: 'bg-amber-500/10 text-amber-300',
  analogy: 'bg-emerald-500/10 text-emerald-300',
  example: 'bg-pink-500/10 text-pink-300',
  practice: 'bg-blue-500/10 text-blue-300',
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
        ? 'bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white shadow-[0_8px_22px_-10px_rgba(124,58,237,0.65)]'
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
    <aside className="premium-sidebar relative flex w-[200px] shrink-0 flex-col border-r border-white/10 bg-[#080D18]/95 p-3">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_0%_0%,rgba(124,58,237,0.18),transparent_55%)]" />

      <div className="relative mb-4 flex items-center gap-2.5 px-1">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600/45 to-fuchsia-600/25 text-white ring-1 ring-violet-400/40 shadow-[0_0_28px_-10px_rgba(124,58,237,0.85)]">
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
          <span className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500/40 to-cyan-500/20 ring-1 ring-white/15">
            <UserCircle2 className="h-9 w-9 text-violet-100/90" strokeWidth={1.4} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[12px] font-semibold leading-tight text-white">Professeur</p>
            <p className="mt-0.5 flex items-center gap-1 text-[10px] text-emerald-300/95">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
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
    <header className="premium-topbar mb-2 shrink-0 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0E1524]/85 px-4 py-2.5 shadow-[0_10px_30px_-18px_rgba(124,58,237,0.45)] backdrop-blur-xl">
      <div className="flex min-w-0 items-center gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15px] font-bold leading-tight tracking-tight">
              LIRI Masterclass Factory
            </h2>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/40 bg-violet-500/15 px-2.5 py-0.5 text-[10.5px] font-semibold text-violet-200">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-violet-300 shadow-[0_0_8px_rgba(167,139,250,0.9)]" />
              Mode automatique
            </span>
            {isRealBrain ? (
              <span className="text-[10px] text-emerald-300/90">● LIRI Brain</span>
            ) : null}
          </div>
          <p className="mt-0.5 text-[11.5px] text-white/50">
            Transforme n&apos;importe quel texte en Masterclass complète prête à enseigner.
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[11.5px] font-medium text-white/80 hover:bg-white/[0.08]"
        >
          <Clock size={12} className="text-white/55" /> Historique
        </button>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] px-3 py-1.5 text-[11.5px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(124,58,237,0.7)] hover:brightness-110"
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
    <div className="mb-2.5 shrink-0 flex items-center gap-1 overflow-x-auto rounded-xl border border-white/10 bg-[#0C1322]/70 px-2 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
              className={`group flex shrink-0 items-center gap-2 rounded-lg px-1.5 py-1 transition ${
                reachable ? 'hover:bg-white/5' : 'cursor-not-allowed opacity-60'
              }`}
            >
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-bold transition ${
                  done
                    ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-200'
                    : current
                    ? 'border-violet-400 bg-[#7C3AED] text-white shadow-[0_0_22px_-4px_rgba(124,58,237,0.85)]'
                    : 'border-white/12 bg-white/5 text-white/55'
                }`}
              >
                {done ? <Check size={12} strokeWidth={3} /> : index + 1}
              </div>
              <span
                className={`whitespace-nowrap text-[11px] font-medium ${
                  current ? 'text-white' : done ? 'text-white/70' : 'text-white/45'
                }`}
              >
                {step.label}
              </span>
            </button>
            {index < MASTERCLASS_STEPS.length - 1 ? (
              <span
                aria-hidden
                className={`h-px min-w-[14px] flex-1 border-t border-dashed ${
                  done ? 'border-emerald-400/40' : 'border-white/15'
                }`}
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
    <div className="mb-2 shrink-0 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-[10px] text-cyan-100">
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
                      ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-100'
                      : status === 'failed'
                      ? 'border-red-400/50 bg-red-500/20 text-red-100'
                      : status === 'smartboard_generating'
                      ? 'border-violet-400/50 bg-violet-500/20 text-violet-100'
                      : status === 'ready_for_smartboard'
                      ? 'border-sky-400/50 bg-sky-500/20 text-sky-100'
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
    <div className="rounded-xl border border-white/10 bg-[#0A101D] p-2.5 text-center">
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px] text-white/45">{label}</p>
    </div>
  );
}

/** Stats avec icône — étape 1 / aperçu (alignée maquette) */
function StatPreviewMini({ icon: Icon, value, label }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0A101D] px-2 py-2.5 text-center shadow-inner shadow-black/30">
      <div className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/12 text-violet-300 ring-1 ring-violet-400/25">
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
  const [showHow, setShowHow] = useState(false);
  const fileInputRef = useRef(null);

  const onPickFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setRawText(String(reader.result || '').slice(0, MAX_RAW_CHARS));
    reader.readAsText(f);
    e.target.value = '';
  };

  const CHAPTER_ELEMENTS = [
    'Objectif du chapitre', 'Compétence à acquérir', 'Connaissance à transmettre',
    'Mise en situation', 'Tension pédagogique', 'Expérience de pensée',
    'Révélation', 'Leçon simple', 'Leçon développée', 'Analogies',
    'Exemples', 'Reformulation', 'Atelier / Application', 'JE RETIENS (dictée)',
    'Test de compréhension', 'Cas réel', 'Transition',
  ];

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[1fr_360px] gap-3 overflow-hidden">

      {/* ─── COLONNE GAUCHE : INPUT ─── */}
      <div className="flex min-h-0 flex-col gap-2.5">

        {/* Texte brut — flex-1 pour remplir */}
        <div className="relative flex min-h-0 flex-1 flex-col rounded-2xl border border-white/[0.08] bg-[radial-gradient(80%_70%_at_12%_0%,rgba(124,58,237,0.18),transparent_60%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.025))] p-4 shadow-[0_14px_36px_-28px_rgba(124,58,237,0.42)]">
          <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600/35 to-violet-800/25 text-violet-200 ring-1 ring-violet-500/35">
                <FileText size={16} strokeWidth={1.85} />
              </div>
              <div>
                <p className="text-[12px] font-bold uppercase tracking-wider text-white">Texte brut à transformer</p>
                <p className="text-[11px] text-white/45">Colle ton contenu, LIRI s&apos;occupe du reste</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <input ref={fileInputRef} type="file" accept=".txt,.md,.text,text/plain" className="sr-only" onChange={onPickFile} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11.5px] font-medium text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-white/25 hover:bg-white/[0.08]"
              >
                <Upload className="h-3.5 w-3.5" /> Importer
              </button>
            </div>
          </div>

          {/* Textarea — flex-1 remplit l'espace restant */}
          <div className="relative flex min-h-0 flex-1 flex-col">
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              className="min-h-0 flex-1 w-full resize-none rounded-xl border border-violet-300/30 bg-[#060A12] p-3.5 pb-8 text-[13px] leading-relaxed text-white outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_0_0_1px_rgba(168,85,247,0.36),0_0_34px_-12px_rgba(168,85,247,0.8)] transition placeholder:text-white/35 focus:border-violet-300/75 focus:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_0_1px_rgba(168,85,247,0.62),0_0_38px_-10px_rgba(168,85,247,0.68)]"
              placeholder="Colle ici ton texte, ta transcription, ta doctrine, ton idée…"
            />
            <div className="pointer-events-none absolute bottom-2 left-3 text-[11px] tabular-nums text-white/30">
              {rawText.length.toLocaleString()} / {MAX_RAW_CHARS.toLocaleString()}
            </div>
            <button
              type="button"
              onClick={() => setRawText('')}
              className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[11px] text-white/60 transition hover:bg-white/[0.08]"
            >
              <Trash2 size={11} /> Effacer
            </button>
          </div>

          {/* Tags */}
          <div className="mt-2.5 flex shrink-0 flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10.5px] font-semibold uppercase tracking-wide text-white/35">Exemples :</span>
            {EXAMPLE_TYPES.map((item) => {
              const on = exampleTag === item;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setExampleTag(item)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] transition ${
                    on
                      ? 'border-violet-300/60 bg-violet-500/15 text-white shadow-[inset_0_0_0_1px_rgba(167,139,250,0.2)]'
                      : 'border-white/10 bg-white/[0.03] text-white/50 hover:border-white/20 hover:text-white/80'
                  }`}
                >
                  {item === 'Transcription audio' ? <span className="text-[11px]">🎙</span> : null}
                  {item}
                </button>
              );
            })}
            <button
              type="button"
              onClick={onLoadDemo}
              className="ml-1 text-[11px] text-violet-300/70 underline decoration-dotted underline-offset-2 transition hover:text-violet-200"
            >
              démo
            </button>
          </div>
        </div>

        <div className="shrink-0 space-y-2 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/55">Analyse structurée du document</p>
          <label
            className={`flex items-start gap-2 ${(rawText?.length ?? 0) > DOCUMENT_ANALYZE_FIRST_WINDOW_CHARS ? 'cursor-pointer' : 'cursor-not-allowed opacity-55'}`}
          >
            <input
              type="checkbox"
              className="mt-0.5 rounded border-white/20 bg-black/40"
              checked={!!documentAnalyzeOptions?.secondWindow}
              onChange={(e) => onDocumentAnalyzeOptionsChange?.({ secondWindow: e.target.checked })}
              disabled={(rawText?.length ?? 0) <= DOCUMENT_ANALYZE_FIRST_WINDOW_CHARS}
            />
            <span className="text-[11px] leading-snug text-white/75">
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
            <span className="text-[11px] leading-snug text-white/75">
              Compléter les trous (gap-fill IA) pour la couverture des passages.
            </span>
          </label>
          {(documentAnalyzeOptions?.secondWindow && documentAnalyzeOptions?.gapFill !== false) && (
            <p className="text-[10px] leading-snug text-amber-200/90">
              Les deux options combinées augmentent le risque de timeout réseau.
            </p>
          )}
        </div>

        {/* CTA */}
        <button
          type="button"
          onClick={onLaunch}
          disabled={!rawText.trim() || status === 'running'}
          className="group flex h-[52px] w-full shrink-0 items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-[#c014f6] via-[#7c3aed] to-[#2563eb] text-[13px] font-extrabold uppercase tracking-[0.1em] text-white shadow-[0_14px_32px_-12px_rgba(76,29,149,0.8),0_0_0_1px_rgba(124,58,237,0.25)] transition duration-200 hover:brightness-110 hover:shadow-[0_14px_40px_-10px_rgba(76,29,149,0.9)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Rocket className="h-[18px] w-[18px] transition-transform group-hover:-rotate-12" strokeWidth={2.2} />
          {status === 'running' ? 'Transformation en cours…' : 'Lancer la transformation automatique'}
          <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.2} />
        </button>

        {/* Comment ça marche — accordéon fermé par défaut */}
        <div className="shrink-0 overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.025]">
          <button
            type="button"
            onClick={() => setShowHow((v) => !v)}
            className="flex w-full items-center justify-between px-3.5 py-2.5 text-[11.5px] font-medium text-white/60 transition hover:text-white/90"
          >
            <span className="flex items-center gap-2">
              <Sparkles size={13} className="text-violet-400/80" />
              Comment ça marche ?
            </span>
            <ChevronRight
              size={13}
              className={`text-white/40 transition-transform duration-200 ${showHow ? 'rotate-90' : ''}`}
            />
          </button>
          {showHow ? (
            <div className="border-t border-white/[0.06] px-3 pb-3 pt-2">
              <div className="flex flex-wrap items-start justify-between gap-y-2 sm:flex-nowrap sm:gap-x-1">
                {HOW_IT_WORKS_STEPS.map((step, idx) => {
                  const Icon = step.Icon;
                  return (
                    <React.Fragment key={step.label}>
                      <div className="flex w-1/4 min-w-0 flex-col items-center text-center sm:w-auto sm:flex-1">
                        <div
                          className={`mb-1 flex h-9 w-9 items-center justify-center rounded-xl border bg-gradient-to-br backdrop-blur-xl ${step.border} ${step.glass} ${step.glow}`}
                        >
                          <Icon className={`h-4 w-4 ${step.iconClass}`} strokeWidth={1.85} />
                        </div>
                        <p className="text-[10px] font-semibold leading-tight text-white/85">{step.label}</p>
                        <p className="mt-0.5 max-w-[5rem] text-[9px] leading-tight text-white/40">{step.sub}</p>
                      </div>
                      {idx < HOW_IT_WORKS_STEPS.length - 1 ? (
                        <ChevronRight className="mt-2 hidden h-3 w-3 shrink-0 text-white/20 sm:block" strokeWidth={2} aria-hidden />
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* ─── COLONNE DROITE : PREVIEW ─── */}
      <div className="flex min-h-0 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/10 bg-[radial-gradient(90%_80%_at_0%_0%,rgba(6,182,212,0.1),transparent_58%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.03))] p-3.5 shadow-[0_18px_44px_-30px_rgba(6,182,212,0.35)]">
          <div className="mb-3 shrink-0">
            <h3 className="text-[12px] font-bold uppercase tracking-wider text-white">Aperçu du résultat</h3>
            <p className="mt-0.5 text-[11px] text-white/45">Une fois la transformation terminée, ton cours apparaîtra ici.</p>
          </div>

          {/* Stats */}
          <div className="grid shrink-0 grid-cols-5 gap-1.5">
            {[
              { icon: BookOpen, value: '0', label: 'chapitres' },
              { icon: Clock, value: '0', label: 'min' },
              { icon: Layers, value: '0', label: 'slides' },
              { icon: Pencil, value: '0', label: 'exercices' },
              { icon: HelpCircle, value: '0', label: 'tests' },
            ].map(({ icon: Icon, value, label }) => (
              <div key={label} className="rounded-xl border border-white/10 bg-[#0A101D] px-1 py-2 text-center shadow-inner shadow-black/30">
                <div className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-lg bg-violet-500/12 text-violet-300 ring-1 ring-violet-400/20">
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.85} />
                </div>
                <p className="text-[16px] font-bold tabular-nums leading-none text-white">{value}</p>
                <p className="mt-0.5 text-[9.5px] text-white/45">{label}</p>
              </div>
            ))}
          </div>

          {/* Empty state */}
          <div className="mt-3 flex shrink-0 flex-col items-center justify-center rounded-2xl border border-white/10 bg-[radial-gradient(70%_80%_at_50%_20%,rgba(124,58,237,0.22),transparent_62%),#0A101D] px-4 py-5 text-center">
            <div className="mb-2.5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#8B5CF6]/35 to-cyan-500/12 shadow-[0_0_32px_-6px_rgba(139,92,246,0.6)] ring-1 ring-white/10">
              <Brain className="h-7 w-7 text-violet-200/85" strokeWidth={1.5} />
            </div>
            <p className="text-[13px] font-semibold text-white">Aucune analyse pour le moment</p>
            <p className="mt-1 text-[11px] leading-snug text-white/45">Colle ton texte et lance la transformation.</p>
          </div>

          {/* Éléments du chapitre — scrollable */}
          <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0A101D]">
            <h4 className="shrink-0 border-b border-white/[0.07] px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-white/80">
              Exemple de chapitre
            </h4>
            <div className="min-h-0 flex-1 overflow-y-auto p-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="grid grid-cols-2 gap-1">
                {CHAPTER_ELEMENTS.map((item, index) => (
                  <div
                    key={item}
                    className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] px-2 py-1.5 transition hover:bg-white/[0.05]"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-violet-500/15 text-[10px] font-bold tabular-nums text-violet-300">
                      {index + 1}
                    </span>
                    <span className="truncate text-[11px] leading-snug text-white/70">{item}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 px-2 py-1.5 text-center text-[10.5px] text-white/35">
                Chaque chapitre : <span className="font-semibold text-violet-300/80">17 éléments</span> pédagogiques
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Adapte l'analyse de `useMasterclassProject` aux champs attendus par l'UI historique + thèmes CDC. */
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
  const progressPct = running ? 65 : analysis ? 100 : 0;

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[52%_48%]">
      <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
        <Panel
          title="2. ANALYSE IA DU TEXTE"
          action={
            <button
              type="button"
              onClick={onRetry}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs transition hover:bg-white/10"
            >
              <RefreshCcw className="mr-2 inline" size={14} /> Relancer
            </button>
          }
        >
          <p className="mt-1 text-xs text-white/55">
            LIRI comprend le sujet, détecte les révélations et prépare la structure du cours.
          </p>

          <div className="mt-3 grid grid-cols-1 overflow-hidden rounded-2xl border border-violet-500/30 bg-[#0A101D] lg:grid-cols-[60%_40%]">
            <div className="p-4">
              <div className="mb-5 flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-violet-600/20 text-violet-300 shadow-lg shadow-violet-800/30">
                  <Brain size={40} />
                </div>
                <div>
                  <h4 className="text-lg font-bold">{running ? 'Analyse en cours…' : 'Analyse terminée'}</h4>
                  <p className="mt-1 text-xs text-white/45">
                    Lecture profonde du texte et extraction pédagogique.
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                {steps.map(({ label, done }) => (
                  <div key={label} className="flex items-center gap-2.5 text-xs">
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded-full ${
                        done ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white/30'
                      }`}
                    >
                      {done ? <Check size={12} /> : '•'}
                    </div>
                    <span className={done ? 'text-white/80' : 'text-white/45'}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col items-center justify-center border-t border-white/10 p-5 lg:border-l lg:border-t-0">
              <div className="relative flex h-28 w-28 items-center justify-center rounded-full border-[8px] border-white/10">
                <div
                  className={`absolute inset-[-8px] rounded-full border-[8px] border-violet-500 ${
                    progressPct < 100 ? 'border-r-transparent border-b-transparent' : ''
                  }`}
                />
                <span className="text-2xl font-bold">{progressPct}%</span>
              </div>
              <p className="mt-3 font-semibold text-violet-300">
                {progressPct === 100 ? 'Analyse complète' : 'Analyse en cours'}
              </p>
              <p className="mt-1.5 text-center text-[11px] text-white/45">
                Cela peut prendre 20 à 60 secondes selon la taille du texte.
              </p>
            </div>
          </div>
        </Panel>

        <Panel title="RÉSUMÉ DE L'ANALYSE">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-[#0A101D] p-3">
              <FileText className="mb-2 text-cyan-300" size={18} />
              <h4 className="text-sm font-semibold">Sujet global</h4>
              <p className="mt-1.5 text-xs leading-relaxed text-white/60">
                {av?.global_subject || '— En attente —'}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#0A101D] p-3">
              <Target className="mb-2 text-cyan-300" size={18} />
              <h4 className="text-sm font-semibold">Intention du cours</h4>
              <p className="mt-1.5 text-xs leading-relaxed text-white/60">
                {av?.intention || '— En attente —'}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#0A101D] p-3">
              <Users className="mb-2 text-cyan-300" size={18} />
              <h4 className="text-sm font-semibold">Public cible</h4>
              <p className="mt-1.5 text-xs leading-relaxed text-white/60">
                {av?.audience || '— En attente —'}
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-[#0A101D] p-3">
              <h4 className="mb-2 text-sm font-semibold">Niveau de difficulté</h4>
              <p className="text-xs text-white/60 capitalize">{av?.difficulty || '—'}</p>
              <div className="mt-2 h-1.5 rounded-full bg-white/10">
                <div
                  className="h-1.5 rounded-full bg-violet-500"
                  style={{ width: `${Math.round((av?.difficulty_score || 0) * 100)}%` }}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0A101D] p-3">
              <Clock className="mb-2 text-violet-300" size={18} />
              <h4 className="text-sm font-semibold">Durée estimée</h4>
              <p className="mt-1 text-xl font-bold">{av?.estimated_total_duration || '—'}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#0A101D] p-3">
              <Layers className="mb-2 text-violet-300" size={18} />
              <h4 className="text-sm font-semibold">Chapitres estimés</h4>
              <p className="mt-1 text-xl font-bold">{stats.chapters || '—'}</p>
            </div>
          </div>

          {av?.global_revelations?.length ? (
            <div className="mt-3 rounded-2xl border border-white/10 bg-[#0A101D] p-3">
              <h4 className="mb-2 text-sm font-semibold">Grandes révélations détectées</h4>
              <div className="space-y-1">
                {av.global_revelations.slice(0, 6).map((r, i) => (
                  <p key={i} className="flex gap-2 text-xs text-white/65">
                    <Lightbulb size={14} className="shrink-0 text-amber-300" /> {r}
                  </p>
                ))}
              </div>
            </div>
          ) : null}
        </Panel>

        {analysis?.structured_document?.topics?.length ? (
          <Panel title="CARTOGRAPHIE & HORODATAGE (BLOCS CDC)">
            {analysis.document_stats ? (
              <div className="mb-3 flex flex-wrap gap-3 text-[11px] text-white/65">
                <span>{analysis.document_stats.word_count?.toLocaleString('fr-FR')} mots</span>
                <span>{analysis.document_stats.paragraph_count} paragraphes</span>
                <span>{analysis.document_stats.char_count?.toLocaleString('fr-FR')} car.</span>
              </div>
            ) : null}
            {analysis.structure_meta?.truncated ? (
              <p className="mb-3 rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200/90">
                Analyse structurée sur les {analysis.structure_meta.structure_char_end?.toLocaleString('fr-FR')}{' '}
                premiers caractères uniquement.
              </p>
            ) : null}
            {analysis.structure_meta?.analysis_quality ? (
              <div
                className={`mb-3 rounded-xl border px-3 py-2 text-[11px] ${
                  analysis.structure_meta.analysis_quality.needs_review
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-100/90'
                    : 'border-white/10 bg-[#0A101D] text-white/65'
                }`}>
                <p className="mb-1 font-semibold text-white/80">Couverture (fragments déterministes)</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  <span>
                    {Math.round((analysis.structure_meta.analysis_quality.coverage_ratio ?? 0) * 1000) / 10} % couvert
                  </span>
                  {analysis.structure_meta.fragment_count != null ? (
                    <span>{analysis.structure_meta.fragment_count} fragments</span>
                  ) : null}
                  <span>{analysis.structure_meta.analysis_quality.gap_count ?? 0} trou(s)</span>
                  <span>{analysis.structure_meta.analysis_quality.overlap_count ?? 0} chev.</span>
                </div>
                {analysis.structure_meta.analysis_meta ? (
                  <p className="mt-1.5 text-[10px] text-white/45">
                    {analysis.structure_meta.analysis_meta.window_count ?? 1} fenêtre(s)
                    {analysis.structure_meta.analysis_meta.gap_fill_applied ? ' · gap-fill' : ''}
                  </p>
                ) : null}
                {analysis.structure_meta.analysis_quality.needs_review ? (
                  <p className="mt-1.5 text-amber-200/85">
                    Revue recommandée : ajuster les passages ou relancer l&apos;analyse.
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="space-y-2">
              {analysis.structured_document.topics.map((t) => {
                const passes =
                  analysis.structured_document.passages?.filter((p) => p.topic_id === t.id).length || 0;
                return (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-xl border border-white/10 bg-[#0A101D] px-3 py-2"
                  >
                    <span className="text-xs font-medium text-white/85">{t.label}</span>
                    <span className="text-[10px] text-white/45">
                      {passes} passage{passes > 1 ? 's' : ''}
                    </span>
                  </div>
                );
              })}
            </div>
            {analysis.structured_document.recommended_chapter_order?.length ? (
              <div className="mt-3">
                <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-white/50">
                  Ordre d&apos;enseignement recommandé
                </h4>
                <ol className="list-decimal list-inside space-y-0.5 text-[11px] text-white/55">
                  {analysis.structured_document.recommended_chapter_order.map((tid) => {
                    const topic = analysis.structured_document.topics.find((x) => x.id === tid);
                    return <li key={tid}>{topic?.label || tid}</li>;
                  })}
                </ol>
              </div>
            ) : null}
            {analysis.pedagogical_reordering_rationale ? (
              <p className="mt-3 border-l-2 border-violet-500/40 pl-3 text-[11px] leading-relaxed text-white/50">
                {analysis.pedagogical_reordering_rationale.slice(0, 1000)}
                {analysis.pedagogical_reordering_rationale.length > 1000 ? '…' : ''}
              </p>
            ) : null}
            {analysis.search_index?.length ? (
              <div className="mt-3">
                <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-white/50">Index rapide</h4>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.search_index.slice(0, 14).map((row) => (
                    <span
                      key={row.term}
                      className="rounded-md border border-cyan-500/25 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-200/80"
                    >
                      {row.term} ({row.hits?.length || 0})
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </Panel>
        ) : null}
      </div>

      <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
        <Panel title="APERÇU DU RÉSULTAT">
          <div className="mt-1 grid grid-cols-5 gap-2">
            <StatCard value={stats.chapters} label="chapitres" />
            <StatCard value={stats.minutes} label="min" />
            <StatCard value={stats.slides} label="slides" />
            <StatCard value={stats.exercises} label="exercices" />
            <StatCard value={stats.tests} label="tests" />
          </div>

          <div className="mt-3 rounded-2xl border border-white/10 bg-[#0A101D] p-4">
            <h4 className="mb-3 text-base font-bold">Structure du cours détectée</h4>
            <div className="space-y-2">
              {(av ? av.central_themes : []).slice(0, 8).map((title, index) => (
                <div
                  key={`${title}-${index}`}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-600/30 text-xs">
                      {index + 1}
                    </span>
                    <span className="text-xs text-white/75">{title}</span>
                  </div>
                </div>
              ))}
              {!analysis ? <p className="text-xs text-white/45">Lance la transformation pour voir la structure.</p> : null}
            </div>

            {av?.estimated_total_duration ? (
              <div className="mt-3 flex justify-between border-t border-white/10 pt-3">
                <span className="text-xs text-white/60">Total estimé</span>
                <span className="text-sm font-bold text-emerald-400">{av.estimated_total_duration}</span>
              </div>
            ) : null}
          </div>
        </Panel>

        <button
          type="button"
          onClick={onContinue}
          disabled={!analysis}
          className="w-full rounded-xl bg-[#7C3AED] py-3 text-sm font-semibold shadow-lg shadow-violet-900/40 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continuer vers Blocs &amp; idées <ArrowRight className="ml-1 inline" size={14} />
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────────── Step 3 — Blocs & idées ──────────────────────────── */

function Step3Blocks({ blocks, onContinue, onPrev, stats }) {
  const list = blocks ?? [];
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[62%_38%]">
      <Panel title="3. BLOCS & IDÉES RÉVÉLÉES">
        <div className="space-y-3">
          {list.length === 0 ? (
            <p className="text-sm text-white/50">Aucun bloc détecté. Relance la transformation.</p>
          ) : null}
          {list.map((b) => (
            <article key={b.id} className="rounded-2xl border border-white/10 bg-[#0A101D] p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="mb-2 flex flex-wrap gap-2">
                    <span className="rounded-lg bg-violet-600 px-2.5 py-1 text-xs font-bold">{b.id}</span>
                    <span className="rounded-lg bg-cyan-500/10 px-2.5 py-1 text-[11px] text-cyan-300">{b.lines_label}</span>
                    <span className="rounded-lg bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-300">
                      {b.duration_minutes} min
                    </span>
                    {b.type ? (
                      <span className={`rounded-lg px-2.5 py-1 text-[11px] ${TYPE_COLORS[b.type] || 'bg-white/5 text-white/55'}`}>
                        {b.type}
                      </span>
                    ) : null}
                    {b.subject_label ? (
                      <span
                        className="max-w-[180px] truncate rounded-lg bg-violet-500/20 px-2.5 py-1 text-[11px] text-violet-200"
                        title={b.subject_label}
                      >
                        {b.subject_label}
                      </span>
                    ) : null}
                  </div>
                  <h4 className="text-sm font-bold">{b.title}</h4>
                  <p className="mt-1 text-xs text-white/60">{b.central_idea}</p>
                  {b.new_elements ? (
                    <p className="mt-2 border-l-2 border-amber-500/40 pl-2 text-[11px] text-amber-200/85">+ {b.new_elements}</p>
                  ) : null}
                </div>
                <ChevronRight className="text-white/30" />
              </div>
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
                <MiniList title="Révélations" items={b.revelations} color="text-violet-300" />
                <MiniList title="Tensions" items={b.tensions} color="text-amber-300" />
                <MiniList title="Mots-clés" items={b.keywords} color="text-cyan-300" />
              </div>
            </article>
          ))}
        </div>
      </Panel>

      <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
        <Panel title="Résumé du découpage">
          <div className="grid grid-cols-2 gap-2">
            <StatCard value={list.length} label="blocs" />
            <StatCard
              value={list.reduce((acc, b) => acc + (Array.isArray(b.keywords) ? b.keywords.length : 0), 0)}
              label="mots-clés"
            />
            <StatCard
              value={list.reduce((acc, b) => acc + (Array.isArray(b.revelations) ? b.revelations.length : 0), 0)}
              label="révélations"
            />
            <StatCard
              value={list.reduce((acc, b) => acc + (Number(b.duration_minutes) || 0), 0)}
              label="min"
            />
          </div>
        </Panel>

        <Panel title="Logique pédagogique">
          {[
            'Tension → Révélation',
            'Atelier avant leçon',
            'Dictée JE RETIENS',
            'Validation par test',
            'Transition entre chapitres',
          ].map((x) => (
            <p key={x} className="mb-2 rounded-xl bg-[#0A101D] p-2.5 text-xs text-white/70">
              {x}
            </p>
          ))}
        </Panel>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onPrev}
            className="rounded-xl border border-white/10 bg-white/5 py-3 text-sm hover:bg-white/10"
          >
            <ArrowLeft className="mr-1 inline" size={14} /> Analyse
          </button>
          <button
            type="button"
            onClick={onContinue}
            disabled={!list.length}
            className="rounded-xl bg-[#7C3AED] py-3 text-sm font-semibold shadow-lg shadow-violet-900/40 hover:bg-violet-500 disabled:opacity-40"
          >
            Chapitres <ArrowRight className="ml-1 inline" size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────── Step 4 — Chapitres ──────────────────────────── */

function Step4Chapters({ chapters, onContinue, onPrev, stats }) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[60%_40%]">
      <Panel title="4. CONSTRUCTION DES CHAPITRES">
        <div className="space-y-3">
          {chapters.length === 0 ? (
            <p className="text-sm text-white/50">Aucun chapitre — lance la transformation.</p>
          ) : null}
          {chapters.map((c, i) => (
            <div key={c.chapter_id || i} className="rounded-2xl border border-white/10 bg-[#0A101D] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded-lg bg-violet-600 px-2 py-1 text-[11px] font-bold">{c.chapter_id || i + 1}</span>
                    <span className="rounded-lg bg-amber-500/10 px-2 py-1 text-[11px] text-amber-300">
                      {c.recommended_duration_minutes || 0} min
                    </span>
                    <span className="rounded-lg bg-white/5 px-2 py-1 text-[11px] capitalize text-white/55">
                      {c.difficulty || 'medium'}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold">{c.title}</h4>
                  <p className="mt-1 text-xs text-white/55">
                    <span className="text-violet-300">Objectif :</span> {c.objective || '—'}
                  </p>
                  <p className="mt-1 text-xs text-white/55">
                    <span className="text-cyan-300">Compétence :</span> {c.skill_to_acquire || '—'}
                  </p>
                  <p className="mt-1 text-xs text-white/55">
                    <span className="text-emerald-300">Connaissance :</span> {c.knowledge_to_transmit || '—'}
                  </p>
                </div>
                <Pencil className="shrink-0 text-white/30" size={18} />
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
        <Panel title="Résumé global">
          <div className="grid grid-cols-2 gap-2">
            <StatCard value={stats.chapters} label="chapitres" />
            <StatCard value={stats.minutes} label="minutes" />
            <StatCard value={stats.slides} label="slides" />
            <StatCard value={stats.tests} label="tests" />
          </div>
        </Panel>

        <Panel title="Logique pédagogique appliquée">
          {[
            'Tension → Révélation',
            'Atelier avant leçon',
            'Dictée JE RETIENS',
            'Validation par test',
            'Cas réel à appliquer',
            'Transition vers chapitre suivant',
          ].map((x) => (
            <p key={x} className="mb-2 rounded-xl bg-[#0A101D] p-2.5 text-xs text-white/70">
              {x}
            </p>
          ))}
        </Panel>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onPrev}
            className="rounded-xl border border-white/10 bg-white/5 py-3 text-sm hover:bg-white/10"
          >
            <ArrowLeft className="mr-1 inline" size={14} /> Blocs
          </button>
          <button
            type="button"
            onClick={onContinue}
            disabled={!chapters.length}
            className="rounded-xl bg-[#7C3AED] py-3 text-sm font-semibold shadow-lg shadow-violet-900/40 hover:bg-violet-500 disabled:opacity-40"
          >
            Pédagogie <ArrowRight className="ml-1 inline" size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────── Step 5 — Pédagogie ──────────────────────────── */

function Step5Pedagogy({ chapters, onContinue, onPrev }) {
  const [activeId, setActiveId] = React.useState(chapters[0]?.chapter_id || null);
  React.useEffect(() => {
    if (!activeId && chapters[0]) setActiveId(chapters[0].chapter_id);
  }, [activeId, chapters]);
  const active = chapters.find((c) => c.chapter_id === activeId) || chapters[0] || null;

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[28%_72%]">
      <Panel title="5. PÉDAGOGIE & ACTIVITÉS">
        <p className="mb-3 text-[11px] text-white/45">Sélectionne un chapitre pour voir le scénario complet.</p>
        <div className="space-y-2">
          {chapters.map((c) => (
            <button
              key={c.chapter_id}
              type="button"
              onClick={() => setActiveId(c.chapter_id)}
              className={`w-full rounded-xl border px-3 py-2 text-left text-xs transition ${
                activeId === c.chapter_id
                  ? 'border-violet-400/60 bg-violet-600/20 text-white'
                  : 'border-white/10 bg-[#0A101D] text-white/65 hover:bg-white/5'
              }`}
            >
              <span className="text-violet-300">Ch. {c.chapter_id}</span> — {c.title}
            </button>
          ))}
        </div>
      </Panel>

      <Panel title={active ? `Chapitre ${active.chapter_id} — ${active.title}` : 'Chapitre'}>
        {active ? (
          <div className="space-y-3 overflow-y-auto pr-1">
            <PedagogyRow icon={Target} label="Mise en situation" value={active.real_life_situation} />
            <PedagogyRow icon={Lightbulb} label="Tension pédagogique" value={active.pedagogical_tension} />
            <PedagogyRow icon={Brain} label="Expérience de pensée" value={active.thought_experiment} />
            <PedagogyRow icon={Sparkles} label="Révélation" value={active.revelation_moment || active.main_revelation} />
            <PedagogyRow icon={BookOpen} label="Leçon simple" value={active.simple_lesson} />
            <PedagogyRow icon={BookOpen} label="Leçon développée" value={active.deep_lesson} />

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Panel title="Analogies" dense>
                {(active.analogies || []).map((a, i) => (
                  <p key={i} className="mb-2 rounded-lg bg-[#0A101D] p-2 text-xs text-white/70">
                    <span className="text-cyan-300">{a.type || 'analogie'} ·</span> {a.content || ''}
                  </p>
                ))}
                {!active.analogies?.length && <p className="text-xs text-white/45">—</p>}
              </Panel>
              <Panel title="Exemples" dense>
                {(active.examples || []).map((e, i) => (
                  <p key={i} className="mb-2 rounded-lg bg-[#0A101D] p-2 text-xs text-white/70">
                    <span className="text-emerald-300">{e.type || 'exemple'} ·</span> {e.content || ''}
                  </p>
                ))}
                {!active.examples?.length && <p className="text-xs text-white/45">—</p>}
              </Panel>
            </div>

            <PedagogyRow icon={MessageCircle} label="Reformulation" value={active.reformulation} />

            {active.workshop?.instructions ? (
              <Panel title="Atelier participatif" dense>
                <p className="text-xs text-white/70">{active.workshop.instructions}</p>
                {active.workshop.questions?.length ? (
                  <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                    <MiniList title="Questions" items={active.workshop.questions} color="text-cyan-300" />
                    <MiniList title="Réponses attendues" items={active.workshop.expected_answers} color="text-emerald-300" />
                  </div>
                ) : null}
              </Panel>
            ) : null}

            {active.je_retiens?.length ? (
              <Panel title="JE RETIENS — à dicter" dense>
                <ol className="list-decimal space-y-1 pl-5 text-xs text-white/75">
                  {active.je_retiens.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              </Panel>
            ) : null}

            {active.understanding_test?.length ? (
              <Panel title="Test de compréhension" dense>
                {active.understanding_test.map((t, i) => (
                  <div key={i} className="mb-2 rounded-lg bg-[#0A101D] p-2 text-xs">
                    <p className="text-white/85">Q{i + 1}. {t.question}</p>
                    <p className="mt-1 text-emerald-300">→ {t.expected_answer}</p>
                  </div>
                ))}
              </Panel>
            ) : null}

            <PedagogyRow icon={ArrowRight} label="Transition" value={active.transition_to_next} />
          </div>
        ) : (
          <p className="text-sm text-white/45">Aucun chapitre.</p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onPrev}
            className="rounded-xl border border-white/10 bg-white/5 py-3 text-sm hover:bg-white/10"
          >
            <ArrowLeft className="mr-1 inline" size={14} /> Chapitres
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="rounded-xl bg-[#7C3AED] py-3 text-sm font-semibold shadow-lg shadow-violet-900/40 hover:bg-violet-500"
          >
            Slides <ArrowRight className="ml-1 inline" size={14} />
          </button>
        </div>
      </Panel>
    </div>
  );
}

function PedagogyRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#0A101D] p-3">
      <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-violet-300">
        <Icon size={14} /> {label}
      </div>
      <p className="text-xs leading-relaxed text-white/75">{value}</p>
    </div>
  );
}

/* ──────────────────────────── Step 6 — Slides ──────────────────────────── */

function Step6Slides({ slides, chapters, onContinue, onPrev }) {
  const [activeIdx, setActiveIdx] = React.useState(0);
  const active = slides[activeIdx] || null;
  const activeChapter = active ? chapters.find((c) => c.chapter_id === active.chapter_id) : null;

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[30%_70%]">
      <Panel title="6. SLIDES SMARTBOARD">
        <p className="mb-3 text-[11px] text-white/45">{slides.length} slides générés</p>
        <div className="space-y-1.5 overflow-y-auto pr-1">
          {slides.map((s, i) => (
            <button
              key={s.slide_id || i}
              type="button"
              onClick={() => setActiveIdx(i)}
              className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-xs transition ${
                i === activeIdx
                  ? 'border-violet-400/60 bg-violet-600/15 text-white'
                  : 'border-white/10 bg-[#0A101D] text-white/65 hover:bg-white/5'
              }`}
            >
              <span className="truncate">
                <span className="text-violet-300">#{i + 1}</span> {s.title}
              </span>
              <span className="ml-2 shrink-0 rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] text-white/55">
                {s.kind}
              </span>
            </button>
          ))}
          {slides.length === 0 ? (
            <p className="text-xs text-white/45">Aucun slide. Relance la transformation.</p>
          ) : null}
        </div>
      </Panel>

      <Panel title={active ? `Prévisualisation — ${active.kind.toUpperCase()}` : 'Prévisualisation'}>
        {active ? (
          <div className="flex h-[460px] flex-col justify-center rounded-3xl border border-violet-500/30 bg-gradient-to-br from-violet-950 via-[#0A101D] to-cyan-950 p-10">
            {activeChapter ? (
              <p className="text-xs uppercase tracking-widest text-violet-300">
                Chapitre {activeChapter.chapter_id}
              </p>
            ) : null}
            <h2 className="mt-4 text-3xl font-bold leading-tight md:text-4xl">{active.title}</h2>
            {active.subtitle ? <p className="mt-2 text-sm text-violet-200/70">{active.subtitle}</p> : null}
            {active.body ? <p className="mt-6 max-w-2xl text-base text-white/75">{active.body}</p> : null}
            {active.bullets?.length ? (
              <ul className="mt-6 max-w-2xl space-y-2">
                {active.bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-white/80">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-400" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-white/45">Aucun slide à afficher.</p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onPrev}
            className="rounded-xl border border-white/10 bg-white/5 py-3 text-sm hover:bg-white/10"
          >
            <ArrowLeft className="mr-1 inline" size={14} /> Pédagogie
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="rounded-xl bg-[#7C3AED] py-3 text-sm font-semibold shadow-lg shadow-violet-900/40 hover:bg-violet-500"
          >
            Script &amp; Docs <ArrowRight className="ml-1 inline" size={14} />
          </button>
        </div>
      </Panel>
    </div>
  );
}

/* ──────────────────────────── Step 7 — Script ──────────────────────────── */

function Step7Script({ scripts, chapters, onContinue, onPrev, onDownloadScript }) {
  const [activeId, setActiveId] = React.useState(scripts[0]?.chapter_id || null);
  React.useEffect(() => {
    if (!activeId && scripts[0]) setActiveId(scripts[0].chapter_id);
  }, [activeId, scripts]);
  const active = scripts.find((s) => s.chapter_id === activeId) || scripts[0] || null;

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[65%_35%]">
      <Panel title={active ? `7. SCRIPT — Chapitre ${active.chapter_id}` : '7. SCRIPT & DOCUMENTS'}>
        <div className="mb-3 flex flex-wrap gap-2">
          {scripts.map((s) => (
            <button
              key={s.chapter_id}
              type="button"
              onClick={() => setActiveId(s.chapter_id)}
              className={`rounded-xl border px-3 py-1.5 text-[11px] transition ${
                activeId === s.chapter_id
                  ? 'border-violet-400/60 bg-violet-600/20 text-white'
                  : 'border-white/10 bg-white/5 text-white/65 hover:bg-white/10'
              }`}
            >
              Ch. {s.chapter_id}
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0A101D] p-5 leading-relaxed">
          {active ? (
            <>
              <h4 className="mb-4 text-base font-bold text-white">{active.title}</h4>
              <div className="space-y-3 text-sm text-white/75">
                {active.lines.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-white/45">Aucun script disponible.</p>
          )}
        </div>
      </Panel>

      <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
        <Panel title="Documents générés">
          {[
            { label: 'PDF Professeur', kind: 'professor' },
            { label: 'PDF Élève', kind: 'student' },
            { label: "Cahier d'exercices", kind: 'exercises' },
            { label: 'Notes SmartBoard', kind: 'smartboard' },
            { label: 'Script live (Markdown)', kind: 'script' },
          ].map((doc) => (
            <button
              key={doc.kind}
              type="button"
              onClick={() => onDownloadScript(doc.kind)}
              className="mb-2 flex w-full items-center justify-between rounded-xl border border-white/10 bg-[#0A101D] p-3 text-left text-xs text-white/75 hover:border-violet-400/60"
            >
              <span>{doc.label}</span>
              <Download size={14} className="text-violet-300" />
            </button>
          ))}
        </Panel>

        <Panel title="Chapitre courant">
          {active ? (
            <p className="text-xs text-white/65">
              {chapters.find((c) => c.chapter_id === active.chapter_id)?.knowledge_to_transmit || ''}
            </p>
          ) : null}
        </Panel>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onPrev}
            className="rounded-xl border border-white/10 bg-white/5 py-3 text-sm hover:bg-white/10"
          >
            <ArrowLeft className="mr-1 inline" size={14} /> Slides
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="rounded-xl bg-[#7C3AED] py-3 text-sm font-semibold shadow-lg shadow-violet-900/40 hover:bg-violet-500"
          >
            Export <ArrowRight className="ml-1 inline" size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────── Step 8 — Export ──────────────────────────── */

function Step8Export({ stats, project, onPrev, onReset, onDownloadJson, onDownloadMarkdown, onDownloadExport }) {
  const downloadable = project.exports?.downloadable || {};
  const exportDocs = [
    { label: 'Studio Live + SmartBoard', kind: 'smartboard-live', enabled: true },
    { label: 'PDF Professeur', kind: 'pdf-professor', enabled: Boolean(downloadable.pdf_professor) },
    { label: 'PDF Élève', kind: 'pdf-student', enabled: Boolean(downloadable.pdf_student) },
    { label: 'SmartBoard', kind: 'smartboard', enabled: Boolean(downloadable.smartboard) },
    { label: 'Markdown complet', kind: 'markdown', enabled: Boolean(downloadable.markdown) },
    { label: 'JSON moteur', kind: 'json', enabled: Boolean(downloadable.json) },
    { label: 'Liri Live', kind: 'live', enabled: Boolean(downloadable.liri_live) },
  ];

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[65%_35%]">
      <Panel title="8. EXPORT MULTI-FORMATS">
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <h3 className="text-base font-bold text-emerald-300">Masterclass générée avec succès !</h3>
          <p className="mt-1 text-xs text-white/65">
            Ton cours est prêt à être enseigné, projeté, partagé ou exporté.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
          {exportDocs.map((doc) => (
            <button
              key={doc.kind}
              type="button"
              disabled={!doc.enabled}
              onClick={() => {
                if (!doc.enabled) return;
                if (doc.kind === 'json') onDownloadJson();
                else if (doc.kind === 'markdown') onDownloadMarkdown();
                else onDownloadExport?.(doc.kind);
              }}
              className={`rounded-2xl border p-5 text-left transition ${
                doc.enabled
                  ? 'border-white/10 bg-[#0A101D] text-white/85 hover:border-violet-400'
                  : 'border-white/10 bg-white/[0.02] text-white/35'
              }`}
            >
              <Download className="mb-3 text-violet-300" />
              <p className="text-sm font-semibold">{doc.label}</p>
              <p className="mt-1 text-[11px] text-white/45">
                {doc.enabled ? 'Téléchargement immédiat' : 'Bientôt disponible'}
              </p>
            </button>
          ))}
        </div>

        {project.quality?.missing_requirements?.length ? (
          <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs">
            <p className="font-semibold text-amber-200">Points à renforcer (contrôle qualité) :</p>
            <ul className="mt-1 list-disc pl-5 text-amber-100/80">
              {project.quality.missing_requirements.slice(0, 8).map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </Panel>

      <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
        <Panel title="Résumé du projet">
          <div className="grid grid-cols-2 gap-2">
            <StatCard value={stats.chapters} label="chapitres" />
            <StatCard value={stats.minutes} label="minutes" />
            <StatCard value={stats.slides} label="slides" />
            <StatCard value={stats.exercises} label="exercices" />
            <StatCard value={stats.tests} label="tests" />
            <StatCard
              value={(project.analysis?.global_revelations || []).length}
              label="révélations"
            />
          </div>
        </Panel>

        <Panel title="Informations">
          <p className="text-[11px] text-white/55">
            <span className="text-violet-300">Sujet :</span> {project.analysis?.global_subject || '—'}
          </p>
          <p className="mt-2 text-[11px] text-white/55">
            <span className="text-violet-300">Public :</span> {project.analysis?.audience || 'mixed'}
          </p>
          <p className="mt-2 text-[11px] text-white/55">
            <span className="text-violet-300">Durée :</span> {project.analysis?.estimated_total_duration || '—'}
          </p>
        </Panel>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onPrev}
            className="rounded-xl border border-white/10 bg-white/5 py-3 text-sm hover:bg-white/10"
          >
            <ArrowLeft className="mr-1 inline" size={14} /> Script
          </button>
          <button
            type="button"
            onClick={onReset}
            className="rounded-xl bg-[#7C3AED] py-3 text-sm font-semibold shadow-lg shadow-violet-900/40 hover:bg-violet-500"
          >
            Nouveau projet <Plus className="ml-1 inline" size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────── Téléchargements ──────────────────────────── */

function downloadBlob(content, filename, type = 'text/plain;charset=utf-8') {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildMarkdown(project) {
  const a = project.analysis || {};
  const lines = [];
  lines.push(`# Masterclass — ${a.global_subject || 'Sans titre'}`);
  if (a.intention) lines.push(`\n_${a.intention}_`);
  lines.push(`\n**Public :** ${a.audience || a.target_audience || 'mixed'}  `);
  lines.push(`**Durée estimée :** ${a.estimated_total_duration || a.estimated_duration || '—'}  `);
  lines.push(`**Difficulté :** ${a.difficulty || '—'}\n`);

  if (a.global_revelations?.length) {
    lines.push('## Grandes révélations\n');
    a.global_revelations.forEach((r) => lines.push(`- ${r}`));
    lines.push('');
  }

  (project.chapters || []).forEach((ch) => {
    lines.push(`\n## Chapitre ${ch.chapter_id} — ${ch.title}`);
    if (ch.recommended_duration_minutes) lines.push(`*Durée : ${ch.recommended_duration_minutes} min*`);
    if (ch.objective) lines.push(`\n**Objectif :** ${ch.objective}`);
    if (ch.skill_to_acquire) lines.push(`**Compétence :** ${ch.skill_to_acquire}`);
    if (ch.knowledge_to_transmit) lines.push(`**Connaissance :** ${ch.knowledge_to_transmit}`);
    if (ch.real_life_situation) lines.push(`\n### Mise en situation\n${ch.real_life_situation}`);
    if (ch.pedagogical_tension) lines.push(`\n### Tension pédagogique\n${ch.pedagogical_tension}`);
    if (ch.thought_experiment) lines.push(`\n### Expérience de pensée\n${ch.thought_experiment}`);
    if (ch.revelation_moment || ch.main_revelation) {
      lines.push(`\n### Révélation\n${ch.revelation_moment || ch.main_revelation}`);
    }
    if (ch.simple_lesson) lines.push(`\n### Leçon simple\n${ch.simple_lesson}`);
    if (ch.deep_lesson) lines.push(`\n### Leçon développée\n${ch.deep_lesson}`);
    if (ch.analogies?.length) {
      lines.push('\n### Analogies');
      ch.analogies.forEach((x) => lines.push(`- *${x.type || 'analogie'}* : ${x.content}`));
    }
    if (ch.examples?.length) {
      lines.push('\n### Exemples');
      ch.examples.forEach((x) => lines.push(`- *${x.type || 'exemple'}* : ${x.content}`));
    }
    if (ch.reformulation) lines.push(`\n### Reformulation\n${ch.reformulation}`);
    if (ch.workshop?.instructions) {
      lines.push(`\n### Atelier\n${ch.workshop.instructions}`);
      if (ch.workshop.questions?.length) {
        lines.push('\n**Questions :**');
        ch.workshop.questions.forEach((q) => lines.push(`- ${q}`));
      }
    }
    if (ch.je_retiens?.length) {
      lines.push('\n### JE RETIENS');
      ch.je_retiens.forEach((j, i) => lines.push(`${i + 1}. ${j}`));
    }
    if (ch.understanding_test?.length) {
      lines.push('\n### Test de compréhension');
      ch.understanding_test.forEach((t, i) => {
        lines.push(`**Q${i + 1}.** ${t.question}`);
        lines.push(`> ${t.expected_answer}`);
      });
    }
    if (ch.real_application) lines.push(`\n### Cas réel\n${ch.real_application}`);
    if (ch.transition_to_next) lines.push(`\n### Transition\n${ch.transition_to_next}`);
  });

  return lines.join('\n');
}

function buildScriptMarkdown(scripts, chapters) {
  const lines = ['# Script professeur'];
  scripts.forEach((s) => {
    const ch = chapters.find((c) => c.chapter_id === s.chapter_id);
    lines.push(`\n## Chapitre ${s.chapter_id} — ${s.title}`);
    if (ch?.recommended_duration_minutes) lines.push(`*Durée : ${ch.recommended_duration_minutes} min*\n`);
    s.lines.forEach((l) => lines.push(l));
  });
  return lines.join('\n');
}

function buildSmartboardPack(project) {
  const chapters = project?.chapters || [];
  const slides = project?.slides || [];
  const lines = ['# SmartBoard Pack'];
  lines.push(`\nSlides: ${slides.length}`);
  lines.push(`Chapitres: ${chapters.length}\n`);
  slides.forEach((slide, index) => {
    lines.push(`## Slide ${index + 1} — ${slide.title || 'Sans titre'}`);
    if (slide.subtitle) lines.push(`_${slide.subtitle}_`);
    if (slide.body) lines.push(slide.body);
    if (Array.isArray(slide.bullets) && slide.bullets.length) {
      slide.bullets.forEach((bullet) => lines.push(`- ${bullet}`));
    }
    lines.push('');
  });
  return lines.join('\n');
}

/* ──────────────────────────── Page ──────────────────────────── */

export default function MasterclassFactoryPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const m = useMasterclassProject();
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

  const handleDownloadExport = (kind) => {
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
            chapters={m.project.chapters}
            onContinue={m.next}
            onPrev={m.prev}
            stats={factoryStats}
          />
        );
      case 4:
        return <Step5Pedagogy chapters={m.project.chapters} onContinue={m.next} onPrev={m.prev} />;
      case 5:
        return (
          <Step6Slides
            slides={m.project.slides}
            chapters={m.project.chapters}
            onContinue={m.next}
            onPrev={m.prev}
          />
        );
      case 6:
        return (
          <Step7Script
            scripts={m.project.scripts}
            chapters={m.project.chapters}
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
          />
        );
      default:
        return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.step, m.status, m.project, factoryStats, pipelineStage]);

  return (
    <main className="premium-dashboard-shell h-[100dvh] overflow-hidden bg-[#070B14] text-white">
      <div className="flex h-full min-h-0">
        <FactorySidebar />

        <section className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-2 sm:p-3">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(75%_55%_at_50%_0%,rgba(124,58,237,0.12),transparent_68%)]" />
          <FactoryHeader onReset={m.reset} isRealBrain={m.isRealBrain} />

          <FactoryProgress active={m.step} onJump={m.goToStep} status={m.status} />

          {m.error ? (
            <div className="mb-2 shrink-0 rounded-lg border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-200">
              {m.error}
            </div>
          ) : null}

          {m.status === 'running' && pipelineStage ? (
            <div className="mb-2 flex shrink-0 items-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2 py-1.5 text-[10px] text-violet-200">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-violet-300 border-t-transparent" />
              Pipeline LIRI · <strong>{pipelineStage}</strong>
            </div>
          ) : null}

          <OrchestratorLiveStrip
            orchestratorStatus={m.orchestratorStatus}
            queues={m.orchestratorQueues}
            chapterStatuses={m.orchestratorChapterStatuses}
          />

          <div className="premium-panel relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0A101D]/45 p-2 sm:p-2.5">
            {screen}
          </div>
        </section>
      </div>
    </main>
  );
}
