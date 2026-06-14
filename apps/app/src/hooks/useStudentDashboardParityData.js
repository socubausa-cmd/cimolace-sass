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
 * Partagé avec : `pages/school/student-school-life/StudentDashboard` et
 * `pages/school/eleve-mobile/etudiantParity/EleveEtudiantDashboardScreen`.
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
        .select('id,title,body,created_at,is_read')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10),
      studentEvaluationsForStudent(userId, { limit: 10 }),
      schoolEventsForStudentWindow({ limit: 10, openEnd: true }),
      attendanceRecordsForStudentParity(userId, { limit: 200 }),
    ]);

    const en = enrollRes.error ? [] : enrollRes.data || [];
    // Group by course_id — student_progress has one row per lesson.
    // Compute real per-course completion ratio (completed lessons / total lessons).
    const courseMap = new Map();
    for (const r of en) {
      const cid = r.course_id || r.id;
      if (!courseMap.has(cid)) {
        courseMap.set(cid, { title: r.courses?.title, enrolledAt: r.created_at, total: 0, completed: 0 });
      }
      const entry = courseMap.get(cid);
      entry.total++;
      if (String(r.status || '').toLowerCase() === 'completed') entry.completed++;
    }
    setFormations(
      [...courseMap.entries()].map(([cid, c]) => ({
        id: cid,
        title: c.title || 'Formation',
        progress: c.total > 0 ? Math.round((c.completed / c.total) * 100) : 0,
        enrolledAt: c.enrolledAt || null,
      })),
    );

    setNotifications(
      (notifRes.error ? [] : notifRes.data || []).map((n) => ({
        id: n.id,
        message: n.body || n.title,
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
