/**
 * Live translate — logique serveur (Edge) alignée sur liri_complete_multilang_system/backend/live_translate.ts
 */
// deno-lint-ignore no-explicit-any
type AdminClient = any;

export function estimateLiveCredits(targetLangCount: number, minutes?: number, participants?: number): number {
  const m = Math.max(1, Math.min(480, Math.floor(minutes ?? 60)));
  const p = Math.max(1, Math.min(500, Math.floor(participants ?? 1)));
  const l = Math.max(1, targetLangCount || 1);
  return Math.min(50000, m * p * l);
}

export async function startLiveSession(
  admin: AdminClient,
  userId: string,
  body: Record<string, unknown>,
): Promise<{ status: string; session: Record<string, unknown> }> {
  const room_label = typeof body.room_label === 'string' ? body.room_label.trim() : '';
  const source_lang =
    typeof body.source_lang === 'string' && body.source_lang.length > 0 && body.source_lang.length < 16
      ? body.source_lang.toLowerCase()
      : 'fr';
  const target_langs = Array.isArray(body.target_langs)
    ? (body.target_langs as unknown[])
        .map((x) => String(x).toLowerCase().trim().slice(0, 12))
        .filter(Boolean)
        .slice(0, 12)
    : [];
  const estimated_minutes = typeof body.estimated_minutes === 'number' && Number.isFinite(body.estimated_minutes)
    ? body.estimated_minutes
    : 60;
  const participant_hint = typeof body.participant_hint === 'number' && Number.isFinite(body.participant_hint)
    ? body.participant_hint
    : 1;
  const credits = estimateLiveCredits(
    target_langs.length > 0 ? target_langs.length : 1,
    estimated_minutes,
    participant_hint,
  );
  const meta = typeof body.metadata === 'object' && body.metadata !== null ? body.metadata as Record<string, unknown> : {};

  const { data, error } = await admin.from('liri_multilang_live_sessions').insert({
    user_id: userId,
    room_label: room_label || null,
    source_lang,
    target_langs,
    status: 'active',
    credits_estimate: credits,
    metadata: meta,
  }).select('id, created_at, status, credits_estimate, room_label, source_lang, target_langs').single();

  if (error) throw error;
  return { status: 'started', session: data as Record<string, unknown> };
}
