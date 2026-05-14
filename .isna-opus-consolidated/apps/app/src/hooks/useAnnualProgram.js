/**
 * useAnnualProgram — Hook partagé Teacher ↔ Élève
 *
 * - Charge le programme annuel depuis Supabase (school_year_calendars + annual_program_weeks)
 * - Expose une action generate() qui appelle la fonction Netlify
 * - Expose publish() pour passer draft → published
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { resolveCimolaceTenantIdForInsert } from '@/lib/tenant/fetchTenantContext';
import { holidaysForSchoolYearAndCountry } from '@/lib/schoolYearHolidays';

const API_BASE = import.meta.env.VITE_NETLIFY_API_URL ?? '';

// ── Defaults ──────────────────────────────────────────────────────────────────

const CURRENT_SCHOOL_YEAR = (() => {
  const now  = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  // Après août → nouvelle année scolaire
  return month >= 9 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
})();

/** Vacances scolaires alignées sur `schoolYear` (France par défaut). @deprecated préférer `holidaysForSchoolYearAndCountry` */
export function holidaysForSchoolYear(schoolYear) {
  return holidaysForSchoolYearAndCountry(schoolYear, 'FR');
}

const DEFAULT_HOLIDAYS = holidaysForSchoolYear(CURRENT_SCHOOL_YEAR);

/** Quatre années scolaires consécutives à partir de l’année courante (sélecteurs UI). */
export function schoolYearOptions(anchorYear = CURRENT_SCHOOL_YEAR) {
  const start = parseInt(String(anchorYear).split('-')[0], 10);
  if (Number.isNaN(start)) return ['2025-2026', '2026-2027', '2027-2028', '2028-2029'];
  return [0, 1, 2, 3].map((i) => `${start + i}-${start + i + 1}`);
}

// ── Hook principal ────────────────────────────────────────────────────────────

export function useAnnualProgram({
  schoolYear = CURRENT_SCHOOL_YEAR,
  cycle      = 'fondements',
  autoLoad   = true,
} = {}) {

  const [calendar,      setCalendar]      = useState(null);
  const [weeks,         setWeeks]         = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [generating,    setGenerating]    = useState(false);
  const [error,         setError]         = useState(null);
  const abortRef = useRef(null);

  // ── Charger depuis Supabase ───────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tenantId = await resolveCimolaceTenantIdForInsert();
      let calQuery = supabase
        .from('school_year_calendars')
        .select('*')
        .eq('school_year', schoolYear)
        .eq('cycle', cycle);
      if (tenantId) calQuery = calQuery.eq('cimolace_tenant_id', tenantId);

      const { data: cal, error: calErr } = await calQuery.maybeSingle();

      if (calErr) throw calErr;
      if (!cal) { setCalendar(null); setWeeks([]); return; }

      setCalendar(cal);

      const { data: wks, error: wErr } = await supabase
        .from('annual_program_weeks')
        .select('*')
        .eq('calendar_id', cal.id)
        .order('week_number', { ascending: true });

      if (wErr) throw wErr;
      setWeeks(wks ?? []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [schoolYear, cycle]);

  useEffect(() => {
    if (autoLoad) load();
  }, [autoLoad, load]);

  // ── Générer via IA ────────────────────────────────────────────────────────
  const generate = useCallback(async ({
    startDate         = `${schoolYear.split('-')[0]}-09-01`,
    sessionsPerWeek   = 2,
    holidays          = holidaysForSchoolYear(schoolYear),
    holiday_country   = 'FR',
    modules           = [],
    pedagogicalNotes  = '',
  } = {}) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setGenerating(true);
    setError(null);

    try {
      const [{ data: sessionData }, tenantId] = await Promise.all([
        supabase.auth.getSession(),
        resolveCimolaceTenantIdForInsert(),
      ]);
      const token = sessionData?.session?.access_token;
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/.netlify/functions/annual-program-generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          school_year:        schoolYear,
          cycle,
          start_date:         startDate,
          sessions_per_week:  sessionsPerWeek,
          holidays,
          holiday_country,
          modules,
          pedagogical_notes:  pedagogicalNotes,
          ...(tenantId ? { cimolace_tenant_id: tenantId } : {}),
        }),
        signal: ctrl.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.weeks?.length > 0) {
        // Reload from DB to get persisted IDs
        await load();
      }
      return data;
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message);
      return null;
    } finally {
      setGenerating(false);
    }
  }, [schoolYear, cycle, load]);

  // ── Publier le calendrier ─────────────────────────────────────────────────
  const publish = useCallback(async () => {
    if (!calendar?.id) return;
    const { error: e } = await supabase
      .from('school_year_calendars')
      .update({ status: 'published', published_at: new Date().toISOString() })
      .eq('id', calendar.id);
    if (e) { setError(e.message); return; }
    setCalendar(c => ({ ...c, status: 'published' }));
  }, [calendar?.id]);

  // ── Mettre à jour une semaine ─────────────────────────────────────────────
  const updateWeek = useCallback(async (weekId, patch) => {
    const { error: e } = await supabase
      .from('annual_program_weeks')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', weekId);
    if (e) { setError(e.message); return; }
    setWeeks(ws => ws.map(w => w.id === weekId ? { ...w, ...patch } : w));
  }, []);

  // ── Données dérivées ──────────────────────────────────────────────────────
  const today          = new Date();
  const todayStr       = today.toISOString().slice(0, 10);

  const currentWeek    = weeks.find(w => w.week_start <= todayStr && w.week_end >= todayStr);
  const upcomingWeeks  = weeks.filter(w => w.week_start > todayStr && !w.is_holiday).slice(0, 4);
  const completedCount = weeks.filter(w => w.status === 'completed').length;
  const totalActive    = weeks.filter(w => !w.is_holiday).length;
  const progressPct    = totalActive > 0 ? Math.round((completedCount / totalActive) * 100) : 0;

  // Trimestres (regroupement par module_number)
  const byTrimester = weeks.reduce((acc, w) => {
    if (w.is_holiday) return acc;
    const t = w.week_number <= 14 ? 1 : w.week_number <= 28 ? 2 : 3;
    if (!acc[t]) acc[t] = [];
    acc[t].push(w);
    return acc;
  }, {});

  return {
    // État
    calendar,
    weeks,
    loading,
    generating,
    error,
    // Actions
    load,
    generate,
    publish,
    updateWeek,
    // Dérivés
    currentWeek,
    upcomingWeeks,
    completedCount,
    totalActive,
    progressPct,
    byTrimester,
    schoolYear,
    cycle,
    hasProgram: !!calendar,
    isPublished: calendar?.status === 'published',
  };
}

export { CURRENT_SCHOOL_YEAR, DEFAULT_HOLIDAYS };
