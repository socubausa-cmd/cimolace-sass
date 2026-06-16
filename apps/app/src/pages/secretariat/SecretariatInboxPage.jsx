import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense, Component } from 'react';
import { Helmet } from 'react-helmet';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import {
  MessageSquare,
  Mail,
  Phone,
  Calendar,
  CalendarCheck,
  Inbox,
  Loader2,
  Sparkles,
  Video,
  ExternalLink,
  Filter,
  LayoutList,
  LayoutGrid,
} from 'lucide-react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useVitrineContactEmail } from '@/contexts/VitrineContactEmailContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
// Import lazy pour éviter la dépendance circulaire dans le bundle Rollup/Vite
// (App.jsx importe aussi MessagingPage via React.lazy + SecretariatInboxPage l'importait statiquement)
const MessagingPage = lazy(() => import('@/pages/MessagingPage'));

class LazyChunkErrorBoundary extends Component {
  state = { hasError: false, reloading: false };
  static isChunkError(error) {
    const msg = error?.message || '';
    return (
      msg.includes('dynamically imported module') ||
      msg.includes('Failed to fetch') ||
      msg.includes('Loading chunk') ||
      error?.name === 'ChunkLoadError'
    );
  }
  static getDerivedStateFromError(error) {
    if (LazyChunkErrorBoundary.isChunkError(error)) return { hasError: true };
    throw error;
  }
  componentDidCatch(error) {
    if (!LazyChunkErrorBoundary.isChunkError(error)) return;
    const FLAG = 'chunk_reload_v1';
    if (!sessionStorage.getItem(FLAG)) {
      sessionStorage.setItem(FLAG, '1');
      this.setState({ reloading: true });
      window.location.reload();
    }
  }
  render() {
    if (this.state.reloading) return null;
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-[var(--lt-muted)]">
          <p className="text-sm">Mise à jour disponible.</p>
          <button
            className="text-xs px-3 py-1.5 rounded border border-[var(--lt-border)] hover:bg-black/[0.04]"
            onClick={() => { sessionStorage.removeItem('chunk_reload_v1'); window.location.reload(); }}
          >
            Recharger
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

import PremiumSegmentedSelector from '@/components/ui/premium-segmented-selector';
import OrgMailboxPage from '@/pages/secretariat/OrgMailboxPage';
import { buildTriageItems, filterTriageItems } from '@/pages/secretariat/secretariatInboxTriage';
import { useToast } from '@/hooks/use-toast';
import {
  cancelSecretariatAppointmentRequest,
  confirmSecretariatAppointmentRequest,
  markAppointmentRequestReschedule,
} from '@/lib/secretariatBookingActions';
import SecretariatAppointmentsMiniCalendar from '@/components/secretariat/SecretariatAppointmentsMiniCalendar';

function toDatetimeLocalValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const VALID_INBOX_TABS = new Set(['tous', 'chat', 'emails', 'appels', 'demandes_rdv', 'rdv_prevus']);

const isMissingRelationError = (error) => {
  const code = String(error?.code || '');
  const msg = String(error?.message || '').toLowerCase();
  return code === '42P01' || code === 'PGRST205' || msg.includes('does not exist') || msg.includes('could not find the table');
};

/** File d'entrée Smart Booking (demandes actives). */
const OPEN_APPOINTMENT_REQUEST_STATUSES = ['pending', 'requested', 'pending_validation', 'rescheduled'];

/** Rendez-vous confirmés à venir. */
const UPCOMING_APPOINTMENT_STATUSES = ['scheduled', 'in_progress', 'rescheduled', 'live_now'];

const APPOINTMENT_TYPE_LABEL = {
  entretien: 'Entretien',
  coaching: 'Coaching',
  conseil: 'Conseil',
  classe: 'Classe',
  conference: 'Conférence',
};

const REQUEST_STATUS_LABEL_FR = {
  pending: 'En attente',
  requested: 'À traiter',
  pending_validation: 'Validation',
  rescheduled: 'À reprogrammer',
  confirmed: 'Confirmé',
  cancelled: 'Annulé',
};

const TRIAGE_FILTERS = [
  { id: 'all', label: 'Tous les canaux' },
  { id: 'unread', label: 'Non lus' },
  { id: 'urgent', label: 'Urgents' },
  { id: 'today', label: "Aujourd'hui" },
  { id: 'mine', label: 'Assignés à moi' },
];

const SecretariatInboxPage = () => {
  const vitrineEmail = useVitrineContactEmail();
  const { supabase, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [contactRequests, setContactRequests] = useState([]);
  const [mailUnreadRows, setMailUnreadRows] = useState([]);
  const [mailThreadsById, setMailThreadsById] = useState({});
  const [mailUnreadCount, setMailUnreadCount] = useState(0);
  const [chatUnreadMessages, setChatUnreadMessages] = useState([]);
  const [contactCallHints, setContactCallHints] = useState([]);
  const [liveSessions, setLiveSessions] = useState([]);
  const [rdvPrevu, setRdvPrevu] = useState([]);
  const [rdvDemandes, setRdvDemandes] = useState([]);
  const [rdvCancelled, setRdvCancelled] = useState([]);
  const [mySecretaryId, setMySecretaryId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCancelledRdv, setShowCancelledRdv] = useState(false);

  const [triageFilter, setTriageFilter] = useState('all');
  const [selectedTriageKey, setSelectedTriageKey] = useState(null);
  const [rdvView, setRdvView] = useState('list');
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [confirmForm, setConfirmForm] = useState({
    scheduled_at: '',
    assigned_teacher_id: '',
    video_meeting_url: '',
  });
  const [teachers, setTeachers] = useState([]);

  const paramTab = searchParams.get('inboxTab');
  const [activeTab, setActiveTab] = useState(() =>
    paramTab && VALID_INBOX_TABS.has(paramTab) ? paramTab : 'tous'
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase.from('profiles').select('id, name, email').in('role', ['secretariat', 'owner', 'admin']);
      if (!alive || error) return;
      setTeachers(data || []);
    })();
    return () => {
      alive = false;
    };
  }, [supabase]);

  /** Ancien onglet fusionné dans Emails. */
  useEffect(() => {
    const t = searchParams.get('inboxTab');
    if (t === 'courrier_infos') {
      setSearchParams({ inboxTab: 'emails' }, { replace: true });
      setActiveTab('emails');
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const t = searchParams.get('inboxTab');
    if (t && VALID_INBOX_TABS.has(t)) setActiveTab(t);
  }, [searchParams]);

  const setInboxTab = (value) => {
    setActiveTab(value);
    setSearchParams({ inboxTab: value }, { replace: true });
    setSelectedTriageKey(null);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const nowIso = new Date().toISOString();
      const uid = user?.id;

      let secId = null;
      if (uid) {
        const secRes = await supabase.from('secretaries').select('id').eq('user_id', uid).maybeSingle();
        if (!isMissingRelationError(secRes.error) && !secRes.error) {
          secId = secRes.data?.id || null;
        }
        setMySecretaryId(secId);
      }

      const [
        contactRes,
        aptReqRes,
        appointmentsRes,
        mailCountRes,
        mailUnreadRes,
        msgUnreadRes,
        cancelledReqRes,
        liveRes,
      ] = await Promise.all([
        supabase
          .from('contact_requests')
          .select('id, name, email, subject, message, status, created_at')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('appointment_requests')
          .select(
            'id, student_id, reason, subject, description, preferred_date_start, preferred_date_end, preferred_date, preferred_time, status, scheduled_at, notes, visitor_name, visitor_email, booking_reference, created_at, assigned_teacher_id, secretary_id, visitor_timezone, video_meeting_url'
          )
          .in('status', OPEN_APPOINTMENT_REQUEST_STATUSES)
          .order('created_at', { ascending: false })
          .limit(80),
        // appointments → bookingApi via supabaseCompat (ignore .gte/.order côté adapter)
        supabase
          .from('appointments')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(80),
        supabase
          .from('emails')
          .select('id', { count: 'exact', head: true })
          .eq('is_read', false)
          .eq('is_outbound', false),
        supabase
          .from('emails')
          .select('id, thread_id, subject, snippet, from_name, from_email, received_at, is_read, is_outbound')
          .eq('is_read', false)
          .eq('is_outbound', false)
          .order('received_at', { ascending: false })
          .limit(40),
        uid
          ? supabase
              .from('messages')
              .select('id, sender_id, content, created_at, is_read')
              .eq('receiver_id', uid)
              .eq('is_read', false)
              .order('created_at', { ascending: false })
              .limit(40)
          : Promise.resolve({ data: [], error: null }),
        showCancelledRdv
          ? supabase
              .from('appointment_requests')
              .select(
                'id, student_id, reason, subject, description, status, visitor_name, visitor_email, booking_reference, created_at, secretary_id, assigned_teacher_id'
              )
              .eq('status', 'cancelled')
              .order('created_at', { ascending: false })
              .limit(30)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from('live_sessions')
          .select('id, title, scheduled_at, status, video_room_url, session_type, teacher_id')
          .gte('scheduled_at', nowIso)
          .order('scheduled_at', { ascending: true })
          .limit(40),
      ]);

      const contactRows = isMissingRelationError(contactRes.error) ? [] : (contactRes.data || []);
      const aptReqRowsRaw = isMissingRelationError(aptReqRes.error) ? [] : (aptReqRes.data || []);
      const appointmentsRowsRaw = isMissingRelationError(appointmentsRes.error) ? [] : (appointmentsRes.data || []);
      const cancelledRowsRaw = isMissingRelationError(cancelledReqRes.error) ? [] : (cancelledReqRes.data || []);
      const liveRowsRaw = isMissingRelationError(liveRes.error) ? [] : (liveRes.data || []);

      const mailRows = isMissingRelationError(mailUnreadRes.error) ? [] : (mailUnreadRes.data || []);
      setMailUnreadCount(typeof mailCountRes.count === 'number' ? mailCountRes.count : mailRows.length);

      const threadIds = [...new Set(mailRows.map((e) => e.thread_id).filter(Boolean))];
      let threadsMap = {};
      if (threadIds.length > 0) {
        const { data: threads, error: thErr } = await supabase
          .from('email_threads')
          .select('id, subject, assigned_user_id, pipeline_status, lead_id')
          .in('id', threadIds);
        if (!thErr && threads) {
          threadsMap = Object.fromEntries(threads.map((t) => [t.id, t]));
        }
      }
      setMailUnreadRows(mailRows);
      setMailThreadsById(threadsMap);

      const msgRows = isMissingRelationError(msgUnreadRes.error) ? [] : (msgUnreadRes.data || []);
      const senderIds = [...new Set(msgRows.map((m) => m.sender_id).filter(Boolean))];
      let senderMap = {};
      if (senderIds.length > 0) {
        const { data: profs } = await supabase.from('profiles').select('id, name').in('id', senderIds);
        senderMap = Object.fromEntries((profs || []).map((p) => [p.id, p]));
      }
      setChatUnreadMessages(
        msgRows.map((m) => ({
          ...m,
          _sender_name: senderMap[m.sender_id]?.name || 'Interlocuteur',
        }))
      );

      const profileIds = [
        ...new Set([
          ...aptReqRowsRaw.map((r) => r.student_id).filter(Boolean),
          ...aptReqRowsRaw.map((r) => r.assigned_teacher_id).filter(Boolean),
          ...cancelledRowsRaw.map((r) => r.student_id).filter(Boolean),
          ...cancelledRowsRaw.map((r) => r.assigned_teacher_id).filter(Boolean),
          ...appointmentsRowsRaw.map((a) => a.student_id).filter(Boolean),
          ...appointmentsRowsRaw.map((a) => a.teacher_id).filter(Boolean),
          ...liveRowsRaw.map((l) => l.teacher_id).filter(Boolean),
        ]),
      ];

      const secIds = [
        ...new Set([
          ...aptReqRowsRaw.map((r) => r.secretary_id).filter(Boolean),
          ...cancelledRowsRaw.map((r) => r.secretary_id).filter(Boolean),
        ]),
      ];
      let secretaryNameById = {};
      if (secIds.length > 0) {
        const secJoin = await supabase.from('secretaries').select('id, display_name').in('id', secIds);
        if (!isMissingRelationError(secJoin.error) && secJoin.data) {
          secretaryNameById = Object.fromEntries(secJoin.data.map((s) => [s.id, s.display_name]));
        }
      }

      let profileMap = {};
      if (profileIds.length > 0) {
        const { data: profRows, error: profErr } = await supabase
          .from('profiles')
          .select('id, name, email')
          .in('id', profileIds);
        if (!profErr && profRows) {
          profileMap = Object.fromEntries(profRows.map((p) => [p.id, p]));
        }
      }

      const withStudent = (row) => {
        const st = row.student_id ? profileMap[row.student_id] : null;
        const th = row.assigned_teacher_id ? profileMap[row.assigned_teacher_id] : null;
        return {
          ...row,
          _student_name: st?.name || row.visitor_name || null,
          _student_email: st?.email || row.visitor_email || null,
          _teacher_name: th?.name || null,
          _secretary_name: row.secretary_id ? secretaryNameById[row.secretary_id] : null,
        };
      };

      const aptReqRows = aptReqRowsRaw.map(withStudent);

      const appointmentsRows = appointmentsRowsRaw.map((a) => {
        const slot = a.booking_slots || {};
        const st = a.student_id ? profileMap[a.student_id] : null;
        const th = a.teacher_id ? profileMap[a.teacher_id] : null;
        // Normalise booking API → champs attendus par l'UI
        const scheduledAt = slot.start_at || a.scheduled_at || a.created_at;
        const apptType = a.type || slot.type || 'entretien';
        return {
          ...a,
          scheduled_at: scheduledAt,
          booking_reference: a.booking_reference || (a.id ? a.id.slice(0, 8).toUpperCase() : null),
          type: apptType,
          notes: a.notes || slot.title || '',
          _student_name: st?.name || null,
          _teacher_name: th?.name || null,
          title: `${APPOINTMENT_TYPE_LABEL[apptType] || apptType || 'RDV'}${st?.name ? ` — ${st.name}` : ''}`,
          session_type: apptType,
        };
      });

      setContactRequests(contactRows);
      setRdvPrevu(appointmentsRows);
      setRdvDemandes(aptReqRows);

      setRdvCancelled(cancelledRowsRaw.map(withStudent));

      const liveRows = liveRowsRaw.map((l) => ({
        ...l,
        _teacher_name: l.teacher_id ? profileMap[l.teacher_id]?.name : null,
      }));
      setLiveSessions(liveRows);

      const extractedCalls = contactRows
        .filter((r) => /appel|telephone|t[eé]l[eé]phone|call/i.test(`${r.subject || ''} ${r.message || ''}`))
        .map((r) => ({
          id: `call-${r.id}`,
          from: r.name || r.email || 'Contact',
          phone:
            String(r.message || '').match(/(\+?\d[\d\s().-]{7,}\d)/)?.[0] ||
            'Non renseigne',
          time: r.created_at,
          status: String(r.status || '').toLowerCase() === 'new' ? 'en_attente' : 'traite',
        }));
      setContactCallHints(extractedCalls);
    } catch {
      setContactRequests([]);
      setMailUnreadRows([]);
      setMailThreadsById({});
      setMailUnreadCount(0);
      setChatUnreadMessages([]);
      setContactCallHints([]);
      setLiveSessions([]);
      setRdvPrevu([]);
      setRdvDemandes([]);
      setRdvCancelled([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, user?.id, showCancelledRdv]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel('secretariat-inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contact_requests' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointment_requests' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emails' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_sessions' }, () => void load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [supabase, load]);

  const contactRequestsForTriage = useMemo(
    () =>
      contactRequests.filter((c) => !c.status || String(c.status).toLowerCase() === 'new'),
    [contactRequests]
  );

  const appelsForTriage = useMemo(() => {
    const liveShaped = liveSessions.map((l) => ({
      id: `live-${l.id}`,
      from: l.title || 'Session live',
      phone: l.video_room_url || l.session_type || 'Visio / live',
      time: l.scheduled_at,
      status: l.status || 'scheduled',
      _kind: 'live_session',
      _raw: l,
    }));
    return [...liveShaped, ...contactCallHints];
  }, [liveSessions, contactCallHints]);

  const triageItems = useMemo(
    () =>
      buildTriageItems({
        contactRequests: contactRequestsForTriage,
        chatUnreadMessages,
        mailUnreadRows,
        mailThreadsById,
        appointmentRequests: rdvDemandes,
        appointments: rdvPrevu,
        appels: appelsForTriage,
      }),
    [contactRequestsForTriage, chatUnreadMessages, mailUnreadRows, mailThreadsById, rdvDemandes, rdvPrevu, appelsForTriage]
  );

  const filteredTriage = useMemo(
    () => filterTriageItems(triageItems, triageFilter, { userId: user?.id, mySecretaryId }),
    [triageItems, triageFilter, user?.id, mySecretaryId]
  );

  const selectedTriage = useMemo(
    () => filteredTriage.find((x) => x.key === selectedTriageKey) || null,
    [filteredTriage, selectedTriageKey]
  );

  const chatUnreadTotal = useMemo(
    () => chatUnreadMessages.length,
    [chatUnreadMessages]
  );

  const TAB_OPTIONS = [
    {
      value: 'tous',
      label: 'Tous',
      count: triageItems.length,
      icon: Inbox,
      badge: 'Centre de tri',
    },
    {
      value: 'chat',
      label: 'Chat direct',
      count: chatUnreadTotal,
      icon: MessageSquare,
      badge: 'Conversations',
    },
    {
      value: 'emails',
      label: 'Emails',
      count: mailUnreadCount,
      icon: Mail,
      badge: 'Courrier',
    },
    {
      value: 'appels',
      label: 'Appels',
      count: liveSessions.length + contactCallHints.length,
      icon: Phone,
      badge: 'Historique vocal',
    },
    {
      value: 'demandes_rdv',
      label: 'Demandes RDV',
      count: rdvDemandes.length + (showCancelledRdv ? rdvCancelled.length : 0),
      icon: Calendar,
      badge: 'À confirmer',
    },
    {
      value: 'rdv_prevus',
      label: 'RDV prévus',
      count: rdvPrevu.length,
      icon: CalendarCheck,
      badge: 'Agenda',
    },
  ];

  const handleConfirmDemand = async (item) => {
    if (item.scheduled_at && item.assigned_teacher_id) {
      const { error } = await confirmSecretariatAppointmentRequest(supabase, item, {
        scheduled_at: item.scheduled_at,
        assigned_teacher_id: item.assigned_teacher_id,
        video_meeting_url: item.video_meeting_url || null,
      });
      if (error) {
        toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'Rendez-vous confirmé', description: 'La demande est passée en confirmé et un RDV agenda a été créé.' });
      void load();
      return;
    }
    setConfirmDialog(item);
    setConfirmForm({
      scheduled_at: toDatetimeLocalValue(item.scheduled_at || item.preferred_date_start || item.preferred_date),
      assigned_teacher_id: item.assigned_teacher_id || '',
      video_meeting_url: item.video_meeting_url || '',
    });
  };

  const submitConfirmDialog = async () => {
    if (!confirmDialog) return;
    if (!confirmForm.scheduled_at?.trim() || !confirmForm.assigned_teacher_id?.trim()) {
      toast({
        title: 'Champs requis',
        description: 'Indiquez la date/heure et le membre du secrétariat assigné.',
        variant: 'destructive',
      });
      return;
    }
    const { error } = await confirmSecretariatAppointmentRequest(supabase, confirmDialog, {
      scheduled_at: new Date(confirmForm.scheduled_at).toISOString(),
      assigned_teacher_id: confirmForm.assigned_teacher_id,
      video_meeting_url: confirmForm.video_meeting_url || null,
    });
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Rendez-vous confirmé' });
    setConfirmDialog(null);
    void load();
  };

  const handleRefuseDemand = async (item) => {
    const { error } = await cancelSecretariatAppointmentRequest(supabase, item.id);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Demande refusée', description: 'Statut mis à annulé.' });
    void load();
  };

  const handleRescheduleDemand = async (item) => {
    const { error } = await markAppointmentRequestReschedule(supabase, item.id);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'À reprogrammer', description: 'Ouvrez le calendrier pour proposer un nouveau créneau.' });
    void load();
    navigate(`/secretariat-space/calendrier?request=${item.id}&action=reschedule`);
  };

  const MessageCard = ({ children, index = 0 }) => (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      whileHover={{ scale: 1.01, x: 4 }}
      whileTap={{ scale: 0.99 }}
      className="flex items-start gap-3 p-4 rounded-[14px] border border-[var(--lt-border)] bg-[var(--lt-card-bg)] shadow-[var(--lt-card-shadow)] hover:border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] hover:opacity-80 transition-all cursor-pointer"
    >
      {children}
    </motion.div>
  );

  const renderDemandeRdvRow = (item, i) => (
    <div key={item.id} className="space-y-3">
      <MessageCard index={i}>
        <motion.div
          className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400"
          whileHover={{ scale: 1.05, boxShadow: '0 0 15px rgba(245,158,11,0.3)' }}
        >
          <Calendar className="w-5 h-5" />
        </motion.div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[var(--lt-text)] truncate">
            {item._student_name || item.visitor_name || 'Demande de rendez-vous'}
          </p>
          <p className="text-sm text-[var(--lt-sub)] truncate">{item.subject || item.reason || item.description || '—'}</p>
          <p className="text-xs text-[var(--lt-muted)] mt-1">
            {item.preferred_date_start || item.preferred_date
              ? format(
                  new Date(item.preferred_date_start || item.preferred_date),
                  "d MMM yyyy",
                  { locale: fr }
                )
              : 'Date souhaitée —'}
            {item.preferred_time ? ` · ${item.preferred_time}` : ''}
            {item.visitor_timezone ? ` · ${item.visitor_timezone}` : ''}
            {item.booking_reference ? ` · ${item.booking_reference}` : ''}
          </p>
          {item._secretary_name ? (
            <p className="text-xs text-[var(--lt-gold-ink)] mt-1">Secrétaire proposée : {item._secretary_name}</p>
          ) : null}
          {item._teacher_name ? (
            <p className="text-xs text-[var(--lt-muted)] mt-0.5">Enseignant : {item._teacher_name}</p>
          ) : null}
        </div>
        <Badge variant="outline" className="shrink-0 border-amber-300 bg-amber-50 text-amber-700">
          {REQUEST_STATUS_LABEL_FR[item.status] || item.status}
        </Badge>
      </MessageCard>
      <div className="flex flex-wrap gap-2 pl-14">
        <Button
          size="sm"
          variant="outline"
          className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
          onClick={() => void handleConfirmDemand(item)}
        >
          Confirmer
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-amber-300 text-amber-700 hover:bg-amber-50"
          onClick={() => void handleRescheduleDemand(item)}
        >
          Reprogrammer
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-red-300 text-red-700 hover:bg-red-50"
          onClick={() => void handleRefuseDemand(item)}
        >
          Refuser
        </Button>
        <Button size="sm" variant="ghost" className="text-[var(--lt-sub)] hover:bg-black/[0.04]" onClick={() => navigate(`/secretariat-space/calendrier?request=${item.id}`)}>
          Ouvrir fiche
        </Button>
      </div>
    </div>
  );

  const renderRdvPrevuRow = (item, i) => (
    <div key={item.id} className="space-y-3">
      <MessageCard index={i}>
        <motion.div
          className="p-2.5 rounded-xl bg-green-500/20 text-green-400"
          whileHover={{ scale: 1.05, boxShadow: '0 0 15px rgba(34,197,94,0.3)' }}
        >
          <CalendarCheck className="w-5 h-5" />
        </motion.div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[var(--lt-text)]">{item.title}</p>
          <p className="text-sm text-[var(--lt-sub)]">
            {item.scheduled_at ? format(new Date(item.scheduled_at), "EEEE d MMM yyyy 'à' HH:mm", { locale: fr }) : '--'}
          </p>
          <p className="text-xs text-[var(--lt-muted)]">
            {item.type ? APPOINTMENT_TYPE_LABEL[item.type] || item.type : 'RDV'}
            {item.duration_minutes ? ` · ${item.duration_minutes} min` : ''}
            {item._teacher_name ? ` · ${item._teacher_name}` : ''}
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0 bg-emerald-50 text-emerald-700 border-emerald-200">
          {item.status}
        </Badge>
      </MessageCard>
      <div className="flex flex-wrap gap-2 pl-14">
        {item.video_meeting_url ? (
          <Button size="sm" className="bg-[var(--school-accent)] text-black hover:bg-[#c9a432]" asChild>
            <a href={item.video_meeting_url} target="_blank" rel="noreferrer">
              <Video className="w-4 h-4 mr-1" /> Rejoindre
            </a>
          </Button>
        ) : null}
        <Button size="sm" variant="outline" onClick={() => navigate('/secretariat-space/calendrier')}>
          Préparer
        </Button>
        <Button size="sm" variant="ghost" asChild>
          <a href="/secretariat-space/calendrier" className="inline-flex items-center gap-1">
            <ExternalLink className="w-3.5 h-3.5" /> Calendrier
          </a>
        </Button>
      </div>
    </div>
  );

  const renderTriageRow = (it, i) => {
    const active = selectedTriageKey === it.key;
    return (
      <button
        key={it.key}
        type="button"
        onClick={() => setSelectedTriageKey(it.key)}
        className={`w-full text-left rounded-[14px] border transition-colors ${
          active ? 'border-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)]' : 'border-[var(--lt-border)] bg-[var(--lt-card-bg)] shadow-[var(--lt-card-shadow)] hover:border-black/20'
        }`}
      >
        <div className="flex items-start gap-3 p-4">
          <div
            className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
              (it.priority || 0) >= 80 ? 'bg-red-500' : (it.priority || 0) >= 70 ? 'bg-amber-500' : 'bg-zinc-400'
            }`}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-[var(--lt-text)] truncate">{it.title}</span>
              <Badge variant="outline" className="text-[10px] border-black/15 text-[var(--lt-sub)]">
                {it.badge}
              </Badge>
            </div>
            <p className="text-sm text-[var(--lt-sub)] truncate">{it.subtitle}</p>
            <p className="text-xs text-[var(--lt-muted)] mt-1">
              {it.date ? format(new Date(it.date), "d MMM yyyy 'à' HH:mm", { locale: fr }) : ''}
            </p>
          </div>
        </div>
      </button>
    );
  };

  const renderTriageDetail = () => {
    if (!selectedTriage) {
      return (
        <div className="rounded-[14px] border border-dashed border-[var(--lt-border)] bg-[var(--lt-inner-bg)] p-8 text-center text-[var(--lt-muted)] text-sm">
          Sélectionnez une ligne pour voir le détail et les actions.
        </div>
      );
    }
    const it = selectedTriage;
    return (
      <div className="rounded-[14px] border border-[var(--lt-border)] bg-[var(--lt-card-bg)] shadow-[var(--lt-card-shadow)] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[var(--lt-gold-ink)]" />
          <h3 className="font-semibold text-[var(--lt-text)]">Détail</h3>
        </div>
        <p className="text-sm text-[var(--lt-sub)]">{it.subtitle}</p>
        <div className="flex flex-wrap gap-2">
          {it.kind === 'mail_unread' && (
            <Button size="sm" onClick={() => setInboxTab('emails')}>
              Ouvrir le courrier
            </Button>
          )}
          {it.kind === 'chat_unread' && (
            <Button size="sm" onClick={() => setInboxTab('chat')}>
              Ouvrir le chat
            </Button>
          )}
          {it.kind === 'contact_form' && (
            <Button size="sm" variant="outline" onClick={() => setTriageFilter('all')}>
              Vue formulaires (liste ci-dessus)
            </Button>
          )}
          {it.kind === 'demande_rdv' && (
            <Button size="sm" onClick={() => setInboxTab('demandes_rdv')}>
              Aller aux demandes RDV
            </Button>
          )}
          {it.kind === 'rdv_prevu' && (
            <Button size="sm" onClick={() => setInboxTab('rdv_prevus')}>
              Voir l&apos;agenda
            </Button>
          )}
          {it.kind === 'appel' && (
            <Button size="sm" variant="outline" onClick={() => setInboxTab('appels')}>
              Voir les appels
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="relative min-h-[60vh]">
      <Helmet>
        <title>Messagerie unifiée | Secrétariat | PRORASCIENCE</title>
      </Helmet>

      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-[color-mix(in_srgb,var(--school-accent)_4%,transparent)] rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[250px] h-[250px] bg-violet-500/[0.03] rounded-full blur-[80px]" />
      </div>

      <div className="space-y-6 relative">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-3"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
            className="p-3 bg-[color-mix(in_srgb,var(--school-accent)_12%,transparent)] rounded-2xl border border-[color-mix(in_srgb,var(--school-accent)_25%,transparent)]"
            whileHover={{ scale: 1.05, boxShadow: '0 0 25px rgba(212,175,55,0.18)' }}
          >
            <Inbox className="w-7 h-7 text-[var(--lt-gold-ink)]" />
          </motion.div>
          <div>
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--lt-inner-bg)] border border-[var(--lt-border)] mb-2"
            >
              <Sparkles className="w-4 h-4 text-[var(--lt-gold-ink)]" />
              <span className="text-xs text-[var(--lt-sub)]">Centre de communication</span>
            </motion.div>
            <h1 className="text-2xl md:text-3xl font-serif font-bold text-[var(--lt-text)]">
              Messagerie unifiée
            </h1>
            <p className="text-[var(--lt-sub)] text-sm mt-1">
              Un seul espace : canaux séparés — chat, courrier{' '}
              <span className="text-[var(--lt-gold-ink)] font-mono text-xs">{vitrineEmail}</span>, appels, réservation.
            </p>
            <p className="text-[var(--lt-muted)] text-xs mt-2 max-w-3xl">
              <strong className="text-[var(--lt-sub)]">Tous</strong> priorise l&apos;action (non lus, urgents, RDV imminents).{' '}
              <strong className="text-[var(--lt-sub)]">Emails</strong> = IMAP intégré.{' '}
              <strong className="text-[var(--lt-sub)]">Demandes RDV</strong> = file Smart Booking.{' '}
              <strong className="text-[var(--lt-sub)]">RDV prévus</strong> = agenda confirmé.
            </p>
          </div>
        </motion.div>

        <Tabs value={activeTab} onValueChange={setInboxTab} className="space-y-6">
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
            <PremiumSegmentedSelector
              value={activeTab}
              onChange={setInboxTab}
              layoutId="messagerie-tab-pill"
              options={TAB_OPTIONS.map((tab) => ({
                value: tab.value,
                label: tab.count !== null && tab.count !== undefined ? `${tab.label} (${tab.count})` : tab.label,
                badge: tab.badge,
                icon: tab.icon,
              }))}
            />
          </motion.div>

          <TabsContent value="tous" className="mt-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-10 h-10 animate-spin text-[var(--lt-gold-ink)]" />
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-[200px_minmax(0,1fr)_minmax(260px,320px)] gap-4">
                <aside className="space-y-2 rounded-[14px] border border-[var(--lt-border)] bg-[var(--lt-card-bg)] shadow-[var(--lt-card-shadow)] p-3 h-fit">
                  <p className="text-[10px] uppercase tracking-wider text-[var(--lt-muted)] px-1 flex items-center gap-1">
                    <Filter className="w-3 h-3" /> Filtres
                  </p>
                  {TRIAGE_FILTERS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        setTriageFilter(f.id);
                        setSelectedTriageKey(null);
                      }}
                      className={`w-full text-left text-xs rounded-lg px-3 py-2 transition-colors ${
                        triageFilter === f.id ? 'bg-[color-mix(in_srgb,var(--school-accent)_18%,transparent)] text-[var(--lt-gold-ink)] border border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)]' : 'text-[var(--lt-sub)] hover:opacity-80'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                  <p className="text-[10px] text-[var(--lt-muted)] px-1 pt-2">
                    {filteredTriage.length} élément{filteredTriage.length > 1 ? 's' : ''} · tri par priorité
                  </p>
                </aside>
                <div className="space-y-3 min-w-0">
                  {filteredTriage.length > 0 ? (
                    filteredTriage.map((it, i) => renderTriageRow(it, i))
                  ) : (
                    <div className="text-center py-16 text-[var(--lt-muted)] rounded-[14px] border border-dashed border-[var(--lt-border)] bg-[var(--lt-inner-bg)]">
                      Rien à traiter avec ce filtre. Les formulaires site et le courrier apparaissent ici lorsqu&apos;il y a du
                      nouveau contenu.
                    </div>
                  )}
                </div>
                <aside className="min-w-0 xl:sticky xl:top-4 h-fit">{renderTriageDetail()}</aside>
              </div>
            )}
          </TabsContent>

          <TabsContent value="chat" className="mt-0">
            <p className="text-xs text-[var(--lt-muted)] mb-2">
              Messagerie conversationnelle (DM, visiteurs, membres) — pas le courrier{' '}
              <span className="font-mono">infos@</span>.
            </p>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[14px] border border-[var(--lt-border)] overflow-hidden bg-[var(--lt-card-bg)] shadow-[var(--lt-card-shadow)] min-h-[480px]"
            >
              <LazyChunkErrorBoundary>
                <Suspense fallback={<div className="flex items-center justify-center h-48 text-[var(--lt-muted)] text-sm">Chargement…</div>}>
                  <MessagingPage embedded />
                </Suspense>
              </LazyChunkErrorBoundary>
            </motion.div>
          </TabsContent>

          <TabsContent value="emails" className="mt-0">
            <p className="text-xs text-[var(--lt-muted)] mb-2">
              Courrier professionnel IMAP (threads, non lus, assignation CRM) — distinct du chat.
            </p>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
              <OrgMailboxPage embedded />
            </motion.div>
          </TabsContent>

          <TabsContent value="appels" className="mt-0 space-y-4">
            <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 flex gap-2 text-sm text-violet-800">
              <Video className="w-5 h-5 shrink-0 text-violet-500" />
              <p>
                <strong className="text-[var(--lt-text)]">Sessions live / visio</strong> à venir (table{' '}
                <span className="font-mono text-xs">live_sessions</span>).
                Complété par les <strong className="text-[var(--lt-text)]">indices téléphone</strong> des formulaires contact.
              </p>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-10 h-10 animate-spin text-[var(--lt-gold-ink)]" />
              </div>
            ) : (
              <div className="space-y-8">
                <div>
                  <h3 className="text-xs uppercase tracking-wider text-[var(--lt-muted)] mb-3">Live & visio à venir</h3>
                  {liveSessions.length > 0 ? (
                    <div className="space-y-3">
                      {liveSessions.map((item, i) => (
                        <MessageCard key={item.id} index={i}>
                          <motion.div className="p-2.5 rounded-xl bg-violet-500/20 text-violet-300">
                            <Video className="w-5 h-5" />
                          </motion.div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-[var(--lt-text)]">{item.title || 'Session live'}</p>
                            <p className="text-sm text-[var(--lt-sub)]">
                              {item._teacher_name ? `${item._teacher_name} · ` : ''}
                              {item.session_type || 'live'}
                            </p>
                            <p className="text-xs text-[var(--lt-muted)] mt-1">
                              {item.scheduled_at
                                ? format(new Date(item.scheduled_at), "EEEE d MMM yyyy 'à' HH:mm", { locale: fr })
                                : '--'}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <Badge variant="secondary" className="bg-violet-50 text-violet-700 border-violet-200">
                              {item.status}
                            </Badge>
                            {item.video_room_url ? (
                              <a
                                href={item.video_room_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[10px] text-[var(--lt-gold-ink)] hover:underline"
                              >
                                Rejoindre
                              </a>
                            ) : null}
                          </div>
                        </MessageCard>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--lt-muted)] py-4">Aucune session live programmée.</p>
                  )}
                </div>
                <div>
                  <h3 className="text-xs uppercase tracking-wider text-[var(--lt-muted)] mb-3">Indices téléphone (formulaires)</h3>
                  {contactCallHints.length > 0 ? (
                    <div className="space-y-3">
                      {contactCallHints.map((item, i) => (
                        <MessageCard key={item.id} index={i}>
                          <motion.div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400">
                            <Phone className="w-5 h-5" />
                          </motion.div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-[var(--lt-text)]">{item.from}</p>
                            <p className="text-sm text-[var(--lt-sub)]">{item.phone}</p>
                            <p className="text-xs text-[var(--lt-muted)] mt-1">
                              {item.time ? format(new Date(item.time), "d MMM HH:mm", { locale: fr }) : '--'}
                            </p>
                          </div>
                          <Badge variant={item.status === 'en_attente' ? 'destructive' : 'secondary'} className="shrink-0">
                            {item.status}
                          </Badge>
                        </MessageCard>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--lt-muted)] py-2">Aucun indice formulaire.</p>
                  )}
                </div>
                {liveSessions.length === 0 && contactCallHints.length === 0 ? (
                  <div className="text-center py-8 text-[var(--lt-muted)] rounded-[14px] border border-dashed border-[var(--lt-border)] bg-[var(--lt-inner-bg)]">
                    Aucune communication vocale / visio listée pour le moment.
                  </div>
                ) : null}
              </div>
            )}
          </TabsContent>

          <TabsContent value="demandes_rdv" className="mt-0 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-[var(--lt-muted)]">File d&apos;entrée Smart Booking — une ligne = une demande à traiter.</p>
              <label className="flex items-center gap-2 text-xs text-[var(--lt-sub)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={showCancelledRdv}
                  onChange={(e) => setShowCancelledRdv(e.target.checked)}
                  className="rounded border-black/20 accent-[var(--school-accent)]"
                />
                Afficher les demandes annulées
              </label>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-10 h-10 animate-spin text-[var(--lt-gold-ink)]" />
              </div>
            ) : (
              <div className="space-y-6">
                {rdvDemandes.length > 0 ? rdvDemandes.map((item, i) => renderDemandeRdvRow(item, i)) : (
                  <div className="text-center py-12 text-[var(--lt-muted)] rounded-[14px] border border-dashed border-[var(--lt-border)] bg-[var(--lt-inner-bg)]">
                    Aucune demande active.
                  </div>
                )}
                {showCancelledRdv && rdvCancelled.length > 0 ? (
                  <div className="space-y-3 pt-4 border-t border-[var(--lt-border)]">
                    <p className="text-xs text-[var(--lt-muted)] uppercase tracking-wider">Annulées</p>
                    {rdvCancelled.map((item, i) => renderDemandeRdvRow(item, i))}
                  </div>
                ) : null}
              </div>
            )}
          </TabsContent>

          <TabsContent value="rdv_prevus" className="mt-0 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-[var(--lt-muted)] max-w-xl">
                Agenda validé (table <span className="font-mono">appointments</span>). Basculez liste / mini-calendrier ; le
                calendrier complet reste sur la page dédiée.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-lg border border-[var(--lt-border)] overflow-hidden">
                  <Button
                    type="button"
                    variant={rdvView === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    className={rdvView === 'list' ? 'bg-[var(--school-accent)] text-black' : ''}
                    onClick={() => setRdvView('list')}
                  >
                    <LayoutList className="w-4 h-4 mr-1" /> Liste
                  </Button>
                  <Button
                    type="button"
                    variant={rdvView === 'calendar' ? 'default' : 'ghost'}
                    size="sm"
                    className={rdvView === 'calendar' ? 'bg-[var(--school-accent)] text-black' : ''}
                    onClick={() => setRdvView('calendar')}
                  >
                    <LayoutGrid className="w-4 h-4 mr-1" /> Calendrier
                  </Button>
                </div>
                <Button size="sm" variant="outline" className="border-[color-mix(in_srgb,var(--school-accent)_45%,transparent)] text-[var(--lt-gold-ink)] hover:bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)]" asChild>
                  <a href="/secretariat-space/calendrier">Calendrier complet</a>
                </Button>
              </div>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-10 h-10 animate-spin text-[var(--lt-gold-ink)]" />
              </div>
            ) : rdvPrevu.length > 0 ? (
              rdvView === 'calendar' ? (
                <SecretariatAppointmentsMiniCalendar
                  items={rdvPrevu}
                  onEventClick={(ev) => {
                    toast({ title: ev.title || 'Rendez-vous', description: ev.scheduled_at ? format(new Date(ev.scheduled_at), "PPPp", { locale: fr }) : '' });
                  }}
                />
              ) : (
                <div className="space-y-6">{rdvPrevu.map((item, i) => renderRdvPrevuRow(item, i))}</div>
              )
            ) : (
              <div className="text-center py-16 text-[var(--lt-muted)] rounded-[14px] border border-dashed border-[var(--lt-border)] bg-[var(--lt-inner-bg)]">
                Aucun rendez-vous confirmé à venir.
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={!!confirmDialog} onOpenChange={(open) => !open && setConfirmDialog(null)}>
          <DialogContent className="bg-[var(--lt-card-bg)] border-[var(--lt-border)] text-[var(--lt-text)] max-w-md">
            <DialogHeader>
              <DialogTitle className="text-[var(--lt-text)]">Confirmer le rendez-vous</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-sm text-[var(--lt-sub)]">
                {confirmDialog?._student_name || confirmDialog?.visitor_name || 'Demande'} — définissez le créneau et le
                secrétariat assigné (Smart Booking).
              </p>
              <div className="space-y-2">
                <Label htmlFor="confirm-sched" className="text-[var(--lt-sub)]">Date et heure</Label>
                <Input
                  id="confirm-sched"
                  type="datetime-local"
                  value={confirmForm.scheduled_at}
                  onChange={(e) => setConfirmForm((f) => ({ ...f, scheduled_at: e.target.value }))}
                  className="bg-[var(--lt-inner-bg)] border-[var(--lt-border)] text-[var(--lt-text)]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[var(--lt-sub)]">Secrétaire / staff assigné</Label>
                <Select
                  value={confirmForm.assigned_teacher_id}
                  onValueChange={(v) => setConfirmForm((f) => ({ ...f, assigned_teacher_id: v }))}
                >
                  <SelectTrigger className="bg-[var(--lt-inner-bg)] border-[var(--lt-border)] text-[var(--lt-text)]">
                    <SelectValue placeholder="Choisir un profil" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name || t.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-video" className="text-[var(--lt-sub)]">Lien visio (optionnel)</Label>
                <Input
                  id="confirm-video"
                  value={confirmForm.video_meeting_url}
                  onChange={(e) => setConfirmForm((f) => ({ ...f, video_meeting_url: e.target.value }))}
                  placeholder="https://..."
                  className="bg-[var(--lt-inner-bg)] border-[var(--lt-border)] text-[var(--lt-text)]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setConfirmDialog(null)} className="text-[var(--lt-sub)] hover:opacity-80">
                Annuler
              </Button>
              <Button className="bg-[var(--school-accent)] text-black hover:bg-[#c9a432]" onClick={() => void submitConfirmDialog()}>
                Confirmer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default SecretariatInboxPage;
