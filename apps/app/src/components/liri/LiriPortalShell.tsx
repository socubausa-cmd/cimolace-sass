import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import {
  Menu, Sparkles, Bell, Settings, House, Video, MessagesSquare, MessageCircle,
  WandSparkles, Library, Settings2, GraduationCap, ChevronRight, ChevronDown, MoreHorizontal,
  CalendarDays, BookOpen, School, Calendar, FileText, Award, AlertTriangle, FolderOpen,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { authStore } from '@/lib/auth-store';
import { useAuth } from '@/hooks/useAuth';
import { isCreatorRole } from '@/lib/liri/creatorRole';
import { useSchoolActive } from '@/hooks/useSchoolActive';
import { LiriRailGroups, getRailItems, LiriEngineSwitcher, getActiveEngine } from './liriRail';
import type { RailKey } from './liriRail';
import { getApiBaseUrl } from '@/lib/apiBase';
import activeTenantConfig from '@/lib/tenant/activeTenantConfig';
import { PortalHeaderProvider, usePortalHeaderValues } from './portalHeader';
import '../../pages/LiriPortal.css';
// Scope froid→chaud (même règles que le Studio) réutilisé sur tout le contenu du portail
// → filet de sécurité : Lives, Brain, etc. n'ont plus de classes froides résiduelles.
import '../../pages/studio-creator/studio/studioWarm.css';

/** Onglets de sous-vues (niveau 3) rendus DANS l'en-tête — voir portalHeader + la RÈGLE menus.
 *  Au-delà de MAX onglets, l'excédent se replie dans un menu « ••• » (RÈGLE menus). */
const MAX_HEADER_TABS = 6;
function HeaderTabs() {
  const { tabs } = usePortalHeaderValues();
  const [moreOpen, setMoreOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!moreOpen) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setMoreOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [moreOpen]);
  if (!tabs || !tabs.items.length) return null;

  const overflow = tabs.items.length > MAX_HEADER_TABS;
  const visible = overflow ? tabs.items.slice(0, MAX_HEADER_TABS) : tabs.items;
  const hidden = overflow ? tabs.items.slice(MAX_HEADER_TABS) : [];
  const hiddenActive = hidden.find((t) => t.value === tabs.active);

  const TabBtn = (t: { value: string; label: string }) => {
    const isActive = t.value === tabs!.active;
    return (
      <button key={t.value} onClick={() => tabs!.onChange(t.value)}
        className={`relative shrink-0 whitespace-nowrap px-3 py-1.5 text-[13px] lp-tr ${isActive ? 'lp-ink font-medium' : 'lp-muted hover:lp-ink'}`}>
        {t.label}
        {isActive && <span className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full" style={{ background: 'var(--coral)' }} />}
      </button>
    );
  };

  return (
    <>
      {/* Desktop (≥ md) : au-delà de MAX, l'excédent se replie dans « ••• » (pas de scroll). */}
      <nav className="hidden min-w-0 items-center gap-0.5 md:flex">
        {visible.map(TabBtn)}
        {overflow && (
          <div className="relative" ref={ref}>
            <button onClick={() => setMoreOpen((o) => !o)}
              className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13px] lp-tr ${hiddenActive ? 'lp-ink font-medium' : 'lp-muted hover:lp-ink'}`}>
              {hiddenActive ? hiddenActive.label : <MoreHorizontal size={16} />}
              <ChevronDown size={13} className="lp-faint" />
            </button>
            {moreOpen && (
              <div className="absolute right-0 top-[calc(100%+6px)] z-50 max-h-[60vh] min-w-[190px] overflow-auto rounded-xl border lp-line lp-rail-bg py-1 lp-soft">
                {hidden.map((t) => {
                  const isActive = t.value === tabs!.active;
                  return (
                    <button key={t.value} onClick={() => { tabs!.onChange(t.value); setMoreOpen(false); }}
                      className={`flex w-full items-center whitespace-nowrap px-3.5 py-2 text-left text-[13px] lp-tr ${isActive ? 'lp-ink font-medium' : 'lp-muted hover:lp-ink'}`}
                      style={isActive ? { background: 'color-mix(in srgb, var(--coral) 16%, transparent)' } : undefined}>
                      {t.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </nav>
      {/* Mobile (< md) : TOUS les onglets en strip scrollable horizontal — pas de « ••• »
          (un dropdown absolu serait clippé par overflow-x-auto). Le scroll révèle l'excédent. */}
      <nav className="flex min-w-0 items-center gap-0.5 overflow-x-auto no-scrollbar md:hidden">
        {tabs.items.map(TabBtn)}
      </nav>
    </>
  );
}

/**
 * Shell du portail LIRI (topbar + rail Zoom×Claude + footer) réutilisable, avec un slot
 * `children` plein-hauteur. La topbar accueille la nav contextuelle (fil d'Ariane + sous-vues)
 * que la page active pousse via les hooks de `portalHeader` → plus de barre de sous-onglets
 * dans le corps (RÈGLE D'ORGANISATION DES MENUS).
 */
export function LiriPortalShell(props: {
  active?: RailKey;
  live?: boolean;
  /** Affiche le rail latéral du portail. `false` pour l'arène live (cadre épuré, topbar seule). */
  rail?: boolean;
  /** Masque le rail-moteur DESKTOP de 92px quand la page fournit déjà son propre panneau de
   *  nav (ex. École → OwnerDashboardBody). Le sélecteur d'en-tête + la nav mobile restent. */
  hideDesktopRail?: boolean;
  children: ReactNode;
}) {
  return (
    <PortalHeaderProvider>
      <LiriPortalShellInner {...props} />
    </PortalHeaderProvider>
  );
}

function LiriPortalShellInner({
  active = 'lives',
  live = false,
  rail = true,
  hideDesktopRail = false,
  children,
}: {
  active?: RailKey;
  live?: boolean;
  rail?: boolean;
  hideDesktopRail?: boolean;
  children: ReactNode;
}) {
  const nav = useNavigate();
  // Vue ADAPTÉE par rôle : l'élève reste dans le portail mais sans l'outillage créateur.
  // Même coupe que LiriPortalPage (helper partagé, fail-closed sur le rôle JWT).
  const { tenantRole } = useAuth();
  const isCreator = isCreatorRole(tenantRole);
  // Mode ÉCOLE activé pour ce tenant ? Sinon = LIRI SIMPLE (Zoom) → sections Vie scolaire masquées.
  const schoolActive = useSchoolActive() === true;
  const slug = authStore.getTenantSlug?.() || 'École';
  const tenant = String(slug).replace(/-/g, ' ');
  // Initiales de marque : celles du NOM du tenant (Academy Ngowazulu → « AN »), pas du slug.
  const _shellIsTenant = !!activeTenantConfig?.slug;
  // Marque blanche : nom + logo du tenant sur SON domaine ; « LIRI » + logo LIRI sur l'hôte produit.
  const _shellBrand = activeTenantConfig?.branding?.name || 'LIRI';
  const _brandInitials = (_shellBrand === 'LIRI' ? tenant : _shellBrand)
    .split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'É';
  const initials = _shellIsTenant ? _brandInitials : tenant.slice(0, 2).toUpperCase();
  // Logo P4 : le VRAI logo du tenant (branding.logo hydraté), jamais un logo LIRI de repli
  // sur un domaine tenant. Sans logo → pastille-initiales (accent du tenant). Cf. audit P4.
  const _rawLogo = activeTenantConfig?.branding?.logo || '';
  const _isLiriLogo = _rawLogo === '/lirilogo.png' || _rawLogo === '/liri-logo-mark.png' || _rawLogo === '';
  const _tenantLogo = _shellIsTenant && !_isLiriLogo ? _rawLogo : '';

  // Fil d'Ariane contextuel (poussé par la page active, ex. ['École', 'Paramètres']).
  const { crumb } = usePortalHeaderValues();

  // Nom de l'ÉCOLE de la session (résolu côté API). Sur l'hôte produit (liri.cimolace.space),
  // la marque reste « LIRI » mais on affiche en suffixe l'école rattachée (ex. « LIRI · Prorascience »).
  const [sessionSchool, setSessionSchool] = useState('');
  useEffect(() => {
    const token = authStore.getToken?.();
    if (!token) return;
    let alive = true;
    fetch(`${getApiBaseUrl()}/tenants/current`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': slug },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        let t: any = d;
        while (t && typeof t === 'object' && 'data' in t) t = t.data;
        if (alive && t?.name) setSessionSchool(String(t.name));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [slug]);
  // Suffixe affiché seulement s'il apporte une info ET qu'aucun fil d'Ariane ne prend le relais.
  const _schoolSuffix = !crumb && sessionSchool && sessionSchool !== _shellBrand ? sessionSchool : '';

  // Moteur actif déduit de la section courante → rail + sélecteur d'en-tête cohérents.
  const activeEngine = getActiveEngine(active);
  // Rail-moteur DESKTOP (92px) : masqué si la page a son propre panneau (École) → 1 seul rail.
  const showDesktopRail = rail && !hideDesktopRail;
  // Items du rail DU MOTEUR ACTIF (filtrés rôle + mode école) pour la barre de nav basse mobile (< md).
  const mobileNavItems = getRailItems({ isCreator, schoolActive, engine: activeEngine });

  return (
    <div className="lp-root relative grid h-[100dvh] w-full grid-rows-[56px_1fr_auto] overflow-hidden">
      {/* Glow chaleureux — discret, confiné à la topbar/aux marges. */}
      <div className="lp-glow">
        <span style={{ width: 460, height: 300, left: '36%', top: -160, background: 'rgba(217,119,87,.05)' }} />
        <span style={{ width: 300, height: 260, right: 40, bottom: -60, background: 'rgba(226,85,63,.035)' }} />
      </div>

      {/* topbar : [menu · logo · fil d'Ariane]  —  [sous-vues]  —  [icônes] */}
      <header className="z-30 flex items-center gap-3 lp-rail-bg border-b lp-line px-4">
        <div className="flex shrink-0 items-center gap-2.5">
          <button onClick={() => nav('/liri')} className="grid h-8 w-8 place-items-center rounded-xl lp-muted lp-railbtn lp-tr" aria-label="Retour au portail"><Menu size={17} /></button>
          <button onClick={() => nav('/liri')} className="flex items-center gap-2 lp-tr" aria-label="Portail LIRI">
            {_shellIsTenant
              ? (_tenantLogo
                  ? <img src={_tenantLogo} alt={_shellBrand} className="h-9 w-9 rounded-lg object-contain" />
                  : <span className="grid h-9 w-9 place-items-center rounded-lg text-[13px] font-black text-white lp-ember">{initials}</span>)
              : <img src="/lirilogo.png" alt="LIRI" className="h-9 w-9 object-contain" />}
            <span className="text-[17px] font-semibold tracking-tight lp-ink">{_shellBrand}</span>
            {_schoolSuffix && (
              <span className="hidden items-center gap-2 text-[14px] lp-muted sm:flex">
                <span className="lp-faint">·</span>
                <span className="capitalize">{_schoolSuffix}</span>
              </span>
            )}
          </button>
          {crumb && crumb.length > 0 && (
            <div className="hidden items-center gap-1.5 pl-1 sm:flex">
              {crumb.map((c, i) => (
                <span key={`${c}-${i}`} className="flex items-center gap-1.5">
                  <ChevronRight size={14} className="lp-faint" />
                  <span className={i === crumb.length - 1 ? 'text-[14px] font-medium lp-ink' : 'text-[14px] lp-muted'}>{c}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* zone centrale : SÉLECTEUR DE MOTEUR (gauche) + sous-vues de la section active (droite) */}
        <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-4">
          <LiriEngineSwitcher activeEngine={activeEngine} isCreator={isCreator} schoolActive={schoolActive} onNav={nav} />
          <div className="flex min-w-0 flex-1 justify-start md:justify-end">
            <HeaderTabs />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {live && (
            <span className="mr-1 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: 'rgba(226,85,63,.10)', border: '1px solid rgba(226,85,63,.30)', color: '#ef6a52' }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#e2553f' }} /> EN DIRECT
            </span>
          )}
          <button className="relative grid h-8 w-8 place-items-center rounded-xl lp-muted lp-railbtn lp-tr" aria-label="Notifications"><Bell size={17} /><span className="absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full" style={{ background: 'var(--coral)' }} /></button>
          {/* Réglages du compte tenant (facturation, membres…) = créateur only. */}
          {isCreator && <button onClick={() => nav('/liri/compte')} className="grid h-8 w-8 place-items-center rounded-xl lp-muted lp-railbtn lp-tr" aria-label="Paramètres"><Settings size={17} /></button>}
          <span className="ml-1 grid h-8 w-8 place-items-center rounded-full text-[12px] font-semibold text-white lp-ember">{initials}</span>
        </div>
      </header>

      {/* middle : rail | main  (immersif : aucun gap/padding externe → le contenu remplit l'écran).
          Mobile (< md) : le rail latéral disparaît (→ barre de nav basse), le contenu prend 100%. */}
      <div className={`z-10 grid min-h-0 ${showDesktopRail ? 'grid-cols-[1fr] md:grid-cols-[92px_1fr]' : 'grid-cols-[1fr]'}`}>
        {showDesktopRail && (
        <aside className="hidden min-h-0 flex-col items-center gap-0.5 overflow-y-auto lp-rail-bg border-r lp-line py-3 lp-rail-scroll md:flex">
          <LiriRailGroups engine={activeEngine} active={active} isCreator={isCreator} schoolActive={schoolActive} live={live} onNav={nav} />
          {isCreator && (
            <>
              <div className="my-1 h-px w-9" style={{ background: 'rgba(245,244,238,.08)' }} />
              <button onClick={() => nav('/liri/compte')} className="lp-nav flex w-[74px] flex-col items-center gap-0.5 rounded-2xl py-2 lp-tr"><span className="lp-ni grid h-6 w-6 place-items-center"><Settings2 size={19} /></span><span className="lp-nl text-[9px] font-medium">Réglages</span></button>
            </>
          )}
          <button className="mt-2 grid h-9 w-9 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white lp-tr lp-railbtn" style={{ background: 'linear-gradient(135deg,#5b7a52,#6d8f60)' }} title={tenant}>{initials}</button>
        </aside>
        )}

        <main className="lp-shell-main studio-warm-scope relative min-h-0 overflow-hidden" style={{ background: 'var(--base)' }}>
          {children}
        </main>
      </div>

      {/* rangée basse : barre de nav (mobile, < md) OU footer (desktop, ≥ md) — même slot de grille. */}
      <div className="z-30 min-w-0">
        {rail && (
          <nav className="flex items-stretch gap-1 overflow-x-auto no-scrollbar border-t lp-line lp-rail-bg px-2 py-1.5 md:hidden" aria-label="Navigation principale">
            {mobileNavItems.map((it) => {
              const Icon = it.icon;
              const isActive = it.key === active;
              return (
                <button key={it.key} onClick={() => nav(it.to)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`lp-nav flex min-h-[44px] min-w-[60px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 lp-tr ${isActive ? 'lp-nav-active' : ''}`}>
                  <span className="lp-ni relative grid h-5 w-5 place-items-center">
                    <Icon size={18} />
                    {it.key === 'lives' && live && (
                      <span className="absolute -right-1.5 -top-1.5 h-2 w-2 rounded-full" style={{ background: 'var(--live)', boxShadow: '0 0 0 2px var(--rail)' }} />
                    )}
                  </span>
                  <span className="lp-nl text-center text-[9px] font-medium leading-none">{it.label}</span>
                </button>
              );
            })}
          </nav>
        )}
        <footer className={`items-center justify-between border-t lp-line lp-rail-bg px-5 py-1.5 text-[11px] lp-muted ${rail ? 'hidden md:flex' : 'flex'}`}>
          <span className="flex items-center gap-2">
            {live ? <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#e2553f' }} /> : <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
            {live ? 'En direct' : 'Connecté'} · <span className="capitalize">{sessionSchool || tenant}</span>
          </span>
          <span className="lp-faint flex items-center gap-1.5">{_shellBrand} v2.0</span>
        </footer>
      </div>
    </div>
  );
}
