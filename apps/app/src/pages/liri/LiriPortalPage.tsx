import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Menu, Sparkles, Bell, Settings, House, Video, MessagesSquare, MessageCircle, WandSparkles,
  Library, Blocks, Settings2, Mic, ArrowUp, LogIn, CalendarPlus, PenTool,
  ShoppingBag, Clock, ChevronRight, Film, ChevronLeft, UserRound, Plus,
  Clapperboard, Radio, FilePenLine, BadgeDollarSign, Webhook,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { authStore } from '@/lib/auth-store';
import { getApiBaseUrl } from '@/lib/apiBase';
import '../LiriPortal.css';

interface Live { id: string; title?: string; status?: string; scheduled_at?: string; started_at?: string | null; ended_at?: string | null; price_cents?: number; }
interface Stats { totalMembers: number; totalLives: number; totalCourses: number; totalRevenueCents: number; }

interface ResumeItem { id: string; icon: LucideIcon; title: string; sub: string; to: string; }
interface ActivityItem { id: string; icon: LucideIcon; tint?: 'coral' | 'green' | 'muted'; title: string; sub: string; when: string; action?: string; to?: string; }

/* Repli « démo » aligné sur la maquette docs/liri-portal-accueil.mockup.html.
   Affiché uniquement quand l'API ne renvoie pas encore de données réelles,
   afin que le portail ne paraisse jamais vide. */
const DEMO_RESUME: ResumeItem[] = [
  { id: 'r1', icon: Clock, title: 'Masterclass React — dans 1 h 53', sub: "Salle d'attente ouverte · 48 inscrits", to: '/dashboard/lives' },
  { id: 'r2', icon: FilePenLine, title: 'Brouillon — « Les portes du monde »', sub: 'Formation Builder · 35 %', to: '/studio/liri/formation' },
];
const DEMO_ACTIVITY: ActivityItem[] = [
  { id: 'a1', icon: Film, tint: 'coral', title: 'Replay « Chapitre 3 — Katiokeni » prêt', sub: 'Post-production disponible', when: '12 min', action: 'Ouvrir', to: '/studio/liri/bibliotheque' },
  { id: 'a2', icon: WandSparkles, tint: 'coral', title: 'Masterclass #4 générée — 19 slides', sub: 'via Orchestrateur Live', when: '1 h' },
  { id: 'a3', icon: BadgeDollarSign, tint: 'green', title: 'Nouvelle inscription payante — 25 €', sub: 'Masterclass React', when: '2 h' },
  { id: 'a4', icon: Webhook, tint: 'muted', title: '2 webhooks livrés à isna.app', sub: 'événement session:ended', when: '3 h' },
];

export function LiriPortalPage() {
  const nav = useNavigate();
  const base = getApiBaseUrl();
  const token = authStore.getToken();
  const slug = authStore.getTenantSlug();
  const tenant = (slug || 'École').replace(/-/g, ' ');

  const [now, setNow] = useState(() => new Date());
  const [stats, setStats] = useState<Stats | null>(null);
  const [lives, setLives] = useState<Live[]>([]);
  const [starting, setStarting] = useState(false);

  // « Démarrer » = réunion instantanée façon Zoom : crée une session live à la volée,
  // la démarre, et ouvre directement le LiveHostPage (coque LIRI neutre). Repli = wizard.
  const startInstantMeeting = async () => {
    if (starting) return;
    setStarting(true);
    try {
      const h = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Tenant-Slug': slug } as Record<string, string>;
      const res = await fetch(`${base}/lives`, {
        method: 'POST',
        headers: h,
        body: JSON.stringify({ title: 'Réunion instantanée', scheduled_at: new Date().toISOString(), price_cents: 0, currency: 'EUR' }),
      });
      const j = await res.json().catch(() => ({}));
      // Dépile l'enveloppe ({data:{data:{id}}} via l'intercepteur global) jusqu'à la session.
      let d: any = j;
      while (d && typeof d === 'object' && !('id' in d) && 'data' in d) d = d.data;
      const id = d?.id;
      if (!id) throw new Error('reunion sans id');
      // Démarrage immédiat (best-effort — l'hôte peut aussi démarrer depuis l'arène).
      try { await fetch(`${base}/lives/${id}/start`, { method: 'POST', headers: h }); } catch { /* noop */ }
      nav(`/live/host/${id}?tenant=${encodeURIComponent(slug)}`);
    } catch {
      nav('/dashboard/lives/new'); // repli : wizard de création classique
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(t); }, []);

  useEffect(() => {
    if (!token) return;
    const h = { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': slug } as Record<string, string>;
    fetch(`${base}/growth/stats`, { headers: h }).then((r) => r.json()).then((d) => setStats(d?.data ?? d)).catch(() => {});
    fetch(`${base}/lives`, { headers: h }).then((r) => r.json()).then((d) => { const a = d?.data ?? d; setLives(Array.isArray(a) ? a : []); }).catch(() => {});
  }, [base, token, slug]);

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

  // « Reprendre » : prochains lives → repli démo si rien de programmé.
  const resumeItems = useMemo<ResumeItem[]>(() => {
    if (upcoming.length === 0) return DEMO_RESUME;
    return upcoming.slice(0, 2).map((l) => ({
      id: l.id,
      icon: Clock,
      title: l.title || 'Session live',
      sub: `${fmtWhen(l.scheduled_at)}${l.price_cents ? ` · ${euros(l.price_cents)} €` : ' · gratuit'}`,
      to: '/dashboard/lives',
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upcoming]);

  // « Activité récente » : lives récents → repli démo si rien.
  const activityItems = useMemo<ActivityItem[]>(() => {
    if (recent.length === 0) return DEMO_ACTIVITY;
    return recent.map((l) => ({
      id: l.id,
      icon: l.ended_at ? Film : WandSparkles,
      tint: 'coral' as const,
      title: l.title || 'Session live',
      sub: l.ended_at ? 'replay disponible' : l.started_at ? 'en cours' : 'programmé',
      when: fmtAgo(l.scheduled_at),
      action: l.ended_at ? 'Ouvrir' : undefined,
      to: '/dashboard/lives',
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recent]);

  function fmtWhen(iso?: string) {
    if (!iso) return '';
    const d = new Date(iso);
    const sameDay = d.toDateString() === now.toDateString();
    const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return sameDay ? `aujourd'hui · ${time}` : `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · ${time}`;
  }
  function euros(cents?: number) { return ((cents ?? 0) / 100).toLocaleString('fr-FR'); }

  const RAIL: { key: string; label: string; icon: LucideIcon; to: string; active?: boolean; live?: boolean; badge?: number }[] = [
    { key: 'accueil', label: 'Accueil', icon: House, to: '/liri', active: true },
    { key: 'lives', label: 'Lives', icon: Video, to: '/dashboard/lives', live: liveNow.length > 0 },
    { key: 'forum', label: 'Forum', icon: MessagesSquare, to: '/dashboard', badge: 5 },
    { key: 'messages', label: 'Messages', icon: MessageCircle, to: '/messages' },
    { key: 'studio', label: 'Studio', icon: WandSparkles, to: '/studio/liri' },
    { key: 'biblio', label: 'Biblio.', icon: Library, to: '/studio/liri/bibliotheque' },
    { key: 'brain', label: 'Brain', icon: Sparkles, to: '/dashboard/liri' },
  ];
  const QUICK = [
    { label: 'Démarrer', icon: Video, hero: true, to: '/dashboard/lives/new' },
    { label: 'Rejoindre', icon: LogIn, to: '/dashboard/lives' },
    { label: 'Converser', icon: MessageCircle, to: '/messages' },
    { label: 'Programmer', icon: CalendarPlus, to: '/dashboard/lives/new' },
    { label: 'SmartBoard', icon: PenTool, to: '/studio/smartboard' },
    { label: 'Acheter', icon: ShoppingBag, to: '/dashboard' },
  ];

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
            <span className="grid h-7 w-7 place-items-center rounded-[10px] text-white lp-ember"><Sparkles size={15} /></span>
            <span className="text-[17px] font-semibold tracking-tight">LIRI</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button className="relative grid h-8 w-8 place-items-center rounded-xl lp-muted lp-railbtn lp-tr" aria-label="Notifications"><Bell size={17} /><span className="absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full" style={{ background: 'var(--coral)' }} /></button>
          <button onClick={() => nav('/dashboard')} className="grid h-8 w-8 place-items-center rounded-xl lp-muted lp-railbtn lp-tr" aria-label="Paramètres"><Settings size={17} /></button>
          <span className="ml-1 grid h-8 w-8 place-items-center rounded-full text-[12px] font-semibold text-white lp-ember">{tenant.slice(0, 2).toUpperCase()}</span>
        </div>
      </header>

      {/* ───── MIDDLE : rail | main | right ───── */}
      <div className="z-10 grid min-h-0 grid-cols-[100px_1fr_344px] gap-3 p-3 pt-1">

        {/* RAIL */}
        <aside className="flex min-h-0 flex-col items-center gap-1 rounded-3xl lp-rail-bg lp-line border py-4 lp-soft">
          {RAIL.map((it) => {
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
          <div className="my-1.5 h-px w-9" style={{ background: 'rgba(245,244,238,.08)' }} />
          <button onClick={() => nav('/dashboard')} className="lp-nav flex w-[72px] flex-col items-center gap-1 rounded-2xl py-2.5 lp-tr"><span className="lp-ni grid h-7 w-7 place-items-center"><Blocks size={20} /></span><span className="lp-nl text-[10px] font-medium">Intégr.</span></button>
          <button onClick={() => nav('/dashboard')} className="lp-nav flex w-[72px] flex-col items-center gap-1 rounded-2xl py-2.5 lp-tr"><span className="lp-ni grid h-7 w-7 place-items-center"><Settings2 size={20} /></span><span className="lp-nl text-[10px] font-medium">Réglages</span></button>
          <button className="mt-auto grid h-9 w-9 place-items-center rounded-full text-[11px] font-bold text-white lp-tr lp-railbtn" style={{ background: 'linear-gradient(135deg,#5b7a52,#6d8f60)' }} title={tenant}>{tenant.slice(0, 2).toUpperCase()}</button>
        </aside>

        {/* MAIN — Accueil */}
        <main className="lp-scroll relative min-h-0 overflow-y-auto">
          <div className="mx-auto flex min-h-full max-w-4xl flex-col items-center px-6 pt-12 pb-10">
            <p className="text-[13px] font-medium uppercase tracking-[0.18em] lp-faint lp-rise">{dateLong} · {timeStr}</p>
            <h1 className="mt-3 text-center lp-serif text-[34px] font-medium leading-tight tracking-tight lp-rise">{greet}<span className="lp-coral"> sur LIRI</span></h1>
            <p className="mt-2 text-center text-[14px] lp-muted lp-rise">Que voulez-vous lancer aujourd'hui&nbsp;?</p>

            {/* command bar → Brain */}
            <button onClick={() => nav('/dashboard/liri')} className="lp-tr lp-soft group mt-7 flex h-14 w-full max-w-xl items-center gap-3 rounded-2xl lp-line border lp-panel px-4 text-left hover:border-[rgba(217,119,87,.4)]">
              <span className="grid h-8 w-8 place-items-center rounded-xl lp-coral lp-coral-tint"><Sparkles size={18} /></span>
              <span className="flex-1 text-[15px] lp-muted">Demandez à LIRI ou lancez une action…</span>
              <span className="grid h-7 w-7 place-items-center rounded-lg lp-faint lp-railbtn lp-tr"><Mic size={16} /></span>
              <span className="grid h-9 w-9 place-items-center rounded-xl text-white lp-ember"><ArrowUp size={18} /></span>
            </button>

            {/* quick actions */}
            <div className="mt-10 flex flex-wrap items-start justify-center gap-x-6 gap-y-7">
              {QUICK.map((q) => {
                const Icon = q.icon;
                return (
                  <button key={q.label} onClick={() => (q.hero ? startInstantMeeting() : nav(q.to))} disabled={q.hero && starting} className="group relative flex w-24 flex-col items-center gap-2.5 disabled:cursor-wait disabled:opacity-70">
                    {q.badge && <span className="absolute -top-2 right-2 z-10 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[9px] font-bold text-white" style={{ background: 'var(--coral)' }}>{q.badge}</span>}
                    <span className={`lp-tr grid h-24 w-24 place-items-center rounded-[26px] lp-soft lp-lift ${q.hero ? 'text-white lp-ember' : 'lp-line border lp-panel lp-coral lp-hovbtn'}`}><Icon size={q.hero ? 32 : 30} /></span>
                    <span className={`text-[13px] font-medium ${q.hero ? 'lp-ink' : 'lp-muted'}`}>{q.hero && starting ? 'Création…' : q.label}</span>
                  </button>
                );
              })}
            </div>

            {/* reprendre — prochains lives + travaux en cours (repli démo) */}
            {resumeItems.length > 0 && (
              <div className="mt-12 w-full max-w-xl">
                <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] lp-faint">Reprendre</p>
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
              </div>
            )}

            {/* activité récente — lives récents + événements (repli démo) */}
            {activityItems.length > 0 && (
              <div className="mt-8 w-full max-w-3xl">
                <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] lp-faint">Activité récente</p>
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
              </div>
            )}
          </div>
        </main>

        {/* RIGHT PANEL */}
        <aside className="lp-scroll min-h-0 overflow-y-auto rounded-3xl lp-rightbg px-4 py-5 lp-soft">
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
            <button onClick={() => nav('/dashboard/lives')} className="lp-tr lp-soft mt-3 flex w-full items-center gap-2.5 rounded-2xl border px-3 py-3 text-left" style={{ background: 'rgba(226,85,63,.10)', borderColor: 'rgba(226,85,63,.28)' }}>
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
            <span className="rounded-md px-1.5 py-0.5 text-[10px] font-medium lp-faint" style={{ background: 'rgba(255,255,255,.05)' }}>Cycle académique</span>
          </div>
          {upcoming.length > 0 ? (
            <button onClick={() => nav('/dashboard/lives')} className="lp-tr lp-soft w-full rounded-2xl lp-line border lp-panel70 p-3.5 text-left lp-panelhov">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[13px] font-semibold"><span className="h-2 w-2 rounded-full" style={{ background: 'var(--coral)' }} />{new Date(upcoming[0].scheduled_at!).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="rounded-md px-1.5 py-0.5 text-[10px] font-bold lp-muted" style={{ background: 'rgba(255,255,255,.05)' }}>{fmtWhen(upcoming[0].scheduled_at).split(' · ')[0]}</span>
              </div>
              <p className="mt-2 text-[13.5px] font-medium">{upcoming[0].title || 'Session live'}</p>
              <p className="mt-1 flex items-center gap-1.5 text-[11px] lp-faint capitalize"><UserRound size={12} /> {tenant}</p>
            </button>
          ) : (
            <div className="lp-soft w-full rounded-2xl lp-line border lp-panel70 p-3.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[13px] font-semibold"><span className="h-2 w-2 rounded-full" style={{ background: 'var(--coral)' }} />20:00 – 22:00</span>
                <span className="rounded-md px-1.5 py-0.5 text-[10px] font-bold lp-muted" style={{ background: 'rgba(255,255,255,.05)' }}>demain</span>
              </div>
              <p className="mt-2 text-[13.5px] font-medium">ISNA — Classe Académique (a)</p>
              <p className="mt-1 flex items-center gap-1.5 text-[11px] lp-faint capitalize"><UserRound size={12} /> {tenant} · récurrent</p>
            </div>
          )}

          {/* ce mois */}
          <h3 className="mb-2 mt-6 text-[11px] font-semibold uppercase tracking-[0.16em] lp-faint">Ce mois</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { v: stats?.totalLives ?? 12, l: 'sessions' },
              { v: stats?.totalMembers ?? '1.2k', l: 'participants' },
              { v: stats ? `${stats.totalLives * 70}` : '847', l: 'min en live' },
              { v: `${stats ? euros(stats.totalRevenueCents) : '3 420'} €`, l: 'revenus', coral: true },
            ].map((s, i) => (
              <div key={i} className="lp-soft rounded-2xl lp-line border lp-panel70 p-3">
                <p className={`lp-serif text-[20px] font-medium ${s.coral ? 'lp-coral' : ''}`}>{s.v}</p>
                <p className="text-[11px] lp-faint">{s.l}</p>
              </div>
            ))}
          </div>

          {/* à traiter — replays en attente de post-production */}
          <button onClick={() => nav('/studio/liri/bibliotheque')} className="lp-tr lp-soft mt-4 flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left lp-panelhov" style={{ borderColor: 'rgba(217,119,87,.25)', background: 'rgba(217,119,87,.08)' }}>
            <span className="grid h-8 w-8 place-items-center rounded-lg lp-coral" style={{ background: 'rgba(217,119,87,.16)' }}><Clapperboard size={17} /></span>
            <span className="flex-1"><span className="block text-[13px] font-medium">3 replays à traiter</span><span className="block text-[11px] lp-faint">post-production en attente</span></span>
            <ChevronRight size={17} className="lp-faint" />
          </button>
        </aside>
      </div>

      {/* ───── FOOTER ───── */}
      <footer className="z-30 flex items-center justify-between border-t lp-line lp-rail-bg px-5 text-[11px] lp-muted">
        <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Connecté · <span className="capitalize">{tenant}</span></span>
        <span className="hidden items-center gap-4 sm:flex">
          <span className="lp-faint">{stats ? stats.totalLives * 70 : 847} / 2 000 min ce mois</span>
          <span className="h-3 w-px" style={{ background: 'rgba(255,255,255,.10)' }} />
          <button onClick={() => nav('/dashboard')} className="lp-railbtn lp-tr rounded px-1">Aide</button>
          <span className="lp-faint flex items-center gap-1.5"><Radio size={12} /> LIRI v2.0</span>
        </span>
      </footer>
    </div>
  );
}
