import { useCallback, useEffect, useState } from 'react';
import { schoolEventsForStudentWindow, studentEvaluationsForStudent } from '@/lib/studentSchoolDataQueries';

/**
 * Notes + événements « type examen » à venir (fenêtre `schoolEventsForStudentWindow` + `start_at` ≥ maintenant) —
 * partagé par `StudentEvaluationsPage` (web) et `EleveEtudiantEvaluationsScreen` (LIRI mobile).
 */
export function useStudentEvaluationsParityData(userId) {
  const [evaluationsRows, setEvaluationsRows] = useState([]);
  const [upcomingRows, setUpcomingRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) {
      setEvaluationsRows([]);
      setUpcomingRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [evalRes, eventsRes] = await Promise.all([
      studentEvaluationsForStudent(userId, { limit: 100 }),
      schoolEventsForStudentWindow({ limit: 100, openEnd: true }),
    ]);
    setEvaluationsRows(evalRes.error ? [] : evalRes.data || []);
    const evs = eventsRes.error ? [] : eventsRes.data || [];
    const now = Date.now();
    setUpcomingRows(
      evs
        .filter((e) => e.start_at && new Date(e.start_at).getTime() >= now)
        .filter((e) =>
          /exam|évaluation|evaluation|contrôle|controle|quiz/i.test(
            String(e.title || '') + String(e.description || ''),
          ),
        ),
    );
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { evaluationsRows, upcomingRows, loading, refresh: load };
}
