import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * Inscriptions « Mes formations » — partagé par
 * `pages/student-school-life/StudentFormationsPage` et
 * `pages/eleve-mobile/etudiantParity/EleveEtudiantFormationsScreen`.
 *
 * Source réelle : `student_progress` (jointure `courses` via FK course_id → courses.id).
 * La table `enrollments` ne contient pas de FK vers les cours dans ce tenant —
 * elle gère les inscriptions administratives (school services).
 */
export function useStudentEnrollmentsList(userId) {
  const [enrolledFormations, setEnrolledFormations] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) {
      setEnrolledFormations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('student_progress')
      .select('id, status, course_id, completed_at, created_at, courses(id, title, description, category)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      // Déduplique par course_id (garder le plus récent)
      const seen = new Set();
      const deduped = data.filter((row) => {
        if (!row.course_id || seen.has(row.course_id)) return false;
        seen.add(row.course_id);
        return true;
      });
      setEnrolledFormations(
        deduped.map((row) => ({
          id: row.courses?.id || row.course_id,
          enrollmentId: row.id,
          title: row.courses?.title || '',
          description: row.courses?.description || '',
          thumbnail: null,
          category: row.courses?.category || 'Formation',
          status: row.status === 'completed' ? 'completed' : 'in_progress',
          completedAt: row.completed_at,
          enrolledAt: row.created_at,
        })),
      );
    } else {
      setEnrolledFormations([]);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { enrolledFormations, loading, refresh: load };
}
