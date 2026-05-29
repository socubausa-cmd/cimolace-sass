import { useCallback, useEffect, useState } from 'react';
import { attendanceRecordsForStudentParity } from '@/lib/studentSchoolDataQueries';

/**
 * `attendance_records` (absent, late, excused) — partagé par
 * `StudentAbsencesPage` (web) et `EleveEtudiantAbsencesScreen` (LIRI mobile).
 */
export function useStudentAttendanceRecords(userId) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await attendanceRecordsForStudentParity(userId, { limit: 200 });
    setRows(error ? [] : data || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { rows, loading, refresh: load };
}
