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
import { useTenantBranding } from '@/hooks/useTenantBranding';
// Règles « grille visible » scopées sous [data-school-shell="studio-designer"]
// (transparentisation des fonds opaques Cours/Biblio/Import/Contrôle intégré).
import '@/styles/formation-studio.css';

// Accents = nuances CHAUDES uniquement (directive LIRI : zéro froid). Les clés
// (teal/cyan/violet/blue/amber/emerald) sont CONSERVÉES comme identifiants mais
// pointent toutes sur des teintes coral/terracotta/ambre, pour différencier les
// studios sans casser les nombreux appels `pageAccent="violet"` etc.
const ACCENT = {
  teal: { text: 'text-[#d8916a]', bg: 'bg-[#d8916a]/15', border: 'border-[#d8916a]/30', glow: 'shadow-[0_0_14px_rgba(216,145,106,0.30)]' },
  cyan: { text: 'text-[#e3aa6b]', bg: 'bg-[#e3aa6b]/15', border: 'border-[#e3aa6b]/30', glow: 'shadow-[0_0_14px_rgba(227,170,107,0.30)]' },
  violet: { text: 'text-[#d97757]', bg: 'bg-[#d97757]/15', border: 'border-[#d97757]/30', glow: 'shadow-[0_0_14px_rgba(217,119,87,0.32)]' },
  blue: { text: 'text-[#cf7a52]', bg: 'bg-[#cf7a52]/15', border: 'border-[#cf7a52]/30', glow: 'shadow-[0_0_14px_rgba(207,122,82,0.26)]' },
  amber: { text: 'text-[#d99a4e]', bg: 'bg-[#d99a4e]/15', border: 'border-[#d99a4e]/30', glow: 'shadow-[0_0_14px_rgba(217,154,78,0.26)]' },
  emerald: { text: 'text-[#cf8059]', bg: 'bg-[#cf8059]/15', border: 'border-[#cf8059]/30', glow: 'shadow-[0_0_14px_rgba(207,128,89,0.26)]' },
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

// Fond = celui du shell portail LIRI (--base #262624), grille ultra-discrète chaude →
// le Studio « respecte le shell » au lieu d'être une boîte noire séparée.
const GRID_BG = {
  background: '#262624',
  backgroundImage:
    'linear-gradient(rgba(245,244,238,0.022) 1px, transparent 1px),'
    + 'linear-gradient(90deg, rgba(245,244,238,0.022) 1px, transparent 1px)',
  backgroundSize: '44px 44px',
};

function DesignerLikeLeftRail({ activeKey }) {
  const { pathname } = useLocation();
  return (
    <aside
      className="flex w-12 flex-shrink-0 flex-col gap-0.5 border-r border-white/[0.07] px-1.5 py-3"
      style={{ background: 'transparent' }}
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
      style={{ background: '#1f1e1c' }}
    >
      <p className="flex min-w-0 flex-wrap items-center gap-1.5 truncate text-[11px] text-white/35">
        <span className="inline-flex shrink-0 items-end gap-1 text-white/50">
          <LiriWordmark size="kicker" className="text-white/50" bulbColor="#cf8059" subtleGlow />
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
 * @param {string} props.pageLabel — segment courant du fil d'Ariane (gras, couleur)
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
  /** Studio DÉDIÉ (ex. Live pour MEDOS) : masque la rail d'icônes écosystème. */
  hideRail = false,
  /** Masque les liens/boutons écosystème (breadcrumb « Écosystème », Aide, Live,
   *  Exporter, Notif, Déconnexion) → cadre épuré, hors-navigation Formation. */
  hideEcosystemActions = false,
}) {
  const { branding, cssVars } = useTenantBranding();
  const accentText = ACCENT[pageAccent]?.text ?? ACCENT.teal.text;
  const accentBox = ACCENT[pageAccent] ?? ACCENT.teal;

  const showFooter = footer !== null && footer !== false;
  const footerNode = footer === undefined ? <DefaultFooter /> : footer;

  return (
    <div
      className="flex h-[100dvh] flex-col overflow-hidden"
      style={{
        background: '#262624',
        fontFamily: 'var(--school-font-family, Inter, system-ui, sans-serif)',
        ...cssVars,
      }}
      data-school-shell="studio-designer"
      data-tenant-brand={branding.name}
    >
      <header
        className="flex h-11 flex-shrink-0 items-center gap-2 border-b border-white/[0.07] px-3"
        style={{ background: '#1f1e1c', backdropFilter: 'blur(20px)' }}
      >
        {/* Identité = LIRI Studio (studio de production embarqué dans LIRI) : vrai logo LIRI
            + « Studio », aligné sur la topbar du portail. Plus de badge tenant violet. */}
        <Link to="/liri" className="flex shrink-0 select-none items-center gap-2" aria-label="Retour à l'accueil LIRI (sortir du Studio)">
          <img src="/lirilogo.png" alt="LIRI" className="h-7 w-7 object-contain" />
          <span className="text-[15px] font-semibold tracking-tight text-white/90">LIRI</span>
          <span className="hidden text-[13px] font-medium text-white/45 sm:inline">Studio</span>
        </Link>
        {!hideEcosystemActions && (
          <>
            <span className="hidden h-4 w-px shrink-0 bg-white/10 md:block" />
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
          </>
        )}

        {(TitleIcon || titleLine) && (
          <>
            <div className="ml-2 flex shrink-0 items-center gap-2">
              {TitleIcon ? (
                <div className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border', accentBox.bg, accentBox.border)} style={{ borderRadius: 'var(--school-radius, 12px)' }}>
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

        {!hideEcosystemActions && (
          <>
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
              style={{ borderRadius: 'var(--school-radius, 12px)' }}
            >
              <Radio className="h-3 w-3" />
              <span className="hidden sm:inline">Live</span>
            </Link>

            <Link
              to="/studio/export-center"
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-medium text-white/40 transition-all hover:border-white/20 hover:text-white/70"
              style={{ borderRadius: 'var(--school-radius, 12px)' }}
            >
              <FileOutput className="h-3 w-3" />
              <span className="hidden sm:inline">Exporter</span>
            </Link>

            <Bell className="h-4 w-4 shrink-0 cursor-pointer text-white/25 transition-colors hover:text-white/50" />

            <Link
              to="/liri"
              title="Sortir du Studio — retour à l'accueil LIRI"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/35 transition-all hover:bg-white/8 hover:text-white/60"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Link>
          </>
        )}
      </header>

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {!hideRail && (
          <div style={{ background: '#1f1e1c' }}>
            <DesignerLikeLeftRail activeKey={railActiveKey} />
          </div>
        )}

        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" style={GRID_BG}>
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">{children}</div>
        </div>
      </div>

      {showFooter ? footerNode : null}
    </div>
  );
}
