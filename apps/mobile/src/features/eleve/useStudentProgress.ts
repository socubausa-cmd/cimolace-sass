import { useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase';

/**
 * Progression réelle de l'élève — portage natif fidèle de
 * apps/app/src/hooks/useLiriStudentProgress.js (table `student_progress`).
 * Même calcul XP/niveau/streak. Source partagée → parité garantie.
 */
type Row = {
  course_id: string | null;
  status: string | null;
  time_spent_seconds: number | null;
  completed_at: string | null;
  created_at: string | null;
};

export function useStudentProgress(userId?: string | null) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(Boolean(userId));

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
        const { data } = await supabase
          .from('student_progress')
          .select('course_id, status, time_spent_seconds, completed_at, created_at')
          .eq('user_id', userId);
        if (alive) setRows((data as Row[]) || []);
      } catch {
        if (alive) setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  const stats = useMemo(() => {
    const completed = rows.filter((r) => r.status === 'completed');
    const inProgress = rows.filter((r) => r.status === 'in_progress');
    const distinctCourses = new Set(rows.map((r) => r.course_id).filter(Boolean)).size;
    const totalTimeSecs = rows.reduce((acc, r) => acc + (r.time_spent_seconds || 0), 0);
    const totalTimeMinutes = Math.round(totalTimeSecs / 60);
    const xp = completed.length * 10 + Math.floor(totalTimeMinutes * 2);
    const level = Math.max(1, 1 + Math.floor(xp / 100));
    const nextLevelXp = 100 - (xp % 100);

    const completionDates = new Set(
      completed
        .map((r) => r.completed_at)
        .filter(Boolean)
        .map((d) => new Date(d as string).toISOString().slice(0, 10)),
    );
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      if (completionDates.has(key)) streak++;
      else if (i > 0) break;
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

  return { ...stats, loading, hasRealData: rows.length > 0 };
}
