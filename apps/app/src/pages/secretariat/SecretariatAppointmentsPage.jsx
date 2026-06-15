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
  pending:      { label: 'En attente',    dot: 'bg-amber-500',   ring: 'border-amber-200  bg-amber-50'   },
  confirmed:    { label: 'Confirmé',      dot: 'bg-emerald-500', ring: 'border-emerald-200 bg-emerald-50' },
  scheduled:    { label: 'Planifié',      dot: 'bg-emerald-500', ring: 'border-emerald-200 bg-emerald-50' },
  preparing:    { label: 'Préparation',   dot: 'bg-blue-500',    ring: 'border-blue-200    bg-blue-50'    },
  ready:        { label: 'Prêt ✓',       dot: 'bg-violet-500',  ring: 'border-violet-200  bg-violet-50',  pulse: true },
  in_progress:  { label: 'En cours',      dot: 'bg-emerald-500', ring: 'border-emerald-200 bg-emerald-50', pulse: true },
  chat_started: { label: 'Chat',          dot: 'bg-emerald-500', ring: 'border-emerald-200 bg-emerald-50', pulse: true },
  live_started: { label: 'Live',          dot: 'bg-violet-500',  ring: 'border-violet-200  bg-violet-50',  pulse: true },
  completed:    { label: 'Terminé',       dot: 'bg-zinc-400',    ring: 'border-black/[0.08]   bg-white'       },
  no_show:      { label: 'Absent',        dot: 'bg-red-500',     ring: 'border-red-200     bg-red-50'     },
  cancelled:    { label: 'Annulé',        dot: 'bg-red-500',     ring: 'border-red-200     bg-red-50'     },
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
          ? 'border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] shadow-[0_1px_4px_rgba(212,175,55,0.18)]'
          : `${conf.ring} hover:border-black/20`
      }`}
    >
      <StatusDot status={appt.status} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#18181B] truncate">{subject}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-xs text-[#71717A] truncate">{visitor}</p>
          <span className="text-[#A1A1AA]">·</span>
          <p className="text-xs text-[#71717A] shrink-0">{time}</p>
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <span className={`text-[10px] rounded-full px-2 py-0.5 border font-medium ${
            selected ? 'border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)] text-[#8A6D1A]' :
            `border-black/[0.08] bg-[#F4F5F7] text-[#52525B]`
          }`}>
            {conf.label}
          </span>
          {appt.booking_reference && (
            <span className="text-[10px] text-[#A1A1AA] font-mono">
              {String(appt.booking_reference).slice(0, 8).toUpperCase()}
            </span>
          )}
        </div>
      </div>
      <ChevronRight className={`w-4 h-4 shrink-0 transition-colors ${selected ? 'text-[#8A6D1A]' : 'text-[#A1A1AA]'}`} />
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

  /* ── Normalise les champs de l'API booking vers le schéma attendu ── */
  const normalizeAppt = useCallback((raw, profileMap = {}) => {
    if (!raw) return raw;
    const slot = raw.booking_slots || {};
    const profile = profileMap[raw.student_id] || {};
    return {
      ...raw,
      // Champ temporel unifié
      scheduled_at: slot.start_at || raw.created_at,
      // Référence lisible
      booking_reference: raw.booking_reference || raw.id?.slice(0, 8).toUpperCase(),
      // Sujet / raison
      reason: raw.notes || slot.title || '',
      // Canal (source → booking_channel)
      booking_channel: raw.booking_channel || raw.source || '',
      // Profil étudiant synthétique
      student_profile: raw.student_profile || (profile.id ? profile : null),
      // Compatibilité champ "request" utilisé dans la recherche / l'affichage
      request: raw.request || {
        subject: slot.title || raw.notes || '',
        reason: raw.notes || '',
        visitor_name: profile.name || profile.email || '',
        visitor_email: profile.email || '',
      },
    };
  }, []);

  /* ── Chargement ── */
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      // L'adaptateur route appointments → bookingApi.listAppointments()
      // qui retourne : *, booking_slots(start_at, end_at, title, type)
      const { data, error } = await supabase
        .from('appointments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        setAppointments([]);
        setSelected(null);
        setLoadError(error.message || 'Impossible de charger les rendez-vous.');
        return;
      }

      const raw = data || [];

      // Chargement des profils pour les student_ids uniques
      let profileMap = {};
      const studentIds = [...new Set(raw.map(a => a.student_id).filter(Boolean))];
      if (studentIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id,name,email')
          .in('id', studentIds);
        profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));
      }

      const normalized = raw.map(a => normalizeAppt(a, profileMap));
      setAppointments(normalized);

      /* Si un appointmentId est dans l'URL, on le sélectionne */
      const targetId = searchParams.get('appointmentId');
      if (targetId) {
        const found = normalized.find(a => a.id === targetId);
        if (found) {
          setSelected(found);
        } else {
          const { data: one, error: oneErr } = await supabase
            .from('appointments')
            .select('*')
            .eq('id', targetId)
            .maybeSingle();
          if (!oneErr && one?.id) {
            const norm = normalizeAppt(one, profileMap);
            setSelected(norm);
            setAppointments((prev) => (prev.some((a) => a.id === norm.id) ? prev : [norm, ...prev]));
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
          <h2 className="text-xl font-bold text-[#18181B] flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-[#8A6D1A]" />
            Rendez-vous actifs — {bookingChannel === BOOKING_CHANNEL_NGOWAZULU ? 'Ngowazulu' : 'Prorascience'}
          </h2>
          <p className="text-xs text-[#71717A] mt-0.5">
            {stats.active} actif{stats.active > 1 ? 's' : ''} · {stats.ready} prêt{stats.ready > 1 ? 's' : ''} · {stats.pending} en attente
          </p>
        </div>
        <Button onClick={load} variant="outline" size="sm" className="border-black/[0.08] bg-white text-[#18181B] hover:bg-[#F4F5F7]" disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
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
                ? 'bg-[color-mix(in_srgb,var(--school-accent)_18%,transparent)] border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] text-[#8A6D1A]'
                : 'bg-white border-black/[0.08] text-[#52525B] hover:border-black/25 hover:text-[#18181B]'
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
                ? 'bg-[color-mix(in_srgb,var(--school-accent)_18%,transparent)] border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] text-[#8A6D1A]'
                : 'bg-white border-black/[0.08] text-[#52525B] hover:border-black/25 hover:text-[#18181B]'
            }`}
          >
            Ngowazulu
          </button>
        </div>
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#71717A]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher sujet, visiteur, réf…"
            className="w-full pl-8 pr-3 py-2 rounded-xl bg-white border border-black/[0.08] text-sm text-[#18181B] placeholder-[#71717A] focus:outline-none focus:border-[color-mix(in_srgb,var(--school-accent)_45%,transparent)] transition-colors"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`text-xs rounded-lg border px-3 py-1.5 font-medium transition-all ${
                filter === opt.value
                  ? 'bg-[color-mix(in_srgb,var(--school-accent)_18%,transparent)] border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] text-[#8A6D1A]'
                  : 'bg-white border-black/[0.08] text-[#52525B] hover:border-black/25 hover:text-[#18181B]'
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
            <div className="flex items-center justify-center py-16 text-[#71717A]">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-[#71717A] gap-3">
              <Inbox className="w-10 h-10 opacity-40" />
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
              'fixed inset-0 z-[60] flex flex-col overflow-hidden bg-[#F4F5F7] pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] px-3 sm:px-4 lg:static lg:z-auto lg:overflow-visible lg:bg-transparent lg:p-0',
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
                    className="border-black/[0.12] bg-white text-[#18181B] hover:bg-[#F4F5F7]"
                    onClick={() => setSelected(null)}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Liste
                  </Button>
                  <p className="min-w-0 truncate text-xs text-[#52525B]">
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
                className="hidden lg:flex flex-col items-center justify-center h-full min-h-[300px] rounded-[14px] border border-black/[0.08] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] text-[#71717A] gap-4"
              >
                <div className="w-14 h-14 rounded-full bg-[color-mix(in_srgb,var(--school-accent)_12%,transparent)] border border-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-[#8A6D1A]" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-[#52525B]">Sélectionnez un rendez-vous</p>
                  <p className="text-xs text-[#71717A] mt-1">Le panneau de commandes s'affichera ici</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
