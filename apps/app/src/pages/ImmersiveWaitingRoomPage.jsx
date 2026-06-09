import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CalendarClock, CheckCircle2, Circle, Clock, Globe, Loader2,
  MessageSquare, Sparkles, Timer, Video, ArrowRight, User,
  BookOpen, AlertCircle, FileText, Zap, Edit3, Save, ChevronDown,
  ChevronUp, Target, List, Star, Wifi,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { JourneyAmbient, JourneyMobileDock, JourneySectionLabel } from '@/components/booking/AppointmentJourneyPrimitives';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/hooks/useAuth';

/* ─── helpers ───────────────────────────────────────────────── */
function fmtLocal(iso, tz) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      timeZone: tz || undefined,
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return new Date(iso).toLocaleString('fr-FR'); }
}

function fmtTz(tz) {
  if (!tz) return null;
  try {
    const offset = new Intl.DateTimeFormat('fr-FR', { timeZone: tz, timeZoneName: 'short' })
      .formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value;
    return `${tz.replace(/_/g, ' ')}${offset ? ` (${offset})` : ''}`;
  } catch { return tz; }
}

function useCountdown(scheduledAt) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return useMemo(() => {
    if (!scheduledAt) return null;
    const ms = new Date(scheduledAt).getTime() - now;
    if (ms <= 0) return { days: 0, hours: 0, mins: 0, secs: 0, isNow: true, isPast: true };
    const days  = Math.floor(ms / 86_400_000);
    const hours = Math.floor((ms % 86_400_000) / 3_600_000);
    const mins  = Math.floor((ms % 3_600_000) / 60_000);
    const secs  = Math.floor((ms % 60_000) / 1000);
    return { days, hours, mins, secs, isNow: ms <= 15 * 60_000, isPast: false };
  }, [scheduledAt, now]);
}

/* ─── Status config ───────────────────────────────────────── */
const STATUS_CONFIG = {
  pending:     { label: 'En attente de validation', color: 'bg-amber-500/20 text-amber-200 border-amber-500/30',   dot: 'bg-amber-400' },
  confirmed:   { label: 'Confirmé',                 color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', dot: 'bg-emerald-400' },
  scheduled:   { label: 'Planifié',                 color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', dot: 'bg-emerald-400' },
  preparing:   { label: 'En cours de préparation',  color: 'bg-[#D4AF37]/15 text-[#D4AF37] border-[#D4AF37]/35',      dot: 'bg-[#D4AF37]' },
  ready:       { label: 'Prêt à démarrer',          color: 'bg-violet-500/20 text-violet-300 border-violet-500/30', dot: 'bg-violet-400', pulse: true },
  in_progress: { label: 'Séance en cours',          color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', dot: 'bg-emerald-400', pulse: true },
  chat_started: { label: 'Chat en cours',           color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', dot: 'bg-emerald-400', pulse: true },
  live_started: { label: 'Live en cours',           color: 'bg-violet-500/20 text-violet-300 border-violet-500/30', dot: 'bg-violet-400', pulse: true },
  cancelled:   { label: 'Annulé',                   color: 'bg-red-500/20 text-red-300 border-red-500/30',         dot: 'bg-red-400' },
  rescheduled: { label: 'Reprogrammé',              color: 'bg-violet-500/20 text-violet-300 border-violet-500/30', dot: 'bg-violet-400' },
  completed:   { label: 'Terminé',                  color: 'bg-white/10 text-gray-400 border-white/15',            dot: 'bg-gray-500' },
};

/* ─── CountdownUnit ─────────────────────────────────────────── */
function CountdownUnit({ value, label }) {
  return (
    <div className="flex flex-col items-center min-w-[4.5rem] sm:min-w-0">
      <div className="text-4xl sm:text-6xl font-bold tabular-nums text-white leading-none">
        {String(value).padStart(2, '0')}
      </div>
      <span className="text-[10px] sm:text-xs text-gray-500 mt-1 uppercase tracking-widest">{label}</span>
    </div>
  );
}

/* ─── Plan steps labels ─────────────────────────────────────── */
const DEFAULT_PLAN_STEPS = [
  { step: 'introduction',  title: 'Introduction',   icon: '👋' },
  { step: 'definition',    title: 'Définition',     icon: '📖' },
  { step: 'analyse',       title: 'Analyse',        icon: '🔍' },
  { step: 'cas_pratiques', title: 'Cas pratiques',  icon: '💡' },
  { step: 'orientation',   title: 'Orientation',    icon: '🎯' },
  { step: 'conclusion',    title: 'Conclusion',     icon: '✅' },
];

/* ─── PlanSection ───────────────────────────────────────────── */
function PlanSection({ plan }) {
  const [expanded, setExpanded] = useState(false);
  if (!plan?.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 overflow-hidden shadow-[0_0_40px_rgba(212,175,55,0.06)]"
    >
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#D4AF37]/10 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <List className="w-4 h-4 text-[#D4AF37]" />
          <span className="font-semibold text-white">Plan de l'entretien</span>
          <Badge className="bg-[#D4AF37]/15 text-[#D4AF37] border-[#D4AF37]/35 text-xs">
            {plan.length} étapes
          </Badge>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-3">
              {plan.map((item, idx) => {
                const meta = DEFAULT_PLAN_STEPS.find(s => s.step === item.step) || {};
                return (
                  <div key={idx} className="flex gap-3 items-start bg-white/5 rounded-xl px-4 py-3 border border-white/8">
                    <span className="text-lg leading-none mt-0.5">{meta.icon || '•'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-white">{item.title || meta.title || item.step}</p>
                        {item.duration_min && (
                          <span className="text-[10px] text-gray-500 border border-white/10 rounded px-1.5 py-0.5">
                            {item.duration_min} min
                          </span>
                        )}
                      </div>
                      {item.content && (
                        <p className="text-xs text-gray-400 mt-1 leading-relaxed">{item.content}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── SmartRoomPreview ─────────────────────────────────────── */
function SmartRoomPreview({ roomType }) {
  const features = [
    { id: 'chat', label: 'Chat immersif',       icon: MessageSquare, active: true },
    { id: 'live', label: 'Live possible',        icon: Video,         active: roomType === 'live' || roomType === 'chat_then_live' },
    { id: 'board', label: 'Tableau interactif', icon: Target,        active: false },
  ];

  return (
    <div className="space-y-2">
      <JourneySectionLabel>Smart Room</JourneySectionLabel>
      <div className="grid grid-cols-3 gap-3">
        {features.map(f => (
          <div key={f.id} className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-4 text-center transition-all ${
            f.active
              ? 'border-[#D4AF37]/30 bg-[#D4AF37]/8 text-[#D4AF37]'
              : 'border-white/8 bg-white/3 text-gray-600'
          }`}>
            <f.icon className="w-5 h-5" />
            <span className="text-[11px] font-medium leading-tight">{f.label}</span>
            {f.active && <Zap className="w-2.5 h-2.5 text-[#D4AF37]/60" />}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── PreparationModule ─────────────────────────────────────── */
const PreparationModule = React.memo(function PreparationModule({ appointmentId, userId }) {
  const [note, setNote]       = useState('');
  const [saved, setSaved]     = useState(false);
  const [saving, setSaving]   = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !appointmentId) { setLoading(false); return; }
    (async () => {
      try {
        const { data, error } = await supabase
          .from('client_notes')
          .select('note')
          .eq('appointment_id', appointmentId)
          .eq('user_id', userId)
          .maybeSingle();
        if (!error && data?.note) setNote(data.note);
      } catch { /* table optionnelle */ } finally {
        setLoading(false);
      }
    })();
  }, [appointmentId, userId]);

  const handleSave = async () => {
    if (!userId || !appointmentId || saving) return;
    setSaving(true);
    try {
      try {
        await supabase
          .from('client_notes')
          .upsert(
            { appointment_id: appointmentId, user_id: userId, note, updated_at: new Date().toISOString() },
            { onConflict: 'appointment_id,user_id' }
          );
      } catch { /* table optionnelle */ }
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const checklist = [
    'Notez vos questions à l\'avance',
    'Définissez vos objectifs pour cet entretien',
    'Installez-vous dans un endroit calme',
    'Vérifiez votre connexion internet',
  ];

  return (
    <div className="rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/5 overflow-hidden">
      <div className="px-5 py-4 border-b border-[#D4AF37]/10 flex items-center gap-2">
        <Target className="w-4 h-4 text-[#D4AF37]" />
        <p className="font-semibold text-white text-sm">Préparez votre séance</p>
      </div>
      <div className="p-5 space-y-4">
        {/* Checklist */}
        <ul className="space-y-2">
          {checklist.map((item, i) => (
            <li key={i} className="flex items-center gap-2.5 text-sm text-gray-300">
              <CheckCircle2 className="w-4 h-4 text-[#D4AF37]/60 shrink-0" />
              {item}
            </li>
          ))}
        </ul>

        {/* Note personnelle — uniquement si connecté */}
        {userId && (
          <div className="space-y-2 pt-2 border-t border-white/8">
            <label className="text-xs text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <Edit3 className="w-3 h-3" /> Votre note pour la séance
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={loading ? 'Chargement de votre note…' : 'Questions, objectifs, points importants à aborder…'}
              rows={3}
              disabled={loading}
              className="w-full resize-none rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#D4AF37]/40 disabled:opacity-70"
            />
            <button
              onClick={handleSave}
              disabled={loading || saving || !note.trim()}
              className="flex items-center gap-1.5 text-xs font-medium text-[#D4AF37] disabled:opacity-40"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              {saved ? 'Note sauvegardée' : 'Sauvegarder la note'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

/* ─── Main ───────────────────────────────────────────────────── */
const ImmersiveWaitingRoomPage = () => {
  const { reference: refParam } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const reference    = refParam || searchParams.get('ref') || searchParams.get('reference') || '';
  const appointmentId = searchParams.get('appointmentId') || '';

  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [data, setData]           = useState(null);
  const [preparation, setPrep]    = useState(null);
  const loadingRef = useRef(false);

  /* ─── load data ─── */
  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setError(null);
    try {
      let request = null;
      let appointment = null;

      /* 1 — fetch by reference */
      if (reference) {
        const { data: appt } = await supabase
          .from('appointments')
          .select(`
            id, booking_reference, status, scheduled_at, visitor_timezone,
            secretary_timezone, visitor_local_datetime, secretary_local_datetime,
            is_prime_hour, immersive_chat_id, immersive_live_id,
            secretary_id, secretary_team_id, request_id, student_id
          `)
          .ilike('booking_reference', reference)
          .maybeSingle();
        appointment = appt || null;
        // Normalise scheduled_at depuis booking_slots si absent (booking API shape)
        if (appointment && !appointment.scheduled_at && appointment.booking_slots?.start_at) {
          appointment = { ...appointment, scheduled_at: appointment.booking_slots.start_at };
        }

        if (appointment?.request_id) {
          const { data: req } = await supabase
            .from('appointment_requests')
            .select('id, subject, description, reason, visitor_name, visitor_email, status, scheduled_at, visitor_timezone, visitor_region, booking_reference')
            .eq('id', appointment.request_id)
            .maybeSingle();
          request = req || null;
        }

        /* 1b — si appointment annulé et pas de request via request_id,
                chercher la request par booking_reference ou par student */
        if (!request && appointment?.status === 'cancelled') {
          // a) par booking_reference exact
          const { data: reqByRef } = await supabase
            .from('appointment_requests')
            .select('id, subject, description, reason, visitor_name, visitor_email, status, scheduled_at, visitor_timezone, visitor_region, booking_reference')
            .ilike('booking_reference', reference)
            .maybeSingle();
          request = reqByRef || null;

          // b) fallback : request active de l'utilisateur connecté
          if (!request && user?.id) {
            const { data: reqByUser } = await supabase
              .from('appointment_requests')
              .select('id, subject, description, reason, visitor_name, visitor_email, status, scheduled_at, visitor_timezone, visitor_region, booking_reference')
              .eq('student_id', user.id)
              .in('status', ['pending', 'confirmed'])
              .order('scheduled_at', { ascending: true })
              .limit(1)
              .maybeSingle();
            request = reqByUser || null;
          }
        }
      }

      /* 2 — fallback: appointmentId or current user */
      if (!appointment) {
        let q = supabase.from('appointments').select(`
          id, booking_reference, status, scheduled_at, visitor_timezone,
          secretary_timezone, visitor_local_datetime, secretary_local_datetime,
          is_prime_hour, immersive_chat_id, immersive_live_id,
          secretary_id, secretary_team_id, request_id, student_id
        `);
        if (appointmentId) {
          q = q.eq('id', appointmentId);
        } else if (user?.id) {
          q = q.eq('student_id', user.id)
            .in('status', ['scheduled', 'pending', 'confirmed', 'preparing', 'ready', 'in_progress', 'rescheduled'])
            .order('scheduled_at', { ascending: true })
            .limit(1);
        }
        const { data: appt } = await q.maybeSingle();
        appointment = appt || null;
        // Normalise scheduled_at depuis booking_slots si absent (booking API shape)
        if (appointment && !appointment.scheduled_at && appointment.booking_slots?.start_at) {
          appointment = { ...appointment, scheduled_at: appointment.booking_slots.start_at };
        }

        if (!request && appointment?.request_id) {
          const { data: req } = await supabase
            .from('appointment_requests')
            .select('id, subject, description, reason, visitor_name, visitor_email, status, scheduled_at, visitor_timezone, visitor_region')
            .eq('id', appointment.request_id)
            .maybeSingle();
          request = req || null;
        }
      }

      /* 3 — si pas d'appointment, chercher dans appointment_requests */
      if (!appointment && user?.id) {
        const { data: req } = await supabase
          .from('appointment_requests')
          .select('id, subject, description, reason, visitor_name, status, scheduled_at, visitor_timezone, visitor_region, booking_reference')
          .eq('student_id', user.id)
          .in('status', ['pending', 'confirmed'])
          .order('scheduled_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        request = req || null;
      }

      /* 4 — secrétaire */
      let secretary = null;
      if (appointment?.secretary_id) {
        const { data: sec } = await supabase
          .from('secretaries')
          .select('id, display_name, timezone, status, team_id')
          .eq('id', appointment.secretary_id)
          .maybeSingle();
        secretary = sec || null;

        /* Fallback : chercher dans profiles */
        if (!secretary) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('id, name, timezone, is_secretariat_online')
            .eq('id', appointment.secretary_id)
            .maybeSingle();
          if (prof) {
            secretary = { id: prof.id, display_name: prof.name, timezone: prof.timezone, status: prof.is_secretariat_online ? 'online' : 'offline' };
          }
        }
      }

      /* 5 — chat & live */
      let chatInvite  = null;
      let liveSession = null;
      if (appointment?.immersive_chat_id) {
        const { data: chat } = await supabase
          .from('live_chat_invites')
          .select('id, status, scheduled_for, started_at, accepted_at')
          .eq('id', appointment.immersive_chat_id)
          .maybeSingle();
        chatInvite = chat || null;
      }
      if (appointment?.immersive_live_id) {
        // Certaines colonnes (scheduled_at, video_room_url) peuvent ne pas exister
        // selon la version du schéma → fallback sur les colonnes de base.
        // Note: maybeSingle() est un Thenable, pas un vrai Promise — .catch() direct n'existe pas.
        let liveRes = { data: null, error: { message: 'fetch error' } };
        try {
          liveRes = await supabase
            .from('live_sessions')
            .select('id, status, scheduled_at, video_room_url')
            .eq('id', appointment.immersive_live_id)
            .maybeSingle();
        } catch { /* ignore, fallback below */ }

        if (liveRes.error) {
          // Fallback colonnes minimales
          try {
            const { data } = await supabase
              .from('live_sessions')
              .select('id, status')
              .eq('id', appointment.immersive_live_id)
              .maybeSingle();
            liveSession = data || null;
          } catch { liveSession = null; }
        } else {
          liveSession = liveRes.data || null;
        }
      }

      /* 6 — plan de préparation (table optionnelle) */
      if (appointment?.id) {
        try {
          const { data } = await supabase
            .from('appointment_preparation')
            .select('id, plan_json, room_type, documents_json, is_ready')
            .eq('appointment_id', appointment.id)
            .maybeSingle();
          setPrep(data || null);
        } catch { setPrep(null); }
      }

      if (!request && !appointment) {
        setError('no_appointment');
      } else {
        setData({ request, appointment, secretary, chatInvite, liveSession });
      }
    } catch (e) {
      console.error('[WaitingRoom] load error:', e);
      setError('load_error');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [reference, appointmentId, user?.id]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('immersive-waiting-room')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointment_requests' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointment_preparation' }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [load]);

  /* ─── computed ─── */
  const scheduledAt = data?.appointment?.scheduled_at || data?.request?.scheduled_at;
  const countdown   = useCountdown(scheduledAt);
  const visitorTz   = data?.appointment?.visitor_timezone || data?.request?.visitor_timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  const flow = useMemo(() => {
    if (!data) return { current: 'loading', steps: [] };
    const req       = data.request;
    const appt      = data.appointment;
    const chatStatus = String(data.chatInvite?.status || '').toLowerCase();
    const liveStatus = String(data.liveSession?.status || '').toLowerCase();
    const apptStatus = String(appt?.status || req?.status || '').toLowerCase();

    let current = 'pending_validation';
    if (['live_started', 'in_progress'].includes(apptStatus) || liveStatus === 'live') current = 'live_active';
    else if (['chat_started', 'in_progress'].includes(apptStatus) || (['accepted', 'pending'].includes(chatStatus) && countdown?.isNow)) current = 'chat_active';
    else if (['confirmed', 'scheduled', 'rescheduled', 'preparing', 'ready'].includes(apptStatus)) current = 'scheduled';

    return {
      current,
      steps: [
        { id: 'pending_validation', label: 'Validation secrétariat', done: apptStatus !== 'pending' },
        { id: 'scheduled',          label: 'Rendez-vous planifié',   done: ['confirmed','scheduled','rescheduled','preparing','ready','chat_started','live_started','in_progress','completed'].includes(apptStatus) },
        { id: 'chat_active',        label: 'Chat immersif',          done: ['accepted','ended'].includes(chatStatus) || ['live_started','in_progress','completed'].includes(apptStatus) },
        { id: 'live_active',        label: 'Live immersif',          done: liveStatus === 'ended' || apptStatus === 'completed' },
      ],
    };
  }, [data, countdown?.isNow]);

  const progressUi = useMemo(() => {
    const steps = flow?.steps || [];
    const activeIndex = Math.max(0, steps.findIndex((s) => s.id === flow.current));
    const doneCount = steps.filter((s) => s.done).length;
    const level = Math.max(doneCount, activeIndex + 1);
    const percent = steps.length ? Math.round((level / steps.length) * 100) : 0;
    const contextual = {
      pending_validation: 'Votre demande est en validation par le secretariat.',
      scheduled: 'Le rendez-vous est planifie. Preparation en cours.',
      chat_active: 'Le chat immersif est actif. Vous pouvez echanger.',
      live_active: 'Le live immersif est en cours. Vous etes au niveau final.',
      loading: 'Chargement du parcours...',
    };
    return {
      steps,
      activeIndex,
      level,
      percent,
      message: contextual[flow.current] || 'Progression de votre parcours en cours.',
    };
  }, [flow]);

  const rawApptStatus = String(data?.appointment?.status || '').toLowerCase();
  const rawReqStatus  = String(data?.request?.status   || '').toLowerCase();
  // Si l'appointment est cancelled mais que la requête est encore active,
  // on affiche le statut de la requête (évite le faux "annulé").
  const status = (rawApptStatus === 'cancelled' && ['pending', 'confirmed'].includes(rawReqStatus))
    ? rawReqStatus
    : (rawApptStatus || rawReqStatus || 'pending');
  const statusConf = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const isCancelled = status === 'cancelled';
  const isPrimeHour = data?.appointment?.is_prime_hour;
  const immersiveLiveReady = ['chat_started', 'live_started', 'in_progress', 'ready'].includes(status);
  const interlocutorLabel = data?.secretary?.display_name || 'Interlocuteur ISNA';

  const bookingRef = data?.appointment?.booking_reference || data?.request?.booking_reference || data?.appointment?.id || data?.request?.id;
  const displayRef = bookingRef ? String(bookingRef).slice(0, 10).toUpperCase() : null;
  const subject    = data?.request?.subject || data?.request?.reason || 'Entretien d\'orientation';

  const joinUrl       = data?.liveSession?.video_room_url || null;
  const chatInviteId  = data?.chatInvite?.id || data?.appointment?.immersive_chat_id;

  /* Visible seulement si status ≥ preparing et plan présent */
  const showPlan = ['preparing','ready','in_progress','chat_started','live_started','completed'].includes(status) && preparation?.plan_json?.length > 0;
  const showSmartRoom = preparation && ['preparing','ready','in_progress','chat_started','live_started'].includes(status);
  const canJoin  = countdown?.isNow || ['ready','in_progress','chat_started','live_started'].includes(status);

  const mobileDockPrimary = useMemo(() => {
    if (isCancelled) return null;
    if (canJoin && joinUrl) {
      return (
        <motion.a
          href={joinUrl}
          target="_blank"
          rel="noreferrer"
          whileTap={{ scale: 0.98 }}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#D4AF37] py-3.5 text-sm font-bold text-black shadow-[0_0_28px_rgba(212,175,55,0.28)]"
        >
          <Video className="h-4 w-4" /> Rejoindre le live
        </motion.a>
      );
    }
    if (canJoin && chatInviteId) {
      return (
        <Button asChild className="h-auto w-full rounded-xl bg-[#D4AF37] py-3.5 text-sm font-bold text-black hover:bg-amber-500">
          <Link to="/messages">
            <MessageSquare className="mr-2 h-4 w-4" /> Ouvrir le chat immersif
          </Link>
        </Button>
      );
    }
    return (
      <Button disabled className="h-auto w-full cursor-not-allowed rounded-xl border border-white/10 bg-white/5 py-3.5 text-sm text-gray-500">
        <Video className="mr-2 h-4 w-4" />
        {status === 'pending' ? 'En attente de confirmation' : status === 'preparing' ? 'Séance en préparation…' : 'Disponible le jour J'}
      </Button>
    );
  }, [isCancelled, canJoin, joinUrl, chatInviteId, status]);

  const mobileDockSecondary = useMemo(() => {
    if (isCancelled) return null;
    return (
      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm" className="flex-1 border-white/15 text-white hover:bg-white/5">
          <Link to="/">Explorer le site</Link>
        </Button>
        {['pending', 'confirmed', 'scheduled', 'preparing'].includes(status) ? (
          <Button asChild variant="outline" size="sm" className="flex-1 border-white/10 text-gray-400 hover:bg-white/5">
            <Link to="/appointment/request">Reprogrammer</Link>
          </Button>
        ) : null}
      </div>
    );
  }, [isCancelled, status]);

  /* ─── Shared wrapper (loading / error / main) ─── */
  const PageShell = ({ children }) => (
    <div className="relative min-h-screen overflow-x-hidden bg-[#070b12] text-white">
      {/* Ambient orbs */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-32 left-1/4 h-[36rem] w-[36rem] rounded-full bg-[#D4AF37]/[0.07] blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 h-[28rem] w-[28rem] rounded-full bg-violet-600/[0.06] blur-[100px]" />
      </div>
      {/* Subtle grid overlay */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.03] [background-image:linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:48px_48px]" />
      <div className="relative z-10">{children}</div>
    </div>
  );

  /* ─── Loading ─── */
  if (loading) {
    return (
      <PageShell>
        <div className="flex min-h-screen items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-5"
          >
            <div className="relative">
              <div className="h-16 w-16 rounded-2xl bg-[#D4AF37] flex items-center justify-center text-black font-bold text-2xl shadow-[0_0_40px_rgba(212,175,55,0.35)]">I</div>
              <Loader2 className="absolute -bottom-1 -right-1 h-5 w-5 animate-spin text-[#D4AF37]" />
            </div>
            <p className="text-sm text-gray-400 tracking-wide">Chargement de votre espace d&apos;attente…</p>
          </motion.div>
        </div>
      </PageShell>
    );
  }

  if (error === 'no_appointment') {
    return (
      <PageShell>
        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/8 bg-[#070b12]/80 px-6 py-4 backdrop-blur-xl">
            <Link to="/" className="flex items-center gap-2 text-sm font-semibold tracking-wide text-white/90">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#D4AF37] text-black font-bold shadow-[0_0_18px_rgba(212,175,55,0.3)]">I</span>
              ISNA · PRORASCIENCE
            </Link>
          </header>
          <div className="flex flex-1 items-center justify-center px-6 py-20">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md space-y-6 text-center">
              <div className="mx-auto inline-flex h-20 w-20 items-center justify-center rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 shadow-[0_0_40px_rgba(212,175,55,0.12)]">
                <CalendarClock className="h-9 w-9 text-[#D4AF37]" />
              </div>
              <div>
                <h1 className="mb-2 text-3xl font-bold tracking-tight">Aucun rendez-vous trouvé</h1>
                <p className="text-gray-400 leading-relaxed">
                  {reference ? `Aucun rendez-vous ne correspond à la référence « ${reference} ».` : "Vous n'avez pas encore de rendez-vous programmé."}
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Button asChild className="bg-[#D4AF37] text-black font-bold hover:bg-[#ebca5e] shadow-[0_0_24px_rgba(212,175,55,0.25)]">
                  <Link to="/appointment/request"><CalendarClock className="mr-2 h-4 w-4" /> Prendre rendez-vous</Link>
                </Button>
                <Button asChild variant="outline" className="border-white/15 text-white hover:bg-white/5">
                  <Link to="/"><Star className="mr-2 h-4 w-4" /> Visiter le site</Link>
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </PageShell>
    );
  }

  /* ─── Main render ─── */
  return (
    <PageShell>
      <div className="flex min-h-screen flex-col">

        {/* ══ Header ══ */}
        <header
          className="sticky top-0 z-20 flex items-center justify-between border-b border-white/8 bg-[#070b12]/80 px-4 py-3.5 backdrop-blur-xl sm:px-6"
          style={{ paddingTop: 'max(0.875rem, env(safe-area-inset-top, 0px))' }}
        >
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 text-sm font-semibold tracking-wide text-white/90">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#D4AF37] text-black font-bold">I</span>
            ISNA · PRORASCIENCE
          </Link>

          {/* Right: secretary + status */}
          <div className="flex items-center gap-3">
            {data?.secretary && (
              <div className="hidden sm:flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10">
                  <User className="h-3.5 w-3.5 text-[#D4AF37]" />
                </div>
                <div>
                  <p className="text-xs font-medium text-white leading-none">{data.secretary.display_name}</p>
                  <p className="text-[10px] text-gray-500">{data.secretary.timezone?.replace(/_/g, ' ') || ''}</p>
                </div>
                <span className={`h-2 w-2 rounded-full ${data.secretary.status === 'online' ? 'bg-emerald-400' : 'bg-gray-500'}`} />
              </div>
            )}
            <div className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${statusConf.color}`}>
              <span className={`h-2 w-2 rounded-full ${statusConf.dot}`} />
              {statusConf.label}
            </div>
          </div>
        </header>

        {/* ══ Main ══ */}
        <main className="flex-1 px-4 pb-32 pt-8 sm:px-6 lg:h-[calc(100dvh-8.2rem)] lg:overflow-hidden lg:pb-8 lg:pt-8">
          <div className="mx-auto max-w-7xl lg:grid lg:h-full lg:grid-cols-[1.18fr_0.82fr] lg:gap-6">
            <div className="space-y-6 lg:min-h-0 lg:space-y-4 lg:overflow-hidden">

            {/* ── Hero block ── */}
            <div>
              {/* Eyebrow */}
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-1.5 text-xs uppercase tracking-[0.18em] text-[#D4AF37]">
                  <Sparkles className="h-3.5 w-3.5" /> Espace d&apos;attente immersif
                </span>
                {displayRef && (
                  <span className="font-mono text-xs text-gray-600">RÉF. <span className="text-gray-400">{displayRef}</span></span>
                )}
                {isPrimeHour && (
                  <Badge className="border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37] gap-1 text-[11px]">
                    <Zap className="h-3 w-3" /> Prime Hours
                  </Badge>
                )}
              </div>

              {/* Title */}
              <h1 className="mb-2 text-3xl font-bold leading-[1.1] tracking-tight sm:text-4xl">
                {status === 'pending'      ? <><span className="text-white">Demande</span>{' '}<span className="text-[#D4AF37]">en cours</span><br /><span className="text-white">de traitement</span></> :
                 status === 'preparing'    ? <><span className="text-white">Préparation</span>{' '}<span className="text-[#D4AF37]">en cours…</span></> :
                 status === 'ready'        ? <><span className="text-[#D4AF37]">Votre séance</span><br /><span className="text-white">est prête !</span></> :
                 status === 'in_progress'  ? <><span className="text-[#D4AF37]">Séance</span>{' '}<span className="text-white">en cours</span></> :
                 status === 'rescheduled'  ? <><span className="text-white">Rendez-vous</span>{' '}<span className="text-[#D4AF37]">reprogrammé</span></> :
                                            <><span className="text-white">Votre espace</span>{' '}<span className="text-[#D4AF37]">d&apos;attente</span></>}
              </h1>

              <p className="text-base leading-relaxed text-white/45">
                {status === 'pending'    ? 'Le secrétariat va confirmer votre créneau sous peu.' :
                 status === 'preparing'  ? 'Un plan personnalisé est en cours d\'élaboration pour votre entretien.' :
                 status === 'ready'      ? 'Vous pouvez rejoindre la session dès maintenant.' :
                                          'Restez ici — vous rejoindrez la session depuis cette page le moment venu.'}
              </p>
            </div>

            {/* ── Ecran central chat immersif ── */}
            {!isCancelled && (
              <div className="relative overflow-hidden rounded-3xl border border-[#D4AF37]/25 bg-gradient-to-br from-[#1a1510]/95 via-[#10141a]/95 to-[#0a0908] p-4 sm:p-5">
                <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-[#D4AF37]/90">
                  Studio immersive
                </p>
                <div className="relative flex min-h-[180px] items-center justify-center rounded-2xl border border-white/15 bg-[#06090f]">
                  <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.12),transparent_65%)]" />
                  {immersiveLiveReady ? (
                    <div className="relative z-[1] text-center">
                      <User className="mx-auto h-8 w-8 text-emerald-300" />
                      <p className="mt-2 text-sm font-semibold text-white">{interlocutorLabel}</p>
                      <p className="mt-1 text-xs text-gray-400">Présent dans l'écran central (chat immersif actif).</p>
                    </div>
                  ) : (
                    <div className="relative z-[1] text-center">
                      <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#D4AF37]" />
                      <p className="mt-2 text-sm font-semibold text-[#D4AF37]">Studio immersive</p>
                      <p className="mt-1 text-xs text-gray-400">Chargement de l'écran central...</p>
                    </div>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-black/25 p-2.5 text-[11px] text-gray-300">
                  <p><span className="text-gray-500">Statut:</span> <span className="capitalize text-white">{status}</span></p>
                  <p><span className="text-gray-500">Canal:</span> <span className="text-white">{immersiveLiveReady ? 'chat/live actif' : 'préparation'}</span></p>
                  <p className="col-span-2"><span className="text-gray-500">Référence:</span> <span className="font-mono text-[#D4AF37]">{displayRef || '—'}</span></p>
                </div>
              </div>
            )}

            {/* ── Cancelled overlay card ── */}
            {isCancelled && (
                <div className="rounded-2xl border border-red-500/25 bg-red-500/[0.07] px-6 py-8 text-center">
                  <AlertCircle className="mx-auto mb-3 h-10 w-10 text-red-400" />
                  <p className="mb-1 text-lg font-semibold text-red-300">Ce rendez-vous a été annulé</p>
                  <p className="mb-6 text-sm text-gray-500">Vous pouvez en créer un nouveau à tout moment.</p>
                  <Button asChild className="bg-[#D4AF37] text-black font-bold hover:bg-[#ebca5e] shadow-[0_0_24px_rgba(212,175,55,0.25)]">
                    <Link to="/appointment/request"><CalendarClock className="mr-2 h-4 w-4" /> Reprogrammer un entretien</Link>
                  </Button>
                </div>
              )}

            {/* ── Countdown ── */}
            {countdown && !countdown.isPast && scheduledAt && ['pending','confirmed','scheduled','preparing','ready'].includes(status) && (
              <div className="relative overflow-hidden rounded-3xl border border-[#D4AF37]/25 bg-gradient-to-br from-[#D4AF37]/[0.07] via-transparent to-transparent px-5 py-5 sm:px-7 sm:py-6">
                {/* top glow line */}
                <div className="pointer-events-none absolute inset-x-8 top-0 h-px rounded-full bg-gradient-to-r from-transparent via-[#D4AF37]/70 to-transparent" />
                <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#D4AF37]">
                  <Timer className="h-4 w-4" /> Compte à rebours
                </p>
                <div className="flex flex-wrap items-end justify-center gap-3 sm:gap-6">
                  <CountdownUnit value={countdown.days}  label="jours"  />
                  <span className="mb-4 text-5xl font-thin text-[#D4AF37]/30">:</span>
                  <CountdownUnit value={countdown.hours} label="heures" />
                  <span className="mb-4 text-5xl font-thin text-[#D4AF37]/30">:</span>
                  <CountdownUnit value={countdown.mins}  label="min"    />
                  <span className="mb-4 text-5xl font-thin text-[#D4AF37]/30">:</span>
                  <CountdownUnit value={countdown.secs}  label="sec"    />
                </div>
              </div>
            )}

            {/* ── Subject + info grid ── */}
            {!isCancelled && (
              <div className="space-y-4">
                {/* Subject */}
                <div className="relative overflow-hidden rounded-2xl border border-[#D4AF37]/20 bg-white/[0.03] px-5 py-5">
                  <div className="pointer-events-none absolute left-0 inset-y-0 w-1 rounded-l-2xl bg-gradient-to-b from-[#D4AF37]/80 via-[#D4AF37]/40 to-transparent" />
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/10">
                      <BookOpen className="h-5 w-5 text-[#D4AF37]" />
                    </div>
                    <div>
                      <p className="mb-0.5 text-[11px] uppercase tracking-[0.14em] text-gray-500">Sujet de l&apos;entretien</p>
                      <p className="font-semibold text-white">{subject}</p>
                      {data?.request?.description && <p className="mt-1 text-sm text-gray-400">{data.request.description}</p>}
                    </div>
                  </div>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {scheduledAt && (
                    <div className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 hover:border-[#D4AF37]/20 transition-colors">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20">
                        <CalendarClock className="h-4.5 w-4.5 text-[#D4AF37]" />
                      </div>
                      <div>
                        <p className="mb-0.5 text-[11px] uppercase tracking-[0.14em] text-gray-500">Date & heure</p>
                        <p className="text-sm font-medium capitalize text-white leading-snug">{fmtLocal(scheduledAt, visitorTz)}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 hover:border-[#D4AF37]/20 transition-colors">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20">
                      <Globe className="h-4.5 w-4.5 text-[#D4AF37]" />
                    </div>
                    <div>
                      <p className="mb-0.5 text-[11px] uppercase tracking-[0.14em] text-gray-500">Fuseau horaire</p>
                      <p className="text-sm font-medium text-white">{fmtTz(visitorTz) || 'Non détecté'}</p>
                    </div>
                  </div>
                  {data?.secretary && (
                    <div className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 hover:border-[#D4AF37]/20 transition-colors">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20">
                        <User className="h-4.5 w-4.5 text-[#D4AF37]" />
                      </div>
                      <div>
                        <p className="mb-0.5 text-[11px] uppercase tracking-[0.14em] text-gray-500">Secrétaire assignée</p>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-white">{data.secretary.display_name}</p>
                          <span className={`h-2 w-2 rounded-full ${data.secretary.status === 'online' ? 'bg-emerald-400' : 'bg-gray-500'}`} />
                        </div>
                        {data.secretary.timezone && <p className="mt-0.5 text-xs text-gray-500">{data.secretary.timezone.replace(/_/g, ' ')}</p>}
                      </div>
                    </div>
                  )}
                  {scheduledAt && countdown && !countdown.isPast && (
                    <div className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 hover:border-[#D4AF37]/20 transition-colors">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20">
                        <Clock className="h-4.5 w-4.5 text-[#D4AF37]" />
                      </div>
                      <div>
                        <p className="mb-0.5 text-[11px] uppercase tracking-[0.14em] text-gray-500">Jours restants</p>
                        <p className="text-2xl font-bold text-white">{countdown.days}</p>
                        <p className="text-xs text-gray-500">{countdown.days === 0 ? "C'est aujourd'hui !" : countdown.days === 1 ? 'jour' : 'jours'}</p>
                      </div>
                    </div>
                  )}
                </div>
                {!isCancelled && !['completed', 'no_show'].includes(status) && (
                  <div>
                    <PreparationModule appointmentId={data?.appointment?.id} userId={user?.id} />
                  </div>
                )}
              </div>
            )}

            </div>
            <aside className="mt-8 space-y-4 lg:mt-0 lg:flex lg:min-h-0 lg:flex-col lg:overflow-hidden">
              {/* ── CTAs desktop ── */}
              {!isCancelled && (
                <div className="hidden lg:flex lg:flex-col lg:gap-2.5">
                {canJoin && joinUrl ? (
                  <a
                    href={joinUrl} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-[#D4AF37] px-7 py-3.5 text-sm font-bold text-black shadow-[0_0_24px_rgba(212,175,55,0.25)]"
                  >
                    <Video className="h-4 w-4" /> Rejoindre le live <ArrowRight className="h-4 w-4" />
                  </a>
                ) : canJoin && chatInviteId ? (
                  <div>
                    <Button asChild className="h-auto rounded-xl bg-[#D4AF37] px-7 py-3.5 text-sm font-bold text-black hover:bg-[#ebca5e] shadow-[0_0_24px_rgba(212,175,55,0.25)]">
                      <Link to="/messages"><MessageSquare className="mr-2 h-4 w-4" /> Ouvrir le chat immersif <ArrowRight className="ml-2 h-4 w-4" /></Link>
                    </Button>
                  </div>
                ) : (
                  <Button disabled className="h-auto cursor-not-allowed rounded-xl border border-white/10 bg-white/5 px-7 py-3.5 text-sm text-gray-500">
                    <Video className="mr-2 h-4 w-4" />
                    {status === 'pending' ? 'En attente de confirmation' : status === 'preparing' ? 'Séance en préparation…' : 'Disponible le jour J'}
                  </Button>
                )}
                <Button asChild variant="outline" className="h-auto rounded-xl border-white/12 px-5 py-3.5 text-sm text-white hover:bg-white/5">
                  <Link to="/"><Star className="mr-2 h-4 w-4" /> Explorer le site</Link>
                </Button>
                {['pending','confirmed','scheduled','preparing'].includes(status) && (
                  <Button asChild variant="outline" className="h-auto rounded-xl border-white/8 px-5 py-3.5 text-sm text-gray-400 hover:bg-white/5">
                    <Link to="/appointment/request"><CalendarClock className="mr-2 h-4 w-4" /> Reprogrammer</Link>
                  </Button>
                )}
                </div>
              )}

              {/* ── Parcours de session ── */}
              <div className="space-y-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3.5">
                <p className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Parcours de session</p>
                <div className="rounded-xl border border-[#D4AF37]/20 bg-[#D4AF37]/5 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold text-[#D4AF37]">Niveau {progressUi.level} / {progressUi.steps.length || 4}</p>
                    <p className="text-[11px] font-medium text-white/70">{progressUi.percent}%</p>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#D4AF37]/70 via-[#D4AF37] to-[#ebca5e]"
                      style={{ width: `${progressUi.percent}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-white/75">{progressUi.message}</p>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {progressUi.steps.map((step, idx) => {
                    const isActive = idx === progressUi.activeIndex;
                    const isDone = step.done;
                    return (
                      <div
                        key={step.id}
                        className={`rounded-lg border px-2 py-2 text-center text-[10px] leading-tight ${
                          isDone
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                            : isActive
                              ? 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]'
                              : 'border-white/10 bg-white/[0.02] text-gray-500'
                        }`}
                      >
                        <div className="mb-1 text-[9px] uppercase tracking-[0.1em] opacity-80">N{idx + 1}</div>
                        {step.label}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Rappels ── */}
              {scheduledAt && countdown && !isCancelled && (
                <div className="space-y-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3.5">
                <p className="text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">Rappels automatiques</p>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { label: 'Rappel J-1',     active: countdown.days === 0 && !countdown.isPast },
                    { label: 'Rappel 1h avant', active: countdown.days === 0 && countdown.hours === 0 && !countdown.isPast },
                    { label: 'Session prête',   active: countdown.isNow || ['ready','in_progress'].includes(status) },
                  ].map(({ label, active }) => (
                    <div key={label} className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-xs font-medium transition-all ${active ? 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]' : 'border-white/8 bg-white/[0.03] text-gray-500'}`}>
                      {active ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <Circle className="h-3.5 w-3.5 shrink-0" />}
                      {label}
                    </div>
                  ))}
                </div>
                </div>
              )}

              {/* Realtime indicator */}
              <div className="flex items-center justify-center gap-2 text-xs text-gray-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <Wifi className="h-3.5 w-3.5" />
              <span>Mise à jour en temps réel</span>
              </div>
            </aside>

            {/* Smart Room */}
            {showSmartRoom && (
              <div className="lg:hidden">
                <SmartRoomPreview roomType={preparation?.room_type || 'chat'} />
              </div>
            )}

            {/* Plan entretien */}
            {showPlan && (
              <div className="lg:hidden">
                <PlanSection plan={preparation.plan_json} />
              </div>
            )}

          </div>
        </main>

        <JourneyMobileDock primary={mobileDockPrimary} secondary={mobileDockSecondary} />

        <footer className="border-t border-white/5 py-6 text-center text-xs text-gray-600">
          <span className="text-[#D4AF37]/60">ISNA · Prorascience</span> — École Métaphysique Africaine · Espace entretien privé
        </footer>

      </div>
    </PageShell>
  );
};

export default ImmersiveWaitingRoomPage;
