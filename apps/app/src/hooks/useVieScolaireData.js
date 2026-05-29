import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import {
  attendanceRecordsForStudentParity,
  enrollmentsForStudentSnapshot,
  schoolEventsForStudentWindow,
  studentEvaluationsForStudent,
} from '@/lib/studentSchoolDataQueries';

/**
 * @returns {{
 *  loading: boolean;
 *  enrollmentCount: number;
 *  formationTitles: string[];
 *  evals: { id: string, title: string, score: number, max: number, at: string }[];
 *  agenda: { id: string, title: string, when: string, loc: string, desc?: string }[];
 *  absenceCount: number;
 *  delayCount: number;
 *  notifPreview: { id: string, line: string, at: string }[];
 *  moyenneLabel: string;
 *  refresh: () => void;
 * }}
 */
export function useVieScolaireData(userId) {
  const [loading, setLoading] = useState(Boolean(userId));
  const [enrollmentCount, setEnrollmentCount] = useState(0);
  const [formationTitles, setFormationTitles] = useState([]);
  const [evals, setEvals] = useState([]);
  const [agenda, setAgenda] = useState([]);
  const [absenceCount, setAbsenceCount] = useState(0);
  const [delayCount, setDelayCount] = useState(0);
  const [notifPreview, setNotifPreview] = useState([]);

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [enrollRes, evalRes, eventRes, absRes, notifRes] = await Promise.all([
      enrollmentsForStudentSnapshot(userId, { limit: 20 }),
      studentEvaluationsForStudent(userId, { limit: 10 }),
      schoolEventsForStudentWindow({ limit: 50, openEnd: true }),
      attendanceRecordsForStudentParity(userId, { limit: 200 }),
      supabase
        .from('notifications')
        .select('id,title,body,created_at,is_read')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    const en = enrollRes.error ? [] : enrollRes.data || [];
    setEnrollmentCount(en.length);
    // student_progress rows joined with courses (enrollmentsForStudentSnapshot now uses this source)
    setFormationTitles(en.map((r) => r?.courses?.title).filter(Boolean));

    setEvals(
      (evalRes.error ? [] : evalRes.data || []).map((e) => ({
        id: e.id,
        title: e.title || 'Évaluation',
        score: Number(e.score || 0),
        max: Number(e.max_score || 20),
        at: e.evaluated_at,
      })),
    );

    setAgenda(
      (eventRes.error ? [] : eventRes.data || []).map((e) => ({
        id: e.id,
        title: e.title || 'Événement',
        when: e.start_at,
        loc: e.location || '',
        desc: e.description ? String(e.description) : '',
      })),
    );

    const absRows = absRes.error ? [] : absRes.data || [];
    setAbsenceCount(absRows.filter((r) => String(r.status || '').toLowerCase() === 'absent').length);
    setDelayCount(absRows.filter((r) => String(r.status || '').toLowerCase() === 'late').length);

    setNotifPreview(
      (notifRes.error ? [] : notifRes.data || []).map((n) => ({
        id: n.id,
        line: n.body || n.title || 'Notification',
        at: n.created_at,
        isRead: Boolean(n.is_read),
      })),
    );
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setEnrollmentCount(0);
      setFormationTitles([]);
      setEvals([]);
      setAgenda([]);
      setAbsenceCount(0);
      setDelayCount(0);
      setNotifPreview([]);
      setLoading(false);
      return;
    }
    void load();
  }, [userId, load]);

  const moyenneLabel = useMemo(() => {
    if (!evals.length) return 'N/A';
    const avg = evals.reduce((a, e) => a + (e.max > 0 ? (e.score / e.max) * 20 : 0), 0) / evals.length;
    return `${avg.toFixed(1)}/20`;
  }, [evals]);

  return {
    loading,
    enrollmentCount,
    formationTitles,
    evals,
    agenda,
    absenceCount,
    delayCount,
    notifPreview,
    moyenneLabel,
    refresh: load,
  };
}
