import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Menu, Sparkles, Bell, Settings, House, Video, MessagesSquare, MessageCircle, WandSparkles,
  Library, Blocks, Settings2, Mic, ArrowUp, LogIn, CalendarPlus, PenTool,
  ShoppingBag, Clock, ChevronRight, Film, ChevronLeft, UserRound,
  Radio, GraduationCap, LogOut, ArrowUpRight, AlertTriangle, CalendarDays, Megaphone,
  BookOpen, CheckCircle2, CalendarClock,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { authStore } from '@/lib/auth-store';
import { getCachedHostTenant } from '@/lib/tenantResolver';
import { getApiBaseUrl } from '@/lib/apiBase';
import { useAuth } from '@/hooks/useAuth';
import { isCreatorRole } from '@/lib/liri/creatorRole';
import { useSchoolActive } from '@/hooks/useSchoolActive';
import { useUpcomingSchoolFeed } from '@/hooks/useUpcomingSchoolFeed';
import { LiriRailGroups, getRailItems, LiriEngineSwitcher } from '@/components/liri/liriRail';
import activeTenantConfig from '@/lib/tenant/activeTenantConfig';
import LiriUpgradeWall from '@/components/liri/LiriUpgradeWall';
import '../LiriPortal.css';

// Marque blanche par tenant : sur le domaine d'un tenant (ex. prorascience.org), le
// portail porte le nom du tenant et n'expose JAMAIS « LIRI » ; sur l'hôte produit LIRI
// (liri.cimolace.space) il reste « LIRI ». activeTenantConfig = résolu par l'hôte.
const PORTAL_IS_TENANT = !!(activeTenantConfig && activeTenantConfig.slug);
const PORTAL_BRAND =
  (activeTenantConfig && activeTenantConfig.branding && activeTenantConfig.branding.name) || 'LIRI';
// Logo du tenant (ex. Œil d'Horus pour Prorascience). Sur un tenant, on affiche SON logo
// (jamais le logo LIRI) ; sans logo → rien (juste le nom). Même règle anti-fuite que le shell.
const _portalRawLogo = (activeTenantConfig && activeTenantConfig.branding && activeTenantConfig.branding.logo) || '';
const PORTAL_LOGO =
  PORTAL_IS_TENANT && _portalRawLogo && _portalRawLogo !== '/lirilogo.png' && _portalRawLogo !== '/liri-logo-mark.png'
    ? _portalRawLogo
    : '';

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
  const [showUpgrade, setShowUpgrade] = useState(false);

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

  // Fil « À venir » + agenda + inscriptions élève (RLS tenant-scopé), fusionnés aux lives.
  const { items: feed, agenda, courses } = useUpcomingSchoolFeed(upcoming, user?.id);

  // Mini-agenda du jour (carte horloge) : jour sélectionné + ses items, navigable ‹ Auj. ›.
  const [dayOffset, setDayOffset] = useState(0);
  const selectedDay = useMemo(() => { const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + dayOffset); return d; }, [now, dayOffset]);
  const dayItems = useMemo(() => agenda.filter((it) => { const w = new Date(it.when); w.setHours(0, 0, 0, 0); return +w === +selectedDay; }), [agenda, selectedDay]);
  const agendaLabel = dayOffset === 0 ? "Aujourd'hui" : selectedDay.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' });

  // Rôle (créateur vs élève) — déclaré ICI car resumeItems/activityItems en dépendent.
  const isCreator = isCreatorRole(tenantRole, org?.role);

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

  // « Reprendre » — RÔLE-ADAPTATIF : élève = cours en cours (student_progress, RÉEL) ;
  // créateur = prochains lives. (Avant : lives seulement → toujours vide pour l'élève.)
  const resumeItems = useMemo<ResumeItem[]>(() => {
    if (isCreator) {
      return upcoming.slice(0, 2).map((l) => ({
        id: l.id, icon: Clock, title: l.title || 'Session live',
        sub: `${fmtWhen(l.scheduled_at)}${l.price_cents ? ` · ${euros(l.price_cents)} €` : ' · gratuit'}`,
        to: '/lives',
      }));
    }
    return courses.filter((c) => c.status === 'in_progress').slice(0, 2).map((c) => ({
      id: c.id, icon: BookOpen, title: c.title, sub: 'Reprendre le cours', to: '/liri/formations',
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreator, upcoming, courses]);

  // « Activité récente » — RÔLE-ADAPTATIF : élève = ses inscriptions récentes (terminées /
  // en cours, RÉEL) ; créateur = lives récents.
  const activityItems = useMemo<ActivityItem[]>(() => {
    if (isCreator) {
      return recent.map((l) => ({
        id: l.id, icon: l.ended_at ? Film : WandSparkles, tint: 'coral' as const,
        title: l.title || 'Session live',
        sub: l.ended_at ? 'replay disponible' : l.started_at ? 'en cours' : 'programmé',
        when: fmtAgo(l.scheduled_at),
        action: l.ended_at ? 'Ouvrir' : undefined,
        to: '/lives',
      }));
    }
    return courses.slice(0, 4).map((c) => ({
      id: c.id, icon: c.status === 'completed' ? CheckCircle2 : BookOpen,
      tint: (c.status === 'completed' ? 'green' : 'coral') as const,
      title: c.title, sub: c.status === 'completed' ? 'Terminé' : 'En cours',
      when: fmtAgo(c.whenIso || undefined), action: 'Ouvrir', to: '/liri/formations',
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCreator, recent, courses]);

  function fmtWhen(iso?: string) {
    if (!iso) return '';
    const d = new Date(iso);
    const sameDay = d.toDateString() === now.toDateString();
    const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return sameDay ? `aujourd'hui · ${time}` : `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · ${time}`;
  }
  function euros(cents?: number) { return ((cents ?? 0) / 100).toLocaleString('fr-FR'); }

  // Le rail (nav latérale) vient de la SOURCE UNIQUE `LiriRailGroups` (partagée avec
  // LiriPortalShell) → accueil et sous-pages ont exactement la même nav groupée.
  // `creator` → réservé créateur ; `student` → réservé élève ; sans flag → tout le monde.
  const QUICK: { label: string; icon: LucideIcon; to: string; hero?: boolean; creator?: boolean; student?: boolean }[] = [
    { label: 'Démarrer', icon: Video, hero: true, to: '/lives', creator: true },
    { label: 'Rejoindre', icon: LogIn, to: '/lives' },
    { label: 'Forum', icon: MessagesSquare, to: '/liri/forum' },
    // Raccourcis APPRENTISSAGE / SCOLARITÉ (élève seulement).
    { label: 'Mes cours', icon: BookOpen, to: '/liri/formations', student: true },
    { label: 'Ma semaine', icon: CalendarDays, to: '/liri/semaine', student: true },
    { label: 'Rendez-vous', icon: CalendarClock, to: '/liri/rendez-vous', student: true },
    { label: 'Programmer', icon: CalendarPlus, to: '/studio/live', creator: true },
    { label: 'SmartBoard', icon: PenTool, to: '/studio/smartboard', creator: true },
    // Le Précepteur — cours enseigné (narré + dessiné main), monté DANS le portail
    // (LiriPrecepteurPage → LiriPortalShell rail « École »). Route publique /liri/precepteur.
    // PARTAGÉ (sans flag) : pertinent pour l'élève (lancer une leçon) ET le créateur (démo).
    { label: 'Précepteur', icon: GraduationCap, to: '/liri/precepteur' },
    { label: 'Acheter', icon: ShoppingBag, to: '/dashboard', creator: true },
  ];

  const openMenu = () => setMenuOpen((v) => !v);
  const runMenu = (fn: () => void) => { setMenuOpen(false); fn(); };

  // L'ÉLÈVE RESTE dans le portail LIRI, mais en vue ADAPTÉE : tout l'outillage
  // créateur (Studio, Programmer, Acheter, École-gestion, Intégr, Réglages,
  // métriques revenus/quota) est masqué plus bas via `isCreator` (déclaré plus haut,
  // AVANT resumeItems/activityItems qui en dépendent). Plus de
  // redirection vers l'ancienne « Vie scolaire » — un seul monde : LIRI.
  // LIRI 2 modes : ÉCOLE (service `school` actif) ajoute la Vie scolaire au rail ;
  // SIMPLE (Zoom) = Accueil/Lives/Forum/Messages seulement. Fail-closed.
  const schoolActive = useSchoolActive() === true;

  // Items du rail (filtrés rôle + mode école) pour la barre de nav basse mobile (< md).
  const mobileNavItems = getRailItems({ isCreator, schoolActive, engine: 'liri' });

  return (
    <div className="lp-root relative h-[100dvh] w-full overflow-hidden grid grid-rows-[56px_1fr_auto]">
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
            {PORTAL_IS_TENANT
              ? (PORTAL_LOGO ? <img src={PORTAL_LOGO} alt={PORTAL_BRAND} className="h-9 w-9 rounded-lg object-contain" /> : null)
              : <img src="/lirilogo.png" alt="LIRI" className="h-9 w-9 object-contain" />}
            <span className="text-[17px] font-semibold tracking-tight">{PORTAL_BRAND}</span>
          </span>
        </div>
        {/* SÉLECTEUR DE MOTEUR — recharge le rail. Centré, comme sur les sous-pages (LiriPortalShell). */}
        <div className="flex min-w-0 flex-1 items-center justify-center px-2">
          <LiriEngineSwitcher activeEngine="liri" isCreator={isCreator} schoolActive={schoolActive} onNav={nav} />
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
                  <button role="menuitem" onClick={() => runMenu(() => setShowUpgrade(true))}
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

      {/* ───── MIDDLE : rail | main | right ─────  (immersif : pas de gap/padding externe, rails collés)
          Mobile (< md) : 1 colonne (contenu seul, rail → barre basse). md : rail + contenu.
          xl : + panneau droit (horloge/agenda) — masqué avant pour éviter le tassement. */}
      <div className="z-10 grid min-h-0 grid-cols-[1fr] md:grid-cols-[92px_1fr] xl:grid-cols-[92px_1fr_344px]">

        {/* RAIL — desktop uniquement (≥ md) */}
        <aside className="hidden min-h-0 flex-col items-center gap-0.5 overflow-y-auto lp-rail-bg border-r lp-line py-3 lp-rail-scroll md:flex">
          <LiriRailGroups engine="liri" active="accueil" isCreator={isCreator} schoolActive={schoolActive} live={liveNow.length > 0} onNav={nav} />
          {isCreator && (
            <>
              <div className="my-1 h-px w-9" style={{ background: 'rgba(245,244,238,.08)' }} />
              <button onClick={() => nav('/liri')} className="lp-nav flex w-[74px] flex-col items-center gap-0.5 rounded-2xl py-2 lp-tr"><span className="lp-ni grid h-6 w-6 place-items-center"><Blocks size={19} /></span><span className="lp-nl text-[9px] font-medium">Intégr.</span></button>
              <button onClick={() => nav('/liri/compte')} className="lp-nav flex w-[74px] flex-col items-center gap-0.5 rounded-2xl py-2 lp-tr"><span className="lp-ni grid h-6 w-6 place-items-center"><Settings2 size={19} /></span><span className="lp-nl text-[9px] font-medium">Réglages</span></button>
            </>
          )}
          <button onClick={openMenu} title={orgName} aria-label="Compte et organisation" className="mt-2 grid h-9 w-9 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white lp-tr lp-railbtn" style={{ background: 'linear-gradient(135deg,#5b7a52,#6d8f60)' }}>{orgName.slice(0, 2).toUpperCase()}</button>
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
              {QUICK.filter((q) => (q.creator ? isCreator : q.student ? !isCreator : true)).map((q) => {
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
                <button onClick={() => nav(isCreator ? '/studio/live' : '/liri/formations')} className="lp-tr lp-soft flex w-full items-center gap-3 rounded-2xl lp-line border lp-panel70 px-4 py-3.5 text-left lp-panelhov">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg lp-coral lp-coral-tint">{isCreator ? <CalendarPlus size={17} /> : <BookOpen size={17} />}</span>
                  <span className="flex-1 min-w-0"><span className="block text-[13.5px] font-medium">Rien à reprendre pour l’instant</span><span className="block text-[12px] lp-faint">{isCreator ? 'Programmez votre premier live ou créez un cours' : 'Reprends un cours dès que tu en commences un'}</span></span>
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

        {/* RIGHT PANEL — grands écrans uniquement (≥ xl) ; masqué avant pour ne pas tasser le contenu. */}
        <aside className="hidden min-h-0 overflow-y-auto border-l lp-line lp-rightbg px-4 py-5 lp-scroll xl:block">
          {/* horloge + mini-agenda du jour (navigable ‹ Auj. ›) */}
          <div className="overflow-hidden rounded-3xl lp-line border lp-soft" style={{ background: 'linear-gradient(160deg,#332e29,#2a2724)' }}>
            <div className="px-5 py-5">
              <p className="lp-serif text-[38px] font-medium leading-none tracking-tight">{timeStr}</p>
              <p className="mt-2 text-[13px] lp-muted capitalize">{dateLong}</p>
            </div>
            <div className="border-t lp-line">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] lp-faint capitalize">{agendaLabel}</span>
                <div className="flex items-center gap-0.5">
                  <button onClick={() => setDayOffset((d) => d - 1)} aria-label="Jour précédent" className="grid h-7 w-7 place-items-center rounded-lg lp-railbtn lp-tr"><ChevronLeft size={15} /></button>
                  {dayOffset !== 0 && <button onClick={() => setDayOffset(0)} className="rounded-lg px-2 py-1 text-[11px] font-medium lp-muted lp-tr">Auj.</button>}
                  <button onClick={() => setDayOffset((d) => d + 1)} aria-label="Jour suivant" className="grid h-7 w-7 place-items-center rounded-lg lp-railbtn lp-tr"><ChevronRight size={15} /></button>
                </div>
              </div>
              <div className="px-3 pb-3">
                {dayItems.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    {dayItems.slice(0, 4).map((it) => (
                      <button key={it.id} onClick={() => nav('/liri/agenda')} className="lp-tr lp-panelhov flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left">
                        <span className="shrink-0 text-[11px] font-semibold tabular-nums" style={{ color: 'var(--coral)' }}>{it.when.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="truncate text-[12px] lp-ink">{it.title}</span>
                        {it.isExam && <span className="ml-auto shrink-0 rounded px-1 py-0.5 text-[9px] font-bold uppercase lp-muted" style={{ background: 'rgba(255,255,255,.06)' }}>Éval</span>}
                      </button>
                    ))}
                  </div>
                ) : (
                  <button onClick={() => nav('/liri/agenda')} className="lp-tr flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left">
                    <CalendarDays size={13} className="lp-faint" />
                    <span className="text-[12px] lp-faint">Rien de prévu · ouvrir l'agenda</span>
                  </button>
                )}
              </div>
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

          {/* à venir — fil VIE SCOLAIRE priorisé : annonces urgentes + événements ≤7j + examens + lives */}
          <div className="mb-2 mt-6 flex items-center justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] lp-faint">À venir</h3>
            {feed.length > 0 && <button onClick={() => nav('/liri/vie-scolaire')} className="lp-tr text-[11px] font-medium lp-muted">Tout voir</button>}
          </div>
          {feed.length > 0 ? (
            <div className="flex flex-col gap-2">
              {feed.map((it) => {
                const Icon = it.kind === 'announcement' ? (it.urgent ? AlertTriangle : Megaphone) : it.kind === 'event' ? CalendarDays : it.kind === 'exam' ? GraduationCap : Radio;
                const t = it.when ? it.when.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : null;
                const dchip = it.when ? (it.when.toDateString() === now.toDateString() ? "auj." : it.when.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })) : null;
                const badge = it.urgent ? 'Urgent' : it.kind === 'announcement' ? 'Annonce' : (t ? `${dchip} · ${t}` : dchip);
                return (
                  <button key={it.id} onClick={() => nav(it.to)}
                    className="lp-tr lp-soft w-full rounded-2xl lp-line border lp-panel70 p-3 text-left lp-panelhov"
                    style={it.urgent ? { borderColor: 'rgba(226,85,63,.34)', background: 'rgba(226,85,63,.08)' } : undefined}>
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl"
                        style={{ background: it.urgent ? 'rgba(226,85,63,.16)' : 'rgba(255,255,255,.05)', color: it.urgent ? 'var(--coral)' : undefined }}>
                        <Icon size={15} className={it.urgent ? '' : 'lp-muted'} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium lp-ink">{it.title}</p>
                        <p className="mt-0.5 truncate text-[11px] lp-faint">{it.sub}</p>
                      </div>
                      <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${it.urgent ? '' : 'lp-muted'}`}
                        style={{ background: it.urgent ? 'var(--coral)' : 'rgba(255,255,255,.05)', color: it.urgent ? '#fff' : undefined }}>
                        {badge}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : isCreator ? (
            <button onClick={() => nav('/studio/live')} className="lp-tr lp-soft w-full rounded-2xl lp-line border lp-panel70 p-3.5 text-left lp-panelhov">
              <p className="text-[13px] font-medium">Rien de programmé</p>
              <p className="mt-1 flex items-center gap-1.5 text-[11px] lp-faint"><CalendarPlus size={12} /> Programmer une session</p>
            </button>
          ) : (
            <div className="w-full rounded-2xl lp-line border lp-panel70 p-3.5">
              <p className="text-[13px] font-medium">Rien d'urgent — tu es à jour.</p>
              <p className="mt-1 text-[11px] lp-faint">Annonces, événements et lives apparaîtront ici.</p>
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

      {/* ───── RANGÉE BASSE : barre de nav (mobile, < md) OU footer (desktop, ≥ md) ───── */}
      <div className="z-30 min-w-0">
        <nav className="flex items-stretch gap-1 overflow-x-auto no-scrollbar border-t lp-line lp-rail-bg px-2 py-1.5 md:hidden" aria-label="Navigation principale">
          {mobileNavItems.map((it) => {
            const Icon = it.icon;
            const isActive = it.key === 'accueil';
            return (
              <button key={it.key} onClick={() => nav(it.to)}
                aria-current={isActive ? 'page' : undefined}
                className={`lp-nav flex min-h-[44px] min-w-[60px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 lp-tr ${isActive ? 'lp-nav-active' : ''}`}>
                <span className="lp-ni relative grid h-5 w-5 place-items-center">
                  <Icon size={18} />
                  {it.key === 'lives' && liveNow.length > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 h-2 w-2 rounded-full" style={{ background: 'var(--live)', boxShadow: '0 0 0 2px var(--rail)' }} />
                  )}
                </span>
                <span className="lp-nl text-center text-[9px] font-medium leading-none">{it.label}</span>
              </button>
            );
          })}
        </nav>
        <footer className="hidden items-center justify-between border-t lp-line lp-rail-bg px-5 py-1.5 text-[11px] lp-muted md:flex">
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
      {showUpgrade && <LiriUpgradeWall asModal onClose={() => setShowUpgrade(false)} />}
    </div>
  );
}
