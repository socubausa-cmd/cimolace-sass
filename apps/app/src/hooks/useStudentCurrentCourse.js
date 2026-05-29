/**
 * useStudentCurrentCourse — Hook central "Salle de Classe Élève"
 *
 * Jointure complète :
 *   enrollment (student ↔ formation)
 *     → live_sessions.formation_id  → prochaine session live
 *     → school_year_calendars       → semaine active du programme
 *     → annual_program_weeks        → contenu pédagogique de la semaine
 *
 * Retourne :
 *   currentWeek      — semaine active du calendrier (annual_program_weeks row)
 *   upcomingWeeks    — 4 prochaines semaines
 *   nextLiveSession  — prochaine session live de l'élève (peut être null)
 *   activeLiveSession — session LIVE en ce moment (status='live')
 *   enrolledFormations — formations actives avec progression
 *   progressPct      — % d'avancement dans l'année
 *   completedCount   — semaines terminées
 *   totalActive      — semaines actives (hors vacances)
 *   calendarWeeks    — toutes les semaines pour la timeline
 *   loading / error
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAnnualProgram, CURRENT_SCHOOL_YEAR } from '@/hooks/useAnnualProgram';

// ── Constantes ────────────────────────────────────────────────────────────────

// Couleurs par type de session (partagées avec EleveCalendrierAnnuelScreen)
export const SESSION_STYLES = {
  cours:      { dot: '#38bdf8', label: 'Cours',      bg: 'rgba(56,189,248,0.10)'  },
  live:       { dot: '#f43f5e', label: 'Live',       bg: 'rgba(244,63,94,0.10)'   },
  atelier:    { dot: '#34d399', label: 'Atelier',    bg: 'rgba(52,211,153,0.10)'  },
  evaluation: { dot: '#D4AF37', label: 'Évaluation', bg: 'rgba(212,175,55,0.10)'  },
  revision:   { dot: '#a78bfa', label: 'Révision',   bg: 'rgba(167,139,250,0.10)' },
  conge:      { dot: '#475569', label: 'Congé',      bg: 'rgba(71,85,105,0.08)'   },
};

// Couleurs par statut de semaine
export const WEEK_STATUS_COLOR = {
  completed:   '#22c55e',   // vert
  in_progress: '#D4AF37',   // or
  planned:     '#334155',   // gris sombre
  skipped:     '#475569',   // gris
};

// ── Hook principal ────────────────────────────────────────────────────────────

export function useStudentCurrentCourse({
  userId,
  schoolYear = CURRENT_SCHOOL_YEAR,
  cycle      = 'fondements',
} = {}) {

  // ── Programme annuel (calendrier) ─────────────────────────────────────────
  const {
    currentWeek,
    upcomingWeeks,
    weeks:         calendarWeeks,
    completedCount,
    totalActive,
    progressPct,
    loading:       calendarLoading,
    error:         calendarError,
    calendar,
  } = useAnnualProgram({ schoolYear, cycle, autoLoad: true });

  // ── Inscriptions élève ────────────────────────────────────────────────────
  const [enrolledFormations, setEnrolledFormations] = useState([]);
  const [formationsLoading,  setFormationsLoading]  = useState(false);

  const loadEnrollments = useCallback(async () => {
    if (!userId) { setEnrolledFormations([]); return; }
    setFormationsLoading(true);
    const { data, error } = await supabase
      .from('student_progress')
      .select(`
        id,
        status,
        created_at,
        completed_at,
        courses (
          id, title, description, status, cycle, image_url, meta
        )
      `)
      .eq('user_id', userId)
      .in('status', ['active', 'completed']);

    if (!error && data) {
      setEnrolledFormations(
        data
          .filter(e => e.courses)
          .map(e => ({
            id:           e.courses.id,
            enrollmentId: e.id,
            title:        e.courses.title    || 'Formation',
            description:  e.courses.description || '',
            thumbnail:    e.courses.image_url || '',
            category:     e.courses.meta?.category || 'Formation',
            status:       e.status === 'completed' ? 'completed' : 'in_progress',
            completedAt:  e.completed_at,
            enrolledAt:   e.created_at,
          }))
      );
    }
    setFormationsLoading(false);
  }, [userId]);

  useEffect(() => { void loadEnrollments(); }, [loadEnrollments]);

  // ── Sessions live liées aux formations de l'élève ─────────────────────────
  const [liveSessions,         setLiveSessions]         = useState([]);
  const [liveSessionsLoading,  setLiveSessionsLoading]  = useState(false);

  const loadLiveSessions = useCallback(async (formationIds) => {
    if (!formationIds?.length) { setLiveSessions([]); return; }
    setLiveSessionsLoading(true);

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('live_sessions')
      .select('id, title, formation_id, session_type, scheduled_at, started_at, ended_at, status, video_room_url, video_provider')
      .in('formation_id', formationIds)
      .in('status', ['scheduled', 'live'])
      .gte('scheduled_at', new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()) // -3h pour sessions en cours
      .order('scheduled_at', { ascending: true })
      .limit(10);

    if (!error && data) setLiveSessions(data);
    setLiveSessionsLoading(false);
  }, []);

  // Recharge les sessions quand les formations changent
  useEffect(() => {
    const fIds = enrolledFormations.map(f => f.id).filter(Boolean);
    void loadLiveSessions(fIds);
  }, [enrolledFormations, loadLiveSessions]);

  // ── Données dérivées ──────────────────────────────────────────────────────

  const now = new Date();

  /** Session live ACTIVE en ce moment (status = 'live') */
  const activeLiveSession = useMemo(
    () => liveSessions.find(s => s.status === 'live') ?? null,
    [liveSessions]
  );

  /** Prochaine session programmée (pas encore commencée) */
  const nextLiveSession = useMemo(
    () => liveSessions.find(s => s.status === 'scheduled' && new Date(s.scheduled_at) > now) ?? null,
    [liveSessions, now]
  );

  /** Formations actives (non terminées) */
  const activeFormations = useMemo(
    () => enrolledFormations.filter(f => f.status === 'in_progress'),
    [enrolledFormations]
  );

  /** Indicateur : l'élève est en retard si currentWeek status !== completed ET week_end < aujourd'hui */
  const isLate = useMemo(() => {
    if (!currentWeek) return false;
    const weekEnd = currentWeek.week_end ? new Date(currentWeek.week_end) : null;
    return weekEnd && weekEnd < now && currentWeek.status !== 'completed';
  }, [currentWeek, now]);

  /** Regroupement par trimestre pour la timeline */
  const byTrimester = useMemo(() => {
    return calendarWeeks.reduce((acc, w) => {
      if (w.is_holiday) return acc;
      const t = w.week_number <= 14 ? 1 : w.week_number <= 28 ? 2 : 3;
      if (!acc[t]) acc[t] = [];
      acc[t].push(w);
      return acc;
    }, {});
  }, [calendarWeeks]);

  const loading = calendarLoading || formationsLoading || liveSessionsLoading;
  const error   = calendarError;

  return {
    // Calendrier
    currentWeek,
    upcomingWeeks,
    calendarWeeks,
    byTrimester,
    calendar,
    completedCount,
    totalActive,
    progressPct,
    isLate,
    // Formations
    enrolledFormations,
    activeFormations,
    // Sessions live
    liveSessions,
    activeLiveSession,
    nextLiveSession,
    // État
    loading,
    error,
    // Actions
    refresh: () => { void loadEnrollments(); },
  };
}
