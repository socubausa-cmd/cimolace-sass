import { supabase } from '@/lib/customSupabaseClient';

export const SMARTBOARD_CANVAS_BUCKET = 'smartboard-canvas';

const ALLOWED_EXT = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg']);

/**
 * Téléverse une image utilisateur vers le bucket SmartBoard Studio.
 * @returns {Promise<{ url: string, path: string }>} URL publique permanente + chemin Storage
 */
export async function uploadSmartboardCanvasImage(file) {
  if (!file || !(file instanceof Blob)) {
    throw new Error('Fichier invalide');
  }
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user?.id) {
    throw new Error('Connectez-vous pour importer une image');
  }
  const uid = userData.user.id;

  const rawName = typeof file.name === 'string' ? file.name : 'image';
  let ext = rawName.split('.').pop()?.toLowerCase() || 'png';
  if (!ALLOWED_EXT.has(ext)) {
    const t = (file.type || '').toLowerCase();
    if (t.includes('jpeg') || t.includes('jpg')) ext = 'jpg';
    else if (t.includes('png')) ext = 'png';
    else if (t.includes('webp')) ext = 'webp';
    else if (t.includes('gif')) ext = 'gif';
    else if (t.includes('svg')) ext = 'svg';
    else ext = 'png';
  }

  const path = `${uid}/${crypto.randomUUID()}.${ext}`;
  const contentType = file.type && file.type.startsWith('image/')
    ? file.type
    : ext === 'svg'
      ? 'image/svg+xml'
      : `image/${ext === 'jpg' ? 'jpeg' : ext}`;

  const { error: upErr } = await supabase.storage
    .from(SMARTBOARD_CANVAS_BUCKET)
    .upload(path, file, { contentType, upsert: false, cacheControl: '31536000' });

  if (upErr) {
    throw new Error(upErr.message || 'Échec du téléversement');
  }

  const { data } = supabase.storage.from(SMARTBOARD_CANVAS_BUCKET).getPublicUrl(path);
  const url = data?.publicUrl;
  if (!url) throw new Error('URL publique indisponible');
  return { url, path };
}
