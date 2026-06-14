import { useMemo, useEffect, useState, useCallback } from 'react';
import { useDataSync } from '@/contexts/DataSyncContext';
import { useStudentAppointments } from '@/hooks/useStudentAppointments';
import { schoolCalendarRowsOverlappingFrom, schoolEventsForStudentWindow } from '@/lib/studentSchoolDataQueries';
import { addDays, startOfWeek, isValid } from 'date-fns';

function formationLivesFromYears(years) {
  const out = [];
  (Array.isArray(years) ? years : []).forEach((y) =>
    (Array.isArray(y?.modules) ? y.modules : []).forEach((m) =>
      (Array.isArray(m?.weeks) ? m.weeks : []).forEach((w) => {
        [w?.openingLive, w?.closingLive].forEach((live) => {
          if (!live || live.status === 'completed' || !live.date) return;
          const raw = live.date;
          const iso = typeof raw === 'string' ? raw : new Date(raw).toISOString();
          const d = new Date(iso);
          if (Number.isNaN(d.getTime())) return;
          out.push({
            id: `fd-live-${live.id}`,
            title: live.title || 'Live formation',
            type: 'formation_live',
            startAt: iso,
            endAt: null,
            location: [m?.title, w?.title].filter(Boolean).join(' · '),
            href: '/m/eleve/live',
            videoUrl: null,
          });
        });
      }),
    ),
  );
  return out;
}

/**
 * Agenda LIRI mobile : événements école, entrées calendrier, RDV / lives élève, lives catalogue formation.
 */
export function useLiriMobileAgendaMerged(userId) {
  const { years } = useDataSync();
  const { upcomingEvents, appointmentRequests, loading: apptLoading, refresh: refreshAppt } = useStudentAppointments(userId || undefined);
  const [schoolEvents, setSchoolEvents] = useState([]);
  const [calendarRows, setCalendarRows] = useState([]);
  const [extraLoading, setExtraLoading] = useState(true);

  const loadExtra = useCallback(async () => {
    setExtraLoading(true);
    const past = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

    const seRes = await schoolEventsForStudentWindow({
      fromIso: past,
      openEnd: true,
      limit: 200,
    });

    const scRes = await schoolCalendarRowsOverlappingFrom({ fromIso: past, limit: 200 });
    const scData = scRes.error ? [] : scRes.data || [];

    setSchoolEvents(seRes.error ? [] : seRes.data || []);
    setCalendarRows(scData);
    setExtraLoading(false);
  }, []);

  useEffect(() => {
    void loadExtra();
  }, [loadExtra]);

  const events = useMemo(() => {
    const formation = formationLivesFromYears(years);
    const school = (schoolEvents || []).map((e) => ({
      id: `school-${e.id}`,
      title: e.title || 'Événement',
      type: /exam|evaluation|controle|quiz/i.test(String(e.title || '') + String(e.description || '')) ? 'exam' : 'school',
      startAt: e.start_at,
      endAt: e.end_at || null,
      location: e.location || 'École',
      href: null,
      videoUrl: null,
      description: e.description,
    }));

    const cal = (calendarRows || []).map((c) => ({
      id: `cal-${c.id}`,
      title: c.title || 'Calendrier',
      type: 'calendar',
      startAt: c.start_date,
      endAt: c.end_date || null,
      location: null,
      href: null,
      videoUrl: null,
      description: c.description,
    }));

    const student = (upcomingEvents || []).map((e) => ({
      id: `${e.type}-${e.id}`,
      title: e.title,
      type: e.type === 'live' ? 'live' : 'appointment',
      startAt: e.scheduled_at,
      endAt: null,
      location: e.video_url ? 'Visio' : 'Plateforme',
      href: e.type === 'live' ? `/live/${e.id}` : null,
      videoUrl: e.video_url || null,
    }));

    const all = [...formation, ...school, ...cal, ...student];
    const seen = new Set();
    return all
      .filter((ev) => {
        if (seen.has(ev.id)) return false;
        seen.add(ev.id);
        return true;
      })
      .sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
  }, [years, schoolEvents, calendarRows, upcomingEvents]);

  const loading = (userId ? apptLoading : false) || extraLoading;

  const refresh = useCallback(() => {
    void loadExtra();
    refreshAppt();
  }, [loadExtra, refreshAppt]);

  const thisWeekCount = useMemo(() => {
    const ws = startOfWeek(new Date(), { weekStartsOn: 1 });
    const we = addDays(ws, 7);
    return events.filter((ev) => {
      const d = new Date(ev.startAt);
      return isValid(d) && d >= ws && d < we;
    }).length;
  }, [events]);

  // Demandes de RDV en attente (status='requested', sans date) — affichées
  // hors grille semaine (cf. EleveAgendaScreen), car elles n'ont pas de créneau.
  return { events, loading, refresh, thisWeekCount, pendingRequests: appointmentRequests };
}
