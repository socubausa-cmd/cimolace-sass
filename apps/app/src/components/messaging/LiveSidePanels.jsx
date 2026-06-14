/**
 * LiveSidePanels — overlay panels used during and after live sessions:
 *   - DeleteMessagePrompt
 *   - PublicProfilePanel
 *   - LiveSummaryPanel
 *   - LiveInvitePrompt
 *   - LiveAgendaPanel
 *   - liveDashboardNotifTypeLabel (helper)
 *
 * Extracted from MessagingPage.jsx (REQ-FE-004).
 */
import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X, Download, BellRing, CalendarClock, Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { roleLabels, formatDuration, formatInviteDate } from '@/lib/messagingUtils';
import { UserAvatar } from './atoms';

// ─── DeleteMessagePrompt ──────────────────────────────────────────────────────

export function DeleteMessagePrompt({ open, message, onCancel, onConfirm, loading }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-[2px]"
            onClick={onCancel}
          />
          <motion.div
            initial={{ opacity: 0, x: 20, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, y: 10, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-6 right-4 md:right-8 z-[61] w-[320px] rounded-2xl border border-white/10 bg-[#0c1118]/95 backdrop-blur-2xl shadow-2xl shadow-black/50 p-4"
          >
            <p className="text-sm font-semibold text-white">Supprimer ce message ?</p>
            <p className="text-xs text-gray-400 mt-2 line-clamp-2">
              {message?.content || 'Ce message sera supprimé pour les participants.'}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="h-8 px-3 rounded-lg text-xs text-gray-300 border border-white/10 hover:bg-white/5"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={onConfirm}
                className="h-8 px-3 rounded-lg text-xs text-red-300 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50"
              >
                {loading ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── PublicProfilePanel ───────────────────────────────────────────────────────

export function PublicProfilePanel({ open, profile, onClose }) {
  return (
    <AnimatePresence>
      {open && profile && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[58]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 10, x: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, x: 8, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="fixed top-24 right-4 md:right-8 z-[59] w-[320px] rounded-2xl border border-white/10 bg-[#0c1118]/95 backdrop-blur-xl p-4 shadow-2xl shadow-black/40"
          >
            <div className="flex items-start gap-3">
              <UserAvatar user={profile} size="lg" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{profile.name}</p>
                <p className="text-xs text-gray-500 truncate">{profile.email}</p>
                <p className="text-[11px] text-[var(--school-accent)] mt-1">
                  {roleLabels[profile.role] || profile.role || 'Membre'}
                </p>
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-400">
              Statut public : <span className="text-white">{profile.status || 'active'}</span>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="h-8 px-3 rounded-lg text-xs border border-white/10 text-gray-300 hover:bg-white/5"
              >
                Fermer
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── LiveSummaryPanel ─────────────────────────────────────────────────────────

export function LiveSummaryPanel({ open, data, onClose }) {
  if (!open || !data) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-[4px]"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.96 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(92vw,760px)] rounded-3xl border border-white/10 bg-[#0c1118]/92 backdrop-blur-2xl p-5 md:p-7 shadow-2xl"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--school-accent)]">Post Live</p>
              <h3 className="text-xl md:text-2xl font-semibold text-white mt-1">
                {data.ai?.title || 'Résumé de session'}
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                {data.participantName} • {formatDuration(data.durationSec)} • {data.modeLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:bg-white/5"
            >
              <X className="w-4 h-4 mx-auto" />
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Analyse IA</p>
            <div className="space-y-2">
              {(data.ai?.highlights || []).map((line) => (
                <p key={line} className="text-sm text-gray-200">• {line}</p>
              ))}
            </div>
          </div>

          <div className="mt-4 grid md:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Actions proposées</p>
              <div className="space-y-1.5">
                {(data.ai?.nextActions || []).map((line) => (
                  <p key={line} className="text-sm text-gray-200">- {line}</p>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Enregistrements</p>
              <div className="space-y-2">
                {data.localRecordUrl ? (
                  <a
                    href={data.localRecordUrl}
                    download={`live-local-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`}
                    className="inline-flex items-center gap-2 text-sm text-emerald-300 hover:text-emerald-200"
                  >
                    <Download className="w-4 h-4" />
                    Télécharger local
                  </a>
                ) : (
                  <p className="text-sm text-gray-500">Pas de fichier local.</p>
                )}
                {data.cloudRecordUrl ? (
                  <a
                    href={data.cloudRecordUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-[var(--school-accent)] hover:text-[#e5c04a]"
                  >
                    <Download className="w-4 h-4" />
                    Ouvrir version cloud
                  </a>
                ) : (
                  <p className="text-sm text-gray-500">Pas de lien cloud.</p>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── LiveInvitePrompt ─────────────────────────────────────────────────────────

export function LiveInvitePrompt({
  invite,
  senderProfile,
  onAccept,
  onDecline,
  onClose,
  onScheduleMissed,
}) {
  if (!invite) return null;
  const isMissed = invite.status === 'missed';
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.97 }}
        className="fixed bottom-24 right-4 md:right-8 z-[85] w-[min(92vw,420px)] rounded-2xl border border-white/10 bg-[#0c1118]/93 backdrop-blur-2xl p-4 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 w-9 h-9 rounded-xl bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] text-[var(--school-accent)] flex items-center justify-center">
            {isMissed ? <BellRing className="w-4 h-4" /> : <CalendarClock className="w-4 h-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-wider text-gray-500">
              {isMissed ? 'Live manqué' : 'Demande Classroom immersive'}
            </p>
            <p className="text-sm text-white mt-1">
              {senderProfile?.name || 'Un membre'} vous invite à passer en mode immersive Classroom.
            </p>
            {invite.scheduled_for ? (
              <p className="text-[11px] text-[var(--school-accent)] mt-1">
                Programmé: {formatInviteDate(invite.scheduled_for)}
              </p>
            ) : null}
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2">
          {!isMissed ? (
            <>
              <button
                type="button"
                onClick={onAccept}
                className="h-9 px-3 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs font-medium"
              >
                <Check className="w-3.5 h-3.5 inline mr-1" />
                Accepter
              </button>
              <button
                type="button"
                onClick={onDecline}
                className="h-9 px-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-xs font-medium"
              >
                Décliner
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onScheduleMissed}
              className="h-9 px-3 rounded-xl bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] text-[var(--school-accent)] text-xs font-medium"
            >
              Programmer un rendez-vous
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── LiveAgendaPanel ──────────────────────────────────────────────────────────

export function LiveAgendaPanel({ open, invites, currentUserId, profiles, onJoin, onScheduleMissed, onClose }) {
  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        className="fixed top-24 right-4 md:right-8 z-[86] w-[min(94vw,420px)] max-h-[70vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0c1118]/93 backdrop-blur-2xl p-3"
      >
        <div className="flex items-center justify-between mb-2 px-1">
          <p className="text-[11px] uppercase tracking-wider text-gray-500">Agenda Live Chat</p>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-2">
          {invites.map((inv) => {
            const peerId = inv.sender_id === currentUserId ? inv.receiver_id : inv.sender_id;
            const peer = profiles[peerId] || null;
            const statusTone =
              inv.status === 'pending'
                ? 'text-amber-200 border-amber-400/30 bg-amber-500/10'
                : inv.status === 'accepted'
                  ? 'text-emerald-200 border-emerald-400/30 bg-emerald-500/10'
                  : inv.status === 'missed'
                    ? 'text-red-200 border-red-500/30 bg-red-500/10'
                    : 'text-gray-300 border-white/10 bg-white/[0.03]';
            return (
              <div key={inv.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{peer?.name || 'Interlocuteur'}</p>
                    <p className="text-[11px] text-gray-500">
                      {inv.scheduled_for
                        ? `Programmé: ${formatInviteDate(inv.scheduled_for)}`
                        : 'Invitation immédiate'}
                    </p>
                  </div>
                  <span className={cn('text-[10px] px-2 py-0.5 rounded-full border', statusTone)}>
                    {inv.status}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  {(inv.status === 'accepted' || inv.status === 'pending') ? (
                    <button
                      type="button"
                      onClick={() => onJoin(inv)}
                      className="h-8 px-2.5 rounded-lg text-[11px] bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] text-[var(--school-accent)]"
                    >
                      Ouvrir conversation
                    </button>
                  ) : null}
                  {inv.status === 'missed' ? (
                    <button
                      type="button"
                      onClick={() => onScheduleMissed(inv)}
                      className="h-8 px-2.5 rounded-lg text-[11px] bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] text-[var(--school-accent)]"
                    >
                      Reprogrammer
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
          {invites.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-6">
              Aucun live programmé pour le moment.
            </p>
          ) : null}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── liveDashboardNotifTypeLabel ──────────────────────────────────────────────

export function liveDashboardNotifTypeLabel(type) {
  if (type === 'live_now') return 'En direct';
  if (type === 'invited') return 'Invitation';
  if (type === 'waiting_entry') return "Salle d'attente";
  if (type === 'access_granted') return 'Accès';
  return type ? String(type) : 'Live';
}
