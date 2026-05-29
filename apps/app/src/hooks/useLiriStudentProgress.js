import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * Données de progression réelle de l'élève depuis la table `student_progress`.
 * Colonnes : id, tenant_id, user_id, lesson_id, course_id, status,
 *            time_spent_seconds, completed_at, created_at
 *
 * Retourne :
 *   - completedLessons  : nombre de leçons terminées
 *   - inProgressLessons : nombre de leçons en cours
 *   - distinctCourses   : nombre de cours distincts touchés
 *   - totalTimeMinutes  : temps total passé (minutes)
 *   - xp                : XP calculé (10 pts/leçon terminée + 2 pts/min)
 *   - level             : niveau (1 + floor(xp / 100))
 *   - nextLevelXp       : XP manquant pour le niveau suivant
 *   - streak            : jours consécutifs d'activité (depuis completed_at)
 *   - loading, error
 */
export function useLiriStudentProgress(userId) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) {
      setRows([]);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const { data, error: err } = await supabase
          .from('student_progress')
          .select('course_id, status, time_spent_seconds, completed_at, created_at')
          .eq('user_id', userId);
        if (!alive) return;
        if (err) { setError(err.message); setRows([]); }
        else setRows(data || []);
      } catch (e) {
        if (alive) setError(e.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [userId]);

  const stats = useMemo(() => {
    const completed = rows.filter((r) => r.status === 'completed');
    const inProgress = rows.filter((r) => r.status === 'in_progress');
    const distinctCourses = new Set(rows.map((r) => r.course_id).filter(Boolean)).size;
    const totalTimeSecs = rows.reduce((s, r) => s + (r.time_spent_seconds || 0), 0);
    const totalTimeMinutes = Math.round(totalTimeSecs / 60);

    // XP: 10 pts/leçon terminée + 2 pts/minute de contenu
    const xp = completed.length * 10 + Math.floor(totalTimeMinutes * 2);
    const level = Math.max(1, 1 + Math.floor(xp / 100));
    const nextLevelXp = 100 - (xp % 100);

    // Streak: nombre de jours consécutifs avec au moins une leçon terminée,
    // en remontant depuis aujourd'hui
    const completionDates = new Set(
      completed
        .map((r) => r.completed_at)
        .filter(Boolean)
        .map((d) => new Date(d).toISOString().slice(0, 10)),
    );
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      if (completionDates.has(key)) {
        streak++;
      } else if (i > 0) {
        break; // Séquence cassée
      }
    }

    return {
      completedLessons: completed.length,
      inProgressLessons: inProgress.length,
      distinctCourses,
      totalTimeMinutes,
      xp,
      level,
      nextLevelXp,
      streak,
    };
  }, [rows]);

  return { ...stats, loading, error, hasRealData: rows.length > 0 };
}

export default useLiriStudentProgress;
