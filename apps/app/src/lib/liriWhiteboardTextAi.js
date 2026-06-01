import { aiUtilsApi } from '@/lib/api-v2';

/**
 * Reformulation du tableau blanc — rebranchée sur NestJS `/ai-utils/reformulate`.
 * (L'edge `reformulate-text` n'est PAS déployée → renvoyait 404.) Le mode fix/rephrase/translate
 * est transmis via le paramètre `context` du service.
 * @param {'fix'|'rephrase'|'translate'} boardMode
 * @param {string} [targetLang] — ex. en, es (pour translate)
 */
export async function invokeWhiteboardTextAi(text, boardMode, targetLang = 'en') {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('Texte vide');
  const lang = String(targetLang || 'en').slice(0, 8);
  const context =
    boardMode === 'translate'
      ? `Traduire fidèlement le texte en ${lang}`
      : boardMode === 'fix'
        ? 'Corriger l’orthographe et la grammaire sans changer le sens'
        : 'Reformuler plus clairement, même langue';
  let data;
  try {
    data = await aiUtilsApi.reformulate({ text: raw.slice(0, 4000), context });
  } catch (e) {
    throw new Error(e?.message || 'IA indisponible');
  }
  const result = String(data?.result ?? '').trim();
  if (!result) throw new Error('Réponse IA vide');
  return result;
}
