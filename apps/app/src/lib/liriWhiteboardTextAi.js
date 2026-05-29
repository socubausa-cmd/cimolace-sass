import { supabase } from '@/lib/supabase';

/**
 * @param {'fix'|'rephrase'|'translate'} boardMode
 * @param {string} [targetLang] — ex. en, es (pour translate)
 */
export async function invokeWhiteboardTextAi(text, boardMode, targetLang = 'en') {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('Texte vide');
  const { data, error } = await supabase.functions.invoke('reformulate-text', {
    body: {
      text: raw.slice(0, 4000),
      boardMode,
      targetLang: String(targetLang || 'en').slice(0, 8),
    },
  });
  if (error) throw new Error(error.message || 'IA indisponible');
  if (data?.error) throw new Error(typeof data.error === 'string' ? data.error : 'IA indisponible');
  const result = String(data?.result ?? '').trim();
  if (!result) throw new Error('Réponse IA vide');
  return result;
}
