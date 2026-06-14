import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Radio, ArrowRight, Clapperboard, Loader2, PlayCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useLiveAlertsForUser } from '@/hooks/useLiveAlertsForUser';
import {
  filterActionableLiveSessions,
  liveSessionPrimaryHref,
  liveSessionPrimaryCtaLabel,
  hasNeuroFormationReplay,
  isArenaLiveJoinable,
  isExternalLiveHref,
  isNeuroReplayDraftForViewer,
} from '@/lib/liveAlertSessionUi';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Bloc tableau de bord : directs réels, salle d'attente, immersif, replays Neuro Recall publiés,
 * et ligne « post-live » pour l'hôte si le status live n'a pas été finalisé en base.
 * @param {object[]} [sessions] — si fourni (ex. accueil mobile), évite un second fetch du même hook.
 */
export default function DashboardLiveSessionsPanel({ className, sessions: controlledSessions }) {
  const { user } = useAuth();
  const uid = user?.id;
  const hookSessions = useLiveAlertsForUser(controlledSessions !== undefined ? null : uid);
  const sessions = controlledSessions !== undefined ? controlledSessions : hookSessions;
  const rows = useMemo(() => filterActionableLiveSessions(sessions, uid), [sessions, uid]);

  if (!uid || rows.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border border-emerald-500/35 bg-gradient-to-br from-emerald-950/50 via-[#151a21] to-[#0c1018] p-4 md:p-5 shadow-[0_0_40px_-12px_rgba(16,185,129,0.35)]',
        className,
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-500/15">
            <Radio className="h-5 w-5 text-emerald-300 animate-pulse" />
          </div>
          <div>
            <h2 className="font-serif text-lg md:text-xl font-bold text-white tracking-tight">
              Live en cours
            </h2>
            <p className="text-sm text-emerald-100/75 mt-0.5">
              {rows.length === 1
                ? 'Une activité live, un replay ou une salle ouverte — accédez depuis ici.'
                : `${rows.length} activités (directs, replays, attente) visibles pour votre compte.`}
            </p>
          </div>
        </div>
      </div>

      <ul className="space-y-2">
        {rows.map((s) => {
          const isWaiting = s.source === 'waiting_approval';
          const isImmersive = s.source === 'immersive';
          const immersivePending = isImmersive && s.immersive_status === 'pending';
          const replayReady = hasNeuroFormationReplay(s, uid);
          const replayDraft = isNeuroReplayDraftForViewer(s, uid);
          const joinLive = isArenaLiveJoinable(s, uid);
          const isStaleHostRow =
            !isImmersive &&
            !isWaiting &&
            !replayReady &&
            !joinLive &&
            String(s.status || '').toLowerCase() === 'live' &&
            s.teacher_id === uid;

          const href = liveSessionPrimaryHref(s, uid);
          const ctaLabel = liveSessionPrimaryCtaLabel(s, uid);
          const external = isExternalLiveHref(href);

          const isHost = s.teacher_id === uid && !isImmersive && !isWaiting;
          const started = s.started_at
            ? formatDistanceToNow(new Date(s.started_at), { addSuffix: true, locale: fr })
            : null;

          let badgeClass = 'bg-emerald-500/20 text-emerald-200 border-emerald-400/25';
          let badgeLabel = 'En direct';

          if (isWaiting) {
            badgeClass = 'bg-amber-500/20 text-amber-200 border-amber-400/25';
            badgeLabel = 'Salle d\'attente';
          } else if (immersivePending) {
            badgeClass = 'bg-sky-500/20 text-sky-200 border-sky-400/25';
            badgeLabel = 'Connexion';
          } else if (isImmersive) {
            badgeLabel = 'Messagerie';
          } else if (replayReady) {
            badgeClass = replayDraft
              ? 'bg-violet-500/12 text-violet-200 border-violet-400/28'
              : 'bg-cyan-500/15 text-cyan-200 border-cyan-400/30';
            badgeLabel = replayDraft ? 'Brouillon replay' : 'Replay formation';
          } else if (isStaleHostRow) {
            badgeClass = 'bg-amber-500/15 text-amber-200/95 border-amber-400/25';
            badgeLabel = 'À finaliser';
          }

          let ctaClass = 'bg-emerald-600 hover:bg-emerald-500';
          if (isWaiting) ctaClass = 'bg-amber-600 hover:bg-amber-500';
          else if (immersivePending) ctaClass = 'bg-sky-600 hover:bg-sky-500';
          else if (replayReady) {
            ctaClass = replayDraft
              ? 'bg-violet-600/90 hover:bg-violet-600'
              : 'bg-cyan-600 hover:bg-cyan-500';
          }
          else if (isStaleHostRow) ctaClass = 'bg-amber-700/90 hover:bg-amber-600';

          const CtaInner = (
            <>
              {isImmersive && immersivePending ? (
                <Loader2 className="h-4 w-4 animate-spin opacity-90" />
              ) : replayReady ? (
                <PlayCircle className="h-4 w-4 opacity-95" />
              ) : null}
              {ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </>
          );

          return (
            <li
              key={`${s.source}-${s.id}`}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 backdrop-blur-sm"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide border',
                      badgeClass,
                    )}
                  >
                    {badgeLabel}
                  </span>
                  {isHost ? (
                    <span className="text-[10px] font-medium uppercase tracking-wide text-[color-mix(in_srgb,var(--school-accent)_90%,transparent)]">
                      Vous animez
                    </span>
                  ) : null}
                </div>
                <p className="text-white font-medium truncate mt-1">{s.title || 'Session live'}</p>
                {replayReady ? (
                  <p className="text-xs text-white/45">
                    {replayDraft
                      ? 'Neuro Recall : brouillon intégré au parcours — relisez avant publication.'
                      : 'Neuro Recall : le replay est disponible dans le parcours formation.'}
                  </p>
                ) : null}
                {isStaleHostRow ? (
                  <p className="text-xs text-white/45">
                    Le direct semble terminé mais le statut n'est pas à jour — ouvrez le post-live pour finaliser.
                  </p>
                ) : null}
                {started && !immersivePending && !replayReady && !isStaleHostRow ? (
                  <p className="text-xs text-white/45">Démarré {started}</p>
                ) : null}
                {started && replayReady ? (
                  <p className="text-xs text-white/35">Séance {started}</p>
                ) : null}
                {immersivePending ? (
                  <p className="text-xs text-white/45">Ouvrez la messagerie pour finaliser la connexion.</p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {external ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white transition-colors',
                      ctaClass,
                    )}
                  >
                    {CtaInner}
                  </a>
                ) : (
                  <Link
                    to={href}
                    className={cn(
                      'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white transition-colors',
                      ctaClass,
                    )}
                  >
                    {CtaInner}
                  </Link>
                )}
                {isHost && joinLive && !isImmersive ? (
                  <Link
                    to={`/studio/live-preparation/${s.id}`}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] px-3 py-2 text-sm font-medium text-[#f5dd8a] hover:bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] transition-colors"
                  >
                    <Clapperboard className="h-4 w-4" />
                    Studio
                  </Link>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </motion.div>
  );
}
