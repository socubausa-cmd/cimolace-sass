import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  Menu, Sparkles, Bell, Settings, House, Video, MessagesSquare, MessageCircle,
  WandSparkles, Library, Blocks, Settings2, GraduationCap,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { authStore } from '@/lib/auth-store';
import { getApiBaseUrl } from '@/lib/apiBase';
import activeTenantConfig from '@/lib/tenant/activeTenantConfig';
import '../../pages/LiriPortal.css';

type RailKey = 'accueil' | 'lives' | 'forum' | 'messages' | 'studio' | 'ecole' | 'biblio' | 'brain' | 'integrations' | 'reglages';

const RAIL: { key: RailKey; label: string; icon: typeof House; to: string }[] = [
  { key: 'accueil', label: 'Accueil', icon: House, to: '/liri' },
  { key: 'lives', label: 'Lives', icon: Video, to: '/lives' },
  { key: 'forum', label: 'Forum', icon: MessagesSquare, to: '/liri/forum' },
  { key: 'messages', label: 'Messages', icon: MessageCircle, to: '/liri/messages' },
  { key: 'studio', label: 'Studio', icon: WandSparkles, to: '/studio/liri' },
  { key: 'ecole', label: 'École', icon: GraduationCap, to: '/liri/ecole' },
  { key: 'biblio', label: 'Biblio.', icon: Library, to: '/studio/liri/bibliotheque' },
  { key: 'brain', label: 'Brain', icon: Sparkles, to: '/dashboard/liri' },
];

/**
 * Shell du portail LIRI (topbar + rail Zoom×Claude + footer) réutilisable, avec
 * un slot `children` plein-hauteur pour la page. Conçu pour envelopper des pages
 * existantes — ex. la LiveHostPage : elle s'affiche dans le `<main>` (sa chrome
 * `height:100dvh` est forcée à `100%` via .lp-shell-main, voir LiriPortal.css).
 */
export function LiriPortalShell({
  active = 'lives',
  live = false,
  rail = true,
  children,
}: {
  active?: RailKey;
  live?: boolean;
  /** Affiche le rail latéral du portail. `false` pour l'arène live (cadre épuré, topbar seule). */
  rail?: boolean;
  children: ReactNode;
}) {
  const nav = useNavigate();
  const slug = authStore.getTenantSlug?.() || 'École';
  const tenant = String(slug).replace(/-/g, ' ');
  const initials = tenant.slice(0, 2).toUpperCase();
  // Marque blanche : nom du tenant sur son domaine, « LIRI »/logo sur l'hôte produit LIRI.
  const _shellIsTenant = !!activeTenantConfig?.slug;
  const _shellBrand = activeTenantConfig?.branding?.name || 'LIRI';

  // Nom de l'ÉCOLE de la session (résolu côté API). Sur l'hôte produit (liri.cimolace.space),
  // la marque reste « LIRI » mais on affiche en suffixe l'école à laquelle l'utilisateur est
  // rattaché (ex. « LIRI · Prorascience ») → lève la confusion « c'est quel tenant ? ».
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
  // Suffixe affiché seulement s'il apporte une info (≠ marque déjà montrée).
  const _schoolSuffix = sessionSchool && sessionSchool !== _shellBrand ? sessionSchool : '';

  return (
    <div className="lp-root relative grid h-[100dvh] w-full grid-rows-[56px_1fr_34px] overflow-hidden">
      {/* Glow chaleureux — discret, confiné à la topbar/aux marges (le <main> est opaque,
          il ne transparaît donc plus dans le contenu : fini le « halo marron » envahissant). */}
      <div className="lp-glow">
        <span style={{ width: 460, height: 300, left: '36%', top: -160, background: 'rgba(217,119,87,.05)' }} />
        <span style={{ width: 300, height: 260, right: 40, bottom: -60, background: 'rgba(226,85,63,.035)' }} />
      </div>

      {/* topbar */}
      <header className="z-30 flex items-center justify-between lp-rail-bg border-b lp-line px-4">
        <div className="flex items-center gap-2.5">
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
        </div>
        <div className="flex items-center gap-1.5">
          {live && (
            <span className="mr-1 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: 'rgba(226,85,63,.10)', border: '1px solid rgba(226,85,63,.30)', color: '#ef6a52' }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#e2553f' }} /> EN DIRECT
            </span>
          )}
          <button className="relative grid h-8 w-8 place-items-center rounded-xl lp-muted lp-railbtn lp-tr" aria-label="Notifications"><Bell size={17} /><span className="absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full" style={{ background: 'var(--coral)' }} /></button>
          <button onClick={() => nav('/liri/compte')} className="grid h-8 w-8 place-items-center rounded-xl lp-muted lp-railbtn lp-tr" aria-label="Paramètres"><Settings size={17} /></button>
          <span className="ml-1 grid h-8 w-8 place-items-center rounded-full text-[12px] font-semibold text-white lp-ember">{initials}</span>
        </div>
      </header>

      {/* middle : rail | main  (rail masqué = arène live plein cadre) */}
      <div className={`z-10 grid min-h-0 gap-3 p-3 pt-1 ${rail ? 'grid-cols-[100px_1fr]' : 'grid-cols-[1fr]'}`}>
        {/* rail */}
        {rail && (
        <aside className="flex min-h-0 flex-col items-center gap-1 rounded-3xl lp-rail-bg lp-line border py-4 lp-soft">
          {RAIL.map((it) => {
            const Icon = it.icon;
            const isActive = it.key === active;
            return (
              <button key={it.key} onClick={() => nav(it.to)} className={`lp-nav flex w-[72px] flex-col items-center gap-1 rounded-2xl py-2.5 lp-tr ${isActive ? 'lp-nav-active' : ''}`}>
                <span className="lp-ni relative grid h-7 w-7 place-items-center">
                  <Icon size={20} />
                  {it.key === 'lives' && live && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-3 w-3">
                      <span className="lp-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'var(--live)' }} />
                      <span className="relative inline-flex h-3 w-3 rounded-full" style={{ background: 'var(--live)', boxShadow: '0 0 0 2px var(--rail)' }} />
                    </span>
                  )}
                </span>
                <span className="lp-nl text-[10px] font-medium">{it.label}</span>
              </button>
            );
          })}
          <div className="my-1.5 h-px w-9" style={{ background: 'rgba(245,244,238,.08)' }} />
          <button onClick={() => nav('/liri')} className="lp-nav flex w-[72px] flex-col items-center gap-1 rounded-2xl py-2.5 lp-tr"><span className="lp-ni grid h-7 w-7 place-items-center"><Blocks size={20} /></span><span className="lp-nl text-[10px] font-medium">Intégr.</span></button>
          <button onClick={() => nav('/liri/compte')} className="lp-nav flex w-[72px] flex-col items-center gap-1 rounded-2xl py-2.5 lp-tr"><span className="lp-ni grid h-7 w-7 place-items-center"><Settings2 size={20} /></span><span className="lp-nl text-[10px] font-medium">Réglages</span></button>
          <button className="mt-auto grid h-9 w-9 place-items-center rounded-full text-[11px] font-bold text-white lp-tr lp-railbtn" style={{ background: 'linear-gradient(135deg,#5b7a52,#6d8f60)' }} title={tenant}>{initials}</button>
        </aside>
        )}

        {/* main : la page enveloppée (host) remplit ce conteneur. Fond OPAQUE (base chaude
            du shell) → les zones non couvertes ne laissent plus voir le glow coral. */}
        <main className="lp-shell-main relative min-h-0 overflow-hidden rounded-3xl lp-line border lp-soft" style={{ background: 'var(--base)' }}>
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
