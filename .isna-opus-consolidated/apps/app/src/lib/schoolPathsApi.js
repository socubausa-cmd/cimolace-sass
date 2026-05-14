/**
 * CRUD parcours scolaires — school_paths → path_courses → modules → weeks → days → blocks — RLS propriétaire.
 */

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export async function listSchoolPaths(supabase) {
  const { data, error } = await supabase
    .from('school_paths')
    .select(`
      id,
      title,
      description,
      starts_on,
      created_at,
      path_courses ( id )
    `)
    .order('created_at', { ascending: false });
  return { data, error };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ title: string; description?: string | null; ownerId: string; startsOn?: string | null }} params
 */
export async function createSchoolPath(supabase, { title, description, ownerId, startsOn }) {
  const { data, error } = await supabase
    .from('school_paths')
    .insert({
      title: title.trim(),
      description: description?.trim() || null,
      owner_id: ownerId,
      starts_on: startsOn && String(startsOn).trim() ? String(startsOn).trim().slice(0, 10) : null,
    })
    .select('id, title, description, starts_on, created_at, path_courses ( id )')
    .single();
  return { data, error };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ id: string; title?: string; description?: string | null; startsOn?: string | null }} params
 */
export async function updateSchoolPath(supabase, { id, title, description, startsOn }) {
  const patch = {};
  if (title != null) patch.title = String(title).trim();
  if (description !== undefined) patch.description = description === null || description === '' ? null : String(description).trim();
  if (startsOn !== undefined) patch.starts_on = startsOn === null || startsOn === '' ? null : String(startsOn).trim().slice(0, 10);
  const { data, error } = await supabase
    .from('school_paths')
    .update(patch)
    .eq('id', id)
    .select('id, title, description, starts_on, created_at, path_courses ( id )')
    .single();
  return { data, error };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} id
 */
export async function deleteSchoolPath(supabase, id) {
  const { error } = await supabase.from('school_paths').delete().eq('id', id);
  return { error };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} pathId
 */
export async function listPathCourses(supabase, pathId) {
  const { data, error } = await supabase
    .from('path_courses')
    .select('id, path_id, title, description, level, created_at')
    .eq('path_id', pathId)
    .order('created_at', { ascending: true });
  return { data, error };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ pathId: string; title: string; description?: string | null; level?: string | null }} params
 */
export async function createPathCourse(supabase, { pathId, title, description, level }) {
  const { data, error } = await supabase
    .from('path_courses')
    .insert({
      path_id: pathId,
      title: title.trim(),
      description: description?.trim() || null,
      level: level?.trim() || null,
    })
    .select('id, path_id, title, description, level, created_at')
    .single();
  return { data, error };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ id: string; title?: string; description?: string | null; level?: string | null }} params
 */
export async function updatePathCourse(supabase, { id, title, description, level }) {
  const patch = {};
  if (title != null) patch.title = String(title).trim();
  if (description !== undefined) patch.description = description === null || description === '' ? null : String(description).trim();
  if (level !== undefined) patch.level = level === null || level === '' ? null : String(level).trim();
  const { data, error } = await supabase
    .from('path_courses')
    .update(patch)
    .eq('id', id)
    .select('id, path_id, title, description, level, created_at')
    .single();
  return { data, error };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} id
 */
export async function deletePathCourse(supabase, id) {
  const { error } = await supabase.from('path_courses').delete().eq('id', id);
  return { error };
}

/* ─── course_modules ─────────────────────────────────────────────────── */

export async function listCourseModules(supabase, courseId) {
  const { data, error } = await supabase
    .from('course_modules')
    .select('id, course_id, title, sort_order')
    .eq('course_id', courseId)
    .order('sort_order', { ascending: true });
  return { data, error };
}

export async function createCourseModule(supabase, { courseId, title, sortOrder }) {
  const { data, error } = await supabase
    .from('course_modules')
    .insert({ course_id: courseId, title: title.trim(), sort_order: sortOrder ?? 0 })
    .select('id, course_id, title, sort_order')
    .single();
  return { data, error };
}

export async function updateCourseModule(supabase, { id, title, sortOrder }) {
  const patch = {};
  if (title != null) patch.title = String(title).trim();
  if (sortOrder !== undefined) patch.sort_order = Number(sortOrder) || 0;
  const { data, error } = await supabase
    .from('course_modules')
    .update(patch)
    .eq('id', id)
    .select('id, course_id, title, sort_order')
    .single();
  return { data, error };
}

export async function deleteCourseModule(supabase, id) {
  const { error } = await supabase.from('course_modules').delete().eq('id', id);
  return { error };
}

/* ─── module_weeks ───────────────────────────────────────────────────── */

export async function listModuleWeeks(supabase, moduleId) {
  const { data, error } = await supabase
    .from('module_weeks')
    .select('id, module_id, title, grammar_key, sort_order, annual_program_week_id')
    .eq('module_id', moduleId)
    .order('sort_order', { ascending: true });
  return { data, error };
}

export async function createModuleWeek(supabase, { moduleId, title, grammarKey, sortOrder }) {
  const { data, error } = await supabase
    .from('module_weeks')
    .insert({
      module_id: moduleId,
      title: title.trim(),
      grammar_key: grammarKey?.trim() || null,
      sort_order: sortOrder ?? 0,
    })
    .select('id, module_id, title, grammar_key, sort_order')
    .single();
  return { data, error };
}

export async function updateModuleWeek(supabase, { id, title, grammarKey, sortOrder }) {
  const patch = {};
  if (title != null) patch.title = String(title).trim();
  if (grammarKey !== undefined) patch.grammar_key = grammarKey === null || grammarKey === '' ? null : String(grammarKey).trim();
  if (sortOrder !== undefined) patch.sort_order = Number(sortOrder) || 0;
  const { data, error } = await supabase
    .from('module_weeks')
    .update(patch)
    .eq('id', id)
    .select('id, module_id, title, grammar_key, sort_order')
    .single();
  return { data, error };
}

export async function deleteModuleWeek(supabase, id) {
  const { error } = await supabase.from('module_weeks').delete().eq('id', id);
  return { error };
}

/* ─── week_days ───────────────────────────────────────────────────────── */

export async function listWeekDays(supabase, weekId) {
  const { data, error } = await supabase
    .from('week_days')
    .select('id, week_id, day_number, title, pedagogy_type, sort_order')
    .eq('week_id', weekId)
    .order('sort_order', { ascending: true });
  return { data, error };
}

export async function createWeekDay(supabase, { weekId, dayNumber, title, pedagogyType, sortOrder }) {
  const { data, error } = await supabase
    .from('week_days')
    .insert({
      week_id: weekId,
      day_number: Number(dayNumber) || 1,
      title: title.trim(),
      pedagogy_type: String(pedagogyType || 'generic').trim(),
      sort_order: sortOrder ?? 0,
    })
    .select('id, week_id, day_number, title, pedagogy_type, sort_order')
    .single();
  return { data, error };
}

export async function updateWeekDay(supabase, { id, dayNumber, title, pedagogyType, sortOrder }) {
  const patch = {};
  if (dayNumber !== undefined) patch.day_number = Number(dayNumber) || 1;
  if (title != null) patch.title = String(title).trim();
  if (pedagogyType != null) patch.pedagogy_type = String(pedagogyType).trim();
  if (sortOrder !== undefined) patch.sort_order = Number(sortOrder) || 0;
  const { data, error } = await supabase
    .from('week_days')
    .update(patch)
    .eq('id', id)
    .select('id, week_id, day_number, title, pedagogy_type, sort_order')
    .single();
  return { data, error };
}

export async function deleteWeekDay(supabase, id) {
  const { error } = await supabase.from('week_days').delete().eq('id', id);
  return { error };
}

/* ─── pedagogical_blocks ─────────────────────────────────────────────── */

export async function listPedagogicalBlocks(supabase, dayId) {
  const { data, error } = await supabase
    .from('pedagogical_blocks')
    .select('id, day_id, type, title, data, sort_order')
    .eq('day_id', dayId)
    .order('sort_order', { ascending: true });
  return { data, error };
}

export async function createPedagogicalBlock(supabase, { dayId, type, title, data, sortOrder }) {
  const { data: row, error } = await supabase
    .from('pedagogical_blocks')
    .insert({
      day_id: dayId,
      type: String(type || 'summary_block').trim(),
      title: title?.trim() || null,
      data: data && typeof data === 'object' ? data : {},
      sort_order: sortOrder ?? 0,
    })
    .select('id, day_id, type, title, data, sort_order')
    .single();
  return { data: row, error };
}

export async function updatePedagogicalBlock(supabase, { id, type, title, data, sortOrder }) {
  const patch = {};
  if (type != null) patch.type = String(type).trim();
  if (title !== undefined) patch.title = title === null || title === '' ? null : String(title).trim();
  if (data !== undefined) patch.data = data && typeof data === 'object' ? data : {};
  if (sortOrder !== undefined) patch.sort_order = Number(sortOrder) || 0;
  const { data: row, error } = await supabase
    .from('pedagogical_blocks')
    .update(patch)
    .eq('id', id)
    .select('id, day_id, type, title, data, sort_order')
    .single();
  return { data: row, error };
}

export async function deletePedagogicalBlock(supabase, id) {
  const { error } = await supabase.from('pedagogical_blocks').delete().eq('id', id);
  return { error };
}

/**
 * Recalcule sort_order (0…n) après drag-and-drop.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {'course_modules'|'module_weeks'|'week_days'|'pedagogical_blocks'} table
 * @param {string[]} orderedIds
 */
export async function applySortOrderSequence(supabase, table, orderedIds) {
  const results = await Promise.all(
    orderedIds.map((id, i) => supabase.from(table).update({ sort_order: i }).eq('id', id)),
  );
  const err = results.find((r) => r.error)?.error;
  return { error: err };
}

/**
 * Arbre complet pour la vue calendrier (parcours → cours → … → jours).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} pathId
 */
export async function fetchPathTreeForCalendar(supabase, pathId) {
  const { data: path, error: e0 } = await supabase
    .from('school_paths')
    .select('id, title, starts_on')
    .eq('id', pathId)
    .maybeSingle();
  if (e0) return { path: null, courses: [], error: e0 };
  if (!path) return { path: null, courses: [], error: null };

  const { data: courses, error: e1 } = await supabase
    .from('path_courses')
    .select('id, title')
    .eq('path_id', pathId)
    .order('created_at', { ascending: true });
  if (e1) return { path, courses: [], error: e1 };

  const out = [];
  for (const c of courses || []) {
    const { data: modules } = await supabase
      .from('course_modules')
      .select('id, title, sort_order')
      .eq('course_id', c.id)
      .order('sort_order', { ascending: true });
    const modList = [];
    for (const m of modules || []) {
      const { data: weeks } = await supabase
        .from('module_weeks')
        .select('id, title, sort_order')
        .eq('module_id', m.id)
        .order('sort_order', { ascending: true });
      const weekList = [];
      for (const w of weeks || []) {
        const { data: days } = await supabase
          .from('week_days')
          .select('id, day_number, title, pedagogy_type, sort_order')
          .eq('week_id', w.id)
          .order('sort_order', { ascending: true });
        weekList.push({ ...w, week_days: days || [] });
      }
      modList.push({ ...m, module_weeks: weekList });
    }
    out.push({ ...c, course_modules: modList });
  }
  return { path, courses: out, error: null };
}

/* ─── replay_assets (1 enregistrement typique par bloc) ─────────────── */

export async function fetchReplayAssetForBlock(supabase, blockId) {
  const { data, error } = await supabase
    .from('replay_assets')
    .select('id, block_id, transcript, summary, chapters, key_points, quiz, mindmap, replay_version_student, replay_version_teacher')
    .eq('block_id', blockId)
    .limit(1)
    .maybeSingle();
  return { data, error };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} blockId
 * @param {Record<string, unknown>} patch — champs replay_assets (summary string, jsonb…)
 */
export async function saveReplayAssetForBlock(supabase, blockId, patch) {
  const { data: existing, error: selErr } = await supabase
    .from('replay_assets')
    .select('id')
    .eq('block_id', blockId)
    .limit(1)
    .maybeSingle();
  if (selErr) return { data: null, error: selErr };
  if (existing?.id) {
    const { data, error } = await supabase.from('replay_assets').update(patch).eq('id', existing.id).select().single();
    return { data, error };
  }
  const insertRow = {
    block_id: blockId,
    transcript: patch.transcript ?? {},
    summary: patch.summary ?? null,
    chapters: patch.chapters ?? [],
    key_points: patch.key_points ?? [],
    quiz: patch.quiz ?? [],
    mindmap: patch.mindmap ?? {},
    replay_version_student: patch.replay_version_student ?? {},
    replay_version_teacher: patch.replay_version_teacher ?? {},
  };
  const { data, error } = await supabase.from('replay_assets').insert(insertRow).select().single();
  return { data, error };
}
