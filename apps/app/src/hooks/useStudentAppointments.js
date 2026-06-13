import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

const isSchemaMismatchError = (error) => {
  const msg = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '');
  return code === '42703' || msg.includes('column') || msg.includes('does not exist');
};

export function useStudentAppointments(userId) {
  const [appointmentRequests, setAppointmentRequests] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [liveSessions, setLiveSessions] = useState([]);
  const [studentReports, setStudentReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [reqRes, apptRes, partRes, reportRes] = await Promise.all([
        supabase
          .from('appointment_requests')
          .select('id, reason, status, scheduled_at, video_meeting_url, assigned_teacher_id, created_at')
          .eq('student_id', userId)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('appointments')
          .select('id, type, scheduled_at, status, video_meeting_url, teacher_id, duration_minutes')
          .eq('student_id', userId)
          .gte('scheduled_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .order('scheduled_at', { ascending: true })
          .limit(100),
        supabase
          .from('live_session_participants')
          .select('live_session_id')
          .eq('user_id', userId),
        supabase
          .from('student_live_reports')
          .select('id, live_session_id, report_text, created_at')
          .eq('student_id', userId)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      // appointment_requests can be absent from the schema — treat as non-critical
      const reqs = reqRes.error ? [] : (reqRes.data || []);

      // Normalise booking API response: booking_slots.start_at → scheduled_at
      const rawAppts = apptRes.error ? [] : (apptRes.data || []);
      const appts = rawAppts.map((a) => {
        const slot = a.booking_slots || {};
        return {
          ...a,
          scheduled_at: slot.start_at || a.scheduled_at || a.created_at,
          type: a.type || slot.type || 'entretien',
        };
      });
      const parts = partRes.error ? [] : (partRes.data || []);
      const reports = reportRes.error ? [] : (reportRes.data || []);

      const sessionIds = [...new Set(parts.map((p) => p.live_session_id))];
      let lives = [];
      if (sessionIds.length > 0) {
        let liveRes = await supabase
          .from('live_sessions')
          .select('id, title, session_type, scheduled_at, status, video_room_url, visibility_mode, teacher_id')
          .in('id', sessionIds)
          .gte('scheduled_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .order('scheduled_at', { ascending: true });
        if (liveRes.error && isSchemaMismatchError(liveRes.error)) {
          liveRes = await supabase
            .from('live_sessions')
            .select('id, title, session_type, scheduled_at, status, teacher_id')
            .in('id', sessionIds)
            .gte('scheduled_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
            .order('scheduled_at', { ascending: true });
        }
        lives = (liveRes.data || []).map((l) => ({
          ...l,
          video_room_url: l.video_room_url || null,
          visibility_mode: l.visibility_mode || 'secret',
        }));
      }

      const teacherIds = [...new Set([
        ...reqs.map((r) => r.assigned_teacher_id),
        ...appts.map((a) => a.teacher_id),
        ...lives.map((l) => l.teacher_id),
      ].filter(Boolean))];
      const { data: profiles } = teacherIds.length ? await supabase.from('profiles').select('id, name, email').in('id', teacherIds) : { data: [] };
      const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));

      setAppointmentRequests(reqs.map((r) => ({ ...r, teacher: profileMap[r.assigned_teacher_id] })));
      setAppointments(appts.map((a) => ({ ...a, teacher: profileMap[a.teacher_id] })));
      setLiveSessions(lives.map((l) => ({ ...l, teacher: profileMap[l.teacher_id] })));
      setStudentReports(reports);
    } catch (e) {
      setError(e);
      setAppointmentRequests([]);
      setAppointments([]);
      setLiveSessions([]);
      setStudentReports([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const upcomingEvents = [
    ...appointments
      .filter((a) => !['cancelled'].includes(a.status))
      .map((a) => ({
        id: a.id,
        type: 'appointment',
        title: `${a.type} - ${a.teacher?.name || 'Conseiller'}`,
        scheduled_at: a.scheduled_at,
        video_url: a.video_meeting_url,
        status: a.status,
        instructor: a.teacher?.name,
      })),
    ...liveSessions
      .filter((l) => l.status !== 'cancelled')
      .map((l) => ({
        id: l.id,
        type: 'live',
        title: l.title,
        scheduled_at: l.scheduled_at,
        video_url: l.video_room_url,
        status: l.status,
        instructor: l.teacher?.name,
      })),
  ].sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));

  return {
    appointmentRequests,
    appointments,
    liveSessions,
    studentReports,
    upcomingEvents,
    loading,
    error,
    refresh,
  };
}
