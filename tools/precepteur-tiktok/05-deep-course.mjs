/**
 * 05-deep-course.mjs — GÉNÉRATEUR DE COURS APPROFONDI (remplace le « 1 appel = 1 cours »).
 *
 * Demande du fondateur : « il est pauvre… il faut reconstruire le cours, ARGUMENTER ce qui est
 * dit, les croquis doivent être RICHES et EXPLIQUER les idées et les symboles, les images doivent
 * être générées. Il faut un générateur approfondi, pas un système automatique — un travail de fond. »
 *
 * Six passes, chacune un appel dédié (au lieu d'un résumé en un coup) :
 *   A. ANALYSE DOCTRINALE  — que dit vraiment le fondateur ? thèse, chaîne d'arguments, SYMBOLES,
 *      termes techniques, objections. On comprend AVANT d'écrire.
 *   B. ARCHITECTURE        — plan raisonné : concepts, progression, ce que CHAQUE croquis doit
 *      démontrer, quel symbole il doit expliquer, quelle analogie visuelle.
 *   C. RÉDACTION           — un appel PAR CONCEPT : leçons qui ARGUMENTENT (prémisse → conséquence
 *      → objection levée), atelier, transition, dans la voix du fondateur.
 *   D. CROQUIS             — un appel PAR croquis : 4 à 8 éléments qui PORTENT l'explication
 *      (le symbole est nommé sur le dessin), tracé pédagogique ordonné.
 *   E. IMAGES              — génération réelle via l'edge `generate-visual-image` (--images).
 *   F. JUGE                — audit `conformCourse` (18 règles) + réparation déterministe.
 *
 * Usage :
 *   node tools/precepteur-tiktok/05-deep-course.mjs --ids 7576576458903096599 [--images] [--replace]
 *   node tools/precepteur-tiktok/05-deep-course.mjs --limit 3 [--images]
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql, q, TENANT_ID, ENV, log } from './common.mjs';
import { fitSketchToCanvas } from './sketchFit.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv;
const num = (n, d) => { const i = argv.indexOf(n); return i > -1 ? Number(argv[i + 1]) : d; };
const LIMIT = num('--limit', 1);
const IDS = (() => { const i = argv.indexOf('--ids'); return i > -1 ? String(argv[i + 1] || '').split(',').map((x) => x.trim()).filter(Boolean) : []; })();
const WITH_IMAGES = argv.includes('--images');
const REPLACE = argv.includes('--replace');

/* ── Référence : le cours modèle du fondateur ─────────────────────────────────────────────── */
function loadCanonical() {
  try {
    const src = readFileSync(path.join(ROOT, 'apps/app/src/pages/dev/precepteurCanonicalCourse.js'), 'utf8');
    const m = src.match(/export\s+const\s+CANONICAL_COURSE\s*=\s*(\{[\s\S]*?\});?\s*$/);
    // eslint-disable-next-line no-new-func
    return m ? Function(`"use strict"; return (${m[1]});`)() : null;
  } catch { return null; }
}
const CANON = loadCanonical();
/** Les 2 croquis du modèle = la référence de RICHESSE et de lisibilité pédagogique. */
const CANON_SKETCHES = (() => {
  const out = [];
  for (const c of CANON?.concepts || []) {
    for (const s of c.scenes || []) {
      if (s.sketch) out.push(s.sketch);
      if (s.reveal_sketch) out.push(s.reveal_sketch);
    }
  }
  return out;
})();

/* ── Vocabulaires FERMÉS (miroirs exacts de SketchRenderer / enrichCroquis) ───────────────── */
const CENTER_KINDS = new Set(['point', 'circle', 'spiral', 'axis', 'label']);
const SEGMENT_KINDS = new Set(['vector', 'arrow', 'line', 'curve']);
const COLORS = new Set(['blue', 'amber', 'green', 'purple', 'slate', 'red']); // SketchRenderer.COLORS
const ANIM_SUBJECTS = new Set(['earth_orbit', 'galaxy_spin', 'orbit_generic', 'bird_tethered']);
const ABSTRACTIONS = new Set(['high', 'medium', 'low']);

const VOIX = `VOIX DU FONDATEUR (à imiter, jamais paraphraser platement) : oral complice, tutoiement,
phrases courtes, respirations « … », interpellations. Marqueurs : « Bon… commençons par »,
« en vrai, c'est quoi ? », « Et là, écoute bien : », « tu vois ? », « Mais attends… »,
« Réfléchis avec moi : », « Eh bien voilà : », « retiens bien ça ».`;

const GEOM = `REPÈRE DU CROQUIS : 0..100 en x ET en y, mais la surface est en 16:9 (160×90) —
donc 10 unités en x sont ~2× plus courtes visuellement que 10 unités en y. OCCUPE TOUT le tableau : x de 8 à 92, y de 14 à 86. Un dessin tassé au centre est illisible.
y augmente vers le BAS. (Un recadrage automatique corrigera, mais vise large dès le départ.)
VOCABULAIRE FERMÉ (rien d'autre n'est dessinable) :
  • segment : {"kind":"vector|arrow|line|curve","from":[x,y],"to":[x,y]}
  • centré  : {"kind":"point|circle|spiral|axis|label","center":[x,y]} (+"radius", +"turns" pour spiral)
Champs : "color" ∈ blue|amber|green|purple|slate|red · "label" (COURT, en MAJUSCULES, nomme le
symbole ou la force) · "labelSide" ∈ above|below · "order" = ordre de TRACÉ pédagogique (1,2,3…).`;

/* ── Appel LLM ───────────────────────────────────────────────────────────────────────────── */
async function llm(system, user, { maxTokens = 8000, temperature = 0.5, label = '' } = {}) {
  const tries = [
    { name: 'deepseek', url: 'https://api.deepseek.com/chat/completions', key: ENV.DEEPSEEK_API_KEY, model: 'deepseek-v4-pro' },
    { name: 'groq', url: 'https://api.groq.com/openai/v1/chat/completions', key: ENV.GROQ_API_KEY, model: 'llama-3.3-70b-versatile' },
  ];
  let lastErr = '';
  for (const t of tries) {
    if (!t.key) continue;
    try {
      const res = await fetch(t.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t.key}` },
        body: JSON.stringify({
          model: t.model,
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
          temperature,
          response_format: { type: 'json_object' },
          max_tokens: t.name === 'groq' ? Math.min(maxTokens, 6000) : maxTokens,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 160)}`);
      const j = await res.json();
      const content = j?.choices?.[0]?.message?.content || '';
      if (!content.trim()) throw new Error('réponse vide (budget de tokens épuisé par le raisonnement)');
      return JSON.parse(content);
    } catch (e) {
      lastErr = `${t.name}: ${String(e.message).slice(0, 160)}`;
      log(`    ⚠️ ${label} ${lastErr}`);
    }
  }
  throw new Error(`toutes les IA ont échoué (${lastErr})`);
}

/* ── PASSE A — analyse doctrinale ────────────────────────────────────────────────────────── */
const SYS_A = `Tu es l'ANALYSTE DOCTRINAL de l'école Prorascience (fondateur : Ngowazulu).
On te donne la transcription brute d'une vidéo d'enseignement. Tu ne rédiges RIEN pour l'élève :
tu EXTRAIS ce que le fondateur affirme réellement, pour qu'un précepteur puisse ensuite l'enseigner.
Sois exhaustif et fidèle. N'invente aucune notion absente de la transcription.
Si ce n'est PAS un enseignement (chant, évocation rituelle, annonce, salutation) → "enseignement": false.

JSON STRICT :
{
 "enseignement": true,
 "titre_pressenti": "…",
 "these": "l'affirmation centrale, en une phrase",
 "chaine_arguments": [
   {"etape":"prémisse ou constat", "justification":"pourquoi c'est vrai selon lui", "consequence":"ce qui en découle"}
 ],
 "symboles": [{"nom":"ex. le serpent, la spirale, le masque","sens":"ce qu'il signifie dans SON enseignement"}],
 "termes_techniques": [{"terme":"…","definition":"telle qu'il l'emploie"}],
 "objections": ["ce qu'un élève pourrait objecter ou mal comprendre"],
 "citations_fortes": ["ses formulations marquantes, mot pour mot"],
 "concepts_proposes": [{"titre":"…","idee_maitresse":"…","abstraction":"high|medium|low"}]
}`;

/* ── PASSE B — architecture ──────────────────────────────────────────────────────────────── */
const SYS_B = `Tu es l'ARCHITECTE PÉDAGOGIQUE du Précepteur. À partir de l'analyse doctrinale, tu bâtis
le PLAN du cours. Tu ne rédiges pas encore : tu décides de la progression et, surtout, tu spécifies
CE QUE CHAQUE CROQUIS DOIT DÉMONTRER (un croquis n'illustre pas : il EXPLIQUE le mécanisme ou le symbole).

Règles : 1 à 3 concepts, chacun autonome et argumenté. Un concept abstrait DOIT avoir un croquis.
Chaque concept nomme le SYMBOLE qu'il éclaire (s'il y en a un) et l'analogie du quotidien.

JSON STRICT :
{
 "titre_cours":"…",
 "concepts":[{
   "titre":"…",
   "objectif":"ce que l'élève saura faire/comprendre",
   "abstraction":"high|medium|low",
   "idee_maitresse":"…",
   "argumentation":["étape 1 du raisonnement","étape 2","étape 3"],
   "objection_a_lever":"…",
   "symbole_a_expliquer":"nom du symbole ou null",
   "croquis_doit_montrer":"la DÉMONSTRATION visuelle attendue : quelles forces/entités, quelle tension, quel résultat",
   "reveal_doit_montrer":"ce que le 2e croquis (après la réponse de l'élève) révèle, ou null",
   "analogie_du_quotidien":"la scène concrète qui rend l'idée évidente",
   "transition_next":"amorce du concept suivant"
 }]
}`;

/* ── PASSE C — rédaction d'un concept ────────────────────────────────────────────────────── */
const SYS_C = `Tu es LE PRÉCEPTEUR. Tu rédiges UN concept de cours, entièrement, dans la voix du fondateur.
${VOIX}

EXIGENCE D'ARGUMENTATION (c'est le cœur) : chaque leçon ne se contente pas d'affirmer — elle POSE
la prémisse, la JUSTIFIE, en TIRE la conséquence, et LÈVE l'objection. Deux à trois leçons par
concept, qui s'enchaînent logiquement. On doit sentir une démonstration, pas un résumé.

DEUX REGISTRES : "board_text" = ce qui s'ÉCRIT (dense, définitionnel, 1 à 3 phrases fortes) ;
"narration" = ce qui se DIT (déroulé, respiré, 4 à 8 phrases, avec les marqueurs de voix).
JAMAIS la même phrase dans les deux.

Tu produis les scènes SAUF les croquis (traités à part) : mets simplement les marqueurs
{"type":"croquis_placeholder"} et, dans l'atelier, "reveal_sketch_placeholder": true si un
2e croquis est prévu.

JSON STRICT :
{"scenes":[
  {"type":"lecon","title":"…","board_text":"…","narration":"…"},
  {"type":"lecon","title":"…","board_text":"…","narration":"…"},
  {"type":"amorce_croquis","narration":"la phrase qui invite à passer au tableau"},
  {"type":"croquis_placeholder"},
  {"type":"atelier","question":"question qui fait CHERCHER (pas de récitation)","hint":"coup de pouce qui oriente sans donner","expected_answers":["…","…"],"expected_errors":["…","…"],"reveal_narration":"la révélation développée : la réponse, POURQUOI elle est vraie, et ce qu'elle ouvre","reveal_sketch_placeholder":true},
  {"type":"image_analogie","analogie":"l'analogie en une phrase","image_prompt":"prompt d'image cinématographique DÉTAILLÉ en français : sujet en action, tension visible, lumière, cadrage, ambiance. Finir par « Sujet clair et lisible, pas de texte. »","narration":"…"},
  {"type":"transition","narration":"…"}
]}`;

/* ── PASSE D — un croquis ────────────────────────────────────────────────────────────────── */
const SYS_D = `Tu es LE TRACEUR du Précepteur. Tu produis UN croquis au tableau qui EXPLIQUE une idée
ou un symbole — il ne décore pas, il DÉMONTRE. L'élève doit comprendre le mécanisme rien qu'en le regardant.

${GEOM}

RICHESSE EXIGÉE — un croquis qui n'explique rien est un échec :
  • 4 à 8 éléments.
  • CHAQUE élément porteur de sens a un "label" COURT en MAJUSCULES qui le NOMME (la force, l'entité,
    le symbole, le résultat). Un dessin muet n'enseigne pas. Au moins 3 éléments étiquetés.
  • Les COULEURS portent le sens : deux forces opposées n'ont jamais la même ; le RÉSULTAT se
    distingue des causes (ex. causes en blue/amber, résultat en green, symbole en purple).
  • "order" = l'ordre du RAISONNEMENT : ce qui existe d'abord, ce qui s'y oppose ensuite, ce qui
    en résulte enfin. L'élève doit suivre la démonstration se construire trait après trait.
  • Si un SYMBOLE est à expliquer, il doit APPARAÎTRE sur le dessin, nommé par son label.

Tu fournis AUSSI la narration : ce que le professeur DIT pendant qu'il trace, dans sa voix
(« Regarde bien. Voilà… », il nomme chaque trait au moment où il le pose, et conclut par ce que
le dessin démontre). 3 à 6 phrases.

JSON STRICT : {"caption":"la légende qui énonce ce que le dessin démontre","narration":"ce que le prof dit en traçant","elements":[…]}`;

/* ── Nettoyage / invariants de rendu ─────────────────────────────────────────────────────── */
const str = (v, max = 4000) => String(v ?? '').trim().slice(0, max);
function coord(p) {
  if (!Array.isArray(p) || p.length < 2) return null;
  const x = Number(p[0]); const y = Number(p[1]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const c = (n) => Math.max(0, Math.min(100, Math.round(n * 10) / 10));
  return [c(x), c(y)];
}
function sanitizeElement(el) {
  if (!el || typeof el !== 'object') return null;
  const kind = String(el.kind || '').toLowerCase();
  const common = {
    ...(COLORS.has(String(el.color).toLowerCase()) ? { color: String(el.color).toLowerCase() } : {}),
    ...(el.label ? { label: str(el.label, 42) } : {}),
    ...(el.labelSide === 'above' || el.labelSide === 'below' ? { labelSide: el.labelSide } : {}),
    ...(Number.isFinite(Number(el.order)) ? { order: Math.round(Number(el.order)) } : {}),
  };
  if (CENTER_KINDS.has(kind)) {
    const center = coord(el.center); if (!center) return null;
    return { kind, center, ...common,
      ...(Number.isFinite(Number(el.radius)) ? { radius: Math.max(2, Math.min(45, Number(el.radius))) } : {}),
      ...(Number.isFinite(Number(el.turns)) ? { turns: Math.max(0.5, Math.min(6, Number(el.turns))) } : {}) };
  }
  if (SEGMENT_KINDS.has(kind)) {
    const from = coord(el.from); const to = coord(el.to); if (!from || !to) return null;
    return { kind, from, to, ...common };
  }
  return null;
}
function sanitizeSketch(sk) {
  if (!sk || typeof sk !== 'object' || !Array.isArray(sk.elements)) return null;
  const elements = sk.elements.map(sanitizeElement).filter(Boolean).slice(0, 9);
  if (!elements.length) return null;
  return { ...(sk.caption ? { caption: str(sk.caption, 150) } : {}), elements: fitSketchToCanvas(elements) };
}
const DEFAULT_ACK = {
  ok: ['Exactement.', 'Tu y es.', 'C’est ça même.', 'Voilà.'],
  partial: ['Presque — pousse d’un cran.', 'Tu tiens un bout du fil…', 'Bonne direction.'],
  wrong: ['Pas tout à fait.', 'Regarde mieux le croquis.', 'Non — mais l’erreur est instructive.'],
};

/* ── PASSE E — génération d'image réelle ─────────────────────────────────────────────────── */
async function generateImage(prompt) {
  const url = ENV.SUPABASE_URL; const anon = ENV.SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  try {
    const res = await fetch(`${url}/functions/v1/generate-visual-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anon}`, apikey: anon },
      body: JSON.stringify({ prompt, size: '1536x1024' }),
    });
    const j = await res.json().catch(() => ({}));
    return j?.imageUrl || null;
  } catch (e) {
    log(`    ⚠️ image : ${String(e.message).slice(0, 120)}`);
    return null;
  }
}

/* ── Fabrication d'un cours ──────────────────────────────────────────────────────────────── */
async function buildCourse(src) {
  // ── A ──────────────────────────────────────────────────────────────────────────────────
  log('  A. analyse doctrinale…');
  const analyse = await llm(SYS_A,
    `TITRE TIKTOK : ${src.title || '(sans titre)'}\n\nTRANSCRIPTION :\n${src.transcript}`,
    { maxTokens: 12000, temperature: 0.3, label: 'A' });
  if (analyse?.enseignement === false) return { skip: 'non-enseignement (analyse)' };
  log(`     thèse : « ${str(analyse?.these, 90)}… » · ${(analyse?.chaine_arguments || []).length} argument(s) · ${(analyse?.symboles || []).length} symbole(s)`);

  // ── B ──────────────────────────────────────────────────────────────────────────────────
  log('  B. architecture du cours…');
  const archi = await llm(SYS_B, `ANALYSE DOCTRINALE :\n${JSON.stringify(analyse, null, 1)}`,
    { maxTokens: 10000, temperature: 0.4, label: 'B' });
  const plan = (Array.isArray(archi?.concepts) ? archi.concepts : []).slice(0, 3);
  if (!plan.length) return { skip: 'architecture vide' };
  log(`     ${plan.length} concept(s) : ${plan.map((c) => `« ${str(c.titre, 40)} »`).join(' · ')}`);

  // ── C + D (par concept) ────────────────────────────────────────────────────────────────
  const concepts = [];
  for (let i = 0; i < plan.length; i += 1) {
    const p = plan[i];
    log(`  C${i + 1}. rédaction « ${str(p.titre, 50)} »…`);
    const red = await llm(SYS_C,
      `CONTEXTE DOCTRINAL :\n${JSON.stringify({ these: analyse.these, symboles: analyse.symboles, termes: analyse.termes_techniques, citations: analyse.citations_fortes }, null, 1)}\n\n`
      + `CONCEPT À RÉDIGER :\n${JSON.stringify(p, null, 1)}`,
      { maxTokens: 14000, temperature: 0.6, label: `C${i + 1}` });

    const rawScenes = Array.isArray(red?.scenes) ? red.scenes : [];
    const scenes = [];
    let mainSketch = null; let revealSketch = null; let mainSketchNarration = '';

    // D — croquis principal
    if (p.croquis_doit_montrer) {
      log(`  D${i + 1}. croquis : « ${str(p.croquis_doit_montrer, 60)}… »`);
      const sk = await llm(SYS_D,
        `CE QUE LE CROQUIS DOIT DÉMONTRER :\n${p.croquis_doit_montrer}\n\n`
        + `SYMBOLE À NOMMER SUR LE DESSIN : ${p.symbole_a_expliquer || '(aucun)'}\n`
        + `IDÉE MAÎTRESSE : ${p.idee_maitresse}\n\n`
        + `EXEMPLES DE CROQUIS DU FONDATEUR (niveau de richesse et de clarté attendu) :\n${JSON.stringify(CANON_SKETCHES, null, 1)}`,
        { maxTokens: 9000, temperature: 0.4, label: `D${i + 1}` });
      mainSketch = sanitizeSketch(sk);
      mainSketchNarration = str(sk?.narration, 900);
      if (!mainSketch) {
        // Diagnostic honnête : on montre ce que l'IA a renvoyé plutôt que de deviner.
        const els = Array.isArray(sk?.elements) ? sk.elements : (Array.isArray(sk?.sketch?.elements) ? sk.sketch.elements : null);
        log(`      🔎 croquis rejeté — clés=${Object.keys(sk || {}).join(',')} · elements=${els ? els.length : 'absent'}`
          + (els && els[0] ? ` · 1er=${JSON.stringify(els[0]).slice(0, 160)}` : ''));
        // Tolérance : certaines IA emballent dans {"sketch":{…}} → on déballe et on re-tente.
        if (sk?.sketch) { mainSketch = sanitizeSketch(sk.sketch); if (mainSketch) log('      ↩︎ déballé depuis {sketch:…}'); }
      }
      if (mainSketch) {
        const nLab = mainSketch.elements.filter((e) => e.label).length;
        log(`      → ${mainSketch.elements.length} éléments · ${nLab} étiquetés · ${[...new Set(mainSketch.elements.map((e) => e.kind))].join(', ')}`);
        if (nLab < 3) log('      ⚠️ croquis peu bavard (<3 labels) — il explique mal');
      }
    }
    // D — croquis de révélation
    if (p.reveal_doit_montrer) {
      const sk2 = await llm(SYS_D,
        `CE QUE CE CROQUIS DE RÉVÉLATION DOIT MONTRER (il vient APRÈS la réponse de l'élève, il conclut) :\n${p.reveal_doit_montrer}\n\n`
        + `IDÉE MAÎTRESSE : ${p.idee_maitresse}\n\nEXEMPLES :\n${JSON.stringify(CANON_SKETCHES, null, 1)}`,
        { maxTokens: 9000, temperature: 0.4, label: `D${i + 1}b` });
      revealSketch = sanitizeSketch(sk2);
    }

    for (const s of rawScenes) {
      const type = String(s?.type || '');
      if (type === 'croquis_placeholder') {
        if (mainSketch) scenes.push({ type: 'croquis', narration: mainSketchNarration || str(s.narration) || 'Regarde bien.', sketch: mainSketch });
        continue;
      }
      if (type === 'lecon') {
        const narration = str(s.narration) || str(s.board_text);
        if (narration) scenes.push({ type: 'lecon', ...(s.title ? { title: str(s.title, 120) } : {}), board_text: str(s.board_text) || narration, narration });
        continue;
      }
      if (type === 'atelier') {
        const question = str(s.question, 400); if (!question) continue;
        const lst = (a, fb) => { const o = (Array.isArray(a) ? a : []).map((x) => str(x, 120)).filter(Boolean).slice(0, 10); return o.length ? o : fb; };
        scenes.push({
          type: 'atelier', address: '{{student_name}}', question,
          ...(s.hint ? { hint: str(s.hint, 300) } : {}),
          expected_answers: lst(s.expected_answers, ['(réponse fidèle à la leçon)']),
          expected_errors: lst(s.expected_errors, ['réponse hors du cadre de la leçon']),
          ack_variants: DEFAULT_ACK,
          reveal_narration: str(s.reveal_narration) || 'Voyons cela ensemble.',
          ...(revealSketch ? { reveal_sketch: revealSketch } : {}),
        });
        continue;
      }
      if (type === 'image_analogie') {
        const analogie = str(s.analogie, 600) || str(s.narration, 600); if (!analogie) continue;
        scenes.push({ type: 'image_analogie', analogie,
          ...(s.image_prompt ? { image_prompt: str(s.image_prompt, 1400) } : {}),
          narration: str(s.narration) || analogie });
        continue;
      }
      if (type === 'amorce_croquis' || type === 'transition') {
        const narration = str(s.narration);
        if (narration) scenes.push({ type, narration });
      }
    }
    // Amorce orpheline (le croquis a été jeté) → on la retire.
    const kept = scenes.some((s) => s.type === 'croquis') ? scenes : scenes.filter((s) => s.type !== 'amorce_croquis');
    if (!kept.some((s) => s.type === 'lecon')) continue;
    const abs = String(p.abstraction || '').toLowerCase();
    concepts.push({
      id: `c${concepts.length + 1}`,
      title: str(p.titre, 120) || `Concept ${i + 1}`,
      ...(p.objectif ? { objectif: str(p.objectif, 300) } : {}),
      ...(ABSTRACTIONS.has(abs) ? { abstraction: abs } : {}),
      scenes: kept,
      ...(p.transition_next ? { transition_next: str(p.transition_next, 400) } : {}),
    });
  }
  if (!concepts.length) return { skip: 'aucun concept rédigeable' };

  const course = {
    title: str(archi?.titre_cours, 140) || str(analyse?.titre_pressenti, 140) || src.title || 'Cours du Précepteur',
    language: 'fr', level: 'initiation', concepts,
  };

  // ── E — images réelles ────────────────────────────────────────────────────────────────
  if (WITH_IMAGES) {
    for (const c of course.concepts) {
      for (const s of c.scenes) {
        if (s.type === 'image_analogie' && s.image_prompt) {
          log('  E. génération de l’image…');
          const u = await generateImage(s.image_prompt);
          if (u) { s.image_url = u; log(`     → ${String(u).slice(0, 70)}…`); }
        }
      }
    }
  }

  // ── F — manuel ────────────────────────────────────────────────────────────────────────
  log('  F. manuel d’enseignement…');
  const man = await llm(
    `Tu rédiges le MANUEL D'ENSEIGNEMENT du professeur pour ce cours (markdown, français, dense et utile).
Sections : ## Objectifs pédagogiques / ## Plan du cours / ## Argumentation détaillée (la démonstration pas à pas, avec les citations exactes du fondateur) / ## Symboles et leur sens / ## Ateliers & corrigés / ## Erreurs fréquentes des élèves / ## Objections à anticiper / ## Prolongements.
JSON STRICT : {"manual_md":"…"}`,
    `ANALYSE :\n${JSON.stringify(analyse, null, 1)}\n\nCOURS RÉDIGÉ :\n${JSON.stringify(course, null, 1)}`,
    { maxTokens: 12000, temperature: 0.4, label: 'F' });

  return { course, manual: str(man?.manual_md, 30000), analyse };
}

/* ── Audit final (juge de conformité) ────────────────────────────────────────────────────── */
async function audit(course) {
  try {
    const mod = await import(path.join(ROOT, 'apps/app/src/lib/precepteur/conformCourse.js'));
    const rep = mod.auditCourse(course);
    return { score: rep?.score, findings: (rep?.findings || []).map((f) => f.code) };
  } catch (e) { return { error: String(e.message).slice(0, 120) }; }
}

/* ── Boucle ──────────────────────────────────────────────────────────────────────────────── */
const where = IDS.length
  ? `and s.external_id in (${IDS.map((x) => q(x)).join(',')})`
  : `and s.status='transcribed' and not exists (select 1 from precepteur_courses pc where pc.source_id = s.id)`;
const rows = sql(`select s.id, s.external_id, s.title, s.transcript_text from precepteur_sources s
                  where s.tenant_id=${q(TENANT_ID)}::uuid ${where}
                  order by length(coalesce(s.transcript_text,'')) desc limit ${IDS.length || LIMIT};`)
  .split('\n').filter(Boolean).map((l) => {
    const i1 = l.indexOf('|'); const i2 = l.indexOf('|', i1 + 1); const i3 = l.indexOf('|', i2 + 1);
    return { id: l.slice(0, i1), ext: l.slice(i1 + 1, i2), title: l.slice(i2 + 1, i3), transcript: l.slice(i3 + 1) };
  });

log(`▶️  GÉNÉRATEUR APPROFONDI — ${rows.length} vidéo(s)${WITH_IMAGES ? ' · images RÉELLES' : ''}`);
for (const r of rows) {
  log(`\n━━ ${r.ext} — « ${str(r.title, 60)} » (${(r.transcript || '').length} c.)`);
  try {
    if ((r.transcript || '').length < 400) { log('  ⏭️  transcription trop courte.'); continue; }
    const out = await buildCourse(r);
    if (out.skip) {
      sql(`update precepteur_sources set status='skipped', error_message=${q(out.skip)}, updated_at=now() where id=${q(r.id)}::uuid;`);
      log(`  ⏭️  ${out.skip}`);
      continue;
    }
    const a = await audit(out.course);
    if (REPLACE) sql(`delete from precepteur_courses where source_id=${q(r.id)}::uuid;`);
    sql(`insert into precepteur_courses (tenant_id, source_id, title, course, manual_md, model)
         values (${q(TENANT_ID)}::uuid, ${q(r.id)}::uuid, ${q(out.course.title)},
                 ${q(JSON.stringify(out.course))}::jsonb, ${q(out.manual)}, 'deep-v3:deepseek-v4-pro');`);
    sql(`update precepteur_sources set status='generated', error_message=null, updated_at=now() where id=${q(r.id)}::uuid;`);
    const sc = out.course.concepts.flatMap((c) => c.scenes);
    const cro = sc.filter((s) => s.type === 'croquis');
    log(`  ✅ « ${out.course.title} » — ${out.course.concepts.length} concept(s) · ${sc.filter((s) => s.type === 'lecon').length} leçons`
      + ` · ${cro.length} croquis (${cro.reduce((n, s) => n + s.sketch.elements.length, 0)} éléments)`
      + ` · manuel ${out.manual.length} c. · audit ${a.score ?? '?'}/100${a.findings?.length ? ` (${a.findings.slice(0, 3).join(',')})` : ''}`);
  } catch (e) {
    const msg = String(e?.message || e).slice(0, 300);
    sql(`update precepteur_sources set error_message=${q(msg)}, updated_at=now() where id=${q(r.id)}::uuid;`);
    log(`  ❌ ${msg.slice(0, 160)}`);
  }
}
