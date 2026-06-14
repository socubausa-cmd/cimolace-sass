/**
 * LiveAlertBanner — Indicateur "Aller en classe" (Smart Entry / LIRI)
 *
 * Apparaît automatiquement quand l'utilisateur connecté :
 *   - a été invité à un live (live_invitations)
 *   - ou le live est public et en cours
 *   - ou l'utilisateur est en salle d'attente
 *   - ou un live immersif messagerie (host / invité) est actif
 *   - ou un replay Neuro Recall est publié en formation
 *
 * États visuels :
 *   - scheduled       : icône statique bleue + countdown
 *   - live_now        : clignotant vert, bouton "Rejoindre" (direct réel seulement)
 *   - waiting_approval: clignotant orange, "En attente"
 *   - replay          : replay formation consultable
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, ArrowRight, X, Loader2 } from 'lucide-react';
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

// ─── Countdown temps réel ────────────────────────────────────────────────────
function LiveCountdown({ scheduledAt }) {
  const [diff, setDiff] = useState(null);

  useEffect(() => {
    if (!scheduledAt) return;
    const tick = () => {
      const ms = new Date(scheduledAt) - Date.now();
      if (ms <= 0) { setDiff(null); return; }
      const h = Math.floor(ms / 3_600_000);
      const m = Math.floor((ms % 3_600_000) / 60_000);
      const sec = Math.floor((ms % 60_000) / 1_000);
      setDiff({ h, m, s: sec });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [scheduledAt]);

  if (!diff) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return (
    <span className="font-mono text-[10px] text-white/50">
      {diff.h > 0 ? `${pad(diff.h)}:` : ''}{pad(diff.m)}:{pad(diff.s)}
    </span>
  );
}

// ─── Composant carte session ─────────────────────────────────────────────────
function SessionAlert({ session, onDismiss }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const isWaiting = session.source === 'waiting_approval';
  const isImmersive = session.source === 'immersive';
  const replayReady = hasNeuroFormationReplay(session, user?.id);
  const replayDraft = isNeuroReplayDraftForViewer(session, user?.id);
  const joinArena = isArenaLiveJoinable(session, user?.id);
  const staleHost =
    !isImmersive &&
    !isWaiting &&
    !replayReady &&
    !joinArena &&
    String(session.status || '').toLowerCase() === 'live' &&
    session.teacher_id === user?.id;

  const statusLower = String(session.status || '').toLowerCase();
  const showScheduled = statusLower === 'scheduled' && !isWaiting && !isImmersive;
  const immersiveActive = isImmersive && session.immersive_status === 'active';
  const immersivePending = isImmersive && session.immersive_status === 'pending';

  const showLivePulse = joinArena || immersiveActive || immersivePending;
  const href = liveSessionPrimaryHref(session, user?.id);
  const ctaLabel = liveSessionPrimaryCtaLabel(session, user?.id);

  const goTo = () => {
    if (isExternalLiveHref(href)) {
      window.open(href, '_blank', 'noopener,noreferrer');
      return;
    }
    navigate(href);
  };

  const cardClass = isWaiting
    ? 'bg-[#140e00]/90 border-amber-500/30'
    : replayReady
      ? replayDraft
        ? 'bg-[#0f0a18]/90 border-violet-500/30'
        : 'bg-[#0a1418]/90 border-cyan-500/35'
      : staleHost
        ? 'bg-[#140e00]/90 border-amber-500/25'
        : joinArena || immersiveActive || immersivePending
          ? 'bg-[#0c1410]/90 border-emerald-500/30'
          : 'bg-[#0c0f18]/90 border-[#D4AF37]/20';

  const iconWrapClass = isWaiting
    ? 'bg-amber-500/20'
    : replayReady
      ? replayDraft
        ? 'bg-violet-500/15'
        : 'bg-cyan-500/15'
      : staleHost
        ? 'bg-amber-500/20'
        : joinArena || immersiveActive || immersivePending
          ? 'bg-emerald-500/20'
          : 'bg-[#D4AF37]/15';

  const subtitle = (() => {
    if (immersivePending) return 'Connexion en cours • ouvrir la messagerie';
    if (isWaiting) return 'En attente de validation';
    if (replayReady) {
      return replayDraft
        ? 'Brouillon Neuro Recall — ouvrez le parcours ou le post-live'
        : 'Replay disponible dans le parcours formation';
    }
    if (staleHost) return 'Direct terminé • finalisez le post-live';
    if (joinArena) return 'En cours • rejoins la salle';
    if (showScheduled) return 'Planifié • bientôt disponible';
    return 'Ouvre la salle';
  })();

  const btnClass = isWaiting
    ? 'bg-amber-500/20 border-amber-500/30 text-amber-300 hover:bg-amber-500/30'
    : replayReady
      ? replayDraft
        ? 'bg-violet-500/20 border-violet-500/35 text-violet-200 hover:bg-violet-500/30'
        : 'bg-cyan-500/20 border-cyan-500/35 text-cyan-200 hover:bg-cyan-500/30'
      : staleHost
        ? 'bg-amber-500/20 border-amber-500/30 text-amber-200 hover:bg-amber-500/28'
        : joinArena || immersiveActive || immersivePending
          ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30'
          : 'bg-[#D4AF37]/15 border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37]/25';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      className={cn(
        'relative flex items-center gap-3 rounded-2xl border px-4 py-3 backdrop-blur-xl shadow-2xl',
        cardClass,
      )}
      style={{ minWidth: '280px', maxWidth: '340px' }}
    >
      <div className={cn(
        'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 relative',
        iconWrapClass,
      )}
      >
        {showLivePulse && (
          <span
            className={cn(
              'absolute inset-0 rounded-full animate-ping',
              isWaiting ? 'bg-amber-400/20' : 'bg-emerald-400/20',
            )}
          />
        )}
        {isWaiting ? (
          <Loader2 className="w-4 h-4 text-amber-400 animate-spin relative" />
        ) : (
          <Radio
            className={cn(
              'w-4 h-4 relative',
              replayReady
                ? replayDraft
                  ? 'text-violet-300'
                  : 'text-cyan-300'
                : joinArena || immersiveActive
                  ? 'text-emerald-400'
                  : 'text-[#D4AF37]',
            )}
          />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-white leading-tight truncate">
          {session.title || 'Session live'}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-[10px] text-white/40">{subtitle}</p>
          {showScheduled ? <LiveCountdown scheduledAt={session.scheduled_at} /> : null}
        </div>
      </div>

      <button
        type="button"
        onClick={goTo}
        className={cn(
          'flex-shrink-0 flex items-center gap-1 h-7 px-3 rounded-full border text-[11px] font-semibold transition-all',
          btnClass,
        )}
      >
        {ctaLabel}
        <ArrowRight className="w-3 h-3" />
      </button>

      <button
        type="button"
        onClick={onDismiss}
        className="flex-shrink-0 w-5 h-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
      >
        <X className="w-2.5 h-2.5 text-white/40" />
      </button>
    </motion.div>
  );
}

// ─── Composant principal (à placer dans App.jsx ou Header) ───────────────────
export default function LiveAlertBanner() {
  const { user } = useAuth();
  const sessions = useLiveAlertsForUser(user?.id);
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('liri_dismissed') || '[]'); }
    catch { return []; }
  });

  const dismiss = (id) => {
    const next = [...dismissed, id];
    setDismissed(next);
    try { sessionStorage.setItem('liri_dismissed', JSON.stringify(next)); } catch {}
  };

  const actionable = filterActionableLiveSessions(sessions, user?.id);
  const fromHookScheduled = sessions.filter((s) => {
    if (String(s.status || '').toLowerCase() !== 'scheduled') return false;
    if (s.source === 'immersive' || s.source === 'waiting_approval') return false;
    const sched = s.scheduled_at ? new Date(s.scheduled_at).getTime() : 0;
    if (sched && !Number.isNaN(sched) && Date.now() > sched + 60 * 60 * 1000) return false;
    return true;
  });
  const mergedForBanner = [...actionable];
  fromHookScheduled.forEach((s) => {
    if (!mergedForBanner.find((x) => x.id === s.id)) mergedForBanner.push(s);
  });

  const visible = mergedForBanner.filter((s) => !dismissed.includes(s.id));

  return (
    <div className="fixed bottom-6 right-4 z-[9999] flex flex-col gap-2 items-end pointer-events-none">
      <AnimatePresence mode="popLayout">
        {visible.slice(0, 3).map((s) => (
          <div key={`${s.source}-${s.id}`} className="pointer-events-auto">
            <SessionAlert session={s} onDismiss={() => dismiss(s.id)} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
