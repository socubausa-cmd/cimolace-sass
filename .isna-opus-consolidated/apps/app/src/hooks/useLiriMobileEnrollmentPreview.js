import { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * Aperçu formations inscrites pour l’accueil LIRI mobile (même source que le tableau de bord élève).
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
        const { data } = await supabase
          .from('enrollments')
          .select('id, status, enrolled_at, formations(id, title, image_url, description)')
          .eq('student_id', userId)
          .order('enrolled_at', { ascending: false });
        if (alive) setEnrollments(data || []);
      } catch {
        if (alive) setEnrollments([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  const current =
    enrollments.find((e) => e.status === 'active') || enrollments.find((e) => e.status !== 'completed') || enrollments[0];

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
