/**
 * StudioDesignerLikeShell — coque visuelle alignée sur StudioSmartboardKonvaPage
 * (top bar h-11, rail icônes w-12, fond grille, footer optionnel).
 */
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home, Compass, GraduationCap, Brain, LayoutGrid, Radio, Route, Library, Download, Monitor, Languages,
  ChevronRight, FileOutput, Bell, LogOut, HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LiriWordmark } from '@/components/brand/LiriWordmark';

const ACCENT = {
  teal: { text: 'text-teal-400', bg: 'bg-teal-500/15', border: 'border-teal-500/30', glow: 'shadow-[0_0_14px_rgba(45,212,191,0.3)]' },
  cyan: { text: 'text-cyan-400', bg: 'bg-cyan-500/15', border: 'border-cyan-500/30', glow: 'shadow-[0_0_14px_rgba(34,211,238,0.3)]' },
  violet: { text: 'text-violet-400', bg: 'bg-violet-500/15', border: 'border-violet-500/30', glow: 'shadow-[0_0_14px_rgba(167,139,250,0.3)]' },
  blue: { text: 'text-blue-400', bg: 'bg-blue-500/15', border: 'border-blue-500/30', glow: 'shadow-[0_0_14px_rgba(96,165,250,0.25)]' },
  amber: { text: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30', glow: 'shadow-[0_0_14px_rgba(251,191,36,0.25)]' },
  emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', glow: 'shadow-[0_0_14px_rgba(52,211,153,0.25)]' },
};

const RAIL = [
  { path: '/studio/liri', icon: Home, title: 'Hub LIRI', key: 'hub' },
  { path: '/studio/liri/constructeurs', icon: Compass, title: 'Constructeurs', key: 'constructeurs', accent: 'violet' },
  { path: '/studio/liri/formation', icon: GraduationCap, title: 'Formation', key: 'formation' },
  { path: '/studio/liri/cours', icon: Brain, title: 'Cours', key: 'cours' },
  { path: '/studio/liri/pedagogie-futur', icon: Route, title: 'Pédagogie du futur', key: 'pedagogie', accent: 'teal' },
  { path: '/studio/liri/multilang', icon: Languages, title: 'Multilingue', key: 'multilang', accent: 'emerald' },
  { path: '/studio/smartboard-designer', icon: LayoutGrid, title: 'SmartBoard Designer', key: 'designer' },
  { path: '/studio/live', icon: Radio, title: 'Live', key: 'live' },
  { path: '/studio/liri/embedded-control', icon: Monitor, title: 'Contrôle intégré', key: 'embedded', accent: 'cyan' },
  { path: '/studio/liri/bibliotheque', icon: Library, title: 'Bibliothèque', key: 'bib' },
  { path: '/studio/liri/import', icon: Download, title: 'Import', key: 'import' },
];

const GRID_BG = {
  background: '#0a0b0f',
  backgroundImage:
    'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),'
    + 'linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
  backgroundSize: '44px 44px',
};

function DesignerLikeLeftRail({ activeKey }) {
  const { pathname } = useLocation();
  return (
    <aside
      className="flex w-12 flex-shrink-0 flex-col gap-0.5 border-r border-white/[0.07] px-1.5 py-3"
      style={{ background: '#12111a' }}
      aria-label="Navigation LIRI"
    >
      {RAIL.map((item) => {
        const Icon = item.icon;
        const byPath =
          item.key === 'hub'
            ? pathname === '/studio/liri' || pathname === '/studio/liri/'
            : pathname === item.path || pathname.startsWith(`${item.path}/`);
        const byKey = activeKey && item.key === activeKey;
        const active = byPath || byKey;
        const a = item.accent && ACCENT[item.accent] ? ACCENT[item.accent] : null;
        return (
          <Link
            key={item.key}
            to={item.path}
            title={item.title}
            className={cn(
              'group flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-150',
              active && a
                ? [a.bg, 'border', a.border, a.glow]
                : active
                  ? 'border border-white/15 bg-white/[0.08] text-white/80'
                  : 'border border-transparent text-white/30 hover:bg-white/[0.06] hover:text-white/60',
            )}
          >
            <Icon className={cn('h-4 w-4 transition-colors', active && a ? a.text : '')} />
          </Link>
        );
      })}
    </aside>
  );
}

function DefaultFooter() {
  return (
    <footer
      className="flex h-14 flex-shrink-0 items-center gap-3 border-t border-white/[0.07] px-3"
      style={{ background: '#12111a' }}
    >
      <p className="flex min-w-0 flex-wrap items-center gap-1.5 truncate text-[11px] text-white/35">
        <span className="inline-flex shrink-0 items-end gap-1 text-white/50">
          <LiriWordmark size="kicker" className="text-white/50" subtleGlow />
          <span>Studio</span>
        </span>
        <span className="truncate">· Designer, Formation, Cours et Live dans une même coque.</span>
      </p>
    </footer>
  );
}

/**
 * @param {object} props
 * @param {string} props.railActiveKey — ex. formation | cours | import | pedagogie
 * @param {string} props.pageLabel — segment courant du fil d’Ariane (gras, couleur)
 * @param {'teal'|'blue'|'amber'|'emerald'|'cyan'|'violet'} [props.pageAccent='teal']
 * @param {React.ComponentType<{ className?: string }>} [props.TitleIcon]
 * @param {string} [props.titleLine] — sous-titre à droite du fil (ex. « Formation Builder »)
 * @param {React.ReactNode} [props.topBarCenter]
 * @param {React.ReactNode} [props.topBarActions] — boutons avant Live / Exporter
 * @param {React.ReactNode} props.children
 * @param {React.ReactNode | null | false} [props.footer] — `null`/`false` masque ; défaut = bandeau court
 * @param {{ label: string, href?: string }[]} [props.breadcrumbMiddle] — segments entre « Écosystème » et `pageLabel`
 */
export default function StudioDesignerLikeShell({
  railActiveKey,
  pageLabel,
  pageAccent = 'teal',
  TitleIcon,
  titleLine,
  breadcrumbMiddle,
  topBarCenter,
  topBarActions,
  children,
  footer,
}) {
  const accentText = ACCENT[pageAccent]?.text ?? ACCENT.teal.text;
  const accentBox = ACCENT[pageAccent] ?? ACCENT.teal;

  const showFooter = footer !== null && footer !== false;
  const footerNode = footer === undefined ? <DefaultFooter /> : footer;

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden" style={{ background: '#0F1117' }}>
      <header
        className="flex h-11 flex-shrink-0 items-center gap-2 border-b border-white/[0.07] px-3"
        style={{ background: 'rgba(15,17,23,0.98)', backdropFilter: 'blur(20px)' }}
      >
        <Link to="/studio/liri" className="flex shrink-0 select-none items-center" aria-label="LIRI">
          <LiriWordmark size="compact" className="text-white/75" />
        </Link>
        <span className="h-4 w-px shrink-0 bg-white/10" />
        <nav className="flex min-w-0 shrink items-center gap-1 overflow-x-auto text-[11px] text-white/35">
          <Link to="/studio/liri" className="shrink-0 transition-colors hover:text-white/60">Écosystème</Link>
          <ChevronRight className="h-3 w-3 shrink-0 text-white/20" />
          {(breadcrumbMiddle || []).map((c, i) => (
            <React.Fragment key={`${c.label}-${i}`}>
              {c.href ? (
                <Link to={c.href} className="shrink-0 transition-colors hover:text-white/65">
                  {c.label}
                </Link>
              ) : (
                <span className="shrink-0 text-white/40">{c.label}</span>
              )}
              <ChevronRight className="h-3 w-3 shrink-0 text-white/20" />
            </React.Fragment>
          ))}
          <span className={cn('shrink-0 font-medium truncate max-w-[140px] sm:max-w-[220px]', accentText)}>{pageLabel}</span>
        </nav>

        {(TitleIcon || titleLine) && (
          <>
            <div className="ml-2 flex shrink-0 items-center gap-2">
              {TitleIcon ? (
                <div className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border', accentBox.bg, accentBox.border)}>
                  <TitleIcon className={cn('h-3 w-3', accentBox.text)} />
                </div>
              ) : null}
              {titleLine ? (
                <span className="hidden text-[12px] font-semibold text-white/70 lg:block">{titleLine}</span>
              ) : null}
            </div>
          </>
        )}

        {topBarCenter ? (
          <>
            <span className="mx-1 h-4 w-px shrink-0 bg-white/10" />
            <div className="hidden min-w-0 shrink md:block">{topBarCenter}</div>
          </>
        ) : null}

        <div className="flex-1" />

        {topBarActions ? <div className="flex shrink-0 items-center gap-2">{topBarActions}</div> : null}

        <Link
          to="/studio/smartboard-aide"
          title="Aide"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/35 transition-all hover:bg-white/8 hover:text-white/70"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </Link>

        <span className="h-4 w-px shrink-0 bg-white/10" />

        <Link
          to="/studio/live"
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-1.5 text-[11px] font-semibold text-red-400 transition-all hover:bg-red-500/20"
        >
          <Radio className="h-3 w-3" />
          <span className="hidden sm:inline">Live</span>
        </Link>

        <Link
          to="/studio/export-center"
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-medium text-white/40 transition-all hover:border-white/20 hover:text-white/70"
        >
          <FileOutput className="h-3 w-3" />
          <span className="hidden sm:inline">Exporter</span>
        </Link>

        <Bell className="h-4 w-4 shrink-0 cursor-pointer text-white/25 transition-colors hover:text-white/50" />

        <Link
          to="/studio"
          title="Studio"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/35 transition-all hover:bg-white/8 hover:text-white/60"
        >
          <LogOut className="h-3.5 w-3.5" />
        </Link>
      </header>

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <DesignerLikeLeftRail activeKey={railActiveKey} />

        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" style={GRID_BG}>
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">{children}</div>
        </div>
      </div>

      {showFooter ? footerNode : null}
    </div>
  );
}
