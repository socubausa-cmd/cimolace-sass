/**
 * Chevauchement de créneaux (tous clients) pour ngowazulu_mentorat_sessions.
 */
export async function fetchNgowazuluSessionConflicts(supabase, { startIso, endIso, excludeSessionId }) {
  if (!startIso || !endIso) return [];
  let q = supabase
    .from('ngowazulu_mentorat_sessions')
    .select('id,title,scheduled_start,scheduled_end,student_id,session_type')
    .neq('status', 'cancelled')
    .lt('scheduled_start', endIso)
    .gt('scheduled_end', startIso);
  const { data, error } = await q;
  if (error) throw error;
  const rows = data || [];
  if (excludeSessionId) return rows.filter((r) => r.id !== excludeSessionId);
  return rows;
}

export function addMinutesToIso(iso, minutes) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  d.setMinutes(d.getMinutes() + Number(minutes || 60));
  return d.toISOString();
}

export function countSessionsInContractPeriod(sessions, periodStart, periodEnd) {
  const a = new Date(periodStart).getTime();
  const b = new Date(periodEnd).getTime();
  return (sessions || []).filter((s) => {
    if (s.status === 'cancelled') return false;
    const t = new Date(s.scheduled_start).getTime();
    return t >= a && t < b;
  }).length;
}

export function countSessionsInCalendarMonth(sessions, refDate = new Date()) {
  const y = refDate.getFullYear();
  const m = refDate.getMonth();
  return (sessions || []).filter((s) => {
    if (s.status === 'cancelled') return false;
    const d = new Date(s.scheduled_start);
    return d.getFullYear() === y && d.getMonth() === m;
  }).length;
}
