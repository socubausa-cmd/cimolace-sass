import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Play, MoreVertical, Loader2, Radio } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useDataSync } from '@/contexts/DataSyncContext';
import { supabase } from '@/lib/customSupabaseClient';
import { EleveMobileShell, EleveSectionTitle } from '@/components/eleve-mobile/EleveMobileShell';
import { LiriStatusBar } from '@/pages/school/eleve-mobile/connection/EleveConnectionLayout';
import { cn } from '@/lib/utils';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import { EV_BG, EV_MUTED, EV_ACCENT, EV_LINE, EV_R, EV_SH } from '@/pages/school/eleve-mobile/eleveMobileScreensShared';
import { format } from 'date-fns';
import { fr as frLocale } from 'date-fns/locale';

const PAGE_AMBIENT =
  'radial-gradient(50% 32% at 50% 0%, rgba(217, 119, 87, 0.14), transparent 70%)';

const LIST_HALO = [
  'rgba(230, 160, 110, 0.1)',
  'rgba(217, 119, 87, 0.12)',
  'rgba(201, 106, 76, 0.1)',
];

function replayRowSurface(index) {
  const h = LIST_HALO[index % LIST_HALO.length];
  return {
    background: [
      `radial-gradient(ellipse 100% 80% at 0% 0%, ${h} 0%, transparent 55%)`,
      'linear-gradient(195deg, rgba(24,20,15,0.97) 0%, rgba(14,11,9,0.99) 100%)',
    ].join(', '),
    border: '1px solid rgba(240, 200, 175, 0.18)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07), 0 2px 12px -4px rgba(0,0,0,0.4)',
  };
}

function continueCardSurface() {
  return {
    background: [
      'radial-gradient(ellipse 100% 70% at 20% 0%, rgba(217, 119, 87, 0.2) 0%, transparent 58%)',
      'linear-gradient(190deg, rgba(26,18,13,0.98) 0%, rgba(12,10,8,0.99) 100%)',
    ].join(', '),
    border: '1px solid rgba(240, 200, 175, 0.22)',
    boxShadow: [
      'inset 0 1px 0 rgba(255,255,255,0.1)',
      '0 12px 32px -12px rgba(217, 119, 87, 0.25)',
      '0 4px 16px -4px rgba(0,0,0,0.45)',
    ].join(', '),
  };
}

const FILTER = [
  { id: 'tous', label: 'Tous' },
  { id: 'mes', label: 'Mes replays' },
  { id: 'recents', label: 'Récents' },
];

function ReplaysFilterBar({ value, onChange }) {
  return (
    <div
      className="mb-4 flex gap-1.5 rounded-[14px] border p-1"
      style={{
        borderColor: 'rgba(240, 200, 175, 0.18)',
        background: 'linear-gradient(180deg, rgba(22,18,13,0.85) 0%, rgba(12,10,8,0.92) 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 14px -6px rgba(0,0,0,0.45)',
      }}
    >
      {FILTER.map((x) => {
        const on = value === x.id;
        return (
          <button
            key={x.id}
            type="button"
            onClick={() => onChange(x.id)}
            className={cn('min-w-0 flex-1 rounded-[10px] py-2.5 text-center text-[12.5px] font-semibold', on ? 'text-white' : 'text-white/50')}
            style={
              on
                ? {
                    background: `linear-gradient(90deg, ${EV_ACCENT} 0%, #d97757 50%, #c96a4c 100%)`,
                    boxShadow: [
                      '0 0 0 1px rgba(255,255,255,0.12)',
                      '0 4px 18px -4px rgba(217, 119, 87, 0.45)',
                      EV_SH.tab,
                    ].join(', '),
                  }
                : { background: 'rgba(0,0,0,0.2)' }
            }
          >
            {x.label}
          </button>
        );
      })}
    </div>
  );
}

/** Formate la durée en secondes en mm:ss ou h:mm:ss */
function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Charge les sessions live avec un Neuro Recall publié (approved / published)
 * accessibles à l'utilisateur courant.
 */
async function fetchReplays(userId) {
  // Sessions avec neuro recall disponible — accès public (approved/published)
  const { data, error } = await supabase
    .from('live_neuro_recall_state')
    .select(`
      live_session_id,
      workflow_status,
      replay_public_url,
      postproduction_content_id,
      live_sessions (
        id, title, description, started_at, ended_at, teacher_id,
        duration_seconds,
        cover_image_url
      )
    `)
    .in('workflow_status', ['approved', 'published'])
    .order('live_session_id', { ascending: false })
    .limit(30);

  if (error) return [];

  const rows = (data || []).filter((r) => r.live_sessions);

  // Si userId fourni, inclure aussi les drafts de l'hôte
  let hostDrafts = [];
  if (userId) {
    const { data: draftData } = await supabase
      .from('live_neuro_recall_state')
      .select(`
        live_session_id,
        workflow_status,
        replay_public_url,
        postproduction_content_id,
        live_sessions (
          id, title, description, started_at, ended_at, teacher_id,
          duration_seconds, cover_image_url
        )
      `)
      .eq('workflow_status', 'draft_generated')
      .eq('live_sessions.teacher_id', userId)
      .limit(10);

    hostDrafts = (draftData || []).filter(
      (r) => r.live_sessions && r.live_sessions.teacher_id === userId,
    );
  }

  const all = [...rows, ...hostDrafts];
  // Déduplique par session id
  const seen = new Set();
  return all.filter((r) => {
    const id = r.live_session_id;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export default function EleveReplaysScreen() {
  const { user } = useAuth();
  const { notifications: sync } = useDataSync();
  const unread = (Array.isArray(sync) ? sync : []).filter((n) => !n.isRead).length;
  const [f, setF] = useState('tous');
  const [replays, setReplays] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchReplays(user?.id ?? null).then((rows) => {
      if (alive) {
        setReplays(rows);
        setLoading(false);
      }
    });
    return () => { alive = false; };
  }, [user?.id]);

  // Filtre local simple
  const displayed = replays.filter((r) => {
    if (f === 'mes') return r.live_sessions?.teacher_id === user?.id;
    if (f === 'recents') {
      const d = r.live_sessions?.started_at;
      if (!d) return false;
      const ageMs = Date.now() - new Date(d).getTime();
      return ageMs < 30 * 24 * 60 * 60 * 1000; // 30 jours
    }
    return true;
  });

  const featured = displayed[0] ?? null;
  const rest = displayed.slice(1);

  return (
    <EleveMobileShell user={user} notificationCount={unread} hideHeader contentClassName="!px-0">
      <div
        className="flex w-full flex-1 flex-col"
        style={{
          minHeight: '100dvh',
          backgroundColor: EV_BG,
          backgroundImage: PAGE_AMBIENT,
        }}
      >
        <div className="px-4 pt-[max(0.35rem,env(safe-area-inset-top))]">
          <LiriStatusBar />
        </div>

        <div className="px-4 pb-4">
          <div className="mb-4 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <LiriWordmark size="kicker" className="text-white/40" />
              <h1 className="mt-0.5 text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-white">Replays</h1>
              <p className="mt-1 text-[13px] font-medium" style={{ color: EV_MUTED }}>
                Sessions enregistrées, reprendre où tu t'es arrêté
              </p>
            </div>
          </div>

          <ReplaysFilterBar value={f} onChange={setF} />

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-white/30" />
              <p className="text-[13px]" style={{ color: EV_MUTED }}>Chargement des replays…</p>
            </div>
          )}

          {/* Vide */}
          {!loading && displayed.length === 0 && (
            <div
              className="flex flex-col items-center justify-center rounded-3xl border py-14 gap-3"
              style={{ borderColor: EV_LINE, background: 'rgba(255,255,255,0.025)' }}
            >
              <Radio className="h-8 w-8 text-white/20" strokeWidth={1.5} />
              <p className="text-[14px] font-semibold text-white/60">Aucun replay disponible</p>
              <p className="text-[12px] text-center max-w-[220px]" style={{ color: EV_MUTED }}>
                Les replays de tes cours en direct apparaîtront ici une fois publiés.
              </p>
            </div>
          )}

          {/* Featured */}
          {!loading && featured && (
            <>
              <p className="mb-2 text-[9px] font-extrabold uppercase tracking-[0.2em] text-amber-200/50">À la une</p>
              <ReplayFeaturedCard replay={featured} />
            </>
          )}

          {/* Liste */}
          {!loading && rest.length > 0 && (
            <>
              <EleveSectionTitle className="mb-2.5 mt-5">
                Tous les replays
              </EleveSectionTitle>
              <div className="space-y-2.5">
                {rest.map((r, i) => (
                  <ReplayRowCard key={r.live_session_id} replay={r} index={i} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </EleveMobileShell>
  );
}

function replayHref(r) {
  const s = r.live_sessions;
  if (!s) return '#';
  // Si replay_public_url, ouvrir directement
  if (r.replay_public_url) return r.replay_public_url;
  // Sinon page post-live
  return `/studio/live-post/${s.id}`;
}

function ReplayFeaturedCard({ replay: r }) {
  const s = r.live_sessions;
  const title = s?.title || 'Session replay';
  const href = replayHref(r);
  const dur = formatDuration(s?.duration_seconds);
  const dateStr = s?.started_at
    ? format(new Date(s.started_at), "d MMM yyyy", { locale: frLocale })
    : null;

  return (
    <Link
      to={href}
      className="relative mb-5 block overflow-hidden"
      style={{ borderRadius: EV_R.lg, ...continueCardSurface() }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-4 h-24 w-24 rounded-full opacity-45 blur-2xl"
        style={{ background: 'radial-gradient(circle, rgba(235, 200, 170, 0.35) 0%, transparent 70%)' }}
      />
      <div className="relative aspect-[16/9] w-full">
        {s?.cover_image_url ? (
          <img src={s.cover_image_url} alt={title} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(135deg, #1a120d 0%, #3a2418 40%, #1c1a17 100%)' }}
          />
        )}
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/10 shadow-[0_0_32px_-8px_rgba(217, 119, 87,0.5)] backdrop-blur-sm">
            <Play className="ml-0.5 h-7 w-7 fill-white text-white" />
          </span>
        </div>
        {dur && (
          <div className="absolute left-2.5 top-2.5">
            <span className="rounded-md border border-white/10 bg-black/50 px-2 py-0.5 font-mono text-[10.5px] text-white/95">
              {dur}
            </span>
          </div>
        )}
        {r.workflow_status === 'draft_generated' && (
          <div className="absolute right-2.5 top-2.5">
            <span className="rounded-md border border-amber-400/40 bg-amber-500/20 px-2 py-0.5 text-[9px] font-bold text-amber-200">
              BROUILLON
            </span>
          </div>
        )}
      </div>
      <div className="relative p-3.5">
        <p className="text-[15px] font-bold leading-tight text-white line-clamp-2">{title}</p>
        {dateStr && (
          <p className="mt-0.5 text-[12.5px]" style={{ color: EV_MUTED }}>{dateStr}</p>
        )}
      </div>
    </Link>
  );
}

function ReplayRowCard({ replay: r, index }) {
  const s = r.live_sessions;
  const title = s?.title || 'Session replay';
  const href = replayHref(r);
  const dur = formatDuration(s?.duration_seconds);
  const dateStr = s?.started_at
    ? format(new Date(s.started_at), "d MMM yyyy", { locale: frLocale })
    : null;

  return (
    <Link to={href} className="block">
      <div
        className="flex items-stretch gap-2.5 p-2 transition active:scale-[0.99]"
        style={{ borderRadius: EV_R.md, ...replayRowSurface(index) }}
      >
        <div
          className="relative h-[4.5rem] w-28 shrink-0 overflow-hidden rounded-[12px] border"
          style={{
            borderColor: 'rgba(255,255,255,0.1)',
            background: 'linear-gradient(145deg, #1f160f, #3a2418)',
          }}
        >
          {s?.cover_image_url ? (
            <img src={s.cover_image_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
          ) : null}
          <div className="absolute inset-0 flex items-center justify-center">
            <Play className="h-6 w-6 fill-white/80 text-white" />
          </div>
        </div>
        <div className="min-w-0 flex-1 py-0.5">
          <p className="line-clamp-2 text-[13.5px] font-semibold text-white leading-snug">{title}</p>
          {dateStr && (
            <p className="mt-0.5 text-[11.5px]" style={{ color: EV_MUTED }}>{dateStr}</p>
          )}
          {dur && (
            <p className="mt-1 text-[10.5px] font-mono tabular-nums" style={{ color: EV_MUTED }}>{dur}</p>
          )}
        </div>
        {r.workflow_status === 'draft_generated' && (
          <div className="flex flex-col justify-center pr-1">
            <span className="text-[9px] font-bold text-amber-300/80 uppercase tracking-wide">Brouillon</span>
          </div>
        )}
      </div>
    </Link>
  );
}
