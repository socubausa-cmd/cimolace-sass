/**
 * SessionFlowPanel — Commande centrale secrétariat pour un RDV
 *
 * Transitions : pending → confirmed → chat_started → live_started → completed
 * Actions disponibles selon l'état courant :
 *   - Démarrer le chat (booking-start-immersive-chat)
 *   - Escalader en live (booking-start-immersive-live)
 *   - Marquer absent (no_show)
 *   - Terminer la session → ouvre PostSessionPanel
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle,
  Video,
  CheckCircle2,
  UserX,
  Loader2,
  ExternalLink,
  Sparkles,
  Clock,
  AlertCircle,
  Star,
  Mail,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import PostSessionPanel from './PostSessionPanel';
import AppointmentPreparationPanel from './AppointmentPreparationPanel';

/* ── Status helpers ─────────────────────────────────────────── */

const FLOW_STEPS = [
  { key: 'confirmed',     label: 'Confirmé' },
  { key: 'chat_started',  label: 'Chat démarré' },
  { key: 'live_started',  label: 'Live démarré' },
  { key: 'completed',     label: 'Terminé' },
];

function stepIndex(status) {
  const map = { confirmed: 0, chat_started: 1, live_started: 2, completed: 3, no_show: 3 };
  return map[status] ?? -1;
}

function StepBadge({ step, currentIdx, idx }) {
  const done    = idx < currentIdx;
  const active  = idx === currentIdx;
  return (
    <div className="flex flex-col items-center gap-1 flex-1">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
        done   ? 'bg-emerald-50 border-emerald-500 text-emerald-700' :
        active ? 'bg-[color-mix(in_srgb,var(--school-accent)_18%,transparent)] border-[var(--school-accent)] text-[#8A6D1A]' :
                 'bg-[#F4F5F7] border-black/[0.12] text-[#A1A1AA]'
      }`}>
        {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
      </div>
      <p className={`text-[10px] text-center leading-tight ${
        active ? 'text-[#8A6D1A]' : done ? 'text-emerald-600' : 'text-[#A1A1AA]'
      }`}>{step.label}</p>
    </div>
  );
}

function Connector({ active }) {
  return (
    <div className={`h-0.5 flex-1 mt-3.5 rounded transition-all ${active ? 'bg-emerald-400' : 'bg-black/[0.08]'}`} />
  );
}

/* ── Main component ─────────────────────────────────────────── */

export default function SessionFlowPanel({ appointment, session, onStatusChange }) {
  const { toast } = useToast();
  const [loading, setLoading]       = useState(null); // 'chat' | 'live' | 'no_show' | 'survey'
  const [showPost, setShowPost]     = useState(false);
  const [showPrep, setShowPrep]     = useState(false);
  const [surveySent, setSurveySent] = useState(false);

  if (!appointment?.id) return null;

  const status   = String(appointment.status || 'confirmed');
  const curIdx   = stepIndex(status);
  const isEnded  = status === 'completed' || status === 'no_show';

  /* ── API helpers ── */
  const callStaff = async (endpoint, body) => {
    const token = session?.access_token;
    if (!token) throw new Error('Session expirée');
    const res = await fetch(`/.netlify/functions/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Erreur serveur');
    return data;
  };

  const handleStartChat = async () => {
    setLoading('chat');
    try {
      const data = await callStaff('booking-start-immersive-chat', { appointmentId: appointment.id });
      toast({ title: 'Chat démarré', description: 'Le visiteur reçoit l\'invitation.' });
      onStatusChange?.({ ...appointment, status: 'chat_started', immersive_chat_id: data.inviteId });
    } catch (e) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(null);
    }
  };

  const handleStartLive = async () => {
    setLoading('live');
    try {
      const data = await callStaff('booking-start-immersive-live', { appointmentId: appointment.id });
      toast({ title: 'Live démarré', description: 'La salle de live est ouverte.' });
      onStatusChange?.({ ...appointment, status: 'live_started', immersive_live_id: data.liveSessionId });
    } catch (e) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(null);
    }
  };

  const handleNoShow = async () => {
    setLoading('no_show');
    try {
      await callStaff('booking-cancel-appointment', { appointmentId: appointment.id, reason: 'no_show' });
      toast({ title: 'Absent enregistré', description: 'La session est clôturée.' });
      onStatusChange?.({ ...appointment, status: 'no_show' });
    } catch (e) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="rounded-[14px] border border-black/[0.08] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-black/[0.06] bg-[#F4F5F7]">
        <Sparkles className="w-4 h-4 text-[#8A6D1A]" />
        <p className="text-sm font-semibold text-[#18181B]">Centre de commandes — Session</p>
        {!isEnded && (
          <span className="ml-auto text-[10px] rounded-full px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700">
            En cours
          </span>
        )}
        {isEnded && (
          <span className={`ml-auto text-[10px] rounded-full px-2 py-0.5 border ${
            status === 'no_show'
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-zinc-100 border-zinc-200 text-zinc-600'
          }`}>
            {status === 'no_show' ? 'Absent' : 'Terminé'}
          </span>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Stepper */}
        <div className="flex items-start gap-0">
          {FLOW_STEPS.map((step, idx) => (
            <React.Fragment key={step.key}>
              <StepBadge step={step} currentIdx={curIdx} idx={idx} />
              {idx < FLOW_STEPS.length - 1 && <Connector active={idx < curIdx} />}
            </React.Fragment>
          ))}
        </div>

        {/* Infos RDV */}
        <div className="rounded-xl bg-[#F4F5F7] border border-black/[0.06] px-3 py-2.5 space-y-1">
          {appointment.reason && (
            <p className="text-xs text-[#52525B] truncate">
              <span className="text-[#71717A]">Sujet :</span> {appointment.reason}
            </p>
          )}
          {appointment.booking_reference && (
            <p className="text-xs text-[#71717A] font-mono">Réf. {appointment.booking_reference}</p>
          )}
          {appointment.scheduled_at && (
            <p className="text-xs text-[#71717A] flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(appointment.scheduled_at).toLocaleString('fr-FR', {
                weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
              })}
            </p>
          )}
        </div>

        {/* Bouton LiveStudio — visible dès que la préparation commence */}
        {!isEnded && ['preparing','ready','in_progress','chat_started','live_started'].includes(status) && (
          <Link
            to={appointment.immersive_live_id
              ? `/live/${appointment.immersive_live_id}`
              : `/studio/appointment?appointmentId=${appointment.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-between text-xs text-purple-700 hover:text-purple-800 border border-purple-200 hover:border-purple-300 rounded-lg px-3 py-2 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Video className="w-3.5 h-3.5" /> Ouvrir LiveStudio
            </span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        )}

        {/* Bouton Studio de préparation */}
        {!isEnded && (
          <button
            onClick={() => setShowPrep(p => !p)}
            className="w-full flex items-center justify-between text-xs text-[#52525B] hover:text-[#8A6D1A] border border-black/[0.08] hover:border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] rounded-lg px-3 py-2 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <span>📋</span> Studio de préparation
            </span>
            {showPrep ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        )}

        {/* Action buttons */}
        {!isEnded && (
          <div className="space-y-2">
            {/* Démarrer le chat */}
            {curIdx <= 0 && (
              <Button
                onClick={handleStartChat}
                disabled={!!loading}
                className="w-full bg-[var(--school-accent)] text-black hover:bg-amber-400 font-semibold flex items-center gap-2"
              >
                {loading === 'chat' ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                Démarrer le chat
              </Button>
            )}

            {/* Rejoindre le chat actif */}
            {curIdx === 1 && appointment.immersive_chat_id && (
              <Button
                variant="outline"
                className="w-full border-[color-mix(in_srgb,var(--school-accent)_45%,transparent)] text-[#8A6D1A] hover:bg-[color-mix(in_srgb,var(--school-accent)_12%,transparent)] flex items-center gap-2"
                onClick={() => window.open(`/messagerie?inviteId=${appointment.immersive_chat_id}`, '_blank')}
              >
                <MessageCircle className="w-4 h-4" /> Rejoindre le chat
                <ExternalLink className="w-3 h-3 ml-auto" />
              </Button>
            )}

            {/* Escalader en live */}
            {curIdx <= 1 && (
              <Button
                onClick={handleStartLive}
                disabled={!!loading}
                variant="outline"
                className="w-full border-purple-300 text-purple-700 hover:bg-purple-50 flex items-center gap-2"
              >
                {loading === 'live' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
                Escalader en live
              </Button>
            )}

            {/* Rejoindre le live actif */}
            {curIdx >= 2 && appointment.immersive_live_id && (
              <Button
                className="w-full bg-purple-600 hover:bg-purple-500 text-white flex items-center gap-2"
                onClick={() => window.open(`/live/${appointment.immersive_live_id}`, '_blank')}
              >
                <Video className="w-4 h-4" /> Rejoindre le live
                <ExternalLink className="w-3 h-3 ml-auto" />
              </Button>
            )}

            {/* Terminer */}
            <div className="flex gap-2">
              <Button
                onClick={() => setShowPost(true)}
                disabled={!!loading}
                variant="outline"
                className="flex-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50 flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" /> Terminer & noter
              </Button>
              <Button
                onClick={handleNoShow}
                disabled={!!loading}
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-50 px-3"
                title="Marquer absent"
              >
                {loading === 'no_show' ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        )}

        {/* Post-session recap quand terminé */}
        {isEnded && status === 'completed' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-emerald-700">
              <CheckCircle2 className="w-4 h-4" /> Session terminée avec succès.
              <button onClick={() => setShowPost(true)} className="ml-auto text-xs text-[#52525B] hover:text-[#18181B] underline">
                Rapport
              </button>
            </div>
            {/* Bouton enquête de satisfaction */}
            {!surveySent && (
              <Button
                onClick={async () => {
                  setLoading('survey');
                  try {
                    const res = await callStaff('booking-satisfaction-send', { appointmentId: appointment.id });
                    setSurveySent(true);
                    toast({ title: res?.already ? 'Enquête déjà envoyée' : 'Enquête envoyée', description: res?.already ? 'L\'élève a déjà reçu le lien.' : 'Le lien d\'évaluation a été envoyé par email.' });
                  } catch (e) {
                    toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
                  } finally {
                    setLoading(null);
                  }
                }}
                disabled={!!loading}
                variant="outline"
                className="w-full border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] text-[#8A6D1A] hover:bg-[color-mix(in_srgb,var(--school-accent)_12%,transparent)] flex items-center gap-2 text-sm"
              >
                {loading === 'survey' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                Envoyer l'enquête de satisfaction
              </Button>
            )}
            {surveySent && (
              <div className="flex items-center gap-2 text-xs text-[#8A6D1A]">
                <Star className="w-3.5 h-3.5" /> Enquête envoyée à l'élève.
              </div>
            )}
          </div>
        )}

        {isEnded && status === 'no_show' && (
          <div className="flex items-center gap-2 text-sm text-red-700">
            <AlertCircle className="w-4 h-4" /> Absent — session clôturée.
          </div>
        )}
      </div>

      {/* Preparation panel (accordéon) */}
      <AnimatePresence>
        {showPrep && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-black/[0.08]"
          >
            <AppointmentPreparationPanel
              appointment={appointment}
              session={session}
              onStatusChange={(updated) => {
                setShowPrep(false);
                onStatusChange?.(updated);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Post-session panel (drawer inlined) */}
      <AnimatePresence>
        {showPost && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-black/[0.08]"
          >
            <PostSessionPanel
              appointment={appointment}
              session={session}
              onDone={(updated) => {
                setShowPost(false);
                onStatusChange?.({ ...appointment, status: 'completed', ...updated });
              }}
              onCancel={() => setShowPost(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
