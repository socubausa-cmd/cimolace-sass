import { supabase } from '@/lib/customSupabaseClient';

/** Filtre commun événements élèves. Sans `openEnd`, borne haute +365 j (sauf `toIso`). Avec `openEnd`, pas de plafond sur `start_at` (volume = `limit`). */
const STUDENT_EVENT_ROLES = ['all', 'student'];

const emptyOk = () => Promise.resolve({ data: [], error: null });

/**
 * Événements d'établissement visibles par l'élève (`all` / `student`).
 * @param {object} [opts]
 * @param {string} [opts.fromIso] - défaut : 7 j avant maintenant
 * @param {string} [opts.toIso] - borne haute (défaut : +365 j). Ignorée si `openEnd`.
 * @param {boolean} [opts.openEnd] - si vrai, pas de `.lte` sur `start_at` (comportement historique de l'agenda web) ; le volume reste borné par `limit`.
 * @param {number} [opts.limit]
 * @returns {import('@supabase/supabase-js').PostgrestSingleResponse<unknown[]>}
 */
export function schoolEventsForStudentWindow({ fromIso, toIso, openEnd, limit = 100 } = {}) {
  const from =
    fromIso || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const defaultTo = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  let q = supabase
    .from('school_events')
    .select('id,title,start_at,end_at,location,description,target_role')
    .in('target_role', STUDENT_EVENT_ROLES)
    .gte('start_at', from);
  if (!openEnd) {
    q = q.lte('start_at', toIso || defaultTo);
  }
  return q.order('start_at', { ascending: true }).limit(limit);
}

/**
 * Périodes `school_calendar` qui ne sont pas terminées avant `fromIso`
 * (équivalent logique d'un horizon ouvert côté fin : plus de plafond sur `start_date`).
 * @param {object} [opts]
 * @param {string} [opts.fromIso] - défaut : 2 j avant (comme l'agenda LIRI)
 * @param {number} [opts.limit]
 */
export function schoolCalendarRowsOverlappingFrom({ fromIso, limit = 200 } = {}) {
  const from =
    fromIso || new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  return supabase
    .from('school_calendar')
    .select('id,title,start_date,end_date,description')
    .gte('end_date', from)
    .order('start_date', { ascending: true })
    .limit(limit);
}

/**
 * Semaines du CALENDRIER ANNUEL pédagogique (annual_program_weeks) des calendriers
 * PUBLIÉS — relie l'agenda élève au programme de l'année (#46). La RLS scope déjà
 * au tenant du membre (via school_year_calendars). `!inner` + filtre status =
 * 'published' → on ne montre que les calendriers publiés (jamais les brouillons).
 */
export function annualProgramWeeksFrom({ fromIso, limit = 60 } = {}) {
  const from =
    fromIso || new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  return supabase
    .from('annual_program_weeks')
    .select('id, week_start, week_end, title, module_title, theme, is_holiday, school_year_calendars!inner(status)')
    .eq('school_year_calendars.status', 'published')
    .gte('week_start', from)
    .order('week_start', { ascending: true })
    .limit(limit);
}

/**
 * Même requête que `useStudentAttendanceRecords` (absent, late, excused).
 * Utilisé aussi par le dashboard / vie scolaire (filtrage absent / retard côté UI).
 */
export function attendanceRecordsForStudentParity(userId, { limit = 200 } = {}) {
  if (!userId) return emptyOk();
  return supabase
    .from('attendance_records')
    .select('id,status,attendance_date,note')
    .eq('student_id', userId)
    .in('status', ['absent', 'late', 'excused'])
    .order('attendance_date', { ascending: false })
    .limit(limit);
}

/**
 * `student_evaluations` récentes — partagé par
 * `useStudentEvaluationsParityData` (100) et dashboard / vie scolaire (10).
 */
export function studentEvaluationsForStudent(userId, { limit = 100 } = {}) {
  if (!userId) return emptyOk();
  return supabase
    .from('student_evaluations')
    .select('id,title,score,max_score,evaluated_at,formation_id')
    .eq('student_id', userId)
    .order('evaluated_at', { ascending: false })
    .limit(limit);
}

/**
 * Aperçu inscriptions (dashboard, vue vie scolaire).
 * Source : `student_progress` (jointure `courses`) — la table `enrollments`
 * ne possède pas de FK vers les formations de cours dans ce tenant.
 */
export function enrollmentsForStudentSnapshot(userId, { limit = 20 } = {}) {
  if (!userId) return emptyOk();
  return supabase
    .from('student_progress')
    .select('id, status, course_id, completed_at, created_at, courses(id, title)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
}
