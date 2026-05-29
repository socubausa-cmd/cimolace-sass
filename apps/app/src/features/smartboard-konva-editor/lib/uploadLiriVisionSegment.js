import { supabase } from '@/lib/customSupabaseClient';

export const LIRI_VISION_TEMP_BUCKET = 'liri-vision-temp';

/**
 * Téléverse un segment vidéo (WebM/MP4) pour analyse serveur.
 * @param {Blob} blob
 * @param {{ ext?: 'webm' | 'mp4' }} [opts]
 * @returns {Promise<string>} Chemin Storage (ex. uuid/xxx.webm)
 */
export async function uploadLiriVisionSegment(blob, opts = {}) {
  if (!blob || !(blob instanceof Blob)) {
    throw new Error('Segment vidéo invalide');
  }
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user?.id) {
    throw new Error('Connectez-vous pour envoyer une vidéo');
  }
  const uid = userData.user.id;
  const ext = opts.ext === 'mp4' ? 'mp4' : 'webm';
  const path = `${uid}/${crypto.randomUUID()}.${ext}`;
  const contentType = ext === 'mp4' ? 'video/mp4' : 'video/webm';

  const { error: upErr } = await supabase.storage
    .from(LIRI_VISION_TEMP_BUCKET)
    .upload(path, blob, { contentType, upsert: false });

  if (upErr) {
    throw new Error(upErr.message || 'Échec du téléversement vidéo');
  }
  return path;
}
