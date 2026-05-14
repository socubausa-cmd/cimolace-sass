import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * Inscriptions « Mes formations » — partagé par
 * `pages/student-school-life/StudentFormationsPage` et
 * `pages/eleve-mobile/etudiantParity/EleveEtudiantFormationsScreen`.
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
      .from('enrollments')
      .select('id, status, enrolled_at, completed_at, formations(id, title, description, status, cycle, image_url, meta)')
      .eq('student_id', userId);
    if (!error && data) {
      setEnrolledFormations(
        data.map((e) => ({
          id: e.formations?.id,
          enrollmentId: e.id,
          title: e.formations?.title || '',
          description: e.formations?.description || '',
          thumbnail: e.formations?.image_url || '',
          category: e.formations?.meta?.category || 'Formation',
          status: e.status === 'completed' ? 'completed' : 'in_progress',
          completedAt: e.completed_at,
          enrolledAt: e.enrolled_at,
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
