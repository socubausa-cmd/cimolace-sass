/**
 * Routage Coach (Groq / mini) vs Architect (Claude → DeepSeek → Grok) sans appel LLM supplémentaire.
 * Respecte le mode client par défaut, avec upgrade / downgrade heuristiques.
 */

export type LongiaClientMode = 'coach' | 'architect';

export type LongiaRouteResult = {
  effectiveMode: LongiaClientMode;
  /** Code stable pour logs / UI debug */
  reason: string;
};

function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** Texte utilisateur récent concaténé (dernier message user surtout). */
export function getLongiaLastUserText(messages: Array<{ role: string; content: string }>): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user' && typeof messages[i].content === 'string') {
      return messages[i].content;
    }
  }
  return '';
}

/** Détecte une intention « lourde » : JSON, plans longs, doc structuré, etc. */
function hasArchitectSignals(text: string): boolean {
  const raw = text.trim();
  if (raw.length >= 620) return true;

  const q = stripDiacritics(raw.toLowerCase());

  const patterns: RegExp[] = [
    /```\s*json\b/i,
    /\bjson\b.*\b(scen|scene|slide|objet|plan|structure)\b/i,
    /\b(generer|génère|genere)\b.*\bjson\b/i,
    /\bexport\b.*\bjson\b/i,
    /\bmind[\s-]?map\b/i,
    /\bcahier des charges\b/i,
    /\bworkflow\b.*\b(complet|detail|détail)\b/i,
    /\bplan\b.*\b(detail|détail|complet|exhaustif)\b/i,
    /\bstructure\b.*\b(complet|document|pages?)\b/i,
    /\bschema\b.*\b(document|donnees|données)\b/i,
    /\bmodele\b.*\b(complet|administratif|legal|légal)\b/i,
    /\bcontrat\b.*\b(structure|clauses|modele|modèle)\b/i,
    /\bsyllabus\b|\bcurriculum\b.*\b(semestre|annee|année)\b/i,
    /\bliste\s+d['']?objets\b/i,
    /\bscen(e|a)\s+konva\b/i,
    /\bparse\b.*\bpdf\b/i,
    /\breconstrui(re|s)\b.*\b(import|pdf|image)\b/i,
    /\barchitecte\b.*\b(document|json|plan)\b/i,
    /\banalyse\b.*\b(profonde|complete|complète|longue)\b/i,
  ];

  return patterns.some((re) => re.test(q));
}

/** Message trivial : social court sans demande de structure. */
export function isLongiaTrivialSocialOrAck(text: string): boolean {
  const t = text.trim();
  if (t.length > 72) return false;
  const q = stripDiacritics(t.toLowerCase()).replace(/[👋✨🙏👍]+/g, ' ').replace(/\s+/g, ' ').trim();

  const social = /^(bonjour|salut|coucou|hey|hello|hi|merci|merci beaucoup|ok|d'accord|dac|super|parfait|oui|non|a plus|à plus|bye|a bientot|à bientôt)[\s!.?]*$/i;
  return social.test(q);
}

/**
 * @param clientMode — mode demandé par le client (hub quick mode).
 * @param messages — fil de conversation (rôles user/assistant).
 */
export function routeLongiaLlmMode(
  clientMode: LongiaClientMode,
  messages: Array<{ role: string; content: string }>,
): LongiaRouteResult {
  const lastUser = getLongiaLastUserText(messages);
  const heavy = hasArchitectSignals(lastUser);

  if (clientMode === 'architect') {
    if (isLongiaTrivialSocialOrAck(lastUser) && !heavy) {
      return { effectiveMode: 'coach', reason: 'architect_hub_social_downgrade' };
    }
    return { effectiveMode: 'architect', reason: 'client_architect' };
  }

  if (heavy) {
    return { effectiveMode: 'architect', reason: 'intent_heavy_upgrade' };
  }

  return { effectiveMode: 'coach', reason: 'client_coach' };
}
