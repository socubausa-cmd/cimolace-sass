/**
 * Sync programme annuel → arbre Pédagogie du futur (module_weeks + starts_on).
 * Un module LIRI « récepteur » reçoit une ligne module_week par semaine active du calendrier.
 */
import { listModuleWeeks, updateSchoolPath } from '@/lib/schoolPathsApi';

function weekTitleFromAnnual(w) {
  const t = w.theme || w.module_title;
  if (t && String(t).trim()) return String(t).trim().slice(0, 500);
  return `Semaine ${w.week_number}`;
}

function grammarKeyFromAnnual(w) {
  const segs = w.liri_segments;
  if (Array.isArray(segs) && segs.length > 0 && segs[0] != null && String(segs[0]).trim()) {
    return String(segs[0]).trim().slice(0, 200);
  }
  return null;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ calendarId: string; pathId: string; moduleId: string }} params
 * @returns {Promise<{ created: number; updated: number; error?: string }>}
 */
export async function syncAnnualProgramToPathModule(supabase, { calendarId, pathId, moduleId }) {
  if (!calendarId || !pathId || !moduleId) {
    return { created: 0, updated: 0, error: 'calendarId, pathId et moduleId requis' };
  }

  const { data: moduleRow, error: modErr } = await supabase
    .from('course_modules')
    .select('id, course_id')
    .eq('id', moduleId)
    .maybeSingle();
  if (modErr) return { created: 0, updated: 0, error: modErr.message };
  if (!moduleRow) return { created: 0, updated: 0, error: 'Module introuvable' };

  const { data: courseRow, error: courseErr } = await supabase
    .from('path_courses')
    .select('id, path_id')
    .eq('id', moduleRow.course_id)
    .maybeSingle();
  if (courseErr) return { created: 0, updated: 0, error: courseErr.message };
  if (!courseRow || courseRow.path_id !== pathId) {
    return { created: 0, updated: 0, error: 'Le module ne fait pas partie de ce parcours' };
  }

  const { data: annualWeeks, error: wErr } = await supabase
    .from('annual_program_weeks')
    .select('id, week_number, week_start, theme, module_title, liri_segments, is_holiday')
    .eq('calendar_id', calendarId)
    .order('week_number', { ascending: true });
  if (wErr) return { created: 0, updated: 0, error: wErr.message };

  const { error: linkErr } = await supabase
    .from('school_year_calendars')
    .update({ school_path_id: pathId, updated_at: new Date().toISOString() })
    .eq('id', calendarId);
  if (linkErr) return { created: 0, updated: 0, error: linkErr.message };

  const { data: modWeeks, error: mwErr } = await listModuleWeeks(supabase, moduleId);
  if (mwErr) return { created: 0, updated: 0, error: mwErr.message };

  const byAnnualId = new Map(
    (modWeeks || []).filter((mw) => mw.annual_program_week_id).map((mw) => [mw.annual_program_week_id, mw])
  );
  const bySort = new Map((modWeeks || []).map((mw) => [mw.sort_order, mw]));

  let created = 0;
  let updated = 0;

  for (const aw of annualWeeks || []) {
    if (aw.is_holiday) continue;

    const title = weekTitleFromAnnual(aw);
    const grammarKey = grammarKeyFromAnnual(aw);
    const sortOrder = aw.week_number ?? 0;

    const row = byAnnualId.get(aw.id) || bySort.get(sortOrder);
    if (row) {
      const { error: uErr } = await supabase
        .from('module_weeks')
        .update({
          title,
          grammar_key: grammarKey,
          sort_order: sortOrder,
          annual_program_week_id: aw.id,
        })
        .eq('id', row.id);
      if (uErr) return { created, updated, error: uErr.message };
      updated += 1;
      byAnnualId.set(aw.id, { ...row, title, grammar_key: grammarKey, sort_order: sortOrder, annual_program_week_id: aw.id });
    } else {
      const { data: ins, error: iErr } = await supabase
        .from('module_weeks')
        .insert({
          module_id: moduleId,
          title,
          grammar_key: grammarKey,
          sort_order: sortOrder,
          annual_program_week_id: aw.id,
        })
        .select('id, sort_order, annual_program_week_id')
        .single();
      if (iErr) return { created, updated, error: iErr.message };
      created += 1;
      if (ins?.id) {
        byAnnualId.set(aw.id, ins);
        bySort.set(sortOrder, ins);
      }
    }
  }

  const first = (annualWeeks || []).find((w) => !w.is_holiday && w.week_start);
  if (first?.week_start) {
    const startsOn = String(first.week_start).slice(0, 10);
    const { error: soErr } = await updateSchoolPath(supabase, { id: pathId, startsOn });
    if (soErr) return { created, updated, error: soErr.message };
  }

  return { created, updated };
}
