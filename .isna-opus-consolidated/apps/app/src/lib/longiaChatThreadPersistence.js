/**
 * Persistance fils LONGIA (`longia_chat_threads`) — sans troncature du nombre de messages ni du texte.
 */

const MAX_SCOPE_ID_LEN = 2000;

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {'designer'|'live'|'live_student'} scopeType
 * @param {string} scopeId
 */
export async function fetchLongiaChatThread(supabase, scopeType, scopeId) {
  const sid = String(scopeId || '').slice(0, MAX_SCOPE_ID_LEN);
  if (!sid) return { row: null, error: null };
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData?.user?.id;
  if (!uid) return { row: null, error: null };

  const { data, error } = await supabase
    .from('longia_chat_threads')
    .select('id, messages, title, updated_at')
    .eq('user_id', uid)
    .eq('scope_type', scopeType)
    .eq('scope_id', sid)
    .maybeSingle();

  if (error) {
    console.warn('fetchLongiaChatThread', error);
    return { row: null, error };
  }
  return { row: data, error: null };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {'designer'|'live'|'live_student'} scopeType
 * @param {string} scopeId
 * @param {Array<{ id?: string; role: string; text: string }>} messages
 * @param {string} [title]
 */
export async function upsertLongiaChatThread(supabase, scopeType, scopeId, messages, title) {
  const sid = String(scopeId || '').slice(0, MAX_SCOPE_ID_LEN);
  if (!sid) return { error: new Error('scope_id requis') };

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user?.id) {
    return { error: new Error('Non connecté') };
  }

  const clean = (messages || [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant' || m.role === 'ai') && String(m.text || '').trim())
    .map((m) => ({
      id: m.id || undefined,
      role: m.role === 'ai' ? 'assistant' : m.role,
      text: String(m.text),
    }));

  const { error } = await supabase.from('longia_chat_threads').upsert(
    {
      user_id: userData.user.id,
      scope_type: scopeType,
      scope_id: sid,
      title: title ? String(title).slice(0, 2000) : null,
      messages: clean,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,scope_type,scope_id' },
  );

  if (error) console.warn('upsertLongiaChatThread', error);
  return { error: error || null };
}
