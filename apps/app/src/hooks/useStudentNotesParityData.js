import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

function computeClassRankingLabel(userId, allRows) {
  if (!Array.isArray(allRows) || allRows.length === 0) return 'N/A';
  const byStudent = new Map();
  allRows.forEach((r) => {
    const sid = String(r.student_id || '');
    if (!sid) return;
    const current = byStudent.get(sid) || { total: 0, count: 0 };
    const normalized =
      Number(r.max_score || 20) > 0 ? (Number(r.score || 0) / Number(r.max_score || 20)) * 20 : 0;
    current.total += normalized;
    current.count += 1;
    byStudent.set(sid, current);
  });
  const ranked = [...byStudent.entries()]
    .map(([sid, v]) => ({ sid, avg: v.count ? v.total / v.count : 0 }))
    .sort((a, b) => b.avg - a.avg);
  const myPos = ranked.findIndex((x) => x.sid === userId);
  return myPos >= 0 ? `${myPos + 1}/${ranked.length}` : 'N/A';
}

/**
 * Relevé de notes + classement (moyenne / rang sur échantillon `student_evaluations`) —
 * partagé par `StudentNotesPage` (web) et `EleveEtudiantNotesScreen` (LIRI mobile).
 */
export function useStudentNotesParityData(userId) {
  const [gradesRows, setGradesRows] = useState([]);
  const [rankingValue, setRankingValue] = useState('N/A');
  const [loading, setLoading] = useState(!!userId);

  const load = useCallback(async () => {
    if (!userId) {
      setGradesRows([]);
      setRankingValue('N/A');
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data: ownRows, error: ownErr }, { data: allRows, error: allErr }] = await Promise.all([
      supabase
        .from('student_evaluations')
        .select('id,title,score,max_score,evaluated_at,comment')
        .eq('student_id', userId)
        .order('evaluated_at', { ascending: false })
        .limit(200),
      supabase.from('student_evaluations').select('student_id,score,max_score').limit(5000),
    ]);

    setGradesRows(ownErr ? [] : ownRows || []);
    setRankingValue(allErr ? 'N/A' : computeClassRankingLabel(userId, allRows));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { gradesRows, rankingValue, loading, refresh: load };
}
