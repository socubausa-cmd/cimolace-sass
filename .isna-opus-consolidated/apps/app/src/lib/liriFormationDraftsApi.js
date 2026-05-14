/**
 * Brouillons Formation Builder — table liri_formation_drafts.
 */

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} ownerId
 */
export async function listFormationDrafts(supabase, ownerId) {
  const { data, error } = await supabase
    .from('liri_formation_drafts')
    .select('id, title, updated_at, created_at')
    .eq('owner_id', ownerId)
    .order('updated_at', { ascending: false });
  return { data, error };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} id
 */
export async function getFormationDraft(supabase, id) {
  const { data, error } = await supabase
    .from('liri_formation_drafts')
    .select('id, title, payload, updated_at')
    .eq('id', id)
    .maybeSingle();
  return { data, error };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ ownerId: string; title: string; payload: object }} params
 */
export async function insertFormationDraft(supabase, { ownerId, title, payload }) {
  const { data, error } = await supabase
    .from('liri_formation_drafts')
    .insert({
      owner_id: ownerId,
      title: title.trim(),
      payload,
      updated_at: new Date().toISOString(),
    })
    .select('id, title, updated_at')
    .single();
  return { data, error };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ id: string; title?: string; payload?: object }} params
 */
export async function updateFormationDraft(supabase, { id, title, payload }) {
  const patch = { updated_at: new Date().toISOString() };
  if (title != null) patch.title = String(title).trim();
  if (payload !== undefined) patch.payload = payload;
  const { data, error } = await supabase
    .from('liri_formation_drafts')
    .update(patch)
    .eq('id', id)
    .select('id, title, updated_at')
    .single();
  return { data, error };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} id
 */
export async function deleteFormationDraft(supabase, id) {
  const { error } = await supabase.from('liri_formation_drafts').delete().eq('id', id);
  return { error };
}
