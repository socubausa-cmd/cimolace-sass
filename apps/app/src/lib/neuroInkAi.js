/**
 * NeuroInk IA — client des briques IA du copilote tableau (live LIRI).
 *
 * Couche mince au-dessus des edge functions Supabase existantes : on ne crée
 * aucune IA, on câble celles déjà déployées. Le JWT de session est attaché
 * automatiquement par le client Supabase.
 *
 * Briques réutilisées :
 *  - liri-smartboard-vision-describe   : image du tableau → lecture pédagogique
 *  - liri-smartboard-architect-structured : texte libre → items structurés (diapo)
 *  - generate-visual-image             : prompt → illustration (Imagen/Mistral/DALL·E)
 *  - neuronq-reformulate               : texte brut → reformulation propre
 */
import { supabase } from '@/lib/customSupabaseClient';

async function invokeAi(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw error;
  if (data && data.error) {
    const msg = typeof data.error === 'string' ? data.error : data.error?.message || 'Erreur IA';
    throw new Error(msg);
  }
  return data || {};
}

/** Palier de coût : 'economy' (DeepSeek/Mistral, défaut) ou 'premium' (Claude/OpenAI). */
function normTier(tier) {
  return tier === 'premium' ? 'premium' : 'economy';
}

/** Tableau (image base64) → description pédagogique (3–5 phrases). */
export async function aiVisionDescribe({ imageBase64, mimeType = 'image/png', lang = 'fr', centralIdea, tier } = {}) {
  const data = await invokeAi('liri-smartboard-vision-describe', {
    imageBase64,
    mimeType,
    lang,
    tier: normTier(tier),
    ...(centralIdea ? { centralIdea: String(centralIdea).slice(0, 800) } : {}),
  });
  return { description: String(data?.description || '').trim(), provider: data?.provider || null };
}

/** Texte libre (≥ 20 car.) → items structurés { id, title, detail, kind }. */
export async function aiArchitectStructured({ assistantText, centralIdea, lang = 'fr', tier } = {}) {
  const data = await invokeAi('liri-smartboard-architect-structured', {
    assistantText,
    lang,
    tier: normTier(tier),
    ...(centralIdea ? { centralIdea: String(centralIdea).slice(0, 800) } : {}),
  });
  return {
    ok: data?.ok !== false,
    items: Array.isArray(data?.items) ? data.items : [],
    provider: data?.provider || null,
  };
}

/** Prompt → URL d'illustration générée. Éco = Mistral ; premium = auto (Imagen/DALL·E). */
export async function aiGenerateImage({ prompt, size = '1024x1024', provider, tier } = {}) {
  const resolvedProvider = provider || (normTier(tier) === 'premium' ? 'auto' : 'mistral');
  const data = await invokeAi('generate-visual-image', {
    prompt: String(prompt || '').trim(),
    size,
    provider: resolvedProvider,
  });
  return { imageUrl: data?.imageUrl || null, provider: data?.provider || null };
}

/** Texte brut → reformulation propre. */
export async function aiReformulate({ rawText, userName, sessionId, tier } = {}) {
  const data = await invokeAi('neuronq-reformulate', {
    rawText: String(rawText || '').trim(),
    tier: normTier(tier),
    ...(userName ? { userName } : {}),
    ...(sessionId ? { sessionId } : {}),
  });
  return { reformulated: String(data?.reformulated || data?.reformulatedText || '').trim() };
}

/**
 * Items Architect → propositions applicables au tableau via l'event
 * `LIRI_LIVE_ARCHITECT_APPLY` (cf. buildStrokesFromArchitectProposal).
 * @param {Array<{title,detail,kind}>} items
 * @param {{ type?: string, max?: number }} [opts] type='layout' pour cadres présentation, '' pour texte simple.
 */
export function architectItemsToProposals(items, { type, max = 6 } = {}) {
  return (Array.isArray(items) ? items : [])
    .filter((it) => it && it.title && it.detail)
    .slice(0, max)
    .map((it) => ({
      type: type !== undefined ? type : it.kind === 'visual' ? 'layout' : '',
      title: String(it.title).slice(0, 200),
      detail: String(it.detail).slice(0, 500),
    }));
}

/** Message d'erreur lisible (FR) pour les échecs courants des edge functions. */
export function humanizeNeuroInkAiError(err) {
  const raw = String(err?.message || err || '').toLowerCase();
  if (raw.includes('402') || raw.includes('insufficient') || raw.includes('credit')) {
    return 'Crédits IA insuffisants pour cette action.';
  }
  if (raw.includes('401') || raw.includes('tenant_not_resolved') || raw.includes('unauthor')) {
    return 'Session non autorisée pour l’IA (reconnecte-toi).';
  }
  if (raw.includes('413') || raw.includes('too large')) {
    return 'Tableau trop dense à analyser — épure un peu et réessaie.';
  }
  if (raw.includes('trop court') || raw.includes('too short')) {
    return 'Pas assez de contenu sur le tableau pour l’IA.';
  }
  return 'L’IA n’a pas pu répondre — réessaie dans un instant.';
}
