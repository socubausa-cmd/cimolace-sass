/**
 * Titre de session, formateur, décompte participants — `live_sessions` + `live_session_participants`.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * @param {string | null} sessionId
 * @param {{ enabled?: boolean }} options
 */
export function useLiveSessionHeaderInfo(sessionId, { enabled = true } = {}) {
  const [title, setTitle] = useState('');
  const [teacherId, setTeacherId] = useState(null);
  const [teacherName, setTeacherName] = useState('');
  const [participantCount, setParticipantCount] = useState(null);
  const [loading, setLoading] = useState(!!(enabled && sessionId));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled || !sessionId) {
      setTitle('');
      setTeacherId(null);
      setTeacherName('');
      setParticipantCount(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const { data: session, error: se } = await supabase
        .from('live_sessions')
        .select('id, title, teacher_id, status')
        .eq('id', sessionId)
        .maybeSingle();

      if (cancelled) return;
      if (se) {
        setError(se);
        setLoading(false);
        return;
      }
      if (!session) {
        setTitle('');
        setTeacherId(null);
        setParticipantCount(0);
        setLoading(false);
        return;
      }

      setTitle(String(session.title || '').trim() || 'Live');
      setTeacherId(session.teacher_id || null);

      if (session.teacher_id) {
        const { data: prof } = await supabase.from('profiles').select('id, name').eq('id', session.teacher_id).maybeSingle();
        if (cancelled) return;
        setTeacherName(prof?.name?.trim() ? prof.name : '');
      } else {
        setTeacherName('');
      }

      const { count, error: ce } = await supabase
        .from('live_session_participants')
        .select('id', { count: 'exact', head: true })
        .eq('live_session_id', sessionId);

      if (cancelled) return;
      if (ce) {
        setParticipantCount(null);
      } else {
        setParticipantCount(typeof count === 'number' ? count : null);
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, sessionId]);

  return { title, teacherId, teacherName, participantCount, loading, error, sessionTypeLabel: 'Session en direct' };
}
