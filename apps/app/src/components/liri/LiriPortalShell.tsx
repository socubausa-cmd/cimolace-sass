import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import {
  Menu, Sparkles, Bell, Settings, House, Video, MessagesSquare, MessageCircle,
  WandSparkles, Library, Blocks, Settings2, GraduationCap, ChevronRight, ChevronDown, MoreHorizontal,
  CalendarDays, BookOpen, School, Calendar, FileText, Award, AlertTriangle, FolderOpen,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { authStore } from '@/lib/auth-store';
import { useAuth } from '@/hooks/useAuth';
import { isCreatorRole } from '@/lib/liri/creatorRole';
import { getApiBaseUrl } from '@/lib/apiBase';
import activeTenantConfig from '@/lib/tenant/activeTenantConfig';
import { PortalHeaderProvider, usePortalHeaderValues } from './portalHeader';
import '../../pages/LiriPortal.css';
// Scope froid→chaud (même règles que le Studio) réutilisé sur tout le contenu du portail
// → filet de sécurité : Lives, Brain, etc. n'ont plus de classes froides résiduelles.
import '../../pages/studio-creator/studio/studioWarm.css';

type RailKey =
  | 'accueil' | 'semaine' | 'formations'
  | 'vie-scolaire' | 'agenda' | 'notes' | 'evaluations' | 'absences'
  | 'lives' | 'forum' | 'messages'
  | 'biblio-eleve' | 'documents'
  | 'studio' | 'ecole' | 'biblio' | 'brain' | 'integrations' | 'reglages';

type RailItem = { key: RailKey; label: string; icon: typeof House; to: string; creator?: boolean; student?: boolean };

// Rail GROUPÉ (familles) : LIRI embarque ISNA Academy (Vie scolaire) → l'élève a TOUTES
// ses fonctionnalités école dans le portail. Visibilité :
//   creator: true  → réservé au CRÉATEUR (Studio/École/Brain…)
//   student: true  → réservé à l'ÉLÈVE (sa scolarité : agenda/notes/évals… — HS pour l'owner)
//   (aucun flag)   → partagé (Accueil, Lives, Forum, Messages)
const RAIL_GROUPS: { section?: string; items: RailItem[] }[] = [
  { items: [
    { key: 'accueil', label: 'Accueil', icon: House, to: '/liri' },
  ] },
  { section: 'Parcours', items: [
    { key: 'semaine', label: 'Ma semaine', icon: CalendarDays, to: '/liri/semaine', student: true },
    { key: 'formations', label: 'Mes cours', icon: BookOpen, to: '/liri/formations', student: true },
  ] },
  { section: 'Scolarité', items: [
    { key: 'vie-scolaire', label: 'Vie scolaire', icon: School, to: '/liri/vie-scolaire', student: true },
    { key: 'agenda', label: 'Agenda', icon: Calendar, to: '/liri/agenda', student: true },
    { key: 'notes', label: 'Notes', icon: FileText, to: '/liri/notes', student: true },
    { key: 'evaluations', label: 'Évals', icon: Award, to: '/liri/evaluations', student: true },
    { key: 'absences', label: 'Absences', icon: AlertTriangle, to: '/liri/absences', student: true },
  ] },
  { section: 'Communauté', items: [
    { key: 'lives', label: 'Lives', icon: Video, to: '/lives' },
    { key: 'forum', label: 'Forum', icon: MessagesSquare, to: '/liri/forum' },
    { key: 'messages', label: 'Messages', icon: MessageCircle, to: '/liri/messages' },
  ] },
  { section: 'Ressources', items: [
    { key: 'biblio-eleve', label: 'Biblio.', icon: Library, to: '/liri/bibliotheque', student: true },
    { key: 'documents', label: 'Documents', icon: FolderOpen, to: '/liri/documents', student: true },
  ] },
  { section: 'Création', items: [
    { key: 'studio', label: 'Studio', icon: WandSparkles, to: '/studio/liri', creator: true },
    { key: 'ecole', label: 'École', icon: GraduationCap, to: '/liri/ecole', creator: true },
    { key: 'biblio', label: 'Biblio.', icon: Library, to: '/studio/liri/bibliotheque', creator: true },
    { key: 'brain', label: 'Brain', icon: Sparkles, to: '/dashboard/liri', creator: true },
  ] },
];

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
  children,
}: {
  active?: RailKey;
  live?: boolean;
  rail?: boolean;
  children: ReactNode;
}) {
  const nav = useNavigate();
  // Vue ADAPTÉE par rôle : l'élève reste dans le portail mais sans l'outillage créateur.
  // Même coupe que LiriPortalPage (helper partagé, fail-closed sur le rôle JWT).
  const { tenantRole } = useAuth();
  const isCreator = isCreatorRole(tenantRole);
  const slug = authStore.getTenantSlug?.() || 'École';
  const tenant = String(slug).replace(/-/g, ' ');
  const initials = tenant.slice(0, 2).toUpperCase();
  // Marque blanche : nom du tenant sur son domaine, « LIRI »/logo sur l'hôte produit LIRI.
  const _shellIsTenant = !!activeTenantConfig?.slug;
  const _shellBrand = activeTenantConfig?.branding?.name || 'LIRI';

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

  return (
    <div className="lp-root relative grid h-[100dvh] w-full grid-rows-[56px_1fr_34px] overflow-hidden">
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
            {_shellIsTenant ? null : <img src="/lirilogo.png" alt="LIRI" className="h-9 w-9 object-contain" />}
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

        {/* zone centrale : sous-vues de la section active (alignées à droite, remplissent le vide) */}
        <div className="flex min-w-0 flex-1 justify-end">
          <HeaderTabs />
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

      {/* middle : rail | main  (immersif : aucun gap/padding externe → le contenu remplit l'écran). */}
      <div className={`z-10 grid min-h-0 ${rail ? 'grid-cols-[92px_1fr]' : 'grid-cols-[1fr]'}`}>
        {rail && (
        <aside className="flex min-h-0 flex-col items-center gap-0.5 overflow-y-auto lp-rail-bg border-r lp-line py-3 lp-rail-scroll">
          {RAIL_GROUPS.map((group, gi) => {
            const items = group.items.filter((it) => (it.creator ? isCreator : it.student ? !isCreator : true));
            if (!items.length) return null;
            return (
              <div key={group.section || `g${gi}`} className="flex w-full flex-col items-center gap-0.5">
                {group.section && (
                  <div className="mb-0.5 mt-2 w-full px-1 text-center lp-faint" style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{group.section}</div>
                )}
                {items.map((it) => {
                  const Icon = it.icon;
                  const isActive = it.key === active;
                  return (
                    <button key={it.key} onClick={() => nav(it.to)} className={`lp-nav flex w-[74px] flex-col items-center gap-0.5 rounded-2xl py-2 lp-tr ${isActive ? 'lp-nav-active' : ''}`}>
                      <span className="lp-ni relative grid h-6 w-6 place-items-center">
                        <Icon size={19} />
                        {it.key === 'lives' && live && (
                          <span className="absolute -right-1.5 -top-1.5 flex h-3 w-3">
                            <span className="lp-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'var(--live)' }} />
                            <span className="relative inline-flex h-3 w-3 rounded-full" style={{ background: 'var(--live)', boxShadow: '0 0 0 2px var(--rail)' }} />
                          </span>
                        )}
                      </span>
                      <span className="lp-nl text-center text-[9px] font-medium leading-tight">{it.label}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
          {isCreator && (
            <>
              <div className="my-1 h-px w-9" style={{ background: 'rgba(245,244,238,.08)' }} />
              <button onClick={() => nav('/liri')} className="lp-nav flex w-[74px] flex-col items-center gap-0.5 rounded-2xl py-2 lp-tr"><span className="lp-ni grid h-6 w-6 place-items-center"><Blocks size={19} /></span><span className="lp-nl text-[9px] font-medium">Intégr.</span></button>
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

      {/* footer */}
      <footer className="z-30 flex items-center justify-between border-t lp-line lp-rail-bg px-5 text-[11px] lp-muted">
        <span className="flex items-center gap-2">
          {live ? <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#e2553f' }} /> : <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
          {live ? 'En direct' : 'Connecté'} · <span className="capitalize">{tenant}</span>
        </span>
        <span className="lp-faint flex items-center gap-1.5">{_shellBrand} v2.0</span>
      </footer>
    </div>
  );
}
