import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

const isSchemaMismatchError = (error) => {
  const msg = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '');
  return code === '42703' || msg.includes('column') || msg.includes('does not exist');
};

/**
 * Rendez-vous & agenda élève.
 *
 * Les RDV sont lus via l'API booking : supabaseCompat route `appointments` vers
 * GET /booking/appointments, STUDENT-SCOPÉ côté serveur (userRole='student' →
 * filtre student_id = auth.uid()) → un élève ne voit QUE ses propres lignes.
 *
 * Schéma RÉEL de public.appointments (vérifié prod 2026-06-14) :
 *   { id, tenant_id, student_id, slot_id, status, notes, source, created_at, updated_at }
 * PAS de scheduled_at / type / teacher_id / video_meeting_url. La date éventuelle
 * vient du créneau joint (booking_slots.start_at), posé par le secrétariat à la
 * confirmation. Une DEMANDE en attente = status='requested' + slot_id NULL →
 * AUCUNE date : elle est exposée via `appointmentRequests` (bannière « en
 * attente »), jamais dans `upcomingEvents` (réservé aux événements datés).
 *
 * NB : l'ancienne table `appointment_requests` (stub `[]` dans supabaseCompat)
 * n'est plus lue — les demandes vivent désormais dans `appointments`.
 */
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
      const [apptRes, partRes, reportRes] = await Promise.all([
        // Routé vers GET /booking/appointments (créneau joint, scope élève serveur).
        supabase
          .from('appointments')
          .select(
            'id, tenant_id, student_id, slot_id, status, notes, source, created_at, updated_at, booking_slots(start_at, end_at, title, type)',
          )
          .eq('student_id', userId)
          .order('created_at', { ascending: false })
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

      const rawAppts = apptRes.error ? [] : (apptRes.data || []);
      const appts = rawAppts.map((a) => {
        const slot = a.booking_slots || null;
        return {
          id: a.id,
          tenant_id: a.tenant_id,
          status: a.status,
          notes: a.notes || '',
          source: a.source || null,
          slot_id: a.slot_id || null,
          created_at: a.created_at,
          // Date réelle = créneau confirmé par le secrétariat ; NULL pour une demande.
          scheduled_at: slot?.start_at || null,
          slot,
        };
      });

      // Demandes en attente : status='requested' (slot_id NULL → sans date).
      const requests = appts
        .filter((a) => a.status === 'requested')
        .map((a) => ({
          id: a.id,
          status: a.status, // 'requested'
          notes: a.notes,
          created_at: a.created_at,
        }));

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

      // appointments n'a pas de teacher_id (vrai schéma) → seuls les lives en ont.
      const teacherIds = [...new Set(lives.map((l) => l.teacher_id).filter(Boolean))];
      const { data: profiles } = teacherIds.length
        ? await supabase.from('profiles').select('id, name, email').in('id', teacherIds)
        : { data: [] };
      const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));

      setAppointments(appts);
      setAppointmentRequests(requests);
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
    // RDV avec un créneau confirmé uniquement — les demandes sans date sont
    // exclues (cf. appointmentRequests / bannière « en attente »).
    ...appointments
      .filter((a) => a.scheduled_at && a.status !== 'cancelled')
      .map((a) => ({
        id: a.id,
        type: 'appointment',
        title: a.slot?.title || 'Rendez-vous',
        scheduled_at: a.scheduled_at,
        video_url: null,
        status: a.status,
        instructor: null,
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
