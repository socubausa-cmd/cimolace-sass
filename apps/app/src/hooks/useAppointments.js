import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import {
  cancelSecretariatAppointmentRequest,
  confirmSecretariatAppointmentRequest,
} from '@/lib/secretariatBookingActions';

const isSchemaMismatchError = (error) => {
  const msg = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '');
  return code === '42703' || msg.includes('column') || msg.includes('does not exist');
};

/** Lecture Supabase : .select() avant filtres (.gte, .order, …). */
const fetchAllLiveSessionsInRange = (selectColumns) =>
  supabase
    .from('live_sessions')
    .select(selectColumns)
    .gte('scheduled_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(200);

export function useSecretariatAppointments() {
  const [appointmentRequests, setAppointmentRequests] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [coachingSessions, setCoachingSessions] = useState([]);
  const [liveSessions, setLiveSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reqRes, apptRes, sessRes] = await Promise.all([
        // appointment_requests n'existe plus — le stub supabaseCompat retourne [] sans erreur.
        // On reste resilient : si le stub est retiré un jour, on ne crash pas.
        supabase
          .from('appointment_requests')
          .select('id, student_id, reason, status, scheduled_at, video_meeting_url, assigned_teacher_id, created_at, queue_position, visitor_region, requester_timezone, booking_reference')
          .order('created_at', { ascending: false })
          .limit(200),
        // appointments → routing via bookingApi (supabaseCompat), ignore .gte/.order côté adapter
        supabase
          .from('appointments')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('coaching_sessions')
          .select('id, student_id, teacher_id, title, session_type, scheduled_at, status, video_meeting_url, notes')
          .gte('scheduled_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .order('scheduled_at', { ascending: true })
          .limit(200),
      ]);

      let liveRes = await fetchAllLiveSessionsInRange(
        'id, teacher_id, title, session_type, scheduled_at, status, video_room_url, visibility_mode'
      );
      if (liveRes.error && isSchemaMismatchError(liveRes.error)) {
        liveRes = await fetchAllLiveSessionsInRange(
          'id, teacher_id, title, session_type, scheduled_at, status'
        );
      }

      // appointment_requests : erreur tolérée (table absente ou stub retiré)
      const reqs = reqRes.error ? [] : (reqRes.data || []);

      // Normalise les appointments du booking API : booking_slots.start_at → scheduled_at
      const normalizeBookingAppt = (a) => {
        const slot = a.booking_slots || {};
        return {
          ...a,
          scheduled_at: slot.start_at || a.scheduled_at || a.created_at,
          booking_reference: a.booking_reference || (a.id ? a.id.slice(0, 8).toUpperCase() : null),
          type: a.type || slot.type || 'entretien',
        };
      };
      const appts = apptRes.error ? [] : (apptRes.data || []).map(normalizeBookingAppt);
      const sess = sessRes.error ? [] : (sessRes.data || []);
      const lives = liveRes.error
        ? []
        : (liveRes.data || []).map((l) => ({
            ...l,
            video_room_url: l.video_room_url || null,
            visibility_mode: l.visibility_mode || 'secret',
          }));

      const userIds = [...new Set([
        ...reqs.map((r) => r.student_id),
        ...reqs.map((r) => r.assigned_teacher_id),
        ...appts.map((a) => a.student_id),
        ...appts.map((a) => a.teacher_id),
        ...sess.map((s) => s.student_id),
        ...sess.map((s) => s.teacher_id),
        ...lives.map((l) => l.teacher_id),
      ].filter(Boolean))];
      const { data: profiles } = userIds.length ? await supabase.from('profiles').select('id, name, email').in('id', userIds) : { data: [] };
      const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));

      setAppointmentRequests(reqs.map((r) => ({ ...r, student: profileMap[r.student_id], teacher: profileMap[r.assigned_teacher_id] })));
      setAppointments(appts.map((a) => ({ ...a, student: profileMap[a.student_id], teacher: profileMap[a.teacher_id] })));
      setCoachingSessions(sess.map((s) => ({ ...s, student: profileMap[s.student_id], teacher: profileMap[s.teacher_id] })));
      setLiveSessions(lives.map((l) => ({ ...l, teacher: profileMap[l.teacher_id] })));
    } catch (e) {
      setError(e);
      setAppointmentRequests([]);
      setAppointments([]);
      setCoachingSessions([]);
      setLiveSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const confirmAppointment = useCallback(
    async (id, { scheduled_at, assigned_teacher_id, video_meeting_url }) => {
      const req = appointmentRequests.find((r) => r.id === id);
      const { error } = await confirmSecretariatAppointmentRequest(supabase, req, {
        scheduled_at,
        assigned_teacher_id,
        video_meeting_url,
      });
      if (error) return { error };
      await refresh();
      return { error: null };
    },
    [refresh, appointmentRequests]
  );

  const cancelAppointmentRequest = useCallback(
    async (id) => {
      const { error } = await cancelSecretariatAppointmentRequest(supabase, id);
      if (error) return { error };
      await refresh();
      return { error: null };
    },
    [refresh]
  );


  const calendarEvents = [
    ...appointmentRequests
      .filter((a) => a.scheduled_at && a.status === 'confirmed')
      .map((a) => ({
        id: a.id,
        type: 'request',
        source: 'appointment_requests',
        title: `Entretien ${a.student?.name || 'Élève'}`,
        start_date: a.scheduled_at,
        end_date: a.scheduled_at,
        duration_minutes: 30,
        status: a.status,
        video_meeting_url: a.video_meeting_url,
        student: a.student,
        teacher: a.teacher,
      })),
    ...appointments
      .filter((a) => !['cancelled'].includes(a.status))
      .map((a) => ({
        id: a.id,
        type: 'appointment',
        source: 'appointments',
        title: `${a.type} - ${a.student?.name || 'Élève'}`,
        start_date: a.scheduled_at,
        end_date: a.scheduled_at,
        duration_minutes: a.duration_minutes || 30,
        status: a.status,
        video_meeting_url: a.video_meeting_url,
        student: a.student,
        teacher: a.teacher,
      })),
    ...coachingSessions
      .filter((s) => s.status !== 'cancelled')
      .map((s) => ({
        id: s.id,
        type: 'coaching',
        source: 'coaching_sessions',
        title: s.title || `${s.session_type} - ${s.student?.name || 'Élève'}`,
        start_date: s.scheduled_at,
        end_date: s.scheduled_at,
        duration_minutes: 60,
        status: s.status,
        video_meeting_url: s.video_meeting_url,
        student: s.student,
        teacher: s.teacher,
      })),
    ...liveSessions
      .filter((l) => l.status !== 'cancelled')
      .map((l) => ({
        id: l.id,
        type: 'live',
        source: 'live_sessions',
        title: l.title,
        start_date: l.scheduled_at,
        end_date: l.scheduled_at,
        duration_minutes: 60,
        status: l.status,
        video_meeting_url: l.video_room_url,
        teacher: l.teacher,
      })),
  ].sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

  return {
    appointmentRequests,
    appointments,
    coachingSessions,
    liveSessions,
    calendarEvents,
    loading,
    error,
    refresh,
    confirmAppointment,
    cancelAppointment: cancelAppointmentRequest,
  };
}
