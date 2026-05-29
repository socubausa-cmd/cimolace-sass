import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useStudentAppointments } from '@/hooks/useStudentAppointments';
import { Calendar as CalendarIcon, Clock, MapPin, Search, Video } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { format, startOfWeek, addDays, isSameDay, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { schoolEventsForStudentWindow } from '@/lib/studentSchoolDataQueries';
import { useEffect } from 'react';

const StudentAgendaPage = () => {
  const { user } = useAuth();
  const { upcomingEvents, appointmentRequests, studentReports, loading, refresh } = useStudentAppointments(user?.id);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterType, setFilterType] = useState('all');
  const { isDemoMode, demoData, restrictedAction } = useDemoMode();
  const [schoolEvents, setSchoolEvents] = useState([]);

  useEffect(() => {
    if (isDemoMode) return;
    let alive = true;
    const loadSchoolEvents = async () => {
      const { data, error } = await schoolEventsForStudentWindow({ limit: 100, openEnd: true });
      if (!alive) return;
      setSchoolEvents(error ? [] : (data || []));
    };
    void loadSchoolEvents();
    return () => {
      alive = false;
    };
  }, [isDemoMode]);

  const events = useMemo(() => {
    if (isDemoMode) return demoData.agenda || [];
    const appointmentBased = upcomingEvents.map((e) => ({
      id: e.id,
      title: e.title,
      type: e.type === 'live' ? 'live' : 'event',
      date: e.scheduled_at,
      time: format(new Date(e.scheduled_at), 'HH:mm', { locale: fr }),
      location: e.video_url || e.type === 'live' ? 'Visioconférence' : 'Plateforme',
      instructor: e.instructor || null,
      video_url: e.video_url,
      liveSessionId: e.type === 'live' ? e.id : null,
    }));
    const schoolBased = schoolEvents.map((e) => ({
      id: `school-${e.id}`,
      title: e.title || 'Evenement',
      type: /exam|evaluation|controle|quiz/i.test(String(e.title || '') + ' ' + String(e.description || '')) ? 'exam' : 'event',
      date: e.start_at,
      time: format(new Date(e.start_at), 'HH:mm', { locale: fr }),
      location: e.location || 'Campus',
      instructor: null,
      video_url: null,
      liveSessionId: null,
    }));
    return [...appointmentBased, ...schoolBased].sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [isDemoMode, demoData.agenda, upcomingEvents, schoolEvents]);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const filteredEvents = events.filter(ev => filterType === 'all' || ev.type === filterType);

  // Helper for safe date formatting
  const safeFormat = (dateInput, formatStr) => {
    if (!dateInput) return '';
    const date = new Date(dateInput);
    return isValid(date) ? format(date, formatStr, { locale: fr }) : '';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-white">Mon Agenda</h1>
          <p className="text-gray-400">Gérez votre emploi du temps et vos échéances.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="border-white/10 text-gray-400 hover:text-white" onClick={() => setCurrentDate(new Date())}>
            Aujourd&apos;hui
          </Button>
          {!isDemoMode && (
            <Button variant="outline" className="border-white/10" onClick={refresh} disabled={loading}>
              Actualiser
            </Button>
          )}
          {!isDemoMode && (
            <Button className="bg-[#D4AF37] text-black hover:bg-amber-500" asChild>
              <Link to="/appointment/request">Demander un rendez-vous</Link>
            </Button>
          )}
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 bg-[#192734] p-4 rounded-xl border border-white/10">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input 
            placeholder="Rechercher un événement..." 
            className="pl-9 bg-black/20 border-white/10 text-white"
          />
        </div>
        <div className="flex gap-2">
          <Button 
            variant={filterType === 'all' ? 'default' : 'ghost'} 
            onClick={() => setFilterType('all')}
            className={filterType === 'all' ? 'bg-[#D4AF37] text-black' : 'text-gray-400'}
          >
            Tout
          </Button>
          <Button 
            variant={filterType === 'live' ? 'default' : 'ghost'} 
            onClick={() => setFilterType('live')}
            className={filterType === 'live' ? 'bg-[#D4AF37] text-black' : 'text-gray-400'}
          >
            Lives
          </Button>
          <Button 
            variant={filterType === 'exam' ? 'default' : 'ghost'} 
            onClick={() => setFilterType('exam')}
            className={filterType === 'exam' ? 'bg-[#D4AF37] text-black' : 'text-gray-400'}
          >
            Examens
          </Button>
        </div>
      </div>

      {/* Calendar View */}
      <Card className="bg-[#192734] border-white/10">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-[#D4AF37]" />
            Semaine du {safeFormat(weekStart, 'd MMMM')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day, idx) => (
              <div key={idx} className={`min-h-[150px] p-2 rounded-lg border ${isSameDay(day, new Date()) ? 'border-[#D4AF37] bg-[#D4AF37]/5' : 'border-white/5 bg-black/20'}`}>
                <div className="text-center mb-2">
                  <div className="text-sm text-gray-400 uppercase">{safeFormat(day, 'EEE')}</div>
                  <div className={`text-lg font-bold ${isSameDay(day, new Date()) ? 'text-[#D4AF37]' : 'text-white'}`}>
                    {safeFormat(day, 'd')}
                  </div>
                </div>
                <div className="space-y-1">
                  {filteredEvents.filter(ev => {
                    const evDate = new Date(ev.date);
                    return isValid(evDate) && isSameDay(evDate, day);
                  }).map((ev, i) => (
                    <div
                      key={ev.id || i}
                      className={`text-xs p-1 rounded truncate cursor-pointer ${
                        ev.type === 'live' ? 'bg-red-500/20 text-red-300' :
                        ev.type === 'deadline' ? 'bg-yellow-500/20 text-yellow-300' :
                        'bg-blue-500/20 text-blue-300'
                      }`}
                      onClick={() => ev.video_url && !isDemoMode ? window.open(ev.video_url, '_blank') : restrictedAction('Voir détails événement')}
                    >
                      {ev.title}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {!isDemoMode && appointmentRequests?.filter((r) => r.status === 'pending').length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <h3 className="font-bold text-amber-200 mb-2">Demande(s) en attente</h3>
          <p className="text-sm text-gray-400">
            Vous avez {appointmentRequests.filter((r) => r.status === 'pending').length} demande(s) de rendez-vous. Le secrétariat vous contactera pour confirmer.
          </p>
          <Button variant="outline" className="mt-2 border-amber-500/30 text-amber-400" asChild>
            <Link to="/appointment/request">Nouvelle demande</Link>
          </Button>
        </div>
      )}

      {!isDemoMode && studentReports?.length > 0 && (
        <div className="rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/5 p-4">
          <h3 className="font-bold text-[#D4AF37] mb-2">Résumés de sessions</h3>
          <p className="text-sm text-gray-400">
            Vous avez {studentReports.length} compte(s) rendu de session(s) live disponible(s).
          </p>
        </div>
      )}

      {/* Upcoming List */}
      <h2 className="text-xl font-bold text-white mt-8 mb-4">Prochains Événements</h2>
      <div className="space-y-3">
        {filteredEvents.map((ev) => (
          <div key={ev.id} className="flex flex-col md:flex-row items-start md:items-center p-4 bg-[#192734] rounded-lg border border-white/10 hover:border-[#D4AF37]/30 transition-all">
            <div className="flex flex-col items-center justify-center bg-black/20 rounded p-3 min-w-[80px] mr-4">
              <span className="text-sm font-bold text-[#D4AF37] uppercase">{safeFormat(ev.date, 'MMM')}</span>
              <span className="text-2xl font-bold text-white">{safeFormat(ev.date, 'dd')}</span>
            </div>
            
            <div className="flex-grow">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className={`
                  ${ev.type === 'live' ? 'border-red-500 text-red-500' : 
                    ev.type === 'deadline' ? 'border-yellow-500 text-yellow-500' : 
                    'border-blue-500 text-blue-500'}
                `}>
                  {ev.type === 'live' ? 'Live' : ev.type === 'deadline' ? 'Echéance' : 'Événement'}
                </Badge>
                <h3 className="text-lg font-medium text-white">{ev.title}</h3>
              </div>
              
              <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                <div className="flex items-center gap-1"><Clock className="w-4 h-4" /> {ev.time}</div>
                <div className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {ev.location}</div>
                {ev.instructor && <div className="flex items-center gap-1 text-[#D4AF37]">Avec {ev.instructor}</div>}
              </div>
            </div>

            {(ev.liveSessionId || ev.video_url) && !isDemoMode ? (
              ev.liveSessionId ? (
                <Button className="mt-4 md:mt-0 bg-[#D4AF37] text-black hover:bg-amber-500" asChild>
                  <Link to={`/live/${ev.liveSessionId}`}>
                    <Video className="w-4 h-4 mr-2" /> Rejoindre
                  </Link>
                </Button>
              ) : (
                <Button className="mt-4 md:mt-0 bg-[#D4AF37] text-black hover:bg-amber-500" onClick={() => window.open(ev.video_url, '_blank')}>
                  <Video className="w-4 h-4 mr-2" /> Rejoindre
                </Button>
              )
            ) : (
              <Button className="mt-4 md:mt-0 bg-white/10 hover:bg-white/20 text-white" onClick={() => restrictedAction('Voir détails')}>
                Détails
              </Button>
            )}
          </div>
        ))}
        {filteredEvents.length === 0 && <p className="text-gray-500 text-sm italic">Aucun événement à afficher.</p>}
      </div>
    </div>
  );
};

export default StudentAgendaPage;