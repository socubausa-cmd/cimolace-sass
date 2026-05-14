/**
 * useStudentLiveSessions
 *
 * Récupère les sessions live (scheduled + live) liées aux formations
 * actives de l'élève connecté.
 *
 * Retourne :
 *   sessions          — toutes les sessions triées par scheduled_at asc
 *   activeLiveSession — session dont status = 'live' (ou null)
 *   loading           — booléen
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

export function useStudentLiveSessions(userId) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!userId) {
      setSessions([]);
      return;
    }
    setLoading(true);

    // 1. Récupérer les formation_id actives de l'élève
    const { data: enrollments, error: enrollErr } = await supabase
      .from('enrollments')
      .select('formation_id')
      .eq('student_id', userId)
      .eq('status', 'active');

    if (enrollErr || !enrollments?.length) {
      setSessions([]);
      setLoading(false);
      return;
    }

    const formationIds = enrollments.map((e) => e.formation_id).filter(Boolean);

    // 2. Récupérer les sessions live pour ces formations
    const { data, error } = await supabase
      .from('live_sessions')
      .select(
        'id, formation_id, title, status, scheduled_at, video_room_url, thumbnail_url, instructor_name',
      )
      .in('formation_id', formationIds)
      .in('status', ['scheduled', 'live'])
      .order('scheduled_at', { ascending: true });

    if (!error && data) {
      setSessions(data);
    } else {
      setSessions([]);
    }

    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeLiveSession = useMemo(
    () => sessions.find((s) => s.status === 'live') ?? null,
    [sessions],
  );

  return { sessions, activeLiveSession, loading };
}
