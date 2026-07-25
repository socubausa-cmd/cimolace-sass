/**
 * NOMS DE MODÈLES DEEPSEEK — source de vérité unique.
 *
 * ⚠️ DeepSeek a RETIRÉ `deepseek-chat` et `deepseek-reasoner` de son API : tout
 * appel avec ces noms répond HTTP 400 (« supported API model names are
 * deepseek-v4-pro or deepseek-v4-flash »). Vérifié en direct le 2026-07-25 :
 *
 *   deepseek-chat      → 400        deepseek-v4-pro    → 200
 *   deepseek-reasoner  → 400        deepseek-v4-flash  → 200
 *
 * Les anciens noms restent des CLÉS PUBLIQUES (elles vivent dans le front, dans
 * `liri_conversations.model` et dans les jobs déjà en base) : on ne les renomme
 * pas, on les TRADUIT ici au moment de l'appel réseau.
 *
 * ⚠️ `deepseek-v4-pro` est un modèle À RAISONNEMENT : il peut répondre 200 avec
 * un `content` VIDE quand sa réflexion absorbe tout le budget de jetons. Ne
 * l'utiliser que derrière un retry + repli (cf. transcript-course.service.ts).
 * C'est pourquoi le généraliste `deepseek-chat` est mappé vers `v4-flash`
 * (non-raisonnant, comportement équivalent) et NON vers `v4-pro`.
 */
export const DEEPSEEK_REASONING_MODEL = 'deepseek-v4-pro';
export const DEEPSEEK_FAST_MODEL = 'deepseek-v4-flash';

/**
 * Traduit une clé de modèle (publique ou déjà réelle) vers un nom accepté par
 * l'API DeepSeek. Tolérant : un nom déjà valide est renvoyé tel quel.
 */
export function resolveDeepseekApiModel(model?: string | null): string {
  const m = String(model ?? '').trim().toLowerCase();
  if (m === 'deepseek-v4-pro' || m === 'deepseek-v4-flash') return m;
  if (m === 'deepseek-reasoner' || m.includes('reason')) return DEEPSEEK_REASONING_MODEL;
  return DEEPSEEK_FAST_MODEL;
}
