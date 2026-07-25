/**
 * 03-generate.mjs — L'AGENT PRÉCEPTEUR-AUTEUR (v2 — schéma CANONIQUE COMPLET).
 *
 * v1 s'appuyait sur `fromMasterclass.js` (qui OMET volontairement les croquis) → les cours
 * générés n'avaient ni géométrie, ni hint/reveal_sketch, ni image_prompt : ~60 % du schéma.
 * v2 prend pour référence LE COURS MODÈLE du fondateur — `apps/app/src/pages/dev/
 * precepteurCanonicalCourse.js` (« Le temps courbé par l'espace ») — injecté en FEW-SHOT,
 * et produit le schéma entier :
 *   racine   { title, language, level, concepts[] }
 *   concept  { id, title, objectif, abstraction, scenes[], transition_next }
 *   scènes   lecon(title, board_text, narration) ×1-2
 *            → amorce_croquis(narration)
 *            → croquis(narration, sketch{caption, elements[]})        ← LA SIGNATURE
 *            → atelier(question, hint, expected_*, ack_variants, reveal_narration, reveal_sketch)
 *            → image_analogie(analogie, image_prompt, analogy_anim, animated_example, narration)
 *            → transition(narration)
 * + MANUEL D'ENSEIGNEMENT (markdown).
 *
 * INVARIANT SACRÉ : `SketchRenderer` lit `el.from[0]` / `el.center[0]` SANS garde → un élément
 * mal formé CRASHE le rendu. `sanitizeSketch` ci-dessous est le MIROIR EXACT de
 * `enrichCroquis.isValidElement` (vocabulaire fermé) : tout élément non conforme est jeté, et
 * une scène croquis sans élément valide est SUPPRIMÉE (jamais de croquis vide).
 *
 * LLM : DeepSeek `deepseek-v4-pro` → repli Groq `llama-3.3-70b-versatile`.
 * Usage : node tools/precepteur-tiktok/03-generate.mjs [--limit N]
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql, q, TENANT_ID, ENV, log } from './common.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const limit = (() => { const i = process.argv.indexOf('--limit'); return i > -1 ? Number(process.argv[i + 1]) : 2; })();

/* ── Cours MODÈLE chargé depuis la source (reste en phase si le fondateur l'édite) ────────── */
function loadCanonicalCourse() {
  try {
    const src = readFileSync(path.join(ROOT, 'apps/app/src/pages/dev/precepteurCanonicalCourse.js'), 'utf8');
    // `export const CANONICAL_COURSE = {…};` → objet évalué (fichier de données, pas de code exécutable).
    const m = src.match(/export\s+const\s+CANONICAL_COURSE\s*=\s*(\{[\s\S]*?\});?\s*$/);
    if (!m) return null;
    // eslint-disable-next-line no-new-func
    return Function(`"use strict"; return (${m[1]});`)();
  } catch (e) {
    log(`  ⚠️ cours modèle illisible (${String(e.message).slice(0, 80)}) — few-shot dégradé`);
    return null;
  }
}
const CANON = loadCanonicalCourse();

/* ── Vocabulaires FERMÉS (miroirs du renderer) ───────────────────────────────────────────── */
const CENTER_KINDS = new Set(['point', 'circle', 'spiral', 'axis', 'label']);   // → center[x,y]
const SEGMENT_KINDS = new Set(['vector', 'arrow', 'line', 'curve']);            // → from[x,y]+to[x,y]
const ANIM_SUBJECTS = new Set(['earth_orbit', 'galaxy_spin', 'orbit_generic', 'bird_tethered']);
const COLORS = new Set(['blue', 'amber', 'green', 'red', 'white', 'slate']);
const ABSTRACTIONS = new Set(['high', 'medium', 'low']);

const SYSTEM = `Tu es LE PRÉCEPTEUR de l'école Prorascience (fondateur : Ngowazulu — « de la prophétie à la science »).
On te donne la TRANSCRIPTION BRUTE d'une vidéo d'enseignement du fondateur (orale, parfois bruitée par la retranscription).
Tu en fais un COURS ENSEIGNÉ complet + un MANUEL D'ENSEIGNEMENT, au FORMAT EXACT du cours modèle qu'on te montre.

━━ FIDÉLITÉ (règle absolue) ━━
Tu STRUCTURES et CLARIFIES l'enseignement du fondateur. Tu n'inventes JAMAIS de doctrine, jamais de
notion qu'il n'a pas dite. Transcription bruitée → reconstruis le sens le plus probable à partir de
SES mots, sans rien ajouter d'étranger. Si la vidéo n'est pas un enseignement (pub, annonce, musique,
salutation) → "topic_ok": false et rien d'autre.

━━ LA VOIX (imite exactement le cours modèle) ━━
Oral complice, tutoiement, phrases courtes, respirations « … », interpellations directes.
Marqueurs du fondateur : « Bon… commençons par », « en vrai, c'est quoi ? », « Et là, écoute bien : »,
« tu vois ? », « Mais attends… », « Réfléchis avec moi : », « Eh bien voilà : », « retiens bien ça ».
DEUX registres à ne jamais confondre :
  • board_text = ce qui s'ÉCRIT au tableau — dense, affirmatif, définitionnel.
  • narration  = ce qui se DIT — la même idée déroulée, respirée, avec les marqueurs ci-dessus.
JAMAIS la même phrase copiée dans les deux.

━━ LE CROQUIS (c'est la signature du Précepteur — ne le saute jamais sur un concept abstrait) ━━
Géométrie RÉELLE dans un repère 0..100 (x vers la droite, y vers le BAS).
Deux familles, vocabulaire FERMÉ :
  • segment → {"kind":"vector|arrow|line|curve","from":[x,y],"to":[x,y]}
  • centré  → {"kind":"point|circle|spiral|axis|label","center":[x,y]}  (+ "radius", "turns" pour spiral)
Champs communs : "color" (blue|amber|green|red|white|slate), "label" (MAJUSCULE courte), "labelSide" ("above"|"below"), "order" (1,2,3… = tracé pas-à-pas).
RÈGLE : 1 idée = 1 croquis (2 à 4 éléments, jamais plus). Le croquis doit MONTRER la tension/le mécanisme,
pas décorer. Si tu ne peux pas dessiner l'idée honnêtement, n'émets pas de scène croquis.

━━ DOSAGE (cahier de charge) ━━
Concept ABSTRAIT ("abstraction":"high") → il DOIT avoir croquis + atelier + image_analogie.
Concept simple ("low") → lecon + image_analogie suffisent.
Séquence de référence : lecon (×1-2) → amorce_croquis → croquis → atelier → image_analogie → transition.

━━ L'IMAGE ━━
"image_prompt" = prompt d'image cinématographique DÉTAILLÉ (sujet en action, tension visible, lumière,
cadrage), qui rend l'analogie VISIBLE. Toujours finir par « Sujet clair et lisible, pas de texte. »
"analogy_anim" et "animated_example.subject" : UNIQUEMENT parmi earth_orbit | galaxy_spin | orbit_generic | bird_tethered
(omets le champ si aucun ne colle — n'invente pas de clé).

Réponds en JSON STRICT, rien hors JSON :
{
 "title":"titre du cours, court et évocateur",
 "topic_ok":true,
 "level":"initiation",
 "concepts":[{
   "title":"titre du concept",
   "objectif":"ce que l'élève doit comprendre à la fin",
   "abstraction":"high|medium|low",
   "scenes":[
     {"type":"lecon","title":"…","board_text":"l'énoncé écrit, dense","narration":"la même idée DITE, déroulée"},
     {"type":"amorce_croquis","narration":"« … on va faire un petit croquis ensemble. »"},
     {"type":"croquis","narration":"ce que le prof dit EN traçant","sketch":{"caption":"…","elements":[{"kind":"vector","from":[26,64],"to":[80,30],"color":"blue","label":"…","labelSide":"above","order":1}]}},
     {"type":"atelier","question":"question qui fait CHERCHER","hint":"coup de pouce sans donner la réponse","expected_answers":["mot-clé attendu","…"],"expected_errors":["erreur fréquente","…"],"reveal_narration":"la révélation du prof, développée","reveal_sketch":{"caption":"…","elements":[…]}},
     {"type":"image_analogie","analogie":"l'analogie en une phrase","image_prompt":"…","analogy_anim":"bird_tethered","animated_example":{"subject":"earth_orbit","caption":"…"},"narration":"…"},
     {"type":"transition","narration":"pont vers la suite"}
   ],
   "transition_next":"amorce du concept suivant"
 }],
 "manual_md":"MANUEL en markdown : ## Objectifs pédagogiques / ## Plan du cours / ## Points clés (avec les formules exactes du fondateur) / ## Ateliers & corrigés / ## Erreurs fréquentes des élèves / ## Prolongements"
}`;

/** Few-shot : le cours modèle en entier (c'est LUI qui fixe le niveau attendu). */
function fewShot() {
  if (!CANON) return '';
  return `\n━━━━━━ COURS MODÈLE DU FONDATEUR (le niveau à atteindre — imite sa structure ET sa voix) ━━━━━━\n${JSON.stringify(CANON, null, 1)}\n━━━━━━ fin du modèle ━━━━━━\n`;
}

async function callLLM(userMsg) {
  const tries = [
    { name: 'deepseek', url: 'https://api.deepseek.com/chat/completions', key: ENV.DEEPSEEK_API_KEY, model: 'deepseek-v4-pro' },
    { name: 'groq', url: 'https://api.groq.com/openai/v1/chat/completions', key: ENV.GROQ_API_KEY, model: 'llama-3.3-70b-versatile' },
  ];
  for (const t of tries) {
    if (!t.key) continue;
    try {
      // Groq plafonne la taille de requête (413) → on lui envoie le message SANS le few-shot.
      const msg = t.name === 'groq' ? userMsg.replace(/━━━━━━ COURS MODÈLE[\s\S]*?fin du modèle ━━━━━━\n/, '') : userMsg;
      const res = await fetch(t.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t.key}` },
        body: JSON.stringify({
          model: t.model,
          messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: msg }],
          temperature: 0.5,
          response_format: { type: 'json_object' },
          max_tokens: t.name === 'groq' ? 6000 : 16000,
        }),
      });
      if (!res.ok) throw new Error(`${t.name} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const j = await res.json();
      return { model: `${t.name}:${t.model}`, data: JSON.parse(j?.choices?.[0]?.message?.content || '{}') };
    } catch (e) {
      log(`  ⚠️ ${t.name} → ${String(e.message).slice(0, 140)}`);
    }
  }
  throw new Error('tous les LLM ont échoué');
}

const DEFAULT_ACK = {
  ok: ['Exactement.', 'Tu y es.', 'C’est ça même.', 'Voilà.'],
  partial: ['Presque — pousse d’un cran.', 'Tu tiens un bout du fil…', 'Bonne direction.'],
  wrong: ['Pas tout à fait.', 'Regarde mieux le croquis.', 'Non — mais l’erreur est instructive.'],
};
const SCENE_TYPES = new Set(['lecon', 'amorce_croquis', 'croquis', 'image_analogie', 'atelier', 'transition']);

const str = (v, max = 4000) => String(v ?? '').trim().slice(0, max);
/** Paire de coordonnées finies, ramenée dans le repère 0..100. */
function coordPair(p) {
  if (!Array.isArray(p) || p.length < 2) return null;
  const x = Number(p[0]); const y = Number(p[1]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const clamp = (n) => Math.max(0, Math.min(100, Math.round(n * 10) / 10));
  return [clamp(x), clamp(y)];
}

/**
 * MIROIR EXACT de `enrichCroquis.isValidElement` : seul le vocabulaire fermé passe, avec la
 * géométrie que `SketchRenderer` lit sans garde. Tout le reste est jeté (jamais de crash).
 */
function sanitizeElement(el) {
  if (!el || typeof el !== 'object') return null;
  const kind = String(el.kind || '').toLowerCase();
  const common = {
    ...(el.color && COLORS.has(String(el.color).toLowerCase()) ? { color: String(el.color).toLowerCase() } : {}),
    ...(el.label ? { label: str(el.label, 60) } : {}),
    ...(el.labelSide === 'above' || el.labelSide === 'below' ? { labelSide: el.labelSide } : {}),
    ...(Number.isFinite(Number(el.order)) ? { order: Math.round(Number(el.order)) } : {}),
  };
  if (CENTER_KINDS.has(kind)) {
    const center = coordPair(el.center);
    if (!center) return null;
    return {
      kind, center, ...common,
      ...(Number.isFinite(Number(el.radius)) ? { radius: Math.max(1, Math.min(50, Number(el.radius))) } : {}),
      ...(Number.isFinite(Number(el.turns)) ? { turns: Math.max(0.5, Math.min(6, Number(el.turns))) } : {}),
    };
  }
  if (SEGMENT_KINDS.has(kind)) {
    const from = coordPair(el.from); const to = coordPair(el.to);
    if (!from || !to) return null;
    return { kind, from, to, ...common };
  }
  return null; // hors vocabulaire fermé → rejeté
}

/** Sketch sûr, ou null si plus rien d'exploitable (→ la scène croquis sera supprimée). */
function sanitizeSketch(sk) {
  if (!sk || typeof sk !== 'object' || !Array.isArray(sk.elements)) return null;
  const elements = sk.elements.map(sanitizeElement).filter(Boolean).slice(0, 6);
  if (!elements.length) return null;
  return { ...(sk.caption ? { caption: str(sk.caption, 140) } : {}), elements };
}

function sanitizeScene(s) {
  if (!s || !SCENE_TYPES.has(s.type)) return null;
  switch (s.type) {
    case 'lecon': {
      const narration = str(s.narration) || str(s.board_text);
      if (!narration) return null;
      return {
        type: 'lecon',
        ...(s.title ? { title: str(s.title, 120) } : {}),
        board_text: str(s.board_text) || narration,
        narration,
      };
    }
    case 'croquis': {
      const sketch = sanitizeSketch(s.sketch);
      if (!sketch) return null; // INVARIANT : jamais de croquis sans géométrie valide
      return { type: 'croquis', narration: str(s.narration) || 'Regarde bien.', sketch };
    }
    case 'atelier': {
      const question = str(s.question, 400);
      if (!question) return null;
      const list = (a, fb) => {
        const out = (Array.isArray(a) ? a : []).map((x) => str(x, 120)).filter(Boolean).slice(0, 10);
        return out.length ? out : fb;
      };
      const revealSketch = sanitizeSketch(s.reveal_sketch);
      return {
        type: 'atelier',
        address: '{{student_name}}',
        question,
        ...(s.hint ? { hint: str(s.hint, 300) } : {}),
        expected_answers: list(s.expected_answers, ['(réponse fidèle à la leçon)']),
        expected_errors: list(s.expected_errors, ['réponse hors du cadre de la leçon']),
        ack_variants: DEFAULT_ACK,
        reveal_narration: str(s.reveal_narration) || 'Voyons cela ensemble.',
        ...(revealSketch ? { reveal_sketch: revealSketch } : {}),
      };
    }
    case 'image_analogie': {
      const analogie = str(s.analogie, 600) || str(s.narration, 600);
      if (!analogie) return null;
      const anim = String(s.analogy_anim || '').toLowerCase();
      const ex = s.animated_example && typeof s.animated_example === 'object' ? s.animated_example : null;
      const exSubject = String(ex?.subject || '').toLowerCase();
      return {
        type: 'image_analogie',
        analogie,
        ...(s.image_prompt ? { image_prompt: str(s.image_prompt, 1200) } : {}),
        ...(ANIM_SUBJECTS.has(anim) ? { analogy_anim: anim } : {}),
        ...(ANIM_SUBJECTS.has(exSubject)
          ? { animated_example: { subject: exSubject, ...(ex.caption ? { caption: str(ex.caption, 300) } : {}) } }
          : {}),
        narration: str(s.narration) || analogie,
      };
    }
    default: { // amorce_croquis | transition
      const narration = str(s.narration);
      return narration ? { type: s.type, narration } : null;
    }
  }
}

/** Schéma canonique garanti + invariants de rendu. */
function sanitizeCourse(raw, fallbackTitle) {
  const concepts = (Array.isArray(raw?.concepts) ? raw.concepts : []).slice(0, 4).map((c, ci) => {
    let scenes = (Array.isArray(c?.scenes) ? c.scenes : []).map(sanitizeScene).filter(Boolean);
    // Une amorce_croquis dont le croquis a été jeté devient orpheline (code AMORCE_ORPHELINE du juge).
    if (!scenes.some((s) => s.type === 'croquis')) scenes = scenes.filter((s) => s.type !== 'amorce_croquis');
    if (!scenes.some((s) => s.type === 'lecon')) return null; // un concept sans leçon n'enseigne rien
    const abstraction = String(c?.abstraction || '').toLowerCase();
    return {
      id: `c${ci + 1}`,
      title: str(c?.title, 120) || `Concept ${ci + 1}`,
      ...(c?.objectif ? { objectif: str(c.objectif, 300) } : {}),
      ...(ABSTRACTIONS.has(abstraction) ? { abstraction } : {}),
      scenes,
      ...(c?.transition_next ? { transition_next: str(c.transition_next, 400) } : {}),
    };
  }).filter(Boolean);
  return {
    title: str(raw?.title, 140) || fallbackTitle || 'Cours du Précepteur',
    language: 'fr',
    level: str(raw?.level, 40) || 'initiation',
    concepts,
  };
}

/** Rapport de richesse — ce que le cours contient vraiment (pour le journal). */
function richness(course) {
  const all = course.concepts.flatMap((c) => c.scenes);
  const n = (t) => all.filter((s) => s.type === t).length;
  const croquis = all.filter((s) => s.type === 'croquis');
  const elements = croquis.reduce((acc, s) => acc + (s.sketch?.elements?.length || 0), 0);
  return `${course.concepts.length} concept(s) · ${n('lecon')} leçon(s) · ${croquis.length} croquis (${elements} él.)`
    + ` · ${n('atelier')} atelier(s) · ${n('image_analogie')} image(s)`
    + `${all.some((s) => s.reveal_sketch) ? ' · reveal_sketch ✓' : ''}`
    + `${all.some((s) => s.image_prompt) ? ' · image_prompt ✓' : ''}`;
}

/* ── Boucle ──────────────────────────────────────────────────────────────────────────────── */
const rows = sql(`select s.id, s.external_id, s.title, s.transcript_text from precepteur_sources s
                  where s.tenant_id=${q(TENANT_ID)}::uuid and s.status='transcribed'
                    and not exists (select 1 from precepteur_courses pc where pc.source_id = s.id)
                  order by s.created_at asc limit ${limit};`)
  .split('\n').filter(Boolean).map((l) => {
    const i1 = l.indexOf('|'); const i2 = l.indexOf('|', i1 + 1); const i3 = l.indexOf('|', i2 + 1);
    return { id: l.slice(0, i1), ext: l.slice(i1 + 1, i2), title: l.slice(i2 + 1, i3), transcript: l.slice(i3 + 1) };
  });
log(`${rows.length} transcription(s) → cours${CANON ? ` (few-shot : « ${CANON.title} »)` : ' (SANS few-shot ⚠️)'}.`);

for (const r of rows) {
  try {
    const user = `${fewShot()}\nTITRE/LÉGENDE TIKTOK : ${r.title || '(sans titre)'}\n\nTRANSCRIPTION DE LA VIDÉO :\n${r.transcript}`;
    const { model, data } = await callLLM(user);
    if (data?.topic_ok === false) {
      sql(`update precepteur_sources set status='skipped', error_message='non-enseignement (topic_ok=false)', updated_at=now() where id=${q(r.id)}::uuid;`);
      log(`⏭️  ${r.ext} — non-enseignement, ignoré.`);
      continue;
    }
    const course = sanitizeCourse(data, r.title);
    if (!course.concepts.length) {
      try {
        const dbg = `${process.env.TMPDIR || '/tmp'}/precepteur-raw-${r.ext}.json`;
        (await import('node:fs')).writeFileSync(dbg, JSON.stringify(data, null, 2));
        log(`  🔎 brut sauvegardé : ${dbg} — clés=${Object.keys(data || {}).join(',')} concepts=${Array.isArray(data?.concepts) ? data.concepts.length : 'n/a'}`);
      } catch { /* noop */ }
      throw new Error('cours vide après sanitize');
    }
    const manual = str(data?.manual_md, 20000);
    sql(`insert into precepteur_courses (tenant_id, source_id, title, course, manual_md, model)
         values (${q(TENANT_ID)}::uuid, ${q(r.id)}::uuid, ${q(course.title)}, ${q(JSON.stringify(course))}::jsonb, ${q(manual)}, ${q(model)});`);
    sql(`update precepteur_sources set status='generated', error_message=null, updated_at=now() where id=${q(r.id)}::uuid;`);
    log(`✅ ${r.ext} → « ${course.title} » — ${richness(course)} · manuel ${manual.length} c. · ${model}`);
  } catch (e) {
    const msg = String(e?.message || e).slice(0, 300);
    sql(`update precepteur_sources set error_message=${q(msg)}, updated_at=now() where id=${q(r.id)}::uuid;`);
    log(`❌ ${r.ext} — ${msg.slice(0, 140)}`);
  }
}
log('État →', sql(`select status||':'||count(*) from precepteur_sources where tenant_id=${q(TENANT_ID)}::uuid group by status order by 1;`).replace(/\n/g, '  '),
  '· cours :', sql(`select count(*) from precepteur_courses where tenant_id=${q(TENANT_ID)}::uuid;`));
