/**
 * Video multilang designer — logique serveur alignée sur liri_complete_multilang_system/backend/video_multilang.ts
 */
// deno-lint-ignore no-explicit-any
type AdminClient = any;

export function estimateVideoCredits(targetLangCount: number, durationMinutes?: number): number {
  const d = Math.max(1, Math.min(600, Math.floor(durationMinutes ?? 10)));
  const l = Math.max(1, targetLangCount || 1);
  return Math.min(100000, d * l * 8);
}

export async function createVideoProject(
  admin: AdminClient,
  userId: string,
  body: Record<string, unknown>,
): Promise<{ status: string; project: Record<string, unknown> }> {
  const titleRaw = typeof body.title === 'string' ? body.title.trim() : '';
  const title = titleRaw || 'Projet vidéo multilingue';
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
  const duration_minutes = typeof body.duration_minutes === 'number' && Number.isFinite(body.duration_minutes)
    ? body.duration_minutes
    : 10;
  const credits = estimateVideoCredits(target_langs.length > 0 ? target_langs.length : 1, duration_minutes);
  const meta = typeof body.metadata === 'object' && body.metadata !== null ? body.metadata as Record<string, unknown> : {};

  const { data, error } = await admin.from('liri_multilang_video_projects').insert({
    user_id: userId,
    title,
    source_lang,
    target_langs,
    status: 'draft',
    credits_estimate: credits,
    metadata: meta,
  }).select('id, created_at, status, credits_estimate, title, source_lang, target_langs').single();

  if (error) throw error;
  return { status: 'created', project: data as Record<string, unknown> };
}
