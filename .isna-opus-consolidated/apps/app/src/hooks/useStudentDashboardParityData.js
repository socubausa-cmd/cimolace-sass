import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import {
  attendanceRecordsForStudentParity,
  enrollmentsForStudentSnapshot,
  schoolEventsForStudentWindow,
  studentEvaluationsForStudent,
} from '@/lib/studentSchoolDataQueries';

/**
 * Même lot de requêtes que `StudentDashboard` (portail web) — sans mode démo.
 * Partagé avec : `pages/student-school-life/StudentDashboard` et
 * `pages/eleve-mobile/etudiantParity/EleveEtudiantDashboardScreen`.
 */
export function useStudentDashboardParityData(userId) {
  const [loading, setLoading] = useState(Boolean(userId));
  const [formations, setFormations] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [delays, setDelays] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [agenda, setAgenda] = useState([]);

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [enrollRes, notifRes, evalRes, eventRes, absRes] = await Promise.all([
      enrollmentsForStudentSnapshot(userId, { limit: 20 }),
      supabase
        .from('notifications')
        .select('id,title,message,created_at,is_read')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10),
      studentEvaluationsForStudent(userId, { limit: 10 }),
      schoolEventsForStudentWindow({ limit: 10, openEnd: true }),
      attendanceRecordsForStudentParity(userId, { limit: 200 }),
    ]);

    const en = enrollRes.error ? [] : enrollRes.data || [];
    setFormations(
      en.map((r) => ({
        id: r.id,
        title: r.formations?.title || 'Formation',
        progress: String(r.status || '').toLowerCase() === 'completed' ? 100 : 50,
        enrolledAt: r.enrolled_at || r.created_at || null,
      })),
    );

    setNotifications(
      (notifRes.error ? [] : notifRes.data || []).map((n) => ({
        id: n.id,
        message: n.message || n.title,
        date: n.created_at,
        isRead: Boolean(n.is_read),
      })),
    );

    setEvaluations(
      (evalRes.error ? [] : evalRes.data || []).map((e) => ({
        id: e.id,
        title: e.title || 'Évaluation',
        date: e.evaluated_at,
        score: Number(e.score || 0),
        max: Number(e.max_score || 20),
        maxScore: Number(e.max_score || 20),
      })),
    );

    setAgenda(
      (eventRes.error ? [] : eventRes.data || []).map((e) => ({
        id: e.id,
        title: e.title || 'Événement',
        date: e.start_at,
        time: (() => {
          const d = e.start_at ? new Date(e.start_at) : null;
          if (!d || Number.isNaN(d.getTime())) return '--:--';
          return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        })(),
        location: e.location || 'Campus',
      })),
    );

    const absRows = absRes.error ? [] : absRes.data || [];
    setAbsences(absRows.filter((r) => String(r.status || '').toLowerCase() === 'absent'));
    setDelays(absRows.filter((r) => String(r.status || '').toLowerCase() === 'late'));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setFormations([]);
      setNotifications([]);
      setAbsences([]);
      setDelays([]);
      setEvaluations([]);
      setAgenda([]);
      setLoading(false);
      return;
    }
    void load();
  }, [userId, load]);

  const moyenneLabel = useMemo(() => {
    if (!evaluations.length) return 'N/A';
    const avg =
      evaluations.reduce((a, e) => a + (e.max > 0 ? (e.score / e.max) * 20 : 0), 0) / evaluations.length;
    return `${avg.toFixed(1)}/20`;
  }, [evaluations]);

  return {
    loading,
    formations,
    notifications,
    absences,
    delays,
    evaluations,
    agenda,
    moyenneLabel,
    refresh: load,
  };
}
