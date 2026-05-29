import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTeacherAppointments } from '@/hooks/useTeacherAppointments';
import { useProfilesSearch } from '@/hooks/useProfilesSearch';
import AgendaEventDetailSheet from '@/components/agenda/AgendaEventDetailSheet';
import { Button } from '@/components/ui/button';
import { Calendar, Video, Clock, User, Loader2, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfWeek, addDays, isSameDay, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { getEffectiveRole } from '@/lib/accountRoleMode';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const TeacherAgendaPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isStaff = ['secretariat', 'admin', 'owner'].includes(getEffectiveRole(user));
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState(user?.id || null);
  const { fetchTeachers } = useProfilesSearch();

  useEffect(() => {
    if (isStaff) {
      fetchTeachers().then(setTeachers);
    }
  }, [isStaff, fetchTeachers]);

  useEffect(() => {
    if (!isStaff && user?.id) setSelectedTeacherId(user.id);
    else if (isStaff && teachers.length > 0 && !selectedTeacherId) setSelectedTeacherId(teachers[0]?.id);
  }, [isStaff, user?.id, teachers, selectedTeacherId]);

  const {
    agendaEvents,
    hostProfile,
    loading,
    error,
    refresh,
    ensureStudioForAppointment,
  } = useTeacherAppointments(selectedTeacherId);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const canManageStudio = useMemo(() => {
    if (!user?.id || !selectedTeacherId) return false;
    return isStaff || user.id === selectedTeacherId;
  }, [isStaff, user?.id, selectedTeacherId]);

  const hostDisplayName = useMemo(() => {
    if (hostProfile?.name) return hostProfile.name;
    if (hostProfile?.email) return hostProfile.email;
    const t = teachers.find((x) => x.id === selectedTeacherId);
    return t?.name || t?.email || '—';
  }, [hostProfile, teachers, selectedTeacherId]);

  const openEventDetail = (ev) => {
    setSelectedEvent(ev);
    setDetailOpen(true);
  };

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const safeFormat = (dateInput, formatStr) => {
    if (!dateInput) return '';
    const date = new Date(dateInput);
    return isValid(date) ? format(date, formatStr, { locale: fr }) : '';
  };

  const todayEvents = agendaEvents.filter((e) => isSameDay(new Date(e.scheduled_at), new Date()));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-white">{isStaff ? 'Agenda enseignant' : 'Mon Agenda'}</h1>
          <p className="text-gray-400">Rendez-vous, entretiens et sessions live.</p>
          {isStaff && teachers.length > 0 && (
            <div className="mt-2">
              <Label className="text-xs text-gray-400">Enseignant</Label>
              <Select value={selectedTeacherId || ''} onValueChange={(v) => setSelectedTeacherId(v || null)}>
                <SelectTrigger className="w-[220px] mt-1 h-9 rounded-lg bg-[#0F1419] border-white/10 text-white text-sm">
                  <SelectValue placeholder="Sélectionner un enseignant" />
                </SelectTrigger>
                <SelectContent className="bg-[#151a21] border-white/10 rounded-xl z-[1100]">
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="focus:bg-[#D4AF37]/10 focus:text-[#D4AF37] rounded-lg">
                      {t.name || t.email || t.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="border-white/10 rounded-xl hover:bg-white/5 hover:border-white/20 transition-all duration-200"
            onClick={() => setCurrentDate(new Date())}
          >
            Aujourd&apos;hui
          </Button>
          <Button
            className="bg-[#D4AF37] text-black hover:bg-[#e5c04a] hover:shadow-lg hover:shadow-[#D4AF37]/25 rounded-xl transition-all duration-200 active:scale-[0.98]"
            onClick={() => navigate('/studio')}
          >
            <Plus className="w-4 h-4 mr-2" /> Studio
          </Button>
          <Button
            variant="outline"
            className="border-white/10 rounded-xl hover:bg-white/5 hover:border-white/20 transition-all duration-200"
            onClick={refresh}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Actualiser'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">{error.message}</div>
      )}

      {todayEvents.length > 0 && (
        <div className="rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/5 p-5 shadow-lg shadow-[#D4AF37]/5">
          <h3 className="font-bold text-[#D4AF37] mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" /> {todayEvents.length} événement(s) aujourd&apos;hui
          </h3>
          <div className="flex flex-wrap gap-2">
            {todayEvents.map((e) => (
              <button
                key={e.key || e.id}
                type="button"
                onClick={() => openEventDetail(e)}
                className="flex items-center gap-2 bg-[#0F1419]/50 rounded-lg px-3 py-2 text-left hover:bg-[#0F1419] hover:ring-1 hover:ring-[#D4AF37]/40 transition-colors w-full"
              >
                <span className="text-xs text-gray-400">{safeFormat(e.scheduled_at, 'HH:mm')}</span>
                <span className="text-sm text-white flex-1 truncate">{e.title}</span>
                <Video className="w-3 h-3 text-[#D4AF37] shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-[#151a21]/80 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden shadow-xl shadow-black/20">
        <div className="p-4 border-b border-white/10 flex justify-between items-center">
          <h3 className="font-bold text-white">Semaine du {safeFormat(weekStart, 'd MMMM')}</h3>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addDays(weekStart, -7))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addDays(weekStart, 7))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-2 p-4">
          {weekDays.map((day) => (
            <div
              key={day}
              className={cn(
                'min-h-[120px] p-2 rounded-lg border',
                isSameDay(day, new Date()) ? 'border-[#D4AF37] bg-[#D4AF37]/5' : 'border-white/5 bg-black/20'
              )}
            >
              <div className="text-center mb-2">
                <div className="text-xs text-gray-400 uppercase">{safeFormat(day, 'EEE')}</div>
                <div className={cn('text-lg font-bold', isSameDay(day, new Date()) ? 'text-[#D4AF37]' : 'text-white')}>
                  {safeFormat(day, 'd')}
                </div>
              </div>
              <div className="space-y-1">
                {agendaEvents
                  .filter((e) => isValid(new Date(e.scheduled_at)) && isSameDay(new Date(e.scheduled_at), day))
                  .map((e) => (
                    <button
                      key={e.key || e.id}
                      type="button"
                      onClick={() => openEventDetail(e)}
                      className={cn(
                        'text-xs p-1 rounded truncate w-full text-left hover:ring-1 hover:ring-[#D4AF37]/50',
                        e.source === 'live_sessions' ? 'bg-purple-500/20 text-purple-300' : 'bg-[#D4AF37]/20 text-[#D4AF37]'
                      )}
                    >
                      {e.title}
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <h2 className="text-xl font-bold text-white mt-8 mb-4">Prochains événements</h2>
      <div className="space-y-3">
        {agendaEvents.map((e) => (
          <div
            key={e.key || e.id}
            role="button"
            tabIndex={0}
            onClick={() => openEventDetail(e)}
            onKeyDown={(ev) => ev.key === 'Enter' && openEventDetail(e)}
            className="flex flex-col md:flex-row items-start md:items-center p-5 bg-[#151a21]/80 backdrop-blur-sm rounded-2xl border border-white/10 hover:border-[#D4AF37]/30 hover:shadow-lg hover:shadow-[#D4AF37]/5 transition-all duration-200 cursor-pointer"
          >
            <div className="flex flex-col items-center justify-center bg-black/20 rounded p-3 min-w-[80px] mr-4">
              <span className="text-sm font-bold text-[#D4AF37] uppercase">{safeFormat(e.scheduled_at, 'MMM')}</span>
              <span className="text-2xl font-bold text-white">{safeFormat(e.scheduled_at, 'dd')}</span>
            </div>
            <div className="flex-grow">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={cn(
                    'text-xs px-2 py-0.5 rounded',
                    e.source === 'live_sessions' ? 'bg-purple-500/20 text-purple-400' : 'bg-[#D4AF37]/20 text-[#D4AF37]'
                  )}
                >
                  {e.source === 'live_sessions' ? 'Live' : 'RDV'}
                </span>
                <span className="text-xs text-gray-500">{e.status}</span>
                <h3 className="text-lg font-medium text-white">{e.title}</h3>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" /> {safeFormat(e.scheduled_at, 'HH:mm')}
                </span>
                {e.student && (
                  <span className="flex items-center gap-1 text-[#D4AF37]">
                    <User className="w-4 h-4" /> {e.student.name}
                  </span>
                )}
              </div>
            </div>
            <div className="mt-4 md:mt-0 flex flex-col gap-2" onClick={(ev) => ev.stopPropagation()}>
              {e.source === 'live_sessions' ? (
                <Button className="bg-[#D4AF37] text-black hover:bg-amber-500" asChild>
                  <Link to={`/live/${e.id}`}>
                    <Video className="w-4 h-4 mr-2" /> {e.status === 'live' ? 'Rejoindre' : 'Ouvrir'}
                  </Link>
                </Button>
              ) : null}
              <Button variant="outline" size="sm" className="border-[#D4AF37]/40 text-[#D4AF37]" onClick={() => openEventDetail(e)}>
                Détails & studio
              </Button>
            </div>
          </div>
        ))}
        {agendaEvents.length === 0 && !loading && (
          <p className="text-gray-500 text-sm italic">Aucun événement programmé.</p>
        )}
      </div>

      <AgendaEventDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        event={selectedEvent}
        isStaff={isStaff}
        canManageStudio={canManageStudio}
        hostName={hostDisplayName}
        onEnsureStudio={ensureStudioForAppointment}
      />
    </div>
  );
};

export default TeacherAgendaPage;
