import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Menu, Sparkles, Bell, Settings, House, Video, MessagesSquare, MessageCircle, WandSparkles,
  Library, Blocks, Settings2, Mic, ArrowUp, LogIn, CalendarPlus, PenTool,
  ShoppingBag, Clock, ChevronRight, Film, ChevronLeft, UserRound, Plus,
  Radio, GraduationCap, LogOut, ArrowUpRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { authStore } from '@/lib/auth-store';
import { getCachedHostTenant } from '@/lib/tenantResolver';
import { getApiBaseUrl } from '@/lib/apiBase';
import { useAuth } from '@/hooks/useAuth';
import { isCreatorRole } from '@/lib/liri/creatorRole';
import activeTenantConfig from '@/lib/tenant/activeTenantConfig';
import '../LiriPortal.css';

// Marque blanche par tenant : sur le domaine d'un tenant (ex. prorascience.org), le
// portail porte le nom du tenant et n'expose JAMAIS « LIRI » ; sur l'hôte produit LIRI
// (liri.cimolace.space) il reste « LIRI ». activeTenantConfig = résolu par l'hôte.
const PORTAL_IS_TENANT = !!(activeTenantConfig && activeTenantConfig.slug);
const PORTAL_BRAND =
  (activeTenantConfig && activeTenantConfig.branding && activeTenantConfig.branding.name) || 'LIRI';

interface Live { id: string; title?: string; status?: string; scheduled_at?: string; started_at?: string | null; ended_at?: string | null; price_cents?: number; }
interface Stats { totalMembers: number; totalLives: number; totalCourses: number; totalRevenueCents: number; }
interface Org { name: string; slug: string; role?: string | null; plan?: string | null; billingStatus?: string | null; }

interface Sub { status?: string; plan_id?: string; provider?: string; current_period_end?: string | null; }

interface ResumeItem { id: string; icon: LucideIcon; title: string; sub: string; to: string; }
interface ActivityItem { id: string; icon: LucideIcon; tint?: 'coral' | 'green' | 'muted'; title: string; sub: string; when: string; action?: string; to?: string; }

export function LiriPortalPage() {
  const nav = useNavigate();
  const { logout, user, tenantRole } = useAuth();
  const base = getApiBaseUrl();
  const token = authStore.getToken();
  // Le portail PRODUIT suit le DOMAINE, PAS le localStorage (qui peut être resté sur 'isna'
  // d'une session antérieure dans le même navigateur → fuite). Domaine prioritaire, getTenantSlug
  // en repli (utilisé pour le header X-Tenant-Slug des appels API au boot, avant que l'org charge).
  const domainSlug = typeof window !== 'undefined' ? getCachedHostTenant(window.location.hostname) : '';
  const slug = domainSlug || authStore.getTenantSlug();

  const [now, setNow] = useState(() => new Date());
  const [stats, setStats] = useState<Stats | null>(null);
  const [lives, setLives] = useState<Live[]>([]);
  const [org, setOrg] = useState<Org | null>(null);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [starting, setStarting] = useState(false);

  // Menu compte / organisation (avatar).
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // orgSlug pour les LIENS /t/:slug : org chargée (vérité) > domaine (fiable) > '' (transitoire).
  // JAMAIS le localStorage → un /t/isna/... périmé ne peut pas réapparaître sur le portail produit.
  const orgSlug = org?.slug || domainSlug || '';
  // Identité affichée : vrai nom d'org (API) sinon slug humanisé ; email du compte.
  const slugLabel = (orgSlug || 'École').replace(/-/g, ' ');
  const orgName = org?.name || slugLabel;
  const email = user?.email || '';

  // État d'abonnement (essai / payant / gratuit) pour le badge + le CTA upgrade.
  const billing = useMemo(() => {
    const active = subs.find((s) => s.status === 'active') ?? subs[0];
    const end = active?.current_period_end ? new Date(active.current_period_end) : null;
    const future = end ? end.getTime() - Date.now() : 0;
    const daysLeft = end ? Math.max(0, Math.ceil(future / 86_400_000)) : null;
    const isPaid = !!active && !!active.provider && active.provider !== 'free' && active.status === 'active' && (!end || future > 0);
    const isTrial = !!active && !isPaid && (String(active.plan_id || '').includes('trial') || active.provider === 'free');
    const label = isPaid ? (active?.plan_id || 'Forfait') : isTrial ? `Essai${daysLeft != null ? ` · ${daysLeft} j` : ''}` : 'Gratuit';
    return { isPaid, label };
  }, [subs]);

  // « Démarrer » = réunion instantanée façon Zoom : crée une session live à la volée,
  // la démarre, et ouvre directement le LiveHostPage (coque LIRI neutre). Repli = wizard.
  const startInstantMeeting = async () => {
    if (starting) return;
    setStarting(true);
    try {
      // host_user_id (colonne NOT NULL de live_sessions) = utilisateur courant = `sub` du JWT.
      let hostId = '';
      try { hostId = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub || ''; } catch { /* noop */ }
      // Tenant de la réunion = org chargée en priorité (jamais un slug localStorage périmé).
      const meetingSlug = org?.slug || slug;
      const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Tenant-Slug': meetingSlug } as Record<string, string>;
      const res = await fetch(`${base}/lives`, {
        method: 'POST',
        headers: h,
        // teacher_id = host_user_id : sans enseignant assigné, plusieurs hooks INVITÉ (détection
        // de fin de live, sync smartboard, canal aside) se gardent sur `teacher_id != null` et ne
        // s'abonnent jamais → l'invité reste bloqué après l'arrêt. On le pose dès la création.
        body: JSON.stringify({ title: 'Réunion instantanée', host_user_id: hostId, teacher_id: hostId, scheduled_at: new Date().toISOString(), price_cents: 0, currency: 'EUR' }),
      });
      const j = await res.json().catch(() => ({}));
      // Dépile l'enveloppe ({data:{data:{id}}} via l'intercepteur global) jusqu'à la session.
      let d: any = j;
      while (d && typeof d === 'object' && !('id' in d) && 'data' in d) d = d.data;
      const id = d?.id;
      if (!id) throw new Error('reunion sans id');
      // Démarrage immédiat (best-effort — l'hôte peut aussi démarrer depuis l'arène).
      try { await fetch(`${base}/lives/${id}/start`, { method: 'POST', headers: h }); } catch { /* noop */ }
      nav(`/live/host/${id}?tenant=${encodeURIComponent(meetingSlug)}`);
    } catch {
      // Échec rare : rester sur l'accueil LIRI avec un message (pas de route cassée).
      if (typeof window !== 'undefined') window.alert('La réunion n’a pas pu démarrer. Réessayez dans un instant.');
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(t); }, []);

  // Ferme le menu compte au clic extérieur / Échap.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [menuOpen]);

  useEffect(() => {
    if (!token) return;
    const h = { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': slug } as Record<string, string>;
    // Stats : on ne garde la réponse QUE si la forme est valide (sinon une réponse
    // d'erreur — guard tenant, 401… — polluerait l'affichage avec des NaN / mocks).
    fetch(`${base}/growth/stats`, { headers: h })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { const s = d?.data ?? d; if (s && typeof s.totalLives === 'number' && typeof s.totalMembers === 'number') setStats(s as Stats); })
      .catch(() => {});
    // Organisation réelle (nom, rôle, plan) pour l'en-tête + le menu compte.
    fetch(`${base}/tenants/current`, { headers: h })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { let t: any = d; while (t && typeof t === 'object' && 'data' in t) t = t.data; if (t?.name || t?.slug) setOrg({ name: t.name ?? slugLabel, slug: t.slug ?? slug, role: t.userRole ?? t.role ?? null, plan: t.plan ?? null, billingStatus: t.billing_status ?? null }); })
      .catch(() => {});
    // Abonnement plateforme (essai / forfait) pour le badge + le CTA upgrade.
    fetch(`${base}/billing/plan`, { headers: h })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { let t: any = d; while (t && typeof t === 'object' && 'data' in t && !('subscriptions' in t)) t = t.data; const arr = t?.subscriptions ?? []; setSubs(Array.isArray(arr) ? arr : []); })
      .catch(() => {});
    fetch(`${base}/lives`, { headers: h }).then((r) => r.json()).then((d) => { const a = d?.data ?? d; setLives(Array.isArray(a) ? a : []); }).catch(() => {});
  }, [base, token, slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const greet = useMemo(() => { const h = now.getHours(); return h < 6 ? 'Bonne nuit' : h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir'; }, [now]);
  const dateLong = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  const liveNow = useMemo(() => lives.filter((l) => l.started_at && !l.ended_at), [lives]);
  const upcoming = useMemo(
    () => lives.filter((l) => !l.started_at && l.scheduled_at && new Date(l.scheduled_at) > now)
      .sort((a, b) => +new Date(a.scheduled_at!) - +new Date(b.scheduled_at!)),
    [lives, now],
  );
  const recent = useMemo(() => [...lives].sort((a, b) => +new Date(b.scheduled_at ?? 0) - +new Date(a.scheduled_at ?? 0)).slice(0, 4), [lives]);

  const liveMinutes = (stats?.totalLives ?? 0) * 70;

  const fmtAgo = (iso?: string) => {
    if (!iso) return '';
    const diff = now.getTime() - new Date(iso).getTime();
    if (diff < 0) return fmtWhen(iso);
    const min = Math.round(diff / 60000);
    if (min < 60) return `${Math.max(1, min)} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `${h} h`;
    return `${Math.round(h / 24)} j`;
  };

  // « Reprendre » : prochains lives réels (plus de repli démo : un tenant neuf est vide).
  const resumeItems = useMemo<ResumeItem[]>(() => (
    upcoming.slice(0, 2).map((l) => ({
      id: l.id,
      icon: Clock,
      title: l.title || 'Session live',
      sub: `${fmtWhen(l.scheduled_at)}${l.price_cents ? ` · ${euros(l.price_cents)} €` : ' · gratuit'}`,
      to: '/lives',
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [upcoming]);

  // « Activité récente » : lives récents réels (plus de repli démo).
  const activityItems = useMemo<ActivityItem[]>(() => (
    recent.map((l) => ({
      id: l.id,
      icon: l.ended_at ? Film : WandSparkles,
      tint: 'coral' as const,
      title: l.title || 'Session live',
      sub: l.ended_at ? 'replay disponible' : l.started_at ? 'en cours' : 'programmé',
      when: fmtAgo(l.scheduled_at),
      action: l.ended_at ? 'Ouvrir' : undefined,
      to: '/lives',
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [recent]);

  function fmtWhen(iso?: string) {
    if (!iso) return '';
    const d = new Date(iso);
    const sameDay = d.toDateString() === now.toDateString();
    const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return sameDay ? `aujourd'hui · ${time}` : `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · ${time}`;
  }
  function euros(cents?: number) { return ((cents ?? 0) / 100).toLocaleString('fr-FR'); }

  // `creator: true` = outil réservé au CRÉATEUR (masqué pour l'élève).
  const RAIL: { key: string; label: string; icon: LucideIcon; to: string; active?: boolean; live?: boolean; badge?: number; creator?: boolean }[] = [
    { key: 'accueil', label: 'Accueil', icon: House, to: '/liri', active: true },
    { key: 'lives', label: 'Lives', icon: Video, to: '/lives', live: liveNow.length > 0 },
    { key: 'forum', label: 'Forum', icon: MessagesSquare, to: '/liri/forum', badge: 5 },
    { key: 'messages', label: 'Messages', icon: MessageCircle, to: '/liri/messages' },
    { key: 'studio', label: 'Studio', icon: WandSparkles, to: '/studio/liri', creator: true },
    { key: 'ecole', label: 'École', icon: GraduationCap, to: '/liri/ecole', creator: true },
    // Biblio → /studio/liri/bibliotheque (bibliothèque communautaire du STUDIO, gardée
    // teacher/admin/owner…). Réservée au créateur : l'élève y serait bloqué par la garde.
    { key: 'biblio', label: 'Biblio.', icon: Library, to: '/studio/liri/bibliotheque', creator: true },
    { key: 'brain', label: 'Brain', icon: Sparkles, to: '/dashboard/liri', creator: true },
  ];
  const QUICK: { label: string; icon: LucideIcon; to: string; hero?: boolean; creator?: boolean }[] = [
    { label: 'Démarrer', icon: Video, hero: true, to: '/lives', creator: true },
    { label: 'Rejoindre', icon: LogIn, to: '/lives' },
    { label: 'Converser', icon: MessageCircle, to: '/liri/messages' },
    { label: 'Programmer', icon: CalendarPlus, to: '/studio/live', creator: true },
    { label: 'SmartBoard', icon: PenTool, to: '/studio/smartboard', creator: true },
    { label: 'Acheter', icon: ShoppingBag, to: '/dashboard', creator: true },
  ];

  const openMenu = () => setMenuOpen((v) => !v);
  const runMenu = (fn: () => void) => { setMenuOpen(false); fn(); };

  // L'ÉLÈVE RESTE dans le portail LIRI, mais en vue ADAPTÉE : tout l'outillage
  // créateur (Studio, Programmer, Acheter, École-gestion, Intégr, Réglages,
  // métriques revenus/quota) est masqué plus bas via `isCreator`. Plus de
  // redirection vers l'ancienne « Vie scolaire » — un seul monde : LIRI.
  const isCreator = isCreatorRole(tenantRole, org?.role);

  return (
    <div className="lp-root relative h-[100dvh] w-full overflow-hidden grid grid-rows-[56px_1fr_34px]">
      {/* glow chaleureux */}
      <div className="lp-glow">
        <span style={{ width: 520, height: 420, left: '34%', top: -120, background: 'rgba(217,119,87,.10)' }} />
        <span style={{ width: 360, height: 360, right: 40, bottom: -40, background: 'rgba(194,104,63,.08)' }} />
      </div>

      {/* ───── TOPBAR ───── */}
      <header className="z-30 flex items-center justify-between lp-rail-bg border-b lp-line px-4">
        <div className="flex items-center gap-2.5">
          <button className="grid h-8 w-8 place-items-center rounded-xl lp-muted lp-railbtn lp-tr" aria-label="Menu"><Menu size={17} /></button>
          <span className="flex items-center gap-2">
            {PORTAL_IS_TENANT ? null : <img src="/lirilogo.png" alt="LIRI" className="h-9 w-9 object-contain" />}
            <span className="text-[17px] font-semibold tracking-tight">{PORTAL_BRAND}</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button className="relative grid h-8 w-8 place-items-center rounded-xl lp-muted lp-railbtn lp-tr" aria-label="Notifications"><Bell size={17} /><span className="absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full" style={{ background: 'var(--coral)' }} /></button>
          {isCreator && <button onClick={() => nav('/liri/compte')} className="grid h-8 w-8 place-items-center rounded-xl lp-muted lp-railbtn lp-tr" aria-label="Réglages de l’organisation"><Settings size={17} /></button>}

          {/* ── Avatar → menu compte / organisation ── */}
          <div className="relative" ref={menuRef}>
            <button onClick={openMenu} aria-label="Compte et organisation" aria-haspopup="menu" aria-expanded={menuOpen}
              className="ml-1 grid h-8 w-8 place-items-center rounded-full text-[12px] font-semibold text-white lp-ember lp-tr lp-railbtn">
              {orgName.slice(0, 2).toUpperCase()}
            </button>

            {menuOpen && (
              <div role="menu" className="absolute right-0 top-[calc(100%+8px)] z-50 w-[280px] overflow-hidden rounded-2xl border lp-line lp-soft"
                style={{ background: '#221f1b', boxShadow: '0 24px 60px -16px rgba(0,0,0,.7)' }}>
                {/* En-tête : nom réel + email + badge essai/plan */}
                <div className="flex items-center gap-3 border-b lp-line px-4 py-3.5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[13px] font-semibold text-white lp-ember">{orgName.slice(0, 2).toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold capitalize lp-ink">{orgName}</p>
                    <p className="truncate text-[11.5px] lp-faint">{email || `/t/${orgSlug}`}</p>
                  </div>
                  <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: billing.isPaid ? 'rgba(91,122,82,.20)' : 'rgba(217,119,87,.16)', color: billing.isPaid ? '#9ec08f' : '#e7a07f' }}>{billing.label}</span>
                </div>

                {/* CTA upgrade — visible tant que non payant */}
                {!billing.isPaid && (
                  <button role="menuitem" onClick={() => runMenu(() => nav('/cimolace/billing?upgrade=liri'))}
                    className="flex w-full items-center justify-between px-4 py-3 text-left lp-tr hover:bg-[rgba(217,119,87,.08)]">
                    <span className="flex items-center gap-2.5 text-[13.5px] font-medium lp-ink"><Sparkles size={16} className="lp-coral" /> Passer à un forfait</span>
                    <ArrowUpRight size={16} className="lp-coral" />
                  </button>
                )}

                <div className="border-t lp-line py-1.5">
                  <button role="menuitem" onClick={() => runMenu(() => nav('/liri/compte'))}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13.5px] lp-muted lp-tr hover:bg-[rgba(255,255,255,.05)]">
                    <UserRound size={16} className="lp-faint" />
                    <span className="flex-1">Mon compte &amp; organisation</span>
                    <ChevronRight size={15} className="lp-faint" />
                  </button>
                  <button role="menuitem" onClick={() => runMenu(() => logout())}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13.5px] lp-muted lp-tr hover:bg-[rgba(255,255,255,.05)]">
                    <LogOut size={16} className="lp-faint" />
                    <span className="flex-1">Déconnexion</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ───── MIDDLE : rail | main | right ─────  (immersif : pas de gap/padding externe, rails collés) */}
      <div className="z-10 grid min-h-0 grid-cols-[92px_1fr_344px]">

        {/* RAIL */}
        <aside className="flex min-h-0 flex-col items-center gap-1 lp-rail-bg border-r lp-line py-4">
          {RAIL.filter((it) => isCreator || !it.creator).map((it) => {
            const Icon = it.icon;
            return (
              <button key={it.key} onClick={() => nav(it.to)} className={`lp-nav flex w-[72px] flex-col items-center gap-1 rounded-2xl py-2.5 lp-tr ${it.active ? 'lp-nav-active' : ''}`}>
                <span className="lp-ni relative grid h-7 w-7 place-items-center">
                  <Icon size={20} />
                  {it.live && <span className="absolute -right-1.5 -top-1.5 flex h-3 w-3"><span className="lp-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'var(--live)' }} /><span className="relative inline-flex h-3 w-3 rounded-full" style={{ background: 'var(--live)', boxShadow: '0 0 0 2px var(--rail)' }} /></span>}
                  {it.badge && <span className="absolute -right-1 -top-1 grid h-3.5 min-w-3.5 place-items-center rounded-full px-1 text-[8px] font-bold text-white" style={{ background: 'var(--coral)' }}>{it.badge}</span>}
                </span>
                <span className="lp-nl text-[10px] font-medium">{it.label}</span>
              </button>
            );
          })}
          {isCreator && (
            <>
              <div className="my-1.5 h-px w-9" style={{ background: 'rgba(245,244,238,.08)' }} />
              <button onClick={() => nav('/liri')} className="lp-nav flex w-[72px] flex-col items-center gap-1 rounded-2xl py-2.5 lp-tr"><span className="lp-ni grid h-7 w-7 place-items-center"><Blocks size={20} /></span><span className="lp-nl text-[10px] font-medium">Intégr.</span></button>
              <button onClick={() => nav('/liri/compte')} className="lp-nav flex w-[72px] flex-col items-center gap-1 rounded-2xl py-2.5 lp-tr"><span className="lp-ni grid h-7 w-7 place-items-center"><Settings2 size={20} /></span><span className="lp-nl text-[10px] font-medium">Réglages</span></button>
            </>
          )}
          <button onClick={openMenu} title={orgName} aria-label="Compte et organisation" className="mt-auto grid h-9 w-9 place-items-center rounded-full text-[11px] font-bold text-white lp-tr lp-railbtn" style={{ background: 'linear-gradient(135deg,#5b7a52,#6d8f60)' }}>{orgName.slice(0, 2).toUpperCase()}</button>
        </aside>

        {/* MAIN — Accueil */}
        <main className="lp-scroll relative min-h-0 overflow-y-auto">
          <div className="mx-auto flex min-h-full max-w-4xl flex-col items-center px-6 pt-12 pb-10">
            <p className="text-[13px] font-medium uppercase tracking-[0.18em] lp-faint lp-rise">{dateLong} · {timeStr}</p>
            <h1 className="mt-3 text-center lp-serif text-[34px] font-medium leading-tight tracking-tight lp-rise">{greet}<span className="lp-coral"> sur {PORTAL_BRAND}</span></h1>
            <p className="mt-2 text-center text-[14px] lp-muted lp-rise">Que voulez-vous lancer aujourd'hui&nbsp;?</p>

            {/* command bar → Brain (créateur uniquement ; l'élève ne pilote pas d'actions) */}
            {isCreator && (
              <button onClick={() => nav('/dashboard/liri')} className="lp-tr lp-soft group mt-7 flex h-14 w-full max-w-xl items-center gap-3 rounded-2xl lp-line border lp-panel px-4 text-left hover:border-[rgba(217,119,87,.4)]">
                <span className="grid h-8 w-8 place-items-center rounded-xl lp-coral lp-coral-tint"><Sparkles size={18} /></span>
                <span className="flex-1 text-[15px] lp-muted">Demandez à {PORTAL_BRAND} ou lancez une action…</span>
                <span className="grid h-7 w-7 place-items-center rounded-lg lp-faint lp-railbtn lp-tr"><Mic size={16} /></span>
                <span className="grid h-9 w-9 place-items-center rounded-xl text-white lp-ember"><ArrowUp size={18} /></span>
              </button>
            )}

            {/* quick actions */}
            <div className="mt-10 flex flex-wrap items-start justify-center gap-x-6 gap-y-7">
              {QUICK.filter((q) => isCreator || !q.creator).map((q) => {
                const Icon = q.icon;
                return (
                  <button key={q.label} onClick={() => (q.hero ? startInstantMeeting() : nav(q.to))} disabled={q.hero && starting} className="group relative flex w-24 flex-col items-center gap-2.5 disabled:cursor-wait disabled:opacity-70">
                    <span className={`lp-tr grid h-24 w-24 place-items-center rounded-[26px] lp-soft lp-lift ${q.hero ? 'text-white lp-ember' : 'lp-line border lp-panel lp-coral lp-hovbtn'}`}><Icon size={q.hero ? 32 : 30} /></span>
                    <span className={`text-[13px] font-medium ${q.hero ? 'lp-ink' : 'lp-muted'}`}>{q.hero && starting ? 'Création…' : q.label}</span>
                  </button>
                );
              })}
            </div>

            {/* reprendre — prochains lives réels ; état vide honnête sinon */}
            <div className="mt-12 w-full max-w-xl">
              <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] lp-faint">Reprendre</p>
              {resumeItems.length > 0 ? (
                <div className="space-y-2">
                  {resumeItems.map((it) => {
                    const Icon = it.icon;
                    return (
                      <button key={it.id} onClick={() => nav(it.to)} className="lp-tr lp-soft flex w-full items-center gap-3 rounded-2xl lp-line border lp-panel70 px-4 py-3 text-left lp-panelhov">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg lp-coral lp-coral-tint"><Icon size={17} /></span>
                        <span className="flex-1 min-w-0"><span className="block truncate text-[13.5px] font-medium">{it.title}</span><span className="block text-[12px] lp-faint">{it.sub}</span></span>
                        <ChevronRight size={18} className="lp-faint" />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <button onClick={() => nav('/studio/live')} className="lp-tr lp-soft flex w-full items-center gap-3 rounded-2xl lp-line border lp-panel70 px-4 py-3.5 text-left lp-panelhov">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg lp-coral lp-coral-tint"><CalendarPlus size={17} /></span>
                  <span className="flex-1 min-w-0"><span className="block text-[13.5px] font-medium">Rien à reprendre pour l’instant</span><span className="block text-[12px] lp-faint">{isCreator ? 'Programmez votre premier live ou créez un cours' : 'Reprends un cours ou un replay dès que tu en commences un'}</span></span>
                  <ChevronRight size={18} className="lp-faint" />
                </button>
              )}
            </div>

            {/* activité récente — lives récents réels ; état vide honnête sinon */}
            <div className="mt-8 w-full max-w-3xl">
              <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] lp-faint">Activité récente</p>
              {activityItems.length > 0 ? (
                <div className="lp-soft overflow-hidden rounded-2xl lp-line border lp-panel70">
                  {activityItems.map((it, idx) => {
                    const Icon = it.icon;
                    const tintCls = it.tint === 'green' ? 'lp-tint-green' : it.tint === 'muted' ? 'lp-tint-muted' : 'lp-coral lp-coral-tint';
                    return (
                      <div key={it.id} className={`flex items-center gap-3.5 px-4 py-3.5 ${idx ? 'border-t lp-line' : ''}`}>
                        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tintCls}`}><Icon size={16} /></span>
                        <div className="min-w-0 flex-1"><p className="truncate text-[13.5px] font-medium">{it.title}</p><p className="text-[12px] lp-faint">{it.sub}</p></div>
                        <span className="text-[11px] lp-faint">{it.when}</span>
                        {it.action && <button onClick={() => it.to && nav(it.to)} className="ml-1 rounded-lg px-2.5 py-1 text-[12px] font-medium lp-coral lp-railbtn lp-tr">{it.action}</button>}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="lp-soft rounded-2xl lp-line border lp-panel70 px-4 py-5 text-center">
                  <p className="text-[13px] lp-faint">Aucune activité pour l’instant — vos lives, replays et inscriptions apparaîtront ici.</p>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* RIGHT PANEL */}
        <aside className="lp-scroll min-h-0 overflow-y-auto border-l lp-line lp-rightbg px-4 py-5">
          {/* horloge */}
          <div className="overflow-hidden rounded-3xl lp-line border lp-soft" style={{ background: 'linear-gradient(160deg,#332e29,#2a2724)' }}>
            <div className="px-5 py-5">
              <p className="lp-serif text-[38px] font-medium leading-none tracking-tight">{timeStr}</p>
              <p className="mt-2 text-[13px] lp-muted capitalize">{dateLong}</p>
            </div>
            <div className="flex items-center justify-between border-t lp-line px-3 py-2 lp-faint">
              <button className="grid h-7 w-7 place-items-center rounded-lg lp-railbtn lp-tr"><Plus size={15} /></button>
              <span className="text-[12px] font-medium lp-muted">Agenda</span>
              <div className="flex gap-0.5"><button className="grid h-7 w-7 place-items-center rounded-lg lp-railbtn lp-tr"><ChevronLeft size={15} /></button><button className="grid h-7 w-7 place-items-center rounded-lg lp-railbtn lp-tr"><ChevronRight size={15} /></button></div>
            </div>
          </div>

          {/* en direct */}
          {liveNow.length > 0 && (
            <button onClick={() => nav('/lives')} className="lp-tr lp-soft mt-3 flex w-full items-center gap-2.5 rounded-2xl border px-3 py-3 text-left" style={{ background: 'rgba(226,85,63,.10)', borderColor: 'rgba(226,85,63,.28)' }}>
              <span className="relative flex h-2.5 w-2.5 shrink-0"><span className="lp-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: 'var(--live)' }} /><span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: 'var(--live)' }} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: '#ef6a52' }}>En direct</span>
                  <span className="flex items-end gap-0.5"><span className="lp-eq" style={{ background: '#ef6a52', animationDelay: '0s' }} /><span className="lp-eq" style={{ background: '#ef6a52', animationDelay: '.25s' }} /><span className="lp-eq" style={{ background: '#ef6a52', animationDelay: '.5s' }} /></span>
                </div>
                <p className="mt-1 truncate text-[12.5px] font-medium lp-ink">{liveNow[0].title || 'Session live'}</p>
              </div>
              <span className="shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-white" style={{ background: 'var(--live)' }}>Rejoindre</span>
            </button>
          )}

          {/* à venir */}
          <div className="mb-2 mt-6 flex items-center justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] lp-faint">À venir</h3>
          </div>
          {upcoming.length > 0 ? (
            <button onClick={() => nav('/lives')} className="lp-tr lp-soft w-full rounded-2xl lp-line border lp-panel70 p-3.5 text-left lp-panelhov">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[13px] font-semibold"><span className="h-2 w-2 rounded-full" style={{ background: 'var(--coral)' }} />{new Date(upcoming[0].scheduled_at!).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="rounded-md px-1.5 py-0.5 text-[10px] font-bold lp-muted" style={{ background: 'rgba(255,255,255,.05)' }}>{fmtWhen(upcoming[0].scheduled_at).split(' · ')[0]}</span>
              </div>
              <p className="mt-2 text-[13.5px] font-medium">{upcoming[0].title || 'Session live'}</p>
              <p className="mt-1 flex items-center gap-1.5 text-[11px] lp-faint capitalize"><UserRound size={12} /> {orgName}</p>
            </button>
          ) : isCreator ? (
            <button onClick={() => nav('/studio/live')} className="lp-tr lp-soft w-full rounded-2xl lp-line border lp-panel70 p-3.5 text-left lp-panelhov">
              <p className="text-[13px] font-medium">Aucun live programmé</p>
              <p className="mt-1 flex items-center gap-1.5 text-[11px] lp-faint"><CalendarPlus size={12} /> Programmer une session</p>
            </button>
          ) : (
            <div className="w-full rounded-2xl lp-line border lp-panel70 p-3.5">
              <p className="text-[13px] font-medium">Aucun live à venir</p>
              <p className="mt-1 text-[11px] lp-faint">Tes prochains lives apparaîtront ici.</p>
            </div>
          )}

          {/* ce mois — métriques CRÉATEUR (sessions/membres/revenus) : masquées pour l'élève */}
          {isCreator && (
            <>
              <h3 className="mb-2 mt-6 text-[11px] font-semibold uppercase tracking-[0.16em] lp-faint">Ce mois</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { v: stats?.totalLives ?? 0, l: 'sessions' },
                  { v: stats?.totalMembers ?? 0, l: 'membres' },
                  { v: liveMinutes, l: 'min en live' },
                  { v: `${euros(stats?.totalRevenueCents)} €`, l: 'revenus', coral: true },
                ].map((s, i) => (
                  <div key={i} className="lp-soft rounded-2xl lp-line border lp-panel70 p-3">
                    <p className={`lp-serif text-[20px] font-medium ${s.coral ? 'lp-coral' : ''}`}>{s.v}</p>
                    <p className="text-[11px] lp-faint">{s.l}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </aside>
      </div>

      {/* ───── FOOTER ───── */}
      <footer className="z-30 flex items-center justify-between border-t lp-line lp-rail-bg px-5 text-[11px] lp-muted">
        <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Connecté · <span className="capitalize">{orgName}</span></span>
        <span className="hidden items-center gap-4 sm:flex">
          {isCreator && (
            <>
              <span className="lp-faint">{liveMinutes} / 2 000 min ce mois</span>
              <span className="h-3 w-px" style={{ background: 'rgba(255,255,255,.10)' }} />
            </>
          )}
          <button onClick={() => nav('/dashboard')} className="lp-railbtn lp-tr rounded px-1">Aide</button>
          <span className="lp-faint flex items-center gap-1.5"><Radio size={12} /> {PORTAL_BRAND} v2.0</span>
        </span>
      </footer>
    </div>
  );
}
