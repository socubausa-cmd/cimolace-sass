/**
 * StudioDesignerLikeShell — coque du Studio LIRI.
 *
 * ── D'où l'on part ──────────────────────────────────────────────────────────
 * C'était un panneau de contrôle rétréci : barre de 44 px, rail de 48 px,
 * typographie Inter figée à 11-13 px, fond plat, pied de page de 56 px occupé
 * par une tagline, et plusieurs textes sous le seuil WCAG (`text-white/35` ≈
 * 2,9:1). Sur un 27 pouces, la chrome tenait autant de place que sur un 13
 * pouces et le contenu, lui, ne gagnait rien.
 *
 * ── Où l'on va ──────────────────────────────────────────────────────────────
 * Même parti pris que l'ImmersiveVideoPlayer (school/formations) : une
 * atmosphère en trois couches (halo coral respirant, lavis d'or, vignette),
 * une typographie éditoriale qui grandit avec l'écran (`clamp`), et une chrome
 * qui s'efface — barres translucides posées SUR l'ambiance au lieu de bandeaux
 * opaques qui la découpent. Le contenu, lui, GAGNE de la place : le pied de
 * page passe de 56 à 34 px et disparaît là où il fait doublon.
 *
 * ── Cohabitation avec la coque du portail LIRI ──────────────────────────────
 * Le Studio est désormais monté à l'intérieur de `<LiriPortalShell>`. Deux
 * conséquences traitées ici, EN CSS et sans détection JS (donc sans risque de
 * désynchronisation) :
 *
 *   1. HAUTEUR. `h-[100dvh]` dans un `<main>` déjà borné par la topbar donnait
 *      100dvh DANS 100dvh moins la topbar → un ascenseur parasite sur les 12
 *      pages. Sous `.lp-shell-main`, la coque bascule en `absolute; inset:0` :
 *      ce main est `position:relative` ET porte `transform:translateZ(0)`
 *      (LiriPortal.css), il est donc le bloc conteneur — la coque se confine
 *      d'elle-même. Hors portail, `100dvh` s'applique : le comportement
 *      autonome d'aujourd'hui est préservé à l'identique.
 *
 *   2. DOUBLONS. Le portail fournit déjà logo, notifications, réglages et
 *      pied de page. Les répéter ici, c'est deux fois la même barre. Les
 *      éléments concernés portent `.sdls-solo` : visibles seuls, masqués sous
 *      `.lp-shell-main`. Le fil d'Ariane, le titre et les actions de page —
 *      qui, eux, n'existent nulle part ailleurs — restent toujours affichés.
 *
 * Le sélecteur `.lp-shell-main` est déjà un point d'ancrage public de
 * LiriPortal.css (il porte une douzaine de re-thèmes) : on s'y accroche en
 * lecture seule, aucun fichier hors périmètre n'est modifié.
 *
 * ── Contrastes (WCAG, mesurés sur les fonds réels) ──────────────────────────
 *   encre .92 sur #262624 → 11,9:1   ·  fil d'Ariane .62 → 6,2:1
 *   libellés .62 sur #1f1e1c → 6,6:1 ·  icônes rail inactives .52 → ~5,0:1
 *   pageLabel coral #d97757 → 4,9:1  ·  « Live » #ef6a52 → 5,0:1
 * Les anciens `text-white/25` à `/45` (2,2:1 à 4,1:1) ont tous été relevés.
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
// (teal/cyan/violet/blue/amber/emerald) sont CONSERVÉES comme identifiants —
// 12 pages passent `pageAccent="violet"` etc. — mais elles pointent toutes sur
// des teintes coral/terre/ambre. Les alias chauds en fin de table sont là pour
// que les NOUVEAUX appels puissent cesser d'employer un nom de couleur froide ;
// les anciens seront renommés page par page (liste dans le rapport).
// Toutes ces valeurs tiennent ≥ 4,7:1 sur #262624 et ≥ 5,2:1 sur #1f1e1c.
const ACCENT = {
  teal: { text: 'text-[#d8916a]', bg: 'bg-[#d8916a]/15', border: 'border-[#d8916a]/30', ring: 'rgba(216,145,106,0.22)' },
  cyan: { text: 'text-[#e3aa6b]', bg: 'bg-[#e3aa6b]/15', border: 'border-[#e3aa6b]/30', ring: 'rgba(227,170,107,0.22)' },
  violet: { text: 'text-[#d97757]', bg: 'bg-[#d97757]/15', border: 'border-[#d97757]/30', ring: 'rgba(217,119,87,0.24)' },
  blue: { text: 'text-[#cf7a52]', bg: 'bg-[#cf7a52]/15', border: 'border-[#cf7a52]/30', ring: 'rgba(207,122,82,0.20)' },
  amber: { text: 'text-[#d99a4e]', bg: 'bg-[#d99a4e]/15', border: 'border-[#d99a4e]/30', ring: 'rgba(217,154,78,0.20)' },
  emerald: { text: 'text-[#cf8059]', bg: 'bg-[#cf8059]/15', border: 'border-[#cf8059]/30', ring: 'rgba(207,128,89,0.20)' },
};
// Alias chauds → même objet, pas de duplication de valeur.
ACCENT.coral = ACCENT.violet;
ACCENT.terre = ACCENT.teal;
ACCENT.or = ACCENT.cyan;
ACCENT.ambre = ACCENT.amber;
ACCENT.brique = ACCENT.blue;
ACCENT.argile = ACCENT.emerald;

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

/**
 * Feuille de style de la coque. Tout est préfixé `.sdls-` et rien n'est écrit
 * en dehors de ce périmètre : `studioWarm.css` (partagé avec TOUT /liri via
 * LiriPortalShell) et `LiriPortal.css` restent intacts.
 */
const SDLS_CSS = `
/* ── Enveloppe ─────────────────────────────────────────────────────────────
   Autonome : plein viewport. Dans le portail : confinée au <main>. */
.sdls-root {
  height: 100dvh;
  --sdls-rail: 52px;
  --sdls-bar: 46px;
  --sdls-pad: clamp(12px, 1.1vw, 26px);
  --sdls-grid: 44px;
}
.lp-shell-main .sdls-root { position: absolute; inset: 0; height: auto; }
/* Le portail fournit déjà identité, cloche, sortie et pied de page. */
.lp-shell-main .sdls-solo { display: none !important; }

/* ── Respiration au-delà du grand écran ───────────────────────────────────
   Au-delà de 1600 px la chrome ne grossit qu'à peine (rail +8 px) alors que
   les marges internes et la grille, elles, s'ouvrent : le contenu gagne du
   champ visuel au lieu d'être compressé par une barre plus haute. */
@media (min-width: 1600px) {
  .sdls-root { --sdls-rail: 60px; --sdls-bar: 54px; --sdls-grid: 60px; }
}
@media (min-width: 2200px) {
  .sdls-root { --sdls-grid: 76px; }
}
/* Écran bas (portable 13" en 16:10, fenêtre réduite) : le bandeau de pied
   n'est que décoratif, on rend ses 34 px au contenu. */
@media (max-height: 720px) { .sdls-foot { display: none !important; } }

.sdls-bar { min-height: var(--sdls-bar); padding-inline: var(--sdls-pad); }
.sdls-rail { width: var(--sdls-rail); }
.sdls-railbtn { width: calc(var(--sdls-rail) - 14px); height: calc(var(--sdls-rail) - 14px); }

/* ── Atmosphère ───────────────────────────────────────────────────────────
   Trois couches purement décoratives.

   Elles sont en z-index:-1 et la racine porte isolation:isolate — la racine
   étant un contexte d'empilement, le z-index négatif y est borné : il peint
   AU-DESSUS du fond de la coque et EN DESSOUS du contenu. On évite ainsi de
   remonter header/rail/contenu en "position:relative; z-index:1", ce qui
   aurait fait de la ligne du milieu un nouveau bloc conteneur et ré-ancré, en
   silence, tout "position:absolute" des 12 pages qui héritent de cette coque.
   Ici, leur positionnement reste exactement celui d'avant.
   (Aucune apostrophe inverse ici : cette feuille vit dans un littéral gabarit,
   une seule suffirait à le refermer en plein milieu.)

   Le contenu n'est JAMAIS conditionné à une transition : sans animation, sans
   JS, la page reste intégralement lisible — seule l'ambiance est immobile. */
.sdls-atmo { position: absolute; inset: 0; z-index: -1; pointer-events: none; overflow: hidden; }
.sdls-atmo-halo {
  position: absolute; top: -18%; left: 50%; transform: translateX(-50%);
  width: min(1180px, 92%); height: 52%;
  border-radius: 50%; filter: blur(10px);
  background: radial-gradient(closest-side, rgba(217,119,87,0.18), rgba(217,119,87,0) 72%);
  animation: sdlsBreathe 11s ease-in-out infinite;
}
.sdls-atmo-gold {
  position: absolute; inset: 0;
  background: radial-gradient(880px 540px at 106% 116%, rgba(230,204,146,0.075), transparent 60%);
}
.sdls-atmo-vignette { position: absolute; inset: 0; box-shadow: inset 0 0 230px 62px rgba(0,0,0,0.40); }
@keyframes sdlsBreathe {
  0%, 100% { opacity: .55; transform: translateX(-50%) scale(1); }
  50%      { opacity: .92; transform: translateX(-50%) scale(1.055); }
}

/* ── Mouvement ────────────────────────────────────────────────────────────
   Le halo est figé à mi-course plutôt que supprimé : l'ambiance reste, le
   mouvement part. Les transitions d'interaction tombent aussi. */
@media (prefers-reduced-motion: reduce) {
  .sdls-atmo-halo { animation: none; opacity: .74; }
  .sdls-railbtn, .sdls-act { transition: none !important; }
}

/* ── Interactions ─────────────────────────────────────────────────────────
   Pas de bordure latérale colorée épaisse : l'état actif se dit par un fond
   teinté, un filet de 1 px et un anneau diffus très bas. */
.sdls-railbtn { transition: background .16s ease, border-color .16s ease, color .16s ease; }
.sdls-act { transition: background .16s ease, border-color .16s ease, color .16s ease; }

/* Ascenseur chaud, aligné sur celui du lecteur immersif. */
.sdls-scroll::-webkit-scrollbar { width: 9px; height: 9px; }
.sdls-scroll::-webkit-scrollbar-track { background: transparent; }
.sdls-scroll::-webkit-scrollbar-thumb { background: rgba(217,119,87,0.26); border-radius: 8px; }
.sdls-scroll::-webkit-scrollbar-thumb:hover { background: rgba(217,119,87,0.42); }
.sdls-scroll { scrollbar-width: thin; scrollbar-color: rgba(217,119,87,0.30) transparent; }
`;

// Grille de plan de travail : chaude, quasi subliminale, et dont le pas suit
// `--sdls-grid` (44 → 60 → 76 px). Sur un très grand écran, une trame figée à
// 44 px devient un moiré ; en s'ouvrant, elle reste une texture.
const GRID_BG = {
  backgroundImage:
    'linear-gradient(rgba(245,244,238,0.020) 1px, transparent 1px),'
    + 'linear-gradient(90deg, rgba(245,244,238,0.020) 1px, transparent 1px)',
  backgroundSize: 'var(--sdls-grid) var(--sdls-grid)',
};

function DesignerLikeLeftRail({ activeKey }) {
  const { pathname } = useLocation();
  return (
    <aside
      className="sdls-rail flex flex-shrink-0 flex-col items-center gap-1 border-r py-3"
      style={{ background: 'transparent', borderColor: 'rgba(245,244,238,.09)' }}
      aria-label="Navigation du Studio"
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
            aria-label={item.title}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'sdls-railbtn group grid place-items-center rounded-2xl border',
              active && a
                ? [a.bg, a.border]
                : active
                  ? 'border-[rgba(217,119,87,.32)] bg-[rgba(217,119,87,.14)]'
                  : 'border-transparent hover:border-[rgba(245,244,238,.10)] hover:bg-[rgba(245,244,238,.06)]',
            )}
            // Anneau diffus très bas : suggère la profondeur sans devenir un néon.
            style={active ? { boxShadow: `0 0 0 1px ${(a || ACCENT.violet).ring}, 0 6px 20px -10px ${(a || ACCENT.violet).ring}` } : undefined}
          >
            <Icon
              className={cn('h-[18px] w-[18px]', active && a ? a.text : '')}
              // Icône inactive à .52 (≈5,0:1) : c'est le seul repère de navigation
              // du rail, il ne doit pas être un fantôme à 2,5:1 comme avant.
              style={active && !a ? { color: '#d97757' } : (!active ? { color: 'rgba(245,244,238,.52)' } : undefined)}
            />
          </Link>
        );
      })}
    </aside>
  );
}

function DefaultFooter() {
  return (
    <footer
      className="sdls-foot sdls-solo flex h-[34px] flex-shrink-0 items-center border-t"
      style={{ paddingInline: 'var(--sdls-pad)', borderColor: 'rgba(245,244,238,.09)', background: 'rgba(31,30,28,.72)' }}
    >
      {/* .62 et non /35 : une mention qu'on ne peut pas lire ne dit rien. */}
      <p className="flex min-w-0 items-center gap-1.5 truncate text-[11.5px]" style={{ color: 'rgba(245,244,238,.62)' }}>
        <span className="inline-flex shrink-0 items-end gap-1">
          <LiriWordmark size="kicker" bulbColor="#d97757" subtleGlow />
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
 * @param {'teal'|'blue'|'amber'|'emerald'|'cyan'|'violet'|'coral'|'terre'|'or'|'ambre'|'brique'|'argile'} [props.pageAccent='teal']
 * @param {React.ComponentType<{ className?: string }>} [props.TitleIcon]
 * @param {string} [props.titleLine] — titre de page (serif, fluide)
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
  const accentBox = ACCENT[pageAccent] ?? ACCENT.teal;
  const accentText = accentBox.text;

  const showFooter = footer !== null && footer !== false;
  const footerNode = footer === undefined ? <DefaultFooter /> : footer;

  return (
    <div
      className="sdls-root relative flex flex-col overflow-hidden"
      style={{
        background: '#262624',
        color: '#f5f4ee',
        fontFamily: 'var(--school-font-family, Inter, system-ui, sans-serif)',
        // Borne les couches d'ambiance (z-index:-1) DANS la coque : sans ce
        // contexte d'empilement, elles passeraient derrière le fond #262624 et
        // seraient purement et simplement invisibles.
        isolation: 'isolate',
        ...cssVars,
      }}
      data-school-shell="studio-designer"
      data-tenant-brand={branding.name}
    >
      <style>{SDLS_CSS}</style>

      {/* Atmosphère — décorative, sous tout le reste, jamais interactive. */}
      <div aria-hidden className="sdls-atmo">
        <div className="sdls-atmo-halo" />
        <div className="sdls-atmo-gold" />
        <div className="sdls-atmo-vignette" />
      </div>

      {/* ── Barre haute ────────────────────────────────────────────────────
          Translucide et SANS flou décoratif : rien ne défile en dessous (c'est
          une ligne de flex, pas un survol), le flou ne servait donc qu'à faire
          « verre ». La transparence, elle, laisse passer le halo. */}
      <header
        className="sdls-bar flex flex-shrink-0 items-center gap-2 border-b"
        style={{ background: 'rgba(31,30,28,.72)', borderColor: 'rgba(245,244,238,.09)' }}
      >
        {/* Identité — masquée dans le portail : sa topbar la porte déjà. */}
        <Link
          to="/liri"
          className="sdls-solo flex shrink-0 select-none items-center gap-2"
          aria-label="Retour à l'accueil LIRI (sortir du Studio)"
        >
          <img src="/lirilogo.png" alt="" className="h-7 w-7 object-contain" />
          <span className="font-semibold tracking-tight" style={{ fontSize: 'clamp(15px,.95vw,18px)', color: 'rgba(245,244,238,.92)' }}>LIRI</span>
          <span className="hidden font-medium sm:inline" style={{ fontSize: 'clamp(12.5px,.8vw,15px)', color: 'rgba(245,244,238,.62)' }}>Studio</span>
        </Link>

        {!hideEcosystemActions && (
          <>
            <span className="sdls-solo hidden h-4 w-px shrink-0 md:block" style={{ background: 'rgba(245,244,238,.12)' }} />
            {/* Fil d'Ariane à .62 (6,2:1). Il était à /35 ≈ 2,9:1 : le seul
                indicateur de « où suis-je » du Studio était illisible. */}
            <nav className="flex min-w-0 shrink items-center gap-1.5 overflow-x-auto text-[12px]" style={{ color: 'rgba(245,244,238,.62)' }} aria-label="Fil d'Ariane">
              <Link to="/studio/liri" className="sdls-act shrink-0 rounded hover:text-[#f5f4ee]">Écosystème</Link>
              <ChevronRight className="h-3 w-3 shrink-0" style={{ color: 'rgba(245,244,238,.34)' }} aria-hidden />
              {(breadcrumbMiddle || []).map((c, i) => (
                <React.Fragment key={`${c.label}-${i}`}>
                  {c.href ? (
                    <Link to={c.href} className="sdls-act shrink-0 rounded hover:text-[#f5f4ee]">{c.label}</Link>
                  ) : (
                    <span className="shrink-0">{c.label}</span>
                  )}
                  <ChevronRight className="h-3 w-3 shrink-0" style={{ color: 'rgba(245,244,238,.34)' }} aria-hidden />
                </React.Fragment>
              ))}
              <span className={cn('max-w-[150px] shrink-0 truncate font-semibold sm:max-w-[240px]', accentText)} aria-current="page">{pageLabel}</span>
            </nav>
          </>
        )}

        {(TitleIcon || titleLine) && (
          <div className="ml-1 flex min-w-0 shrink items-center gap-2.5">
            {TitleIcon ? (
              <span
                className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-xl border', accentBox.bg, accentBox.border)}
                style={{ borderRadius: 'var(--school-radius, 12px)' }}
              >
                <TitleIcon className={cn('h-3.5 w-3.5', accentBox.text)} aria-hidden />
              </span>
            ) : null}
            {/* Titre de page en serif éditoriale, fluide : 14 px sur un 13
                pouces, 20 px sur un 27 pouces. C'est le seul endroit où la
                coque hausse la voix — le reste de la chrome s'efface. */}
            {titleLine ? (
              <h1
                className="hidden min-w-0 truncate lg:block"
                style={{
                  margin: 0,
                  fontFamily: "'Fraunces','Source Serif 4',Georgia,serif",
                  fontSize: 'clamp(14px, 1.05vw, 20px)',
                  fontWeight: 600,
                  lineHeight: 1.15,
                  letterSpacing: '-.005em',
                  color: 'rgba(245,244,238,.92)',
                }}
              >
                {titleLine}
              </h1>
            ) : null}
          </div>
        )}

        {topBarCenter ? (
          <>
            <span className="mx-1 h-4 w-px shrink-0" style={{ background: 'rgba(245,244,238,.12)' }} />
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
              aria-label="Aide du Studio"
              className="sdls-act grid h-8 w-8 shrink-0 place-items-center rounded-lg hover:bg-[rgba(245,244,238,.07)]"
              style={{ color: 'rgba(245,244,238,.62)' }}
            >
              <HelpCircle className="h-4 w-4" aria-hidden />
            </Link>

            <span className="h-4 w-px shrink-0" style={{ background: 'rgba(245,244,238,.12)' }} />

            {/* « Live » : teintes du portail (#e2553f pastille / #ef6a52 texte
                à 5,0:1) plutôt que le rouge Tailwind red-400, étranger à la
                charte et sous le seuil sur ce fond. */}
            <Link
              to="/studio/live"
              className="sdls-act flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-semibold hover:bg-[rgba(226,85,63,.18)]"
              style={{ borderRadius: 'var(--school-radius, 12px)', borderColor: 'rgba(226,85,63,.30)', background: 'rgba(226,85,63,.10)', color: '#ef6a52' }}
            >
              <Radio className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden sm:inline">Live</span>
            </Link>

            <Link
              to="/studio/export-center"
              className="sdls-act flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium hover:bg-[rgba(245,244,238,.07)]"
              style={{ borderRadius: 'var(--school-radius, 12px)', borderColor: 'rgba(245,244,238,.12)', color: 'rgba(245,244,238,.62)' }}
            >
              <FileOutput className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden sm:inline">Exporter</span>
            </Link>

            {/* Cloche et sortie : doublons de la topbar du portail → `sdls-solo`. */}
            <button
              type="button"
              className="sdls-act sdls-solo grid h-8 w-8 shrink-0 place-items-center rounded-lg hover:bg-[rgba(245,244,238,.07)]"
              style={{ color: 'rgba(245,244,238,.62)' }}
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" aria-hidden />
            </button>

            <Link
              to="/liri"
              title="Sortir du Studio — retour à l'accueil LIRI"
              aria-label="Sortir du Studio, retour à l'accueil LIRI"
              className="sdls-act sdls-solo grid h-8 w-8 shrink-0 place-items-center rounded-lg hover:bg-[rgba(245,244,238,.07)]"
              style={{ color: 'rgba(245,244,238,.62)' }}
            >
              <LogOut className="h-4 w-4" aria-hidden />
            </Link>
          </>
        )}
      </header>

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {!hideRail && <DesignerLikeLeftRail activeKey={railActiveKey} />}

        {/* Plan de travail. Fond TRANSPARENT (et non #262624 opaque) : c'est
            ce qui laisse le halo et le lavis d'or traverser jusque sous le
            contenu — l'ambiance est vue, pas devinée en bordure. */}
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" style={GRID_BG}>
          <div className="sdls-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden">{children}</div>
        </div>
      </div>

      {showFooter ? footerNode : null}
    </div>
  );
}
