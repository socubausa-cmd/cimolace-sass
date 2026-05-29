import { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * Aperçu des cours en cours / terminés pour l'accueil LIRI mobile.
 *
 * Source réelle : `student_progress` (jointure `courses` via FK course_id → courses.id).
 * Colonnes student_progress : id, user_id, course_id, status, time_spent_seconds,
 *                              completed_at, created_at
 * Colonnes courses jointure  : id, title, description, category
 *
 * Remplace l'ancienne source `enrollments` (table école, sans FK formations).
 */
export function useLiriMobileEnrollmentPreview(userId) {
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(Boolean(userId));

  useEffect(() => {
    if (!userId) {
      setEnrollments([]);
      setLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('student_progress')
          .select('id, status, course_id, time_spent_seconds, completed_at, created_at, courses(id, title, description, category)')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        if (alive) {
          // Normalise vers le même shape qu'avant pour ne pas casser les écrans
          const normalized = (data || []).map((row) => ({
            id: row.id,
            status: row.status === 'completed' ? 'completed' : row.status === 'in_progress' ? 'active' : row.status,
            enrolled_at: row.created_at,
            formations: row.courses
              ? {
                  id: row.courses.id,
                  title: row.courses.title,
                  description: row.courses.description,
                  image_url: null,
                  category: row.courses.category,
                }
              : null,
          }));
          setEnrollments(normalized);
        }
      } catch {
        if (alive) setEnrollments([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [userId]);

  const current =
    enrollments.find((e) => e.status === 'active') ||
    enrollments.find((e) => e.status !== 'completed') ||
    enrollments[0];

  const completed = enrollments.filter((e) => e.status === 'completed').length;
  const total = enrollments.length;
  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    enrollments,
    loading,
    currentFormation: current?.formations || null,
    progressLabel: total > 0 ? `${completed} / ${total}` : null,
    progressPercent,
  };
}
