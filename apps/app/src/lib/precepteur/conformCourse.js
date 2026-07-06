/**
 * conformCourse.js — LE JUGE DE CONFORMITÉ DU PRÉCEPTEUR (brique C).
 *
 * BUT : garantir que TOUS les cours du Précepteur atteignent le MÊME niveau —
 * mêmes dispositifs pédagogiques, même structure. C'est LA brique d'uniformité.
 *
 * Deux fonctions :
 *   • auditCourse(course, opts?)   → rapport PUR, jamais throw, déterministe :
 *       pour chaque concept, compare la RECETTE IDÉALE (planInjections / classifySegment
 *       de injectionRules.js) aux SCÈNES RÉELLES, et signale chaque écart (finding).
 *   • conformCourse(course, opts?) → répare ce qui est DÉTERMINISTE (compose
 *       enrichCourseWithDevices) et FLAGGE ce qui exige un LLM (croquis/atelier/image)
 *       — jamais inventé. Non destructif, idempotent, fail-safe.
 *
 * RÈGLE D'OR : le déterministe RÉPARE, le LLM FLAGGE (jamais fabriqué).
 *  - Aucun check n'exige un type hors RENDERABLE_TYPES (sinon on garantirait de l'invisible).
 *  - INVARIANT SACRÉ : une scène `croquis` n'existe JAMAIS sans `sketch.elements` valides
 *    (SketchRenderer lit `el.from[0]`/`el.center[0]` sans garde → crash). coerceCroquis retire.
 *
 * PURE ESM : seuls imports = les modules Précepteur (eux-mêmes purs) → tourne sous
 * `node` nu pour la preuve. `isValidElement` est ré-implémenté ici (miroir exact de
 * enrichCroquis.js) pour rester auto-porté.
 */
import { classifySegment, planInjections } from './injectionRules.js';
import { enrichCourseWithDevices } from './enrichCourseWithDevices.js';
import { enrichCourseWithCroquis, buildCroquisSeeds } from './enrichCroquis.js';

// ── Vocabulaire fermé + ordre canonique (= ordre de planInjections) ──────────
export const SCENE_VOCABULARY = new Set([
  'lecon', 'surlignage', 'encadre', 'resume_encadre',
  'amorce_croquis', 'croquis', 'atelier', 'image_analogie', 'transition',
]);
export const RENDERABLE_TYPES = [...SCENE_VOCABULARY];
export const CANONICAL_ORDER = {
  lecon: 0, surlignage: 1, encadre: 2, amorce_croquis: 3,
  croquis: 4, atelier: 5, image_analogie: 6, resume_encadre: 7, transition: 8,
};

// ack_variants par défaut — miroir de fromMasterclass.js (feedbacks vivants du prof).
const DEFAULT_ACK = {
  ok: ['Exactement.', 'Tu y es.', 'C’est ça même.', 'Voilà.'],
  partial: ['Presque — pousse d’un cran.', 'Tu tiens un bout du fil…', 'Bonne direction.'],
  wrong: ['Pas tout à fait.', 'Regarde encore.', 'Non — mais l’erreur est instructive.'],
};

// Détecteur de formule — miroir de enrichCourseWithDevices.FORMULA_RE (cohérence audit↔réparation).
const FORMULA_RE = /[=×÷≈≤≥±]|(\d+\s*[+\-*/]\s*\d+)/;

// ── Vocabulaire géométrique (miroir EXACT de enrichCroquis.js) ───────────────
const CENTER_KINDS = new Set(['point', 'circle', 'spiral', 'axis', 'label']);
const SEGMENT_KINDS = new Set(['vector', 'arrow', 'line', 'curve']);
const isPair = (p) => Array.isArray(p) && p.length >= 2 && Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1]));

/** Un élément de croquis est sûr UNIQUEMENT s'il porte la géométrie lue sans garde par SketchRenderer. */
export function isValidElement(el) {
  if (!el || typeof el !== 'object') return false;
  const kind = String(el.kind || '').toLowerCase();
  if (CENTER_KINDS.has(kind)) return isPair(el.center);
  if (SEGMENT_KINDS.has(kind)) return isPair(el.from) && isPair(el.to);
  return false; // hors vocab fermé → rejeté (sinon branche segment → crash)
}

// ── Petits utilitaires texte (miroir enrichCourseWithDevices) ────────────────
function txt(v) { if (v == null) return ''; return String(v).trim(); }
function sentences(t) {
  return String(t || '').replace(/[ \t]+/g, ' ').split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean);
}
function firstMatch(t, re) { return sentences(t).find((s) => re.test(s)) || ''; }
/** Extrait ≥2 points d'une énumération — miroir EXACT de enrichCourseWithDevices.extractPoints. */
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

/** Le texte de leçon d'un concept = 1re scène `lecon` (board_text||narration), comme enrichCourseWithDevices. */
function leconTextOf(scenes) {
  const i = scenes.findIndex((s) => s && s.type === 'lecon');
  if (i < 0) return { idx: -1, text: '' };
  return { idx: i, text: txt(scenes[i].board_text || scenes[i].narration) };
}

// ── CATALOGUE DES CHECKS (méta) ──────────────────────────────────────────────
// severity: error (invalide le cours) | warn (uniformité) | info (polish).
// repair: deterministic (réparé par conformCourse) | llm (flaggé pour regen) | none (structurel dur).
export const CHECKS = {
  COURSE_VIDE: { severity: 'error', scope: 'course', repair: 'none', repairAction: 'Régénérer le cours (aucun concept).' },
  CONCEPT_SANS_SCENE: { severity: 'error', scope: 'concept', repair: 'none', repairAction: 'Retirer/régénérer le concept vide en amont.' },
  CONCEPT_NO_LECON: { severity: 'error', scope: 'concept', repair: 'none', repairAction: 'Régénérer : un concept doit être ENSEIGNÉ (≥1 leçon). Non inventable.' },
  LECON_TEXTE_VIDE: { severity: 'error', scope: 'concept', repair: 'none', repairAction: 'Régénérer le texte de la leçon (contenu manquant).' },
  DEFINITION_SANS_ENCADRE: { severity: 'warn', scope: 'concept', repair: 'deterministic', repairAction: 'enrichCourseWithDevices insère l’encadré « Définition » après la leçon.' },
  DEFINITION_SANS_SURLIGNAGE: { severity: 'info', scope: 'concept', repair: 'deterministic', repairAction: 'enrichCourseWithDevices insère le surlignage du mot-clé.' },
  FORMULE_SANS_ENCADRE: { severity: 'warn', scope: 'concept', repair: 'deterministic', repairAction: 'enrichCourseWithDevices insère l’encadré « Formule ».' },
  RESUME_MANQUANT: { severity: 'warn', scope: 'concept', repair: 'deterministic', repairAction: 'enrichCourseWithDevices insère le résumé encadré (points clés).' },
  CROQUIS_MANQUANT: { severity: 'warn', scope: 'concept', repair: 'llm', repairAction: 'FLAG : générer le croquis vectoriel via l’edge (enrichCourseWithCroquis). Jamais fabriqué localement (invariant sacré).' },
  CROQUIS_INVALIDE: { severity: 'error', scope: 'scene', repair: 'deterministic', repairAction: 'Filtrer les éléments via isValidElement ; si aucun valide → retirer la scène croquis (anti-crash) + FLAG regen.' },
  AMORCE_ORPHELINE: { severity: 'info', scope: 'concept', repair: 'llm', repairAction: 'FLAG : régénérer le croquis annoncé par l’amorce (même voie que CROQUIS_MANQUANT).' },
  ATELIER_MANQUANT: { severity: 'warn', scope: 'concept', repair: 'llm', repairAction: 'FLAG : concept abstrait → atelier socratique attendu (question + révélation = LLM).' },
  ATELIER_INCOMPLET: { severity: 'warn', scope: 'scene', repair: 'deterministic', repairAction: 'Injecter ack_variants=DEFAULT_ACK + expected_* = []. question/reveal vides → FLAG llm.' },
  IMAGE_MANQUANTE: { severity: 'info', scope: 'concept', repair: 'llm', repairAction: 'FLAG : ancrer l’idée concrète par une image/analogie générée (LLM).' },
  IMAGE_VIDE: { severity: 'warn', scope: 'scene', repair: 'llm', repairAction: 'FLAG : analogie ET narration vides → régénérer le contenu.' },
  ORDRE_INVALIDE: { severity: 'warn', scope: 'concept', repair: 'deterministic', repairAction: 'Réordonnancement canonique stable (tri par rang, index d’origine préservé).' },
  SCENE_TYPE_NON_RENDU: { severity: 'warn', scope: 'scene', repair: 'none', repairAction: 'FLAG : type hors vocabulaire (rendu en fallback transition). Corriger en amont (transform).' },
  NARRATION_ABSENTE_FALLTHROUGH: { severity: 'warn', scope: 'scene', repair: 'deterministic', repairAction: 'Retirer la scène de fallback vide (aucun contenu à afficher).' },
};

/** Construit un finding à partir du catalogue + du contexte. Forme stable (id déterministe). */
function mkFinding(code, conceptIndex, sceneIndex, extra = {}) {
  const meta = CHECKS[code] || { severity: 'warn', scope: 'scene', repair: 'none', repairAction: '' };
  return {
    id: `${code}:${conceptIndex == null ? '-' : conceptIndex}:${sceneIndex == null ? '-' : sceneIndex}`,
    code,
    severity: meta.severity,
    scope: meta.scope,
    conceptIndex: conceptIndex == null ? null : conceptIndex,
    conceptTitle: extra.conceptTitle ?? null,
    sceneIndex: sceneIndex == null ? null : sceneIndex,
    sceneType: extra.sceneType ?? null,
    message: extra.message || meta.repairAction,
    repair: meta.repair,
    repairAction: meta.repairAction,
    expected: extra.expected ?? null,
    actual: extra.actual ?? null,
  };
}

// ── AUDIT d'un concept ───────────────────────────────────────────────────────
function auditConcept(concept, ci) {
  const findings = [];
  const title = txt(concept?.title) || null;
  const scenes = Array.isArray(concept?.scenes) ? concept.scenes : [];
  const F = (code, si, extra = {}) => findings.push(mkFinding(code, ci, si, { conceptTitle: title, ...extra }));

  if (scenes.length === 0) { F('CONCEPT_SANS_SCENE', null, { actual: '0 scène' }); return findings; }

  const sceneTypes = scenes.map((s) => (s && s.type) || '?');
  const { idx: leconIdx, text: leconText } = leconTextOf(scenes);
  if (leconIdx < 0) F('CONCEPT_NO_LECON', null, { expected: '≥1 scène lecon', actual: sceneTypes });
  else if (leconText.length < 12) F('LECON_TEXTE_VIDE', leconIdx, { sceneType: 'lecon', actual: `${leconText.length} car.` });

  const usable = leconText.length >= 12;
  const cls = usable ? classifySegment(leconText, { abstraction: concept?.abstraction }) : null;
  const plan = usable ? planInjections(leconText, { abstraction: concept?.abstraction }) : [];
  const planHasCroquis = plan.some((p) => p.device === 'croquis');
  const has = (pred) => scenes.some(pred);

  // Concept-level : recette idéale (classifySegment/planInjections) vs scènes réelles.
  if (cls && cls.tags.includes('definition')) {
    if (!has((s) => s && s.type === 'encadre' && s.kind === 'definition'))
      F('DEFINITION_SANS_ENCADRE', null, { expected: 'encadre kind=definition', actual: sceneTypes });
    if (cls.keyTerm && !has((s) => s && s.type === 'surlignage' && txt(s.term) === txt(cls.keyTerm)))
      F('DEFINITION_SANS_SURLIGNAGE', null, { expected: `surlignage « ${cls.keyTerm} »`, actual: sceneTypes });
  }
  if (cls && cls.tags.includes('formula') && firstMatch(leconText, FORMULA_RE)) {
    if (!has((s) => s && s.type === 'encadre' && s.kind === 'formule'))
      F('FORMULE_SANS_ENCADRE', null, { expected: 'encadre kind=formule', actual: sceneTypes });
  }
  if (cls && (cls.tags.includes('enumeration') || cls.tags.includes('takeaway')) && extractPoints(leconText).length >= 2) {
    if (!has((s) => s && s.type === 'resume_encadre'))
      F('RESUME_MANQUANT', null, { expected: 'resume_encadre (≥2 points)', actual: sceneTypes });
  }
  if (planHasCroquis && !has((s) => s && s.type === 'croquis'))
    F('CROQUIS_MANQUANT', null, { expected: 'scène croquis (sketch.elements)', actual: sceneTypes });
  if (cls && cls.isAbstract && !has((s) => s && s.type === 'atelier'))
    F('ATELIER_MANQUANT', null, { expected: 'scène atelier', actual: sceneTypes });
  if (cls && (cls.tags.includes('phenomenon') || !cls.isAbstract) && !has((s) => s && s.type === 'image_analogie'))
    F('IMAGE_MANQUANTE', null, { expected: 'scène image_analogie', actual: sceneTypes });

  // Scene-level.
  scenes.forEach((s, si) => {
    if (!s) return;
    const t = s.type;
    if (!SCENE_VOCABULARY.has(t)) {
      F('SCENE_TYPE_NON_RENDU', si, { sceneType: t, actual: t });
      if (!txt(s.narration)) F('NARRATION_ABSENTE_FALLTHROUGH', si, { sceneType: t });
      return;
    }
    if (t === 'transition' && !txt(s.narration)) F('NARRATION_ABSENTE_FALLTHROUGH', si, { sceneType: t });
    if (t === 'amorce_croquis') {
      const hasCroquisAfter = scenes.slice(si + 1).some((x) => x && x.type === 'croquis');
      if (!hasCroquisAfter && planHasCroquis) F('AMORCE_ORPHELINE', si, { sceneType: 'amorce_croquis', expected: 'croquis suivant' });
    }
    if (t === 'croquis') {
      const els = Array.isArray(s.sketch?.elements) ? s.sketch.elements : [];
      if (els.length === 0 || els.some((el) => !isValidElement(el)))
        F('CROQUIS_INVALIDE', si, { sceneType: 'croquis', actual: `${els.length} élément(s), ${els.filter(isValidElement).length} valide(s)` });
    }
    if (t === 'atelier') {
      if (!txt(s.question) || !s.ack_variants || !Array.isArray(s.ack_variants.ok) || !txt(s.reveal_narration))
        F('ATELIER_INCOMPLET', si, { sceneType: 'atelier' });
    }
    if (t === 'image_analogie') {
      if (!txt(s.analogie) && !txt(s.narration)) F('IMAGE_VIDE', si, { sceneType: 'image_analogie' });
    }
  });

  // Ordre canonique BEAT-AWARE : cohérent avec reorderScenes (pas de faux positif sur
  // les concepts multi-leçons). ORDRE_INVALIDE ssi le réordonnancement change la suite des types.
  const reorderedTypes = reorderScenes(scenes).map((s) => (s && s.type) || '?');
  if (reorderedTypes.join('|') !== sceneTypes.join('|'))
    F('ORDRE_INVALIDE', null, { expected: reorderedTypes, actual: sceneTypes });

  return findings;
}

/**
 * auditCourse — rapport PUR, jamais throw, déterministe (hors meta.checkedAt, opt-in).
 * @returns {{ ok, score, counts, conceptsTotal, conceptsConform, findings, repairable, meta }}
 */
export function auditCourse(course, opts = {}) {
  const c = course && typeof course === 'object' ? course : {};
  const concepts = Array.isArray(c.concepts) ? c.concepts : [];
  const findings = [];
  if (concepts.length === 0) findings.push(mkFinding('COURSE_VIDE', null, null, { actual: '0 concept' }));
  else concepts.forEach((concept, ci) => { findings.push(...auditConcept(concept, ci)); });

  const counts = { error: 0, warn: 0, info: 0 };
  findings.forEach((f) => { counts[f.severity] = (counts[f.severity] || 0) + 1; });
  const WEIGHT = { error: 20, warn: 6, info: 2 };
  const penalty = findings.reduce((a, f) => a + (WEIGHT[f.severity] || 0), 0);
  const score = Math.max(0, 100 - penalty);
  const conceptsConform = concepts.filter((_, ci) => !findings.some((f) => f.conceptIndex === ci && f.severity === 'error')).length;
  const repairable = { deterministic: [], llm: [], none: [] };
  findings.forEach((f) => { (repairable[f.repair] || repairable.none).push(f.id); });

  return {
    ok: counts.error === 0,
    score,
    counts,
    conceptsTotal: concepts.length,
    conceptsConform,
    findings,
    repairable,
    meta: { version: 'C-1', checkedAt: opts.now ?? null },
  };
}

/** Retire meta d'un audit (comparaisons de tests). */
export function stripMeta(audit) { const { meta, ...rest } = audit || {}; return rest; }

// ── Réparateurs déterministes (purs, jamais throw, idempotents) ──────────────

/** Signature d'un dispositif auto-injecté (pour dédup). null = type non-dispositif (jamais dédupé). */
function deviceSignature(s) {
  if (!s) return null;
  if (s.type === 'surlignage') return `surlignage|${txt(s.term)}`;
  if (s.type === 'encadre') return `encadre|${s.kind}|${txt(s.text)}`;
  if (s.type === 'resume_encadre') return `resume_encadre|${(Array.isArray(s.points) ? s.points : []).join('¦')}`;
  return null;
}
/** Retire les dispositifs auto strictement identiques (garantit l'idempotence après re-enrich). */
function dedupeScenes(scenes) {
  const seen = new Set();
  const out = [];
  for (const s of scenes) {
    const sig = deviceSignature(s);
    if (sig) { if (seen.has(sig)) continue; seen.add(sig); }
    out.push(s);
  }
  return out;
}
/** Anti-crash : filtre les éléments de croquis ; retire la scène si aucun n'est dessinable. */
function coerceCroquisScenes(scenes) {
  const out = [];
  for (const s of scenes) {
    if (s && s.type === 'croquis') {
      const els = Array.isArray(s.sketch?.elements) ? s.sketch.elements.filter(isValidElement) : [];
      if (els.length === 0) continue; // scène croquis non dessinable → retirée (invariant sacré)
      out.push({ ...s, sketch: { ...(s.sketch || {}), elements: els } });
    } else out.push(s);
  }
  return out;
}
/** Complète un atelier incomplet (défauts non destructifs). */
function fixAtelierScene(s) {
  if (!s || s.type !== 'atelier') return s;
  const patch = {};
  if (!s.ack_variants || !Array.isArray(s.ack_variants.ok)) patch.ack_variants = DEFAULT_ACK;
  if (!Array.isArray(s.expected_answers)) patch.expected_answers = [];
  if (!Array.isArray(s.expected_errors)) patch.expected_errors = [];
  return Object.keys(patch).length ? { ...s, ...patch } : s;
}
/**
 * Réordonnancement canonique STABLE, CONSCIENT DES « BEATS ».
 * Un concept peut enchaîner PLUSIEURS leçons (leçon + ses dispositifs = un beat).
 * On ne trie QU'À L'INTÉRIEUR de chaque beat (délimité par les leçons) : jamais entre
 * beats — sinon on regrouperait les leçons et on détacherait un surlignage/encadré de SA
 * leçon. Les scènes avant la 1re leçon se rattachent au 1er beat (elles s'y trient).
 * Types inconnus : gardent le rang de la scène connue précédente (restent en place).
 */
function reorderScenes(scenes) {
  const arr = Array.isArray(scenes) ? scenes.slice() : [];
  const firstLecon = arr.findIndex((s) => s && s.type === 'lecon');
  if (firstLecon < 0) return arr; // aucune ancre leçon → on ne réordonne rien
  const leading = arr.slice(0, firstLecon); // scènes avant la 1re leçon → rattachées au 1er beat
  const beats = [];
  let cur = null;
  for (let i = firstLecon; i < arr.length; i += 1) {
    const s = arr[i];
    if (s && s.type === 'lecon') { cur = { list: [s], order: [i] }; beats.push(cur); }
    else { cur.list.push(s); cur.order.push(i); }
  }
  if (leading.length && beats.length) {
    leading.forEach((s) => { beats[0].list.push(s); beats[0].order.push(-1); });
  }
  const sortBeat = (b) => {
    let last = 0;
    const keyed = b.list.map((s, k) => {
      let r = s ? CANONICAL_ORDER[s.type] : undefined;
      if (r == null) r = last; else last = r;
      return { s, r, o: b.order[k] };
    });
    keyed.sort((a, z) => (a.r - z.r) || (a.o - z.o));
    return keyed.map((k) => k.s);
  };
  return beats.flatMap(sortBeat);
}

/** Applique une transformation de scènes à chaque concept (immuable). */
function mapConceptScenes(course, fn) {
  return {
    ...course,
    concepts: (Array.isArray(course.concepts) ? course.concepts : []).map((c) => ({
      ...(c || {}),
      scenes: fn(Array.isArray(c?.scenes) ? c.scenes : []),
    })),
  };
}

function buildReport(audit0, auditN, repaired) {
  return {
    scoreBefore: audit0.score,
    scoreAfter: auditN.score,
    before: audit0.counts,
    after: auditN.counts,
    repaired,
    flagged: auditN.findings.filter((f) => f.repair !== 'deterministic').map((f) => f.id),
    remaining: auditN.findings.map((f) => f.id),
    unchanged: repaired.length === 0
      && audit0.counts.error === auditN.counts.error
      && audit0.counts.warn === auditN.counts.warn
      && audit0.counts.info === auditN.counts.info,
  };
}

/** Pipeline de réparation DÉTERMINISTE (pur, jamais throw, idempotent) : clone → dispositifs
 *  → dédup → anti-crash croquis → défauts atelier → réordonnancement beat-aware. */
function repairDeterministic(course, opts = {}) {
  const { enrichDevices = true, reorder = true, fixAtelierDefaults = true } = opts;
  // Clone profond : l'entrée n'est JAMAIS mutée (données JSON pures).
  let work;
  try { work = course ? JSON.parse(JSON.stringify(course)) : { title: '', concepts: [] }; }
  catch { work = { title: '', concepts: [] }; }
  if (!Array.isArray(work.concepts) || work.concepts.length === 0) return work;

  if (enrichDevices) {
    try { work = enrichCourseWithDevices(work); } catch { /* fail-safe : work inchangé */ }
    work = mapConceptScenes(work, dedupeScenes); // idempotence après re-enrich
  }
  work = mapConceptScenes(work, coerceCroquisScenes); // anti-crash croquis (sécurité dure)
  if (fixAtelierDefaults) work = mapConceptScenes(work, (sc) => sc.map(fixAtelierScene));
  if (reorder) work = mapConceptScenes(work, reorderScenes);
  return work;
}

/**
 * conformCourseSync — réparation DÉTERMINISTE seule (sans edge). Synchrone, pour câblage
 * trivial dans le rendu (remplace enrichCourseWithDevices en apportant coerce + reorder + dédup).
 * @returns {{ course: Object, report: Object }}
 */
export function conformCourseSync(course, opts = {}) {
  const audit0 = auditCourse(course, opts);
  const work = repairDeterministic(course, opts);
  const auditN = auditCourse(work, opts);
  const repaired = audit0.findings.filter((f0) => !auditN.findings.some((fN) => fN.id === f0.id)).map((f) => f.id);
  return { course: work, report: buildReport(audit0, auditN, repaired) };
}

/**
 * conformCourse — répare le déterministe, flagge le LLM. Non destructif, idempotent, fail-safe.
 * La réparation LLM (croquis via edge) est OPT-IN et jamais fabriquée localement.
 * @param {Object} course
 * @param {Object} [opts] { enrichDevices=true, enrichCroquis=false, project, invokeEdge, reorder=true, fixAtelierDefaults=true, now }
 * @returns {Promise<{ course: Object, report: Object }>}
 */
export async function conformCourse(course, opts = {}) {
  const { enrichCroquis = false, project = null, invokeEdge = null, reorder = true } = opts;
  const audit0 = auditCourse(course, opts);
  let work = repairDeterministic(course, opts);

  // Croquis LLM (opt-in, fail-safe) — géométrie jamais inventée localement.
  if (enrichCroquis && project && typeof invokeEdge === 'function'
      && Array.isArray(work.concepts) && work.concepts.length) {
    try {
      const seeds = buildCroquisSeeds(project);
      work = await enrichCourseWithCroquis(work, seeds, invokeEdge);
      work = mapConceptScenes(work, coerceCroquisScenes); // re-sécurise l'insertion edge
      if (reorder) work = mapConceptScenes(work, reorderScenes);
    } catch { /* échec edge → work conservé, flags maintenus */ }
  }

  const auditN = auditCourse(work, opts);
  const repaired = audit0.findings.filter((f0) => !auditN.findings.some((fN) => fN.id === f0.id)).map((f) => f.id);
  return { course: work, report: buildReport(audit0, auditN, repaired) };
}

export default {
  auditCourse,
  conformCourse,
  conformCourseSync,
  stripMeta,
  SCENE_VOCABULARY,
  RENDERABLE_TYPES,
  CANONICAL_ORDER,
  CHECKS,
  isValidElement,
};
