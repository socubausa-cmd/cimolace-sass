import { supabase } from '@/lib/customSupabaseClient';
import { SMARTBOARD_CANVAS_BUCKET } from '@/lib/uploadSmartboardCanvasImage';

/** Limite alignée sur le bucket (50 Mo). */
export const SMARTBOARD_CINEMA_MAX_BYTES = 50 * 1024 * 1024;

/**
 * Téléverse un clip WebM (prise cinéma pédagogique) vers le bucket SmartBoard.
 * @param {Blob} blob
 * @returns {Promise<{ publicUrl: string; path: string }>}
 */
export async function uploadSmartboardCinemaTake(blob) {
  if (!blob || !(blob instanceof Blob)) {
    throw new Error('Fichier vidéo invalide');
  }
  if (blob.size > SMARTBOARD_CINEMA_MAX_BYTES) {
    throw new Error('Vidéo trop volumineuse (max 50 Mo)');
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user?.id) {
    throw new Error('Connectez-vous pour enregistrer la vidéo');
  }
  const uid = userData.user.id;

  const path = `${uid}/cinema-${crypto.randomUUID()}.webm`;
  const contentType = blob.type && blob.type.startsWith('video/') ? blob.type : 'video/webm';

  const { error: upErr } = await supabase.storage
    .from(SMARTBOARD_CANVAS_BUCKET)
    .upload(path, blob, {
      contentType,
      upsert: false,
      cacheControl: '3600',
    });

  if (upErr) {
    throw new Error(upErr.message || 'Échec du téléversement vidéo');
  }

  const { data } = supabase.storage.from(SMARTBOARD_CANVAS_BUCKET).getPublicUrl(path);
  const publicUrl = data?.publicUrl;
  if (!publicUrl) throw new Error('URL publique indisponible');
  return { publicUrl, path };
}

/**
 * Supprime un clip sur Storage (même bucket). Silencieux si chemin invalide.
 * @param {string | undefined | null} storagePath chemin relatif bucket, ex. `{uid}/cinema-….webm`
 */
export async function deleteSmartboardCinemaTake(storagePath) {
  if (!storagePath || typeof storagePath !== 'string') return;
  const { error } = await supabase.storage.from(SMARTBOARD_CANVAS_BUCKET).remove([storagePath]);
  if (error) {
    console.warn('[uploadSmartboardCinemaTake] remove', error.message);
  }
}
