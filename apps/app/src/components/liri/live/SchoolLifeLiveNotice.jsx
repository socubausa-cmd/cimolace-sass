import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Radio, ArrowRight, Loader2, PlayCircle } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useLiveAlertsForUser } from '@/hooks/useLiveAlertsForUser';
import {
  filterActionableLiveSessions,
  hasNeuroFormationReplay,
  isArenaLiveJoinable,
  isExternalLiveHref,
  isNeuroReplayDraftForViewer,
  liveSessionPrimaryCtaLabel,
  liveSessionPrimaryHref,
} from '@/lib/liveAlertSessionUi';
import { cn } from '@/lib/utils';

/**
 * Bandeau visible dans Vie scolaire → onglet Événements : rappelle un live en cours
 * (arène, salle d'attente, messagerie immersive, replay Neuro Recall).
 */
export default function SchoolLifeLiveNotice() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const sessions = useLiveAlertsForUser(user?.id);
  const actionable = filterActionableLiveSessions(sessions, user?.id);

  if (!actionable.length) return null;

  return (
    <div className="mb-8 space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#D4AF37]/80">
        Live en cours
      </p>
      {actionable.map((s) => {
        const isWaiting = s.source === 'waiting_approval';
        const isImmersive = s.source === 'immersive';
        const replayReady = hasNeuroFormationReplay(s, user?.id);
        const replayDraft = isNeuroReplayDraftForViewer(s, user?.id);
        const joinArena = isArenaLiveJoinable(s, user?.id);
        const staleHost =
          !isImmersive &&
          !isWaiting &&
          !replayReady &&
          !joinArena &&
          String(s.status || '').toLowerCase() === 'live' &&
          s.teacher_id === user?.id;
        const href = liveSessionPrimaryHref(s, user?.id);
        const ctaLabel = liveSessionPrimaryCtaLabel(s, user?.id);
        const external = isExternalLiveHref(href);

        const go = () => {
          if (external) {
            window.open(href, '_blank', 'noopener,noreferrer');
            return;
          }
          navigate(href);
        };

        const borderClass = isWaiting
          ? 'border-amber-500/35 bg-amber-500/[0.08]'
          : replayReady
            ? replayDraft
              ? 'border-violet-500/35 bg-violet-500/[0.06]'
              : 'border-cyan-500/35 bg-cyan-500/[0.07]'
            : staleHost
              ? 'border-amber-500/30 bg-amber-500/[0.06]'
              : 'border-emerald-500/35 bg-emerald-500/[0.08]';

        const iconClass = isWaiting
          ? 'bg-amber-500/20'
          : replayReady
            ? replayDraft
              ? 'bg-violet-500/20'
              : 'bg-cyan-500/20'
            : staleHost
              ? 'bg-amber-500/18'
              : 'bg-emerald-500/20';

        const hint = isImmersive
          ? 'Appel vidéo dans la messagerie — ouvrez l\'onglet Messages pour rejoindre.'
          : isWaiting
            ? 'Vous êtes en salle d\'attente : ouvrez la file pour être admis.'
            : replayReady
              ? replayDraft
                ? 'Neuro Recall : brouillon dans le parcours — à valider avant diffusion.'
                : 'Neuro Recall : le replay est intégré au parcours formation.'
              : joinArena
                ? 'Une séance est en direct. Rejoignez depuis ce lien.'
                : staleHost
                  ? 'Le statut du direct n\'est pas à jour — ouvrez le post-live pour finaliser.'
                  : 'Ouvrez la page indiquée pour accéder à la séance.';

        const btnClass = isWaiting
          ? 'border-amber-500/40 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25'
          : replayReady
            ? replayDraft
              ? 'border-violet-500/40 bg-violet-500/12 text-violet-100 hover:bg-violet-500/22'
              : 'border-cyan-500/40 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/22'
            : staleHost
              ? 'border-amber-500/40 bg-amber-500/12 text-amber-100 hover:bg-amber-500/22'
              : 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25';

        return (
          <motion.div
            key={`${s.source}-${s.id}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3',
              borderClass,
            )}
          >
            <div
              className={cn(
                'h-9 w-9 rounded-full flex items-center justify-center shrink-0',
                iconClass,
              )}
            >
              {isWaiting ? (
                <Loader2 className="w-4 h-4 text-amber-300 animate-spin" />
              ) : replayReady ? (
                <PlayCircle className={replayDraft ? 'w-4 h-4 text-violet-300' : 'w-4 h-4 text-cyan-300'} />
              ) : staleHost ? (
                <Radio className="w-4 h-4 text-amber-200/90" />
              ) : (
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40" />
                  <Radio className="w-4 h-4 text-emerald-300 relative" />
                </span>
              )}
            </div>
            <div className="flex-1 min-w-[200px]">
              <p className="text-sm font-semibold text-white">{s.title || 'Session live'}</p>
              <p className="text-xs text-white/50">{hint}</p>
            </div>
            <button
              type="button"
              onClick={go}
              className={cn(
                'shrink-0 flex items-center gap-1.5 h-9 px-4 rounded-full text-xs font-semibold border transition-colors',
                btnClass,
              )}
            >
              {ctaLabel}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        );
      })}
    </div>
  );
}
