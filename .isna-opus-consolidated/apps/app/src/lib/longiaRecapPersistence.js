/**
 * File d’attente recap LONGIA dans `live_sessions.config.longia_recap_queue`.
 */

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {string} sessionId
 * @param {{ id?: string, message?: string }} decision
 */
export async function persistLongiaRecapDecision(sb, sessionId, decision) {
  if (!sb || !sessionId || !decision?.message) return;
  try {
    const { data: row, error } = await sb.from('live_sessions').select('config').eq('id', sessionId).maybeSingle();
    if (error || !row) return;
    let c = {};
    try {
      const raw = row.config;
      c = typeof raw === 'string' ? JSON.parse(raw) : (raw && typeof raw === 'object' ? { ...raw } : {});
    } catch {
      c = {};
    }
    const q = Array.isArray(c.longia_recap_queue) ? [...c.longia_recap_queue] : [];
    q.push({
      at: new Date().toISOString(),
      message: String(decision.message).slice(0, 2000),
      decision_id: decision.id || null,
    });
    await sb
      .from('live_sessions')
      .update({
        config: { ...c, longia_recap_queue: q.slice(-80) },
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);
  } catch {
    /* ignore */
  }
}
