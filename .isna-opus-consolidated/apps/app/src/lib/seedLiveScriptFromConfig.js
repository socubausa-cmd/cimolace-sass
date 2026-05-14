import { formatMasterAgentContent } from '@/lib/smartboardIAMapper';

function isSchemaMismatchError(error) {
  const msg = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '');
  return code === '42703' || msg.includes('column') || msg.includes('does not exist');
}

/**
 * Insère les sections MasterScript du wizard (`smartboard_master_script_sections`) dans `live_script_sections`
 * si la session n’a encore aucune ligne — évite d’écraser une prépa studio existante.
 *
 * @returns {Promise<{ inserted?: number, skipped?: boolean, reason?: string, error?: Error }>}
 */
export async function seedLiveScriptSectionsFromWizard({
  supabase,
  sessionId,
  userId,
  sections,
}) {
  if (!sessionId || !userId || !Array.isArray(sections) || sections.length === 0) {
    return { skipped: true, reason: 'no_data' };
  }

  const { data: existing, error: exErr } = await supabase
    .from('live_script_sections')
    .select('id')
    .eq('session_id', sessionId)
    .limit(1);

  if (exErr) {
    if (isSchemaMismatchError(exErr)) return { skipped: true, reason: 'schema' };
    console.warn('[seedLiveScript] count check:', exErr.message);
    return { error: exErr };
  }
  if (existing?.length) return { skipped: true, reason: 'already_has_sections' };

  const rows = sections.map((sec, i) => {
    const slideIndex = typeof sec.slide_index === 'number' ? sec.slide_index : i;
    const master_agent = sec.master_agent && typeof sec.master_agent === 'object' ? sec.master_agent : null;
    let content = String(sec.content || '').trim();
    if (!content && master_agent) content = formatMasterAgentContent(master_agent);
    if (!content) content = String(sec.script || '').trim() || '(vide)';
    const title = sec.title ? String(sec.title).slice(0, 500) : null;

    return {
      session_id: sessionId,
      created_by: userId,
      slide_index: slideIndex,
      title: title || null,
      content,
      master_agent,
      order_index: i,
    };
  });

  const { error } = await supabase.from('live_script_sections').insert(rows);
  if (error) {
    if (isSchemaMismatchError(error)) return { skipped: true, reason: 'schema' };
    console.warn('[seedLiveScript] insert:', error.message);
    return { error };
  }
  return { inserted: rows.length };
}
