import { supabase } from '@/lib/customSupabaseClient';

/**
 * Persiste les captures PNG des scènes Konva pour l’export vidéo FFmpeg (split-screen).
 *
 * @param {string} contentId — `formation_day_contents.id`
 * @param {Array<{ slideIndex: number, url: string, label?: string }>} frames
 */
export async function saveRenderSlideFramesToFormationContent(contentId, frames) {
  const id = String(contentId || '').trim();
  if (!id) throw new Error('contentId manquant');

  const { data: row, error: e1 } = await supabase.from('formation_day_contents').select('data').eq('id', id).maybeSingle();
  if (e1) throw e1;

  const prev = row?.data && typeof row.data === 'object' ? row.data : {};
  const next = {
    ...prev,
    renderSlideFrames: Array.isArray(frames) ? frames : [],
    renderSlideFramesCapturedAt: new Date().toISOString(),
  };

  const { error: e2 } = await supabase.from('formation_day_contents').update({ data: next }).eq('id', id);
  if (e2) throw e2;
}
