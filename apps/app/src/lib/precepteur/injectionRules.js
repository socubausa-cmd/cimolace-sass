/**
 * injectionRules.js — L'ATELIER D'ANALYSE du Précepteur (brique A, déterministe).
 *
 * PURE ESM, aucun import (comme fromMasterclass.js) → tourne sous `node` nu pour la preuve.
 *
 * BUT : rendre REPRODUCTIBLE le « quand injecter quoi ». À partir d'un SEGMENT de cours
 * (un « bloc de sens » issu de masterclassStructuredDocument.js, ou un chapitre), on :
 *   1. CLASSE le segment par SIGNAUX détectables dans le texte (pas au feeling du LLM) ;
 *   2. en déduit une RECETTE d'injection ORDONNÉE de « dispositifs » pédagogiques.
 *
 * Dispositifs (device) — vocabulaire fermé :
 *   lecon · surlignage · encadre · resume_encadre · amorce_croquis · croquis ·
 *   atelier · image_analogie · transition
 * (surlignage / encadre / resume_encadre = NOUVEAUX ; nécessitent un rendu front — cf. doc.)
 *
 * S'inspire de la richesse « Masterclass Factory » : le segment porte des signaux
 * (abstraction, key_points, dépendances) qu'on exploite plutôt que de deviner.
 */

// ── Détecteurs de signaux (heuristiques FR, insensibles à la casse) ───────────
const RE = {
  definition: /\b(est|sont)\s+(défini|appelé|nommé|dit)s?\b|\bon appelle\b|\bc'est-à-dire\b|\bse (définit|nomme|caractérise)\b|\b(désigne|correspond à|signifie)\b|«[^»]{2,40}»/i,
  enumeration: /(^|\n)\s*[-•*]\s+.+(\n\s*[-•*]\s+.+){1,}|\b(premièrement|deuxièmement|troisièmement|d'abord|ensuite|puis|enfin)\b.*\b(ensuite|puis|enfin|deuxièmement)\b|\b(plusieurs|trois|quatre|cinq|différents?|types|catégories|éléments|étapes)\b/i,
  process: /\b(d'abord|ensuite|puis|enfin|alors|donc|ainsi|par conséquent|ce qui (provoque|entraîne|cause|produit)|étapes?|mécanisme|processus)\b/i,
  relation: /\b(oppose|opposé|contraire|inverse|proportionnel|inversement|relation|dépend de|varie|équilibre|déséquilibre|force|tension|attraction|répulsion)\b/i,
  phenomenon: /\b(par exemple|comme (dans|lorsque)|dans la (nature|vie|réalité)|on (observe|remarque|voit)|se produit|au quotidien|concrètement|imagine|pense à)\b/i,
  formula: /[=×÷≈≤≥±]|(\d+\s*[+\-*/]\s*\d+)|\b(formule|équation|calcul|somme|produit|ratio|proportion|pourcentage|racine|carré|puissance)\b/i,
  takeaway: /\b(en résumé|pour résumer|retenez?|l'essentiel|à retenir|en somme|en conclusion|ce qu'il faut retenir|donc au final)\b/i,
};

/** Extrait le « mot-clé » à surligner : 1er terme entre «…», sinon le 1er mot Capitalisé long. */
function extractKeyTerm(text) {
  const q = String(text).match(/«\s*([^»]{2,40})\s*»/);
  if (q) return q[1].trim();
  const cap = String(text).match(/\b([A-ZÀ-Ý][a-zà-ÿ]{4,})\b/);
  return cap ? cap[1] : null;
}

const has = (re, t) => re.test(String(t || ''));

/**
 * CLASSE un segment. Renvoie les tags détectés + quelques signaux exploitables.
 * @param {string} text  le contenu du segment (central_idea / content / lesson)
 * @param {object} [meta] { abstraction?: 'high'|'low'|number, key_points?: string[] }
 */
export function classifySegment(text, meta = {}) {
  const t = String(text || '');
  const tags = [];
  if (has(RE.definition, t)) tags.push('definition');
  if (has(RE.formula, t)) tags.push('formula');
  if (has(RE.enumeration, t) || (Array.isArray(meta.key_points) && meta.key_points.length >= 2)) tags.push('enumeration');
  if (has(RE.process, t)) tags.push('process');
  if (has(RE.relation, t)) tags.push('relation');
  if (has(RE.phenomenon, t)) tags.push('phenomenon');
  if (has(RE.takeaway, t)) tags.push('takeaway');

  // Abstraction : explicite (meta) OU inférée (relation/formula/process sans phénomène concret).
  const absMeta = meta.abstraction;
  const absExplicit = absMeta === 'high' || absMeta === true || (typeof absMeta === 'number' && absMeta >= 0.6);
  const absInferred = (tags.includes('relation') || tags.includes('formula') || tags.includes('process'))
    && !tags.includes('phenomenon');
  const isAbstract = absExplicit || absInferred;

  return {
    tags,
    isAbstract,
    keyTerm: tags.includes('definition') ? extractKeyTerm(t) : null,
    hasFormula: tags.includes('formula'),
    keyPoints: Array.isArray(meta.key_points) ? meta.key_points.filter(Boolean) : [],
  };
}

/**
 * PLAN d'injection ORDONNÉ pour un segment. Règles déterministes (mêmes entrées → même plan).
 * @param {string} text
 * @param {object} [opts] { abstraction, key_points, isLastOfChapter, position }
 * @returns {Array<{device, reason, payloadHint?}>}
 */
export function planInjections(text, opts = {}) {
  const c = classifySegment(text, opts);
  const plan = [];
  const push = (device, reason, payloadHint) => plan.push({ device, reason, ...(payloadHint ? { payloadHint } : {}) });

  // 1) Toujours : la LEÇON (l'explication écrite/narrée).
  push('lecon', 'socle : toute idée est d\'abord expliquée');

  // 2) DÉFINITION → surligner le mot-clé + l'encadrer (Sherpas : le mot-clé porte le sens).
  if (c.tags.includes('definition')) {
    if (c.keyTerm) push('surlignage', `définition : surligner le mot-clé « ${c.keyTerm} »`, { term: c.keyTerm });
    push('encadre', 'définition : encadrer l\'énoncé pour le figer', { kind: 'definition' });
  }

  // 3) FORMULE → l'encadrer + croquis couleur-codé (style Sherpas : chiffres reliés par la couleur).
  if (c.tags.includes('formula')) {
    push('encadre', 'formule : l\'encadrer comme point d\'ancrage', { kind: 'formule' });
    push('amorce_croquis', 'transition « posons le calcul »');
    push('croquis', 'formule : croquis couleur-codé, résultat en VERT, tracé pas-à-pas (order)', { style: 'sherpas_color_coded' });
  }

  // 4) PROCESSUS / RELATION / ABSTRAIT → amorce + croquis idéogramme + atelier socratique.
  //    (on évite le doublon de croquis si la formule en a déjà déclenché un)
  const needsIdeogram = (c.tags.includes('process') || c.tags.includes('relation') || c.isAbstract) && !c.tags.includes('formula');
  if (needsIdeogram) {
    push('amorce_croquis', 'transition « faisons un croquis »');
    push('croquis', 'abstrait/relation : idéogramme (flèches/points), 1 idée = 1 croquis', { style: 'ideogramme' });
  }
  if (c.isAbstract) {
    push('atelier', 'concept abstrait : atelier nominatif socratique + révélation');
  }

  // 5) PHÉNOMÈNE / CONCRET → image générée + animée (faire ASSEOIR l'idée).
  if (c.tags.includes('phenomenon') || !c.isAbstract) {
    push('image_analogie', 'ancrer par une image concrète du quotidien (générée + animée)');
  }

  // 6) ÉNUMÉRATION / À-RETENIR → résumé encadré (liste des points clés).
  if (c.tags.includes('enumeration') || c.tags.includes('takeaway') || c.keyPoints.length >= 2) {
    push('resume_encadre', 'points multiples : les rassembler dans un résumé encadré', {
      kind: 'resume', points: c.keyPoints.slice(0, 6),
    });
  }

  // 7) Fin de chapitre → transition.
  if (opts.isLastOfChapter) {
    push('transition', 'amorce vers le concept suivant');
  }

  // Garde-fou de DOSAGE : jamais 2 croquis dans un même segment (1 idée = 1 croquis).
  let sawCroquis = false;
  const capped = plan.filter((d) => {
    if (d.device === 'croquis') {
      if (sawCroquis) return false;
      sawCroquis = true;
    }
    return true;
  });

  return capped;
}

/**
 * Plan d'un CHAPITRE entier : applique planInjections à chaque segment de sens.
 * @param {Array<{central_idea?:string, content?:string, abstraction?:any, key_points?:string[]}>} segments
 */
export function planChapter(segments) {
  const list = Array.isArray(segments) ? segments : [];
  return list.map((seg, i) =>
    planInjections(seg.central_idea || seg.content || seg.summary || '', {
      abstraction: seg.abstraction,
      key_points: seg.key_points,
      isLastOfChapter: i === list.length - 1,
      position: i,
    }),
  );
}

export const DEVICES = [
  'lecon', 'surlignage', 'encadre', 'resume_encadre',
  'amorce_croquis', 'croquis', 'atelier', 'image_analogie', 'transition',
];

export default { classifySegment, planInjections, planChapter, DEVICES };
