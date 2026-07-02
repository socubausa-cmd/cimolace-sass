/**
 * judgeAtelier.js — Résolution du VERDICT d'un atelier « Le Précepteur ».
 *
 * PURE ESM. Aucun import (ni alias `@/…`, ni dépendance bundler) : ce module doit
 * tourner tel quel sous Node nu (`node fichier.mjs`) pour la preuve automatisée,
 * ET être importable depuis le front (AtelierPrompt.jsx / PrecepteurPlayer).
 *
 * ── Deux mondes qui se rejoignent ici ──────────────────────────────────────
 *   • DÉMO / hors-ligne : `classifyLocal()` — heuristique mots-clés (déplacée depuis
 *     AtelierPrompt.jsx). Aucune IA, aucun réseau. Sert de repli SÛR.
 *   • PRODUCTION : l'edge `liri-preceptor-atelier-judge` (LLM) renvoie
 *     `{ verdict, ack }`. `resolveAtelierVerdict()` FAIT CONFIANCE à ce verdict
 *     s'il est valide, sinon retombe proprement sur `classifyLocal()`.
 *
 * ── INVARIANT ──────────────────────────────────────────────────────────────
 * Aucune fonction ne JETTE jamais. Entrées manquantes/malformées → verdict par
 * défaut cohérent + `ack` non vide. Le player peut donc appeler sans try/catch.
 *
 * @typedef {'ok'|'partial'|'wrong'} Verdict
 * @typedef {{ verdict: Verdict, ack: string }} AtelierVerdict
 */

/** Enum des verdicts valides. */
const VERDICTS = ['ok', 'partial', 'wrong'];

/** ack de dernier recours, chaleureux et neutre (jamais vide). */
const FALLBACK_ACK = 'Voyons ensemble.';

/** Normalisation texte : minuscules + suppression des accents (NFD). */
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Tableau sûr : renvoie [] si l'entrée n'est pas un tableau. */
const arr = (v) => (Array.isArray(v) ? v : []);

/**
 * HEURISTIQUE LOCALE (démo / repli). Déplacée telle quelle depuis AtelierPrompt.jsx.
 *   - réponse vide            → 'partial'
 *   - contient une réponse    → 'ok'
 *   - contient une erreur     → 'wrong'
 *   - mot significatif (>3 c.) d'une réponse attendue présent → 'partial'
 *   - sinon                   → 'wrong'
 *
 * Ne jette jamais (tolère undefined/null pour les listes).
 *
 * @param {string} answer
 * @param {string[]} [expectedAnswers]
 * @param {string[]} [expectedErrors]
 * @returns {Verdict}
 */
export function classifyLocal(answer, expectedAnswers = [], expectedErrors = []) {
  const a = norm(answer);
  if (!a.trim()) return 'partial';
  const answers = arr(expectedAnswers);
  const errors = arr(expectedErrors);
  if (answers.some((k) => a.includes(norm(k)))) return 'ok';
  if (errors.some((k) => a.includes(norm(k)))) return 'wrong';
  const partial = answers.some((k) => norm(k).split(/\s+/).some((w) => w.length > 3 && a.includes(w)));
  return partial ? 'partial' : 'wrong';
}

/**
 * Choisit une réaction (`ack`) pour la catégorie donnée, au hasard parmi les
 * variantes de la scène. Fallback `FALLBACK_ACK` si aucune variante.
 *
 * ⚠️ `Math.random` est VOLONTAIRE ici : c'est du runtime front (variété des
 * réactions), pas la logique testée déterministe. La preuve n'assert jamais la
 * valeur exacte d'un `ack` piochant dans les variantes.
 *
 * @param {Object} scene
 * @param {Verdict|string} cat
 * @returns {string}
 */
export function pickAck(scene, cat) {
  const variants = arr(scene && scene.ack_variants ? scene.ack_variants[cat] : null)
    .map((s) => String(s == null ? '' : s).trim())
    .filter((s) => s.length > 0);
  if (!variants.length) return FALLBACK_ACK;
  return variants[Math.floor(Math.random() * variants.length)] || FALLBACK_ACK;
}

/**
 * RÉSOUT le verdict final d'un atelier.
 *
 * Priorité au verdict de l'edge LLM (`edgeResult.verdict` ∈ {ok,partial,wrong}) :
 *   → on garde son verdict ; `ack` = celui de l'edge (trim non vide) SINON une
 *     variante locale `pickAck(scene, verdict)`.
 * Sinon (edge null / verdict absent ou hors-enum) :
 *   → repli déterministe `classifyLocal(...)` sur les repères de la scène, et
 *     `ack` = variante locale.
 *
 * Ne jette JAMAIS : tout `scene` / `answer` / `edgeResult` manquant est toléré.
 *
 * @param {Object} scene       la scène atelier (expected_answers, expected_errors, ack_variants…)
 * @param {string} answer      la réponse saisie par l'élève
 * @param {AtelierVerdict|null|undefined} edgeResult  sortie de l'edge (ou null si échec/off-line)
 * @returns {AtelierVerdict}
 */
export function resolveAtelierVerdict(scene, answer, edgeResult) {
  const s = scene && typeof scene === 'object' ? scene : {};
  const edgeVerdict = edgeResult && typeof edgeResult === 'object' ? edgeResult.verdict : undefined;

  if (VERDICTS.includes(edgeVerdict)) {
    const edgeAck = String((edgeResult && edgeResult.ack) || '').trim();
    return { verdict: edgeVerdict, ack: edgeAck || pickAck(s, edgeVerdict) };
  }

  const v = classifyLocal(answer, s.expected_answers, s.expected_errors);
  return { verdict: v, ack: pickAck(s, v) };
}
