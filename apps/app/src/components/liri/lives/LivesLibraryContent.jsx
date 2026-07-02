import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDataSync } from '@/contexts/DataSyncContext';
import { authStore } from '@/lib/auth-store';
import { getApiBaseUrl } from '@/lib/apiBase';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PlayCircle, Calendar, Clock, Search, LayoutGrid, List as ListIcon, Sparkles, ChevronRight, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import { ELEVE_MOBILE } from '@/lib/eleveMobileRoutes';

/** Date sûre (gère null / invalide). */
const safeDate = (v) => {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};
const fmtDateTime = (v) => {
  const d = safeDate(v);
  return d ? `${d.toLocaleDateString()} à ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Date à confirmer';
};
const fmtDate = (v) => {
  const d = safeDate(v);
  return d ? d.toLocaleDateString() : '';
};

/**
 * Liste lives (à venir + replays) — curriculum + lives RÉELS du Studio.
 * Recherche intelligente, filtres, vue grille/liste, suggestions « Pour toi ».
 * @param {'default' | 'liriMobile'} variant
 */
export default function LivesLibraryContent({ variant = 'default' }) {
  const { years = [] } = useDataSync();

  // Lives RÉELS créés au Studio (table live_sessions, scopés au tenant via l'API).
  const [sessions, setSessions] = useState([]);
  useEffect(() => {
    const token = authStore.getToken?.();
    if (!token) return;
    let alive = true;
    fetch(`${getApiBaseUrl()}/lives`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': authStore.getTenantSlug?.() || '' },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { const a = d?.data ?? d; if (alive && Array.isArray(a)) setSessions(a); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const { upcomingLives, pastLives } = useMemo(() => {
    const upcoming = [];
    const past = [];
    (Array.isArray(years) ? years : []).forEach((y) =>
      (Array.isArray(y?.modules) ? y.modules : []).forEach((m) =>
        (Array.isArray(m?.weeks) ? m.weeks : []).forEach((w) => {
          [w?.openingLive, w?.closingLive].forEach((live) => {
            if (!live) return;
            const liveData = { ...live, subtitle: [m?.title, w?.title].filter(Boolean).join(' • ') };
            if (live.status === 'completed') past.push(liveData);
            else upcoming.push(liveData);
          });
        }),
      ),
    );
    (Array.isArray(sessions) ? sessions : []).forEach((s) => {
      if (!s?.id) return;
      const ended = s.status === 'ended' || s.status === 'completed' || !!s.ended_at;
      const item = {
        id: s.id,
        title: s.title || 'Session live',
        date: s.scheduled_at || s.started_at || s.ended_at || s.created_at,
        subtitle: 'Session live',
        description: s.description || '',
        status: ended ? 'completed' : (s.status || 'scheduled'),
        replayable: ended,   // vraie live_session terminée → a une salle de replay (get_replay_room)
      };
      if (ended) past.push(item); else upcoming.push(item);
    });
    upcoming.sort((a, b) => (safeDate(a.date)?.getTime() || Infinity) - (safeDate(b.date)?.getTime() || Infinity));
    past.sort((a, b) => (safeDate(b.date)?.getTime() || 0) - (safeDate(a.date)?.getTime() || 0));
    return { upcomingLives: upcoming, pastLives: past };
  }, [years, sessions]);

  const mobile = variant === 'liriMobile';

  // ── Recherche · filtre · vue ───────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'upcoming' | 'replays'
  const [view, setView] = useState('grid'); // 'grid' | 'list'

  const matchQuery = (l) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [l.title, l.subtitle, l.description].filter(Boolean).some((s) => String(s).toLowerCase().includes(q));
  };
  const fUpcoming = useMemo(() => upcomingLives.filter(matchQuery), [upcomingLives, query]);
  const fReplays = useMemo(() => pastLives.filter(matchQuery), [pastLives, query]);

  // ── Suggestions « Pour toi » (heuristique ; la vraie progression se branchera) ─
  const nextLive = upcomingLives[0] || null; // déjà trié par date croissante
  const catchUp = pastLives.slice(0, 4); // replays récents = à rattraper

  // ── Variante mobile : rendu compact (inchangé, sans toolbar) ────────────────
  if (mobile) {
    return (
      <div className="space-y-8">
        <div className="space-y-2 pb-1">
          <LiriWordmark size="kicker" className="text-[color-mix(in_srgb,var(--school-accent)_80%,transparent)]" />
          <h2 className="font-serif text-lg text-[#faf3e6] tracking-tight">Lives & replays</h2>
          <p className="text-xs text-white/42">
            En invité : accès aux directs et rediffusions. Un lien reçu ? Collez-le dans « Connexion » →{' '}
            <Link to={`${ELEVE_MOBILE.connexion}/lien`} className="text-[color-mix(in_srgb,var(--school-accent)_85%,white)] underline-offset-2 hover:underline">
              Rejoindre avec un lien
            </Link>.
          </p>
        </div>
        <MobileSection title="À venir" icon={Calendar} items={upcomingLives} kind="upcoming" />
        <MobileSection title="Replays" icon={PlayCircle} items={pastLives} kind="replay" />
      </div>
    );
  }

  const showUpcoming = filter === 'all' || filter === 'upcoming';
  const showReplays = filter === 'all' || filter === 'replays';
  const nothing = fUpcoming.length === 0 && fReplays.length === 0;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* En-tête */}
      <div className="text-center space-y-3">
        <h1 className="text-4xl md:text-5xl font-serif font-bold text-white">Bibliothèque des Lives</h1>
        <p className="text-lg text-stone-400">Le catalogue : trouvez et regardez vos directs et replays.</p>
      </div>

      {/* ── Pour toi (suggestions) ── */}
      {(nextLive || catchUp.length > 0) && (
        <section className="rounded-2xl border border-[rgba(217,119,87,0.22)] bg-[color-mix(in_srgb,var(--school-accent)_8%,#2b2926)] p-5">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--school-accent)]" />
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[color-mix(in_srgb,var(--school-accent)_85%,white)]">Pour toi</h3>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {nextLive && (
              <div className="flex items-center gap-3 rounded-xl border border-[rgba(245,244,238,0.08)] bg-[#30302e] p-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--school-accent)_18%,transparent)] text-[var(--school-accent)]"><Clock className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] uppercase tracking-wide text-stone-400">Ne manque pas ton prochain live</p>
                  <p className="truncate text-sm font-semibold text-white">{nextLive.title}</p>
                  <p className="truncate text-xs text-stone-400">{fmtDateTime(nextLive.date)}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-stone-500" />
              </div>
            )}
            {catchUp.length > 0 && (
              <button
                type="button"
                onClick={() => { setFilter('replays'); setQuery(''); }}
                className="flex items-center gap-3 rounded-xl border border-[rgba(245,244,238,0.08)] bg-[#30302e] p-4 text-left transition-colors hover:border-[rgba(217,119,87,0.35)]"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--school-accent)_18%,transparent)] text-[var(--school-accent)]"><RotateCcw className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] uppercase tracking-wide text-stone-400">À rattraper</p>
                  <p className="text-sm font-semibold text-white">{catchUp.length} replay{catchUp.length > 1 ? 's' : ''} à revoir</p>
                  <p className="truncate text-xs text-stone-400">{catchUp.map((c) => c.title).slice(0, 2).join(' · ')}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-stone-500" />
              </button>
            )}
          </div>
        </section>
      )}

      {/* ── Barre d'outils : recherche · filtres · vue ── */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un live, un thème…"
            className="h-10 w-full rounded-xl border border-[rgba(245,244,238,0.1)] bg-[#2b2926] pl-9 pr-3 text-sm text-stone-100 placeholder:text-stone-500 outline-none transition-colors focus:border-[color-mix(in_srgb,var(--school-accent)_45%,transparent)]"
          />
        </div>
        <div className="flex items-center gap-2">
          {[
            { k: 'all', label: 'Tous' },
            { k: 'upcoming', label: 'À venir' },
            { k: 'replays', label: 'Replays' },
          ].map((c) => (
            <button
              key={c.k}
              type="button"
              onClick={() => setFilter(c.k)}
              className={cn(
                'h-9 rounded-full px-3.5 text-xs font-medium transition-colors',
                filter === c.k
                  ? 'bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] text-[color-mix(in_srgb,var(--school-accent)_90%,white)] border border-[color-mix(in_srgb,var(--school-accent)_36%,transparent)]'
                  : 'border border-[rgba(245,244,238,0.1)] bg-[#2b2926] text-stone-400 hover:text-stone-200',
              )}
            >
              {c.label}
            </button>
          ))}
          <div className="ml-1 flex items-center rounded-full border border-[rgba(245,244,238,0.1)] bg-[#2b2926] p-0.5">
            {[
              { k: 'grid', Icon: LayoutGrid, label: 'Grille' },
              { k: 'list', Icon: ListIcon, label: 'Liste' },
            ].map(({ k, Icon, label }) => (
              <button
                key={k}
                type="button"
                onClick={() => setView(k)}
                aria-label={label}
                title={label}
                className={cn(
                  'grid h-8 w-8 place-items-center rounded-full transition-colors',
                  view === k ? 'bg-[color-mix(in_srgb,var(--school-accent)_22%,transparent)] text-[var(--school-accent)]' : 'text-stone-500 hover:text-stone-300',
                )}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {nothing && (
        <p className="py-10 text-center text-stone-400">
          {query ? `Aucun résultat pour « ${query} ».` : 'Aucun live pour le moment.'}
        </p>
      )}

      {/* ── À venir ── */}
      {showUpcoming && fUpcoming.length > 0 && (
        <section>
          <SectionTitle icon={Calendar}>À venir</SectionTitle>
          {view === 'grid' ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {fUpcoming.map((live) => <UpcomingCard key={live.id} live={live} />)}
            </div>
          ) : (
            <div className="space-y-2">
              {fUpcoming.map((live) => <LiveRow key={live.id} live={live} kind="upcoming" />)}
            </div>
          )}
        </section>
      )}

      {/* ── Replays ── */}
      {showReplays && fReplays.length > 0 && (
        <section>
          <SectionTitle icon={PlayCircle}>Replays</SectionTitle>
          {view === 'grid' ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {fReplays.map((live) => <ReplayCard key={live.id} live={live} />)}
            </div>
          ) : (
            <div className="space-y-2">
              {fReplays.map((live) => <LiveRow key={live.id} live={live} kind="replay" />)}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/* ─── Sous-composants (desktop) ─── */
function SectionTitle({ icon: Icon, children }) {
  return (
    <h3 className="mb-6 flex items-center gap-2 text-2xl font-bold text-white">
      <Icon className="h-6 w-6 text-[var(--school-accent)]" />
      {children}
    </h3>
  );
}

function UpcomingCard({ live }) {
  return (
    <Card className="border-[rgba(245,244,238,0.08)] bg-[#30302e]">
      <CardContent className="p-6">
        <Badge className="mb-3 bg-[var(--school-accent)] text-[10px] text-black">Programmé</Badge>
        <h4 className="mb-2 text-xl font-bold text-white">{live.title}</h4>
        <p className="mb-4 text-sm text-stone-400">{live.subtitle}</p>
        <div className="mb-6 flex items-center gap-2 text-sm text-stone-300">
          <Clock className="h-3.5 w-3.5 shrink-0 text-[var(--school-accent)]" />
          {fmtDateTime(live.date)}
        </div>
        <Button className="w-full border border-[color-mix(in_srgb,var(--school-accent)_32%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] text-[#f0d5c6] hover:bg-[color-mix(in_srgb,var(--school-accent)_24%,transparent)]">
          S'inscrire / Rejoindre
        </Button>
      </CardContent>
    </Card>
  );
}

function ReplayCard({ live }) {
  const navigate = useNavigate();
  const canOpen = !!live.replayable;
  return (
    <Card
      onClick={() => canOpen && navigate(`/liri/forum/replay/${live.id}`)}
      role={canOpen ? 'button' : undefined}
      className={cn(
        'group overflow-hidden border-[rgba(245,244,238,0.08)] bg-[#30302e] transition-colors hover:border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)]',
        canOpen ? 'cursor-pointer' : 'cursor-default',
      )}>
      <div className="relative aspect-video bg-black">
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 transition-colors group-hover:bg-black/30">
          <PlayCircle className="h-16 w-16 text-white opacity-80 transition-transform group-hover:scale-110" />
        </div>
      </div>
      <CardContent className="p-6">
        <h4 className="mb-1 text-lg font-bold text-white">{live.title}</h4>
        <p className="mb-4 text-sm text-stone-400">{fmtDate(live.date)}</p>
        {live.description ? <p className="line-clamp-2 text-sm text-stone-300">{live.description}</p> : null}
      </CardContent>
    </Card>
  );
}

function LiveRow({ live, kind }) {
  const navigate = useNavigate();
  const canOpen = kind === 'replay' && !!live.replayable;
  return (
    <div className="flex items-center gap-4 rounded-xl border border-[rgba(245,244,238,0.08)] bg-[#30302e] px-4 py-3 transition-colors hover:border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)]">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--school-accent)_14%,transparent)] text-[var(--school-accent)]">
        {kind === 'replay' ? <PlayCircle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">{live.title}</p>
        <p className="truncate text-xs text-stone-400">
          {kind === 'replay' ? fmtDate(live.date) : `${live.subtitle ? `${live.subtitle} · ` : ''}${fmtDateTime(live.date)}`}
        </p>
      </div>
      <Button size="sm" onClick={() => canOpen && navigate(`/liri/forum/replay/${live.id}`)} className="shrink-0 border border-[color-mix(in_srgb,var(--school-accent)_32%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] text-[#f0d5c6] hover:bg-[color-mix(in_srgb,var(--school-accent)_24%,transparent)]">
        {kind === 'replay' ? 'Revoir' : 'Rejoindre'}
      </Button>
    </div>
  );
}

/* ─── Section mobile (compacte) ─── */
function MobileSection({ title, icon: Icon, items, kind }) {
  return (
    <section>
      <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-white">
        <Icon className="h-4 w-4 text-[var(--school-accent)]" />
        {title}
      </h3>
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-white/40">{kind === 'replay' ? 'Aucun replay.' : 'Aucun live programmé.'}</p>
        ) : (
          items.map((live) => <LiveRow key={live.id} live={live} kind={kind} />)
        )}
      </div>
    </section>
  );
}
