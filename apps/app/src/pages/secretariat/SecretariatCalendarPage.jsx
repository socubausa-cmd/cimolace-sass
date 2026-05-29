import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import frLocale from '@fullcalendar/core/locales/fr';
import { useSecretariatAppointments } from '@/hooks/useAppointments';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
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
import { Calendar, Video, Clock, User, Loader2, Filter, CheckCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import PremiumSegmentedSelector from '@/components/ui/premium-segmented-selector';
import { motion } from 'framer-motion';
import SecretariatRescheduleQueue from '@/components/secretariat/SecretariatRescheduleQueue';
import SessionFlowPanel from '@/components/secretariat/SessionFlowPanel';
import { useAuth } from '@/hooks/useAuth';

const SecretariatCalendarPage = () => {
  const { calendarEvents, appointmentRequests, loading, error, refresh, confirmAppointment, cancelAppointment } = useSecretariatAppointments();
  const { session } = useAuth();
  const [confirmModal, setConfirmModal] = useState(null);
  const [confirmForm, setConfirmForm] = useState({ scheduled_at: '', assigned_teacher_id: '', video_meeting_url: '' });
  const [eventModal, setEventModal] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRegion, setFilterRegion] = useState('all');
  const [teachers, setTeachers] = useState([]);
  const [schoolEvents, setSchoolEvents] = useState([]);
  const [nowTick, setNowTick] = useState(Date.now());
  const { toast } = useToast();

  useEffect(() => {
    let alive = true;
    const loadStaff = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id,name,email,role,timezone,secretariat_region,is_secretariat_online,secretariat_last_seen_at,secretariat_sla_ms')
        .in('role', ['secretariat', 'owner', 'admin']);
      if (!alive) return;
      setTeachers(data || []);
    };
    void loadStaff();
    const channel = supabase
      .channel('secretariat-online-staff')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        void loadStaff();
      })
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, []);
  useEffect(() => {
    let alive = true;
    const loadSchoolEvents = async () => {
      const { data, error: evErr } = await supabase
        .from('school_events')
        .select('id,title,description,start_at,end_at,location,target_role,created_by')
        .order('start_at', { ascending: true })
        .limit(200);
      if (!alive) return;
      setSchoolEvents(evErr ? [] : (data || []));
    };
    void loadSchoolEvents();
    const channel = supabase
      .channel('secretariat-calendar-school-events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'school_events' }, () => {
        void loadSchoolEvents();
      })
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const pendingRequests = appointmentRequests.filter((a) => {
    if (a.status !== 'pending') return false;
    if (filterRegion === 'all') return true;
    return String(a.visitor_region || 'AF_EU') === filterRegion;
  });
  const pendingByRegion = useMemo(() => ({
    AF_EU: appointmentRequests.filter((a) => a.status === 'pending' && String(a.visitor_region || 'AF_EU') === 'AF_EU').length,
    US: appointmentRequests.filter((a) => a.status === 'pending' && String(a.visitor_region || '') === 'US').length,
  }), [appointmentRequests]);

  const filteredCalendarEvents = useMemo(() => {
    const mergedEvents = [
      ...calendarEvents,
      ...schoolEvents.map((e) => ({
        id: `school-${e.id}`,
        title: e.title || 'Evenement',
        type: 'school_event',
        status: 'scheduled',
        start_date: e.start_at,
        duration_minutes: e.end_at ? Math.max(15, Math.round((new Date(e.end_at).getTime() - new Date(e.start_at).getTime()) / (60 * 1000))) : 60,
        video_meeting_url: null,
        location: e.location || null,
        description: e.description || null,
        target_role: e.target_role || 'all',
      })),
    ];
    return mergedEvents.filter((e) => {
      if (filterType !== 'all' && e.type !== filterType) return false;
      if (filterStatus !== 'all' && e.status !== filterStatus) return false;
      if (filterRegion !== 'all' && e.type === 'request' && String(e.visitor_region || 'AF_EU') !== filterRegion) return false;
      return true;
    });
  }, [calendarEvents, filterType, filterStatus, filterRegion, schoolEvents]);

  const fcEvents = useMemo(() => {
    return filteredCalendarEvents.map((e) => {
      const start = new Date(e.start_date);
      const durationMin = e.duration_minutes || 30;
      const end = new Date(start.getTime() + durationMin * 60 * 1000);
      return {
        id: e.id,
        title: e.title,
        start: start.toISOString(),
        end: end.toISOString(),
        backgroundColor: e.type === 'appointment' ? '#D4AF37' : e.type === 'live' ? '#a855f7' : e.type === 'coaching' ? '#3b82f6' : '#f59e0b',
        borderColor: e.type === 'appointment' ? '#D4AF37' : e.type === 'live' ? '#a855f7' : e.type === 'coaching' ? '#3b82f6' : '#f59e0b',
        extendedProps: e,
      };
    });
  }, [filteredCalendarEvents]);

  const todayEvents = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return filteredCalendarEvents.filter((e) => new Date(e.start_date).toISOString().slice(0, 10) === today);
  }, [filteredCalendarEvents]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 10000);
    return () => window.clearInterval(timer);
  }, []);

  const slaByRegion = useMemo(() => {
    const liveByRegion = { AF_EU: 0, US: 0 };
    const totalByRegion = { AF_EU: 0, US: 0 };
    teachers.forEach((t) => {
      const region = String(t.secretariat_region || 'AF_EU');
      if (!['AF_EU', 'US'].includes(region)) return;
      totalByRegion[region] += 1;
      if (!t.is_secretariat_online || !t.secretariat_last_seen_at) return;
      const slaMs = Number(t.secretariat_sla_ms || 180000);
      const isFresh = nowTick - new Date(t.secretariat_last_seen_at).getTime() <= slaMs;
      if (isFresh) liveByRegion[region] += 1;
    });
    return {
      AF_EU: { online: liveByRegion.AF_EU, total: totalByRegion.AF_EU },
      US: { online: liveByRegion.US, total: totalByRegion.US },
      onlineAll: liveByRegion.AF_EU + liveByRegion.US,
      totalAll: totalByRegion.AF_EU + totalByRegion.US,
    };
  }, [teachers, nowTick]);

  const slaState = useMemo(() => {
    if (slaByRegion.totalAll === 0) return 'offline';
    if (slaByRegion.onlineAll >= 2) return 'optimal';
    if (slaByRegion.onlineAll === 1) return 'limited';
    return 'offline';
  }, [slaByRegion.onlineAll, slaByRegion.totalAll]);

  const handleConfirm = async () => {
    if (!confirmModal?.id) return;
    const { error: err } = await confirmAppointment(confirmModal.id, {
      scheduled_at: confirmForm.scheduled_at ? new Date(confirmForm.scheduled_at).toISOString() : null,
      assigned_teacher_id: confirmForm.assigned_teacher_id || null,
      video_meeting_url: confirmForm.video_meeting_url || null,
    });
    if (err) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Rendez-vous confirmé' });
    setConfirmModal(null);
    setConfirmForm({});
  };

  const handleRefuseRequest = async (id) => {
    const { error: err } = await cancelAppointment(id);
    if (err) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Demande refusée', description: 'Statut mis à annulé.' });
  };

  const handleEventClick = (info) => {
    info.jsEvent.preventDefault();
    const props = info.event.extendedProps;
    setEventModal(props);
  };

  return (
    <div className="relative space-y-6">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 h-[220px] w-[380px] -translate-x-1/2 rounded-full bg-[#D4AF37]/8 blur-[95px]" />
        <div className="absolute -bottom-10 right-0 h-[240px] w-[240px] rounded-full bg-violet-500/8 blur-[105px]" />
      </div>
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Calendar className="w-6 h-6 text-[#D4AF37]" />
            Calendrier des rendez-vous
          </h2>
          <div className="flex flex-wrap gap-2">
            <motion.span
              animate={slaState === 'limited' ? { opacity: [0.75, 1, 0.75] } : { opacity: 1 }}
              transition={slaState === 'limited' ? { duration: 1.5, repeat: Infinity } : { duration: 0.2 }}
              className={`text-xs rounded-full px-2 py-1 border ${
                slaState === 'optimal'
                  ? 'border-emerald-500/30 bg-gradient-to-r from-emerald-500/20 to-cyan-500/10 text-emerald-200'
                  : slaState === 'limited'
                    ? 'border-amber-500/30 bg-gradient-to-r from-amber-500/20 to-orange-500/10 text-amber-200'
                    : 'border-red-500/30 bg-red-500/10 text-red-200'
              }`}
            >
              SLA global: {slaByRegion.onlineAll}/{slaByRegion.totalAll} online
            </motion.span>
            <motion.span
              animate={slaByRegion.AF_EU.online === 1 ? { opacity: [0.78, 1, 0.78] } : { opacity: 1 }}
              transition={slaByRegion.AF_EU.online === 1 ? { duration: 1.7, repeat: Infinity } : { duration: 0.2 }}
              className="text-xs rounded-full px-2 py-1 border border-blue-500/30 bg-gradient-to-r from-blue-500/20 to-indigo-500/10 text-blue-200"
            >
              AF+EU: {slaByRegion.AF_EU.online}/{slaByRegion.AF_EU.total}
            </motion.span>
            <motion.span
              animate={slaByRegion.US.online === 1 ? { opacity: [0.78, 1, 0.78] } : { opacity: 1 }}
              transition={slaByRegion.US.online === 1 ? { duration: 1.7, repeat: Infinity } : { duration: 0.2 }}
              className="text-xs rounded-full px-2 py-1 border border-violet-500/30 bg-gradient-to-r from-violet-500/20 to-fuchsia-500/10 text-violet-200"
            >
              US: {slaByRegion.US.online}/{slaByRegion.US.total}
            </motion.span>
          </div>
        </div>
        <Button onClick={refresh} variant="outline" className="border-white/10 bg-white/5 hover:bg-white/10 transition-all hover:-translate-y-0.5" disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Actualiser'}
        </Button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
          {error.message}
        </div>
      )}

      <SecretariatRescheduleQueue onProcessed={refresh} />

      {/* Filtres */}
      <div className="rounded-2xl border border-white/10 bg-[#121a25]/60 backdrop-blur-xl p-3 flex flex-wrap gap-3 items-center">
        <Filter className="w-4 h-4 text-gray-500" />
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px] bg-[#192734] border-white/10">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            <SelectItem value="request">Demandes confirmées</SelectItem>
            <SelectItem value="appointment">Rendez-vous</SelectItem>
            <SelectItem value="live">Sessions live</SelectItem>
            <SelectItem value="coaching">Coaching</SelectItem>
            <SelectItem value="school_event">Evenements ecole</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px] bg-[#192734] border-white/10">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="confirmed">Confirmé</SelectItem>
            <SelectItem value="scheduled">Programmé</SelectItem>
            <SelectItem value="live">En cours</SelectItem>
            <SelectItem value="ended">Terminé</SelectItem>
            <SelectItem value="scheduled">Planifié</SelectItem>
          </SelectContent>
        </Select>
        <PremiumSegmentedSelector
          value={filterRegion}
          onChange={setFilterRegion}
          compact
          showChevron={false}
          layoutId="secretariat-region-filter-pill"
          options={[
            { value: 'all', label: 'Toutes zones', badge: String(appointmentRequests.length) },
            { value: 'AF_EU', label: 'AF+EU', badge: String(pendingByRegion.AF_EU) },
            { value: 'US', label: 'US', badge: String(pendingByRegion.US) },
          ]}
          className="min-w-[320px]"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <motion.div whileHover={{ y: -2, scale: 1.01 }} className="rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-4 py-3 shadow-[0_10px_30px_rgba(212,175,55,0.12)]">
          <p className="text-xs text-[#D4AF37] uppercase tracking-wider">Demandes en attente</p>
          <p className="text-2xl font-bold text-white">{pendingRequests.length}</p>
        </motion.div>
        <motion.div whileHover={{ y: -2, scale: 1.01 }} className="rounded-xl border border-blue-500/25 bg-blue-500/10 px-4 py-3">
          <p className="text-xs text-blue-300 uppercase tracking-wider">Zone AF+EU</p>
          <p className="text-2xl font-bold text-white">{pendingByRegion.AF_EU}</p>
        </motion.div>
        <motion.div whileHover={{ y: -2, scale: 1.01 }} className="rounded-xl border border-violet-500/25 bg-violet-500/10 px-4 py-3">
          <p className="text-xs text-violet-300 uppercase tracking-wider">Zone US</p>
          <p className="text-2xl font-bold text-white">{pendingByRegion.US}</p>
        </motion.div>
        <motion.div whileHover={{ y: -2, scale: 1.01 }} className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3">
          <p className="text-xs text-emerald-300 uppercase tracking-wider">SLA online</p>
          <p className="text-2xl font-bold text-white">{slaByRegion.onlineAll}</p>
        </motion.div>
      </div>

      {/* Rendez-vous du jour */}
      {todayEvents.length > 0 && (
        <div className="rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/5 p-4">
          <h3 className="font-bold text-[#D4AF37] mb-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" /> {todayEvents.length} rendez-vous aujourd&apos;hui
          </h3>
          <div className="flex flex-wrap gap-2">
            {todayEvents.map((e) => (
              <motion.div key={e.id} whileHover={{ y: -1 }} className="flex items-center gap-2 bg-[#0F1419]/50 rounded-lg px-3 py-2 border border-white/10">
                <span className="text-xs text-gray-400">{new Date(e.start_date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="text-sm text-white">{e.title}</span>
                {e.type === 'live' ? (
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-[#D4AF37]" asChild>
                    <Link to={`/live/${e.id}`}>
                      <Video className="w-3 h-3" />
                    </Link>
                  </Button>
                ) : e.video_meeting_url ? (
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-[#D4AF37]" onClick={() => window.open(e.video_meeting_url, '_blank')}>
                    <Video className="w-3 h-3" />
                  </Button>
                ) : null}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {pendingRequests.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <h3 className="font-bold text-amber-200 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" /> {pendingRequests.length} demande(s) en attente
          </h3>
          <div className="space-y-2">
            {pendingRequests.map((r) => (
              <motion.div
                key={r.id}
                whileHover={{ x: 2 }}
                className="flex items-center justify-between bg-[#0F1419]/50 rounded-xl border border-white/10 p-3"
              >
                <div>
                  <p className="font-medium text-white">{r.student?.name || r.student?.email || 'Élève'}</p>
                  <p className="text-sm text-gray-400">{r.reason || 'Demande d\'entretien'}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Ref: {String(r.booking_reference || r.id).slice(0, 8).toUpperCase()} • Zone {r.visitor_region || 'AF_EU'} • File {r.queue_position || 1}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="border-red-500/30 text-red-400" onClick={() => handleRefuseRequest(r.id)}>
                    Refuser
                  </Button>
                  <Button size="sm" className="bg-[#D4AF37] text-black hover:bg-amber-500 hover:shadow-[0_0_20px_rgba(212,175,55,0.3)] transition-all" onClick={() => setConfirmModal(r)}>
                    Confirmer
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* FullCalendar */}
      <div className="bg-[#121a25]/70 border border-white/10 rounded-2xl overflow-hidden p-4 backdrop-blur-xl shadow-[0_16px_48px_rgba(0,0,0,0.32)]">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
          }}
          buttonText={{
            today: 'Aujourd\'hui',
            month: 'Mois',
            week: 'Semaine',
            day: 'Jour',
            list: 'Liste',
          }}
          locale={frLocale}
          events={fcEvents}
          eventClick={handleEventClick}
          height="auto"
          slotMinTime="07:00:00"
          slotMaxTime="22:00:00"
          allDaySlot={false}
          nowIndicator
          eventDisplay="block"
          themeSystem="standard"
          eventTimeFormat={{
            hour: '2-digit',
            minute: '2-digit',
          }}
          slotLabelFormat={{
            hour: '2-digit',
            minute: '2-digit',
          }}
          className="secretariat-calendar"
        />
      </div>

      <style>{`
        .secretariat-calendar {
          --fc-border-color: rgba(255,255,255,0.1);
          --fc-page-bg-color: transparent;
          --fc-neutral-bg-color: #0F1419;
          --fc-list-event-hover-bg-color: rgba(212,175,55,0.2);
        }
        .secretariat-calendar .fc {
          font-family: inherit;
        }
        .secretariat-calendar .fc-toolbar-title {
          font-size: 1.25rem;
          color: white;
        }
        .secretariat-calendar .fc-button {
          background: #0F1419 !important;
          border-color: rgba(255,255,255,0.2) !important;
          color: white !important;
          border-radius: 0.65rem !important;
          transition: all 180ms ease !important;
        }
        .secretariat-calendar .fc-button:hover {
          background: rgba(212,175,55,0.2) !important;
          border-color: #D4AF37 !important;
          color: #D4AF37 !important;
          transform: translateY(-1px);
        }
        .secretariat-calendar .fc-button-active {
          background: rgba(212,175,55,0.3) !important;
          border-color: #D4AF37 !important;
          color: #D4AF37 !important;
        }
        .secretariat-calendar .fc-col-header-cell {
          background: #0F1419;
          color: #9ca3af;
          font-size: 0.75rem;
        }
        .secretariat-calendar .fc-timegrid-slot {
          height: 2.5rem;
        }
        .secretariat-calendar .fc-timegrid-slot-label {
          color: #6b7280;
        }
        .secretariat-calendar .fc-daygrid-day-number {
          color: #9ca3af;
        }
        .secretariat-calendar .fc-event {
          cursor: pointer;
          border-radius: 8px;
          box-shadow: 0 8px 18px rgba(0,0,0,0.22);
        }
        .secretariat-calendar .fc-event-title {
          font-weight: 500;
        }
      `}</style>

      {/* Modal détail événement */}
      <Dialog open={!!eventModal} onOpenChange={() => setEventModal(null)}>
        <DialogContent className="bg-[#151a21] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Détail</DialogTitle>
          </DialogHeader>
          {eventModal && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded font-medium',
                  eventModal.type === 'appointment' && 'bg-[#D4AF37]/20 text-[#D4AF37]',
                  eventModal.type === 'live' && 'bg-purple-500/20 text-purple-400',
                  eventModal.type === 'coaching' && 'bg-blue-500/20 text-blue-400',
                  eventModal.type === 'request' && 'bg-amber-500/20 text-amber-400',
                  eventModal.type === 'school_event' && 'bg-emerald-500/20 text-emerald-400'
                )}>
                  {eventModal.type === 'appointment' && 'RDV'}
                  {eventModal.type === 'live' && 'Live'}
                  {eventModal.type === 'coaching' && 'Coaching'}
                  {eventModal.type === 'request' && 'Demande'}
                  {eventModal.type === 'school_event' && 'Evenement'}
                </span>
                <span className="text-xs text-gray-500">{eventModal.status}</span>
              </div>
              <p className="font-medium text-white">{eventModal.title}</p>
              <p className="text-sm text-gray-400">
                {new Date(eventModal.start_date).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
              </p>
              {eventModal.location ? <p className="text-sm text-gray-400">Lieu: <span className="text-white">{eventModal.location}</span></p> : null}
              {eventModal.description ? <p className="text-sm text-gray-400">{eventModal.description}</p> : null}
              {eventModal.student && <p className="text-sm text-[#D4AF37] flex items-center gap-1"><User className="w-4 h-4" /> {eventModal.student.name || eventModal.student.email}</p>}
              {eventModal.teacher && !eventModal.student && <p className="text-sm text-[#D4AF37] flex items-center gap-1"><User className="w-4 h-4" /> {eventModal.teacher.name}</p>}
              <div className="flex gap-2 pt-2">
                {eventModal.type === 'live' && (
                  <Button asChild className="bg-[#D4AF37] text-black">
                    <Link to={`/live/${eventModal.id}`}>
                      <Video className="w-4 h-4 mr-2" /> Ouvrir la salle
                    </Link>
                  </Button>
                )}
                {eventModal.video_meeting_url && eventModal.type !== 'live' && (
                  <Button variant="outline" className="border-[#D4AF37]/30 text-[#D4AF37]" onClick={() => window.open(eventModal.video_meeting_url, '_blank')}>
                    <Video className="w-4 h-4 mr-2" /> Rejoindre
                  </Button>
                )}
              </div>

              {/* Session Flow Panel — only for confirmed appointments */}
              {eventModal.type === 'appointment' && ['confirmed','chat_started','live_started','completed','no_show'].includes(eventModal.status) && (
                <div className="pt-2">
                  <SessionFlowPanel
                    appointment={eventModal}
                    session={session}
                    onStatusChange={(updated) => {
                      setEventModal(updated);
                      refresh();
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmModal} onOpenChange={() => setConfirmModal(null)}>
        <DialogContent className="bg-[#151a21] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmer le rendez-vous</DialogTitle>
          </DialogHeader>
          {confirmModal && (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                Élève : <span className="text-white">{confirmModal.student?.name || confirmModal.student?.email}</span>
              </p>
              <div>
                <Label>Secretariat assigne</Label>
                <Select value={confirmForm.assigned_teacher_id} onValueChange={(v) => setConfirmForm((p) => ({ ...p, assigned_teacher_id: v }))}>
                  <SelectTrigger className="bg-[#0F1419] border-white/10 mt-1">
                    <SelectValue placeholder="Choisir un secretariat" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name || t.email || t.id}{t.timezone ? ` (${t.timezone})` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date et heure</Label>
                <Input
                  type="datetime-local"
                  value={confirmForm.scheduled_at}
                  onChange={(e) => setConfirmForm((p) => ({ ...p, scheduled_at: e.target.value }))}
                  className="bg-[#0F1419] border-white/10 mt-1"
                />
              </div>
              <div>
                <Label>Lien de session video (optionnel)</Label>
                <Input
                  type="url"
                  placeholder="https://... (laisser vide pour demarrer en chat immersif)"
                  value={confirmForm.video_meeting_url}
                  onChange={(e) => setConfirmForm((p) => ({ ...p, video_meeting_url: e.target.value }))}
                  className="bg-[#0F1419] border-white/10 mt-1"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setConfirmForm((p) => ({
                  ...p,
                  scheduled_at: new Date().toISOString().slice(0, 16),
                }))
              }
              className="border-emerald-500/30 text-emerald-300"
            >
              Demarrer maintenant
            </Button>
            <Button variant="outline" onClick={() => setConfirmModal(null)} className="border-white/10">Annuler</Button>
            <Button onClick={handleConfirm} className="bg-[#D4AF37] text-black hover:bg-amber-500">
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SecretariatCalendarPage;
