/**
 * Codes courts « rejoindre le live » (colonne `live_sessions.join_code`).
 */
import { supabase } from '@/lib/customSupabaseClient';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Génère un code 8 caractères (affichage XXXX-XXXX, stockage sans tiret). */
export function generateLiveJoinCodeRaw() {
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  let s = '';
  for (let i = 0; i < 8; i += 1) {
    s += ALPHABET[buf[i] % ALPHABET.length];
  }
  return s;
}

/** Affichage utilisateur à partir du stockage DB. */
export function formatJoinCodeDisplay(stored) {
  if (!stored) return '';
  const v = String(stored).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (v.length !== 8) return String(stored);
  return `${v.slice(0, 4)}-${v.slice(4)}`;
}

/** Résout un code court → UUID session (RPC Supabase). */
export async function resolveLiveJoinCodeFromPaste(raw) {
  const normalized = String(raw || '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, 16);
  if (normalized.length < 6) return null;

  const { data, error } = await supabase.rpc('live_session_id_from_join_code', {
    p_code: normalized,
  });
  if (error || !data) return null;
  const id = typeof data === 'string' ? data : String(data);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ? id
    : null;
}
