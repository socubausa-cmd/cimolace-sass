/**
 * enrichCourseWithDevices.js — POST-PROCESSEUR : insère les NOUVEAUX dispositifs
 * (surlignage / encadre / resume_encadre) dans un cours du Précepteur, en appliquant
 * l'atelier d'analyse déterministe (injectionRules) au TEXTE des leçons.
 *
 * Composable comme enrichCroquis : `course -> course enrichi`. PURE ESM.
 * Ne throw JAMAIS ; n'insère un dispositif que si un CONTENU réel a pu être extrait
 * (pas d'encadré vide, pas de résumé sans points).
 */
import { classifySegment } from './injectionRules.js';

const DEF_RE = /\b(est|sont)\s+(défini|appelé|nommé|dit)s?\b|\bon appelle\b|\bc'est-à-dire\b|\bse (définit|nomme|caractérise)\b|\b(désigne|correspond à|signifie)\b/i;
const FORMULA_RE = /[=×÷≈≤≥±]|(\d+\s*[+\-*/]\s*\d+)/;

/** Découpe en phrases (garde la ponctuation forte comme séparateur). */
function sentences(text) {
  return String(text || '').replace(/[ \t]+/g, ' ').split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean);
}
function firstMatch(text, re) {
  return sentences(text).find((s) => re.test(s)) || '';
}
function sentenceWithTerm(text, term) {
  if (!term) return '';
  const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  return sentences(text).find((s) => re.test(s)) || '';
}
/** Extrait ≥2 points d'une énumération (puces/numéros, ou séquence d'abord…ensuite…enfin). */
function extractPoints(text) {
  const t = String(text || '');
  const bulleted = t.split('\n').map((l) => l.trim())
    .filter((l) => /^([-•*]|\d+[).])\s+/.test(l))
    .map((l) => l.replace(/^([-•*]|\d+[).])\s+/, '').trim())
    .filter(Boolean);
  if (bulleted.length >= 2) return bulleted.slice(0, 6);
  const seq = t.split(/\b(?:d'abord|ensuite|puis|enfin|premièrement|deuxièmement|troisièmement)\b/i)
    .map((s) => s.replace(/^[\s,:;–-]+/, '').replace(/[\s.;]+$/, '').trim())
    .filter((s) => s.length > 3);
  if (seq.length >= 3) return seq.slice(1, 7);
  return [];
}

/** Enrichit les scènes d'UN concept selon l'analyse de sa 1re leçon. */
function conceptScenesEnriched(scenes) {
  const list = Array.isArray(scenes) ? scenes.slice() : [];
  const firstLeconIdx = list.findIndex((s) => s && s.type === 'lecon');
  if (firstLeconIdx < 0) return list;

  const leconText = String(list[firstLeconIdx].board_text || list[firstLeconIdx].narration || '');
  if (leconText.trim().length < 12) return list;
  const c = classifySegment(leconText);

  const afterLecon = [];
  // DÉFINITION → surlignage du mot-clé + encadré de l'énoncé.
  if (c.tags.includes('definition')) {
    const defSentence = firstMatch(leconText, DEF_RE) || sentences(leconText)[0] || '';
    if (c.keyTerm) {
      afterLecon.push({
        type: 'surlignage',
        term: c.keyTerm,
        text: sentenceWithTerm(leconText, c.keyTerm) || defSentence,
        narration: `Le mot à retenir : ${c.keyTerm}.`,
      });
    }
    if (defSentence) {
      afterLecon.push({ type: 'encadre', kind: 'definition', text: defSentence, narration: defSentence });
    }
  }
  // FORMULE → encadré de la formule (le croquis couleur-codé, lui, vient d'enrichCroquis).
  if (c.tags.includes('formula')) {
    const f = firstMatch(leconText, FORMULA_RE);
    if (f && !afterLecon.some((d) => d.kind === 'formule')) {
      afterLecon.push({ type: 'encadre', kind: 'formule', text: f, narration: f });
    }
  }

  // RÉSUMÉ ENCADRÉ → fin de concept (avant transition), si ≥2 points extraits.
  const points = (c.tags.includes('enumeration') || c.tags.includes('takeaway')) ? extractPoints(leconText) : [];
  const resume = points.length >= 2
    ? { type: 'resume_encadre', points, narration: 'Ce qu\'il faut retenir.' }
    : null;

  const out = [];
  list.forEach((s, i) => {
    out.push(s);
    if (i === firstLeconIdx && afterLecon.length) out.push(...afterLecon);
  });
  if (resume) {
    const trIdx = out.findIndex((s) => s && s.type === 'transition');
    if (trIdx >= 0) out.splice(trIdx, 0, resume);
    else out.push(resume);
  }
  return out;
}

/**
 * @param {{title?:string, concepts?:Array<{scenes?:Object[]}>}} course
 * @returns cours enrichi (mêmes concepts, scènes + dispositifs)
 */
export function enrichCourseWithDevices(course) {
  const c = course || {};
  const concepts = Array.isArray(c.concepts) ? c.concepts : [];
  return {
    ...c,
    concepts: concepts.map((cc) => ({ ...(cc || {}), scenes: conceptScenesEnriched(cc?.scenes) })),
  };
}

export default enrichCourseWithDevices;
