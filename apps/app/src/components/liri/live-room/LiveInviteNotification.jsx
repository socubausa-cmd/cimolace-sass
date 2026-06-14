/**
 * LiveInviteNotification
 * ─────────────────────────────────────────────────────────────────────────────
 * Bande de notification d'invitation live — HORS du fil de messages.
 *
 * Affiche selon la perspective :
 *  - Receveur  : "Brad vous invite → [Accepter] [Décliner]"
 *  - Envoyeur  : "En attente de Brad… [Annuler]  (compte à rebours)"
 *  - Acceptée (envoyeur) : "Brad a accepté — démarrage en cours…"
 */
import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Video, X, Check, Clock, Loader2, CalendarClock, BellRing, CalendarPlus } from 'lucide-react';
import { cn } from '@/lib/utils';

function formatScheduled(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  return d.toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function LiveInviteNotification({
  currentUserId,
  incomingInvite,
  outgoingInvite,
  senderProfile,     // profil de l'invitant (quand on reçoit)
  receiverProfile,   // profil du destinataire (quand on envoie)
  inviteCountdown,   // secondes restantes (invite sortante)
  onAccept,
  onDecline,
  onCancel,
  onDismiss,
  onSchedule,        // () => void — propose un RDV après appel manqué
  liveActive,        // si l'appel est déjà actif, on cache tout
  isDarkTheme = true,
  className,
}) {
  // Ne rien afficher pendant un appel actif ou sans invite
  if (liveActive || (!incomingInvite && !outgoingInvite)) return null;

  // ── Invite ENTRANTE — perspective receveur ─────────────────────────────────
  if (incomingInvite) {
    const isMissed    = incomingInvite.status === 'missed';
    const senderName  = senderProfile?.name || 'Un membre';
    const scheduled   = incomingInvite.scheduled_for
      ? formatScheduled(incomingInvite.scheduled_for)
      : null;

    return (
      <AnimatePresence>
        <motion.div
          key="invite-incoming"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className={cn(
            'w-full rounded-xl border px-3 py-2.5 shadow-lg backdrop-blur-xl',
            isMissed
              ? isDarkTheme
                ? 'border-amber-500/30 bg-amber-500/10'
                : 'border-amber-300 bg-amber-50'
              : isDarkTheme
                ? 'border-[#D4AF37]/25 bg-[#111827]/88'
                : 'border-[#e6ca71] bg-white',
            className
          )}
        >
          <div className="flex items-center gap-2.5">
            <div className={cn(
              'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
              isMissed ? 'bg-amber-400/20 text-amber-300' : 'bg-[#D4AF37]/15 text-[#D4AF37]'
            )}>
              {isMissed ? <BellRing className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
            </div>

            <div className="min-w-0 flex-1">
              <p className={cn('text-xs truncate', isDarkTheme ? 'text-white' : 'text-[#1f2937]')}>
                {isMissed ? (
                  <><span className="text-amber-300 font-medium">{senderName}</span> a manqué l'appel.</>
                ) : (
                  <><span className="text-[#D4AF37] font-medium">{senderName}</span> vous invite en vidéo.</>
                )}
              </p>
              {scheduled && (
                <p className={cn('text-[11px] mt-0.5 inline-flex items-center gap-1', isDarkTheme ? 'text-gray-400' : 'text-gray-600')}>
                  <CalendarClock className="w-3 h-3" />
                  {scheduled}
                </p>
              )}
            </div>

            {!isMissed ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={onAccept}
                  className="h-7 px-2.5 rounded-lg bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-[11px] hover:bg-emerald-500/30 transition-colors inline-flex items-center gap-1"
                >
                  <Check className="w-3 h-3" />
                  Accepter
                </button>
                <button
                  type="button"
                  onClick={onDecline}
                  className={cn(
                    'h-7 px-2.5 rounded-lg text-[11px] transition-colors',
                    isDarkTheme
                      ? 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10'
                      : 'bg-gray-100 border border-gray-300 text-gray-700 hover:bg-gray-200'
                  )}
                >
                  Refuser
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 shrink-0">
                {onSchedule && (
                  <button
                    type="button"
                    onClick={onSchedule}
                    className="h-7 px-2.5 rounded-lg bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37] text-[11px] hover:bg-[#D4AF37]/25 transition-colors inline-flex items-center gap-1"
                  >
                    <CalendarPlus className="w-3 h-3" />
                    Planifier
                  </button>
                )}
                {onDismiss && (
                  <button
                    type="button"
                    onClick={onDismiss}
                    className={cn(
                      'h-7 w-7 rounded-lg transition-colors inline-flex items-center justify-center',
                      isDarkTheme
                        ? 'bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                        : 'bg-gray-100 border border-gray-300 text-gray-500 hover:text-gray-800 hover:bg-gray-200'
                    )}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // ── Invite SORTANTE — perspective envoyeur ─────────────────────────────────
  if (outgoingInvite) {
    const receiverName = receiverProfile?.name || 'votre interlocuteur';
    const isAccepted   = outgoingInvite.status === 'accepted';
    const scheduled    = outgoingInvite.scheduled_for
      ? formatScheduled(outgoingInvite.scheduled_for)
      : null;

    return (
      <AnimatePresence>
        <motion.div
          key="invite-outgoing"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className={cn(
            'w-full rounded-xl border px-3 py-2.5 shadow-lg backdrop-blur-xl',
            isAccepted
              ? isDarkTheme
                ? 'border-emerald-400/30 bg-emerald-500/10'
                : 'border-emerald-300 bg-emerald-50'
              : isDarkTheme
                ? 'border-white/10 bg-[#111827]/88'
                : 'border-gray-300 bg-white',
            className
          )}
        >
          <div className="flex items-center gap-2.5">
            <div className={cn(
              'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
              isAccepted ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5 text-gray-400'
            )}>
              {isAccepted ? <Check className="w-3.5 h-3.5" /> : <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className={cn('text-xs truncate', isDarkTheme ? 'text-white' : 'text-[#1f2937]')}>
                {isAccepted ? (
                  <><span className="text-emerald-300 font-medium">{receiverName}</span> a accepté. Connexion en cours…</>
                ) : (
                  <>Invitation envoyée à <span className="text-white/80 font-medium">{receiverName}</span>.</>
                )}
              </p>
              {scheduled && !isAccepted && (
                <p className={cn('text-[11px] mt-0.5 inline-flex items-center gap-1', isDarkTheme ? 'text-gray-400' : 'text-gray-600')}>
                  <CalendarClock className="w-3 h-3" />
                  {scheduled}
                </p>
              )}
            </div>
            {!isAccepted && inviteCountdown != null && !scheduled && (
              <div className={cn('text-[11px] inline-flex items-center gap-1 shrink-0', isDarkTheme ? 'text-gray-400' : 'text-gray-600')}>
                <Clock className="w-3 h-3" />
                {inviteCountdown}s
              </div>
            )}
            {!isAccepted && onCancel && (
              <button
                onClick={onCancel}
                className={cn(
                  'h-7 w-7 rounded-lg transition-colors inline-flex items-center justify-center shrink-0',
                  isDarkTheme
                    ? 'bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                    : 'bg-gray-100 border border-gray-300 text-gray-500 hover:text-gray-800 hover:bg-gray-200'
                )}
                title="Annuler l'invitation"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return null;
}
