/**
 * SecretariatAppointmentsPage — Vue unifiée des rendez-vous actifs
 *
 * Layout split-view :
 *   Gauche  → liste de tous les RDV avec statut coloré, sujet, visiteur, heure
 *   Droite  → SessionFlowPanel du RDV sélectionné
 *
 * Filtres : statut (tous / pending / confirmed / preparing / ready / in_progress)
 * Realtime : channel Supabase sur appointments + appointment_preparation
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarClock, RefreshCw, Search, Users, Clock,
  ChevronRight, ChevronLeft, Loader2, Inbox, Sparkles,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import SessionFlowPanel from '@/components/secretariat/SessionFlowPanel';
import {
  BOOKING_CHANNEL_NGOWAZULU,
  BOOKING_CHANNEL_PRORASCIENCE,
} from '@/config/ngowazuluConsultation';

/* ── Statut config ─────────────────────────────────────────── */
const STATUS_CONFIG = {
  pending:      { label: 'En attente',    dot: 'bg-amber-400',   ring: 'border-amber-500/30  bg-amber-500/8'   },
  confirmed:    { label: 'Confirmé',      dot: 'bg-emerald-400', ring: 'border-emerald-500/30 bg-emerald-500/8' },
  scheduled:    { label: 'Planifié',      dot: 'bg-emerald-400', ring: 'border-emerald-500/30 bg-emerald-500/8' },
  preparing:    { label: 'Préparation',   dot: 'bg-blue-400',    ring: 'border-blue-500/30    bg-blue-500/8'    },
  ready:        { label: 'Prêt ✓',       dot: 'bg-violet-400',  ring: 'border-violet-500/30  bg-violet-500/8',  pulse: true },
  in_progress:  { label: 'En cours',      dot: 'bg-emerald-400', ring: 'border-emerald-500/30 bg-emerald-500/8', pulse: true },
  chat_started: { label: 'Chat',          dot: 'bg-emerald-400', ring: 'border-emerald-500/30 bg-emerald-500/8', pulse: true },
  live_started: { label: 'Live',          dot: 'bg-violet-400',  ring: 'border-violet-500/30  bg-violet-500/8',  pulse: true },
  completed:    { label: 'Terminé',       dot: 'bg-gray-500',    ring: 'border-white/10       bg-white/3'       },
  no_show:      { label: 'Absent',        dot: 'bg-red-400',     ring: 'border-red-500/20     bg-red-500/5'     },
  cancelled:    { label: 'Annulé',        dot: 'bg-red-400',     ring: 'border-red-500/20     bg-red-500/5'     },
};

const ACTIVE_STATUSES = ['pending','confirmed','scheduled','preparing','ready','in_progress','chat_started','live_started'];
const FILTER_OPTIONS  = [
  { value: 'active',      label: 'Actifs' },
  { value: 'pending',     label: 'En attente' },
  { value: 'preparing',   label: 'Préparation' },
  { value: 'ready',       label: 'Prêts' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'completed',   label: 'Terminés' },
];

function StatusDot({ status, pulse }) {
  const conf = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <motion.div
      animate={pulse || conf.pulse ? { scale: [1, 1.4, 1], opacity: [1, 0.5, 1] } : { scale: 1 }}
      transition={pulse || conf.pulse ? { duration: 1.5, repeat: Infinity } : {}}
      className={`w-2 h-2 rounded-full shrink-0 ${conf.dot}`}
    />
  );
}

function AppointmentCard({ appt, selected, onSelect }) {
  const conf    = STATUS_CONFIG[appt.status] || STATUS_CONFIG.pending;
  const subject = appt.request?.subject || appt.request?.reason || appt.reason || 'Entretien';
  const visitor = appt.request?.visitor_name || appt.student_profile?.name || appt.student_profile?.email || appt.student_id?.slice(0, 8);
  const time    = appt.scheduled_at ? format(new Date(appt.scheduled_at), 'dd MMM · HH:mm', { locale: fr }) : '—';

  return (
    <motion.button
      whileHover={{ x: 2 }}
      onClick={() => onSelect(appt)}
      className={`w-full text-left rounded-xl border px-4 py-3.5 transition-all flex items-center gap-3 ${
        selected
          ? 'border-[#D4AF37]/50 bg-[#D4AF37]/10 shadow-[0_0_20px_rgba(212,175,55,0.1)]'
          : `${conf.ring} hover:border-white/20`
      }`}
    >
      <StatusDot status={appt.status} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{subject}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-xs text-gray-500 truncate">{visitor}</p>
          <span className="text-gray-700">·</span>
          <p className="text-xs text-gray-500 shrink-0">{time}</p>
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <span className={`text-[10px] rounded-full px-2 py-0.5 border font-medium ${
            selected ? 'border-[#D4AF37]/40 bg-[#D4AF37]/15 text-[#D4AF37]' :
            `border-white/10 bg-white/5 text-gray-400`
          }`}>
            {conf.label}
          </span>
          {appt.booking_reference && (
            <span className="text-[10px] text-gray-600 font-mono">
              {String(appt.booking_reference).slice(0, 8).toUpperCase()}
            </span>
          )}
        </div>
      </div>
      <ChevronRight className={`w-4 h-4 shrink-0 transition-colors ${selected ? 'text-[#D4AF37]' : 'text-gray-600'}`} />
    </motion.button>
  );
}

export default function SecretariatAppointmentsPage() {
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const channelParam = String(searchParams.get('channel') || '').toLowerCase();
  const bookingChannel =
    channelParam === BOOKING_CHANNEL_NGOWAZULU ? BOOKING_CHANNEL_NGOWAZULU : BOOKING_CHANNEL_PRORASCIENCE;

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [loadError, setLoadError]       = useState('');
  const [filter, setFilter]             = useState('active');
  const [search, setSearch]             = useState('');
  const [selected, setSelected]         = useState(null);

  /* Pré-sélectionner depuis ?appointmentId=... (lien notification) */
  useEffect(() => {
    const id = searchParams.get('appointmentId');
    if (id && appointments.length > 0) {
      const found = appointments.find(a => a.id === id);
      if (found) setSelected(found);
    }
  }, [searchParams, appointments]);

  /* ── Chargement ── */
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      let q = supabase
        .from('appointments')
        .select(`
          id, status, scheduled_at, booking_reference, reason,
          booking_channel,
          student_id, immersive_chat_id, immersive_live_id,
          request_id, assigned_teacher_id,
          student_profile:profiles!appointments_student_id_fkey(name, email),
          request:appointment_requests!appointments_request_id_fkey(subject, reason, visitor_name, visitor_email, visitor_timezone)
        `)
        .eq('booking_channel', bookingChannel)
        .order('scheduled_at', { ascending: true })
        .limit(100);

      const { data, error } = await q;
      if (error) {
        setAppointments([]);
        setSelected(null);
        setLoadError(error.message || 'Impossible de charger les rendez-vous.');
        return;
      }
      setAppointments(data || []);

      /* Si un appointmentId est dans l'URL, on le sélectionne */
      const id = searchParams.get('appointmentId');
      if (id && data) {
        const found = data.find(a => a.id === id);
        if (found) {
          setSelected(found);
        } else {
          // Le lien de notification peut pointer vers un RDV hors des 100 lignes chargées.
          const { data: one, error: oneErr } = await supabase
            .from('appointments')
            .select(`
              id, status, scheduled_at, booking_reference, reason,
              booking_channel,
              student_id, immersive_chat_id, immersive_live_id,
              request_id, assigned_teacher_id,
              student_profile:profiles!appointments_student_id_fkey(name, email),
              request:appointment_requests!appointments_request_id_fkey(subject, reason, visitor_name, visitor_email, visitor_timezone)
            `)
            .eq('id', id)
            .maybeSingle();
          if (!oneErr && one?.id) {
            setSelected(one);
            setAppointments((prev) => (prev.some((a) => a.id === one.id) ? prev : [one, ...prev]));
          }
        }
      }
    } finally {
      setLoading(false);
    }
  }, [bookingChannel, searchParams]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('sec-appointments-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointment_preparation' }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [load]);

  /* ── Filtrage ── */
  const filtered = useMemo(() => {
    let list = appointments;

    if (filter === 'active') {
      list = list.filter(a => ACTIVE_STATUSES.includes(a.status));
    } else {
      list = list.filter(a => a.status === filter);
    }

    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(a => {
        const subject = (a.request?.subject || a.request?.reason || a.reason || '').toLowerCase();
        const visitor = (a.request?.visitor_name || a.student_profile?.name || a.student_profile?.email || '').toLowerCase();
        const ref     = String(a.booking_reference || '').toLowerCase();
        return subject.includes(s) || visitor.includes(s) || ref.includes(s);
      });
    }

    return list;
  }, [appointments, filter, search]);

  /* Mise à jour du RDV sélectionné depuis SessionFlowPanel */
  const handleStatusChange = useCallback((updated) => {
    setSelected(updated);
    setAppointments(prev => prev.map(a => a.id === updated.id ? { ...a, ...updated } : a));
  }, []);

  /* Stats rapides */
  const stats = useMemo(() => {
    const active    = appointments.filter(a => ACTIVE_STATUSES.includes(a.status)).length;
    const ready     = appointments.filter(a => a.status === 'ready').length;
    const preparing = appointments.filter(a => a.status === 'preparing').length;
    const pending   = appointments.filter(a => a.status === 'pending').length;
    return { active, ready, preparing, pending };
  }, [appointments]);

  return (
    <div className="space-y-4 h-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-[#D4AF37]" />
            Rendez-vous actifs — {bookingChannel === BOOKING_CHANNEL_NGOWAZULU ? 'Ngowazulu' : 'Prorascience'}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {stats.active} actif{stats.active > 1 ? 's' : ''} · {stats.ready} prêt{stats.ready > 1 ? 's' : ''} · {stats.pending} en attente
          </p>
        </div>
        <Button onClick={load} variant="outline" size="sm" className="border-white/10 text-white hover:bg-white/5" disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {loadError ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {loadError}
        </div>
      ) : null}

      {/* Filtres + Recherche */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1">
          <button
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.set('channel', BOOKING_CHANNEL_PRORASCIENCE);
              setSearchParams(next);
            }}
            className={`text-xs rounded-lg border px-3 py-1.5 font-medium transition-all ${
              bookingChannel === BOOKING_CHANNEL_PRORASCIENCE
                ? 'bg-[#D4AF37]/20 border-[#D4AF37]/50 text-[#D4AF37]'
                : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/25 hover:text-white'
            }`}
          >
            Prorascience
          </button>
          <button
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.set('channel', BOOKING_CHANNEL_NGOWAZULU);
              setSearchParams(next);
            }}
            className={`text-xs rounded-lg border px-3 py-1.5 font-medium transition-all ${
              bookingChannel === BOOKING_CHANNEL_NGOWAZULU
                ? 'bg-[#D4AF37]/20 border-[#D4AF37]/50 text-[#D4AF37]'
                : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/25 hover:text-white'
            }`}
          >
            Ngowazulu
          </button>
        </div>
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher sujet, visiteur, réf…"
            className="w-full pl-8 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#D4AF37]/40 transition-colors"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`text-xs rounded-lg border px-3 py-1.5 font-medium transition-all ${
                filter === opt.value
                  ? 'bg-[#D4AF37]/20 border-[#D4AF37]/50 text-[#D4AF37]'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/25 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Split-view desktop ; mobile = liste puis détail plein écran */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 min-h-[min(500px,70dvh)] lg:min-h-[500px]">

        {/* ── Liste gauche ── */}
        <div
          className={cn(
            'lg:col-span-2 space-y-2 overflow-y-auto max-h-[min(52dvh,420px)] lg:max-h-[700px] pr-1',
            selected ? 'hidden lg:block' : 'block',
          )}
        >
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-600 gap-3">
              <Inbox className="w-10 h-10 opacity-30" />
              <p className="text-sm">Aucun rendez-vous trouvé</p>
            </div>
          ) : (
            filtered.map(appt => (
              <AppointmentCard
                key={appt.id}
                appt={appt}
                selected={selected?.id === appt.id}
                onSelect={setSelected}
              />
            ))
          )}
        </div>

        {/* ── Panneau droit ── */}
        <div
          className={cn(
            'lg:col-span-3',
            selected &&
              'fixed inset-0 z-[60] flex flex-col overflow-hidden bg-[#0a0f14] pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] px-3 sm:px-4 lg:static lg:z-auto lg:overflow-visible lg:bg-transparent lg:p-0',
          )}
        >
          <AnimatePresence mode="wait">
            {selected ? (
              <motion.div
                key={selected.id}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.18 }}
                className="flex min-h-0 flex-1 flex-col gap-3 lg:gap-0 lg:block"
              >
                <div className="flex shrink-0 items-center gap-2 lg:hidden">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-white/15 text-white hover:bg-white/10"
                    onClick={() => setSelected(null)}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Liste
                  </Button>
                  <p className="min-w-0 truncate text-xs text-gray-400">
                    {selected.request?.subject || selected.request?.reason || selected.reason || 'Entretien'}
                  </p>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain lg:overflow-visible lg:flex-none">
                  <SessionFlowPanel
                    appointment={selected}
                    session={session}
                    onStatusChange={handleStatusChange}
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="hidden lg:flex flex-col items-center justify-center h-full min-h-[300px] rounded-2xl border border-white/8 bg-white/3 text-gray-600 gap-4"
              >
                <div className="w-14 h-14 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-[#D4AF37]/50" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-400">Sélectionnez un rendez-vous</p>
                  <p className="text-xs text-gray-600 mt-1">Le panneau de commandes s'affichera ici</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
