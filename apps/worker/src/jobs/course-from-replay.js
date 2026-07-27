/**
 * course-from-replay.js — REPLAY → COURS ENSEIGNABLE (poller worker).
 *
 * Consomme `course_generation_jobs` (créés par l'API depuis la Vidéothèque) et déroule
 * la chaîne complète, sans intervention :
 *   1. EXTRACTION  — transcription brute → document dense (vides, redites et incidents
 *      retirés ; jusqu'à 230 000 car. ramenés sous le plafond d'analyse) ;
 *   2. PLAN        — notions ordonnées du simple au complexe + glossaire des termes ;
 *   3. LEÇONS      — trame d'ingénierie pédagogique (amorce → intuition → définition →
 *      schéma → exemple → contre-exemple → erreur fréquente → expérience de pensée →
 *      mise en situation → je retiens → quiz corrigé), avec CONTRÔLE ANTI-COPIE ;
 *   4. PUBLICATION — formation en brouillon (modules → semaines → jours → contenus).
 *
 * Le cours n'est JAMAIS publié aux élèves : il arrive en brouillon au poste production.
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || '';
const MODEL = process.env.COURSE_ENGINE_MODEL || 'deepseek-v4-pro';
const MAX_DOC = 40000;
const WINDOW = 18000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── LLM ─────────────────────────────────────────────────────────────────────
async function llm(system, user, { maxTokens = 12000, temp = 0.35, json = true } = {}) {
  for (let a = 0; a < 4; a++) {
    try {
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${DEEPSEEK_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
          max_tokens: maxTokens, temperature: temp,
          ...(json ? { response_format: { type: 'json_object' } } : {}),
        }),
      });
      const j = await res.json();
      const txt = j?.choices?.[0]?.message?.content?.trim();
      if (txt) return json ? JSON.parse(txt.replace(/^```json\s*|```$/g, '')) : txt;
    } catch { /* retry */ }
    await sleep(2500 * (a + 1));
  }
  return null;
}

// ── Anti-copie (8-grammes partagés avec la source) ──────────────────────────
const grams = (s, n = 8) => {
  const w = String(s || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  const out = new Set();
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(' '));
  return out;
};
const copyRate = (text, src) => {
  const g = grams(text);
  if (!g.size) return 0;
  let hit = 0;
  for (const x of g) if (src.has(x)) hit++;
  return hit / g.size;
};

// ── Schémas (gabarits SVG : le LLM ne fournit que les libellés) ─────────────
const CO = { ink: '#f4efe6', terra: '#d97757', gold: '#e6cc92' };
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const SCHEMAS = {
  triangle: ({ titre, a, b, c, centre }) => `<svg viewBox="0 0 420 320" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(titre)}"><text x="210" y="22" text-anchor="middle" fill="${CO.gold}" font-size="15" font-weight="700">${esc(titre)}</text><polygon points="210,60 360,255 60,255" fill="none" stroke="${CO.terra}" stroke-width="2"/><circle cx="210" cy="60" r="6" fill="${CO.terra}"/><circle cx="360" cy="255" r="6" fill="${CO.terra}"/><circle cx="60" cy="255" r="6" fill="${CO.terra}"/><text x="210" y="46" text-anchor="middle" fill="${CO.ink}" font-size="14">${esc(a)}</text><text x="376" y="278" text-anchor="end" fill="${CO.ink}" font-size="14">${esc(b)}</text><text x="44" y="278" text-anchor="start" fill="${CO.ink}" font-size="14">${esc(c)}</text>${centre ? `<circle cx="210" cy="190" r="36" fill="rgba(217,119,87,0.14)" stroke="${CO.gold}" stroke-width="1.5"/><text x="210" y="195" text-anchor="middle" fill="${CO.gold}" font-size="12.5" font-weight="600">${esc(centre)}</text>` : ''}</svg>`,
  chaine: ({ titre, etapes = [] }) => {
    const list = etapes.slice(0, 4); const n = Math.max(list.length, 1); const w = 430 / n;
    return `<svg viewBox="0 0 450 165" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(titre)}"><text x="225" y="22" text-anchor="middle" fill="${CO.gold}" font-size="15" font-weight="700">${esc(titre)}</text><defs><marker id="ar" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0 0 L9 4.5 L0 9 z" fill="${CO.gold}"/></marker></defs>${list.map((e, i) => { const x = 8 + i * w; const bw = w - 26; return `<rect x="${x}" y="58" width="${bw}" height="62" rx="12" fill="rgba(217,119,87,0.10)" stroke="${CO.terra}" stroke-width="1.5"/><text x="${x + bw / 2}" y="92" text-anchor="middle" fill="${CO.ink}" font-size="11.5">${esc(String(e).slice(0, 22))}</text>${i < list.length - 1 ? `<path d="M${x + bw + 3} 89 L${x + w - 4} 89" stroke="${CO.gold}" stroke-width="2" marker-end="url(#ar)"/>` : ''}`; }).join('')}</svg>`;
  },
  comparaison: ({ titre, gauche_titre, gauche = [], droite_titre, droite = [] }) => `<svg viewBox="0 0 450 250" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(titre)}"><text x="225" y="22" text-anchor="middle" fill="${CO.gold}" font-size="15" font-weight="700">${esc(titre)}</text><rect x="10" y="40" width="205" height="196" rx="14" fill="rgba(122,181,122,0.07)" stroke="rgba(122,181,122,0.45)" stroke-width="1.5"/><rect x="235" y="40" width="205" height="196" rx="14" fill="rgba(217,119,87,0.07)" stroke="${CO.terra}" stroke-width="1.5"/><text x="112" y="64" text-anchor="middle" fill="#9cc48a" font-size="12.5" font-weight="700">${esc(gauche_titre)}</text><text x="337" y="64" text-anchor="middle" fill="#f0c3ac" font-size="12.5" font-weight="700">${esc(droite_titre)}</text>${gauche.slice(0, 4).map((t, i) => `<text x="24" y="${92 + i * 32}" fill="${CO.ink}" font-size="11">• ${esc(String(t).slice(0, 32))}</text>`).join('')}${droite.slice(0, 4).map((t, i) => `<text x="249" y="${92 + i * 32}" fill="${CO.ink}" font-size="11">• ${esc(String(t).slice(0, 32))}</text>`).join('')}</svg>`,
  couches: ({ titre, couches = [] }) => `<svg viewBox="0 0 420 265" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(titre)}"><text x="210" y="22" text-anchor="middle" fill="${CO.gold}" font-size="15" font-weight="700">${esc(titre)}</text>${couches.slice(0, 4).map((c, i) => `<ellipse cx="210" cy="${68 + i * 54}" rx="${172 - i * 32}" ry="25" fill="rgba(217,119,87,${0.06 + i * 0.05})" stroke="${CO.terra}" stroke-width="1.3"/><text x="210" y="${73 + i * 54}" text-anchor="middle" fill="${CO.ink}" font-size="11.5">${esc(String(c).slice(0, 36))}</text>`).join('')}</svg>`,
};
const renderSchema = (spec) => { try { return spec && SCHEMAS[spec.gabarit] ? SCHEMAS[spec.gabarit](spec) : null; } catch { return null; } };

// ── Prompts ─────────────────────────────────────────────────────────────────
const SYS_DOC = `Tu es archiviste pédagogique. On te donne la TRANSCRIPTION BRUTE (reconnaissance vocale imparfaite) d'un extrait de séance enseignée en direct par un maître.
Ta tâche : RESTITUER le contenu enseigné sous forme de DOCUMENT SUIVI, fidèle et dense.
CONSERVE : idées, définitions, raisonnements ; les FORMULES prononcées mot pour mot quand elles sont identifiables ; exemples, récits, cas concrets ; le vocabulaire propre du maître.
SUPPRIME : salutations, appels de présence, bavardages, incidents techniques ; répétitions ; hésitations et phrases inachevées.
RÈGLES : français soutenu, paragraphes suivis ; corrige les erreurs manifestes de transcription quand le sens est certain ; N'INVENTE RIEN ; aucune structure pédagogique, aucun titre ; pas d'introduction ni de conclusion de ta part.`;

const SYS_PLAN = `Tu es ingénieur pédagogique. On te donne le DOCUMENT d'une séance enseignée par un maître.
Conçois le PLAN d'un cours pour de VRAIS DÉBUTANTS qui ne connaissent RIEN au sujet.
Règles : ordonne du PLUS SIMPLE au PLUS COMPLEXE en respectant les prérequis (jamais un terme avant sa définition) ; chaque notion est une IDÉE, pas un morceau de texte ; le glossaire définit CHAQUE terme propre au maître en mots ordinaires sans trahir le sens ; n'invente aucune notion absente du document.
JSON STRICT :
{"titre":"…","promesse":"ce que l'élève saura FAIRE, une phrase concrète","public":"…","prerequis":["…"],
 "glossaire":[{"terme":"…","simple":"1 phrase ordinaire","rigoureuse":"1-2 phrases fidèles"}],
 "notions":[{"id":"n1","titre":"…","idee_centrale":"…","pourquoi":"…","prerequis":["n0"],"appuis":["fait du document"]}]}`;

const SYS_LECON = `Tu es professeur expert de la transmission aux GRANDS DÉBUTANTS.
INTERDITS : recopier des phrases du document (REFORMULE ; une seule citation courte autorisée dans definition.citation) ; employer un terme technique sans l'expliquer juste avant ; rester abstrait ; inventer une doctrine absente du document.
EXIGENCES : phrases courtes, vocabulaire ordinaire, tutoiement bienveillant ; l'amorce part d'une situation quotidienne de l'élève, PAS du sujet ; l'exemple se déroule pas à pas ; le contre-exemple montre ce que la notion N'EST PAS ; l'expérience de pensée est jouable en 30 secondes ; la mise en situation est une tâche concrète de la semaine ; le quiz teste la COMPRÉHENSION et chaque réponse est expliquée.
JSON STRICT :
{"titre":"…","amorce":{"situation":"…","question":"…"},"intuition":"3-5 phrases sans jargon",
 "definition":{"enonce":"…","citation":"…","mots_cles":[{"mot":"…","sens":"…"}]},
 "schema":{"gabarit":"triangle|chaine|comparaison|couches","titre":"…","a":"…","b":"…","c":"…","centre":"…","etapes":["…"],"gauche_titre":"…","gauche":["…"],"droite_titre":"…","droite":["…"],"couches":["…"],"legende":"…"},
 "exemple":{"titre":"…","deroule":"4-6 phrases"},"contre_exemple":{"titre":"…","pourquoi_faux":"…"},
 "erreur_frequente":{"erreur":"…","correction":"…"},
 "experience_pensee":{"consigne":"…","deroule":"…","ce_que_ca_montre":"…"},
 "mise_en_situation":{"contexte":"…","consigne":"…","reussite":"…"},
 "je_retiens":{"phrases":["3 phrases"],"mots_cles":["5 mots"]},
 "quiz":[{"question":"…","options":["A","B","C","D"],"correctAnswer":0,"explication":"pourquoi juste, pourquoi les autres sont fausses"}]}
Ne garde dans "schema" que les clés utiles au gabarit choisi.`;

// ── Rendu HTML des écrans ───────────────────────────────────────────────────
const P = (...xs) => xs.filter(Boolean).map((x) => `<p>${esc(x)}</p>`).join('');
const UL = (xs = []) => `<ul>${xs.filter(Boolean).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
const BOX = (h) => `<blockquote>${h}</blockquote>`;
const TABLE = (head, rows) => `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;

function lessonSlides(L) {
  const s = [];
  s.push({ title: 'Pour commencer', content: P(L.amorce?.situation) + (L.amorce?.question ? BOX(`<p><strong>La question :</strong> ${esc(L.amorce.question)}</p>`) : '') });
  s.push({ title: "L'idée en clair", content: P(L.intuition) });
  const mots = Array.isArray(L.definition?.mots_cles) ? L.definition.mots_cles : [];
  s.push({ title: 'La définition', content: BOX(P(L.definition?.enonce)) + (L.definition?.citation ? `<p><em>Le maître dit : ${esc(L.definition.citation)}</em></p>` : '') + (mots.length ? `<h4>Les mots à connaître</h4>${TABLE(['Mot', 'Ce que ça veut dire'], mots.map((m) => [m.mot, m.sens]))}` : '') });
  const svg = renderSchema(L.schema);
  if (svg) s.push({ title: L.schema?.titre || 'Le schéma', content: `<figure>${svg}${L.schema?.legende ? `<figcaption>${esc(L.schema.legende)}</figcaption>` : ''}</figure>` });
  s.push({ title: L.exemple?.titre || 'Un exemple', content: P(L.exemple?.deroule) });
  s.push({ title: L.contre_exemple?.titre || "Ce que ce n'est PAS", content: P(L.contre_exemple?.pourquoi_faux) });
  s.push({ title: "L'erreur fréquente", content: `<h4>Ce qu'on croit souvent</h4>${P(L.erreur_frequente?.erreur)}<h4>Ce qu'il faut comprendre</h4>${P(L.erreur_frequente?.correction)}` });
  s.push({ title: 'Expérience de pensée', content: BOX(P(L.experience_pensee?.consigne)) + P(L.experience_pensee?.deroule) + (L.experience_pensee?.ce_que_ca_montre ? `<h4>Ce que cela montre</h4>${P(L.experience_pensee.ce_que_ca_montre)}` : '') });
  s.push({ title: 'À toi de jouer', content: P(L.mise_en_situation?.contexte) + BOX(`<p><strong>Ta tâche :</strong> ${esc(L.mise_en_situation?.consigne)}</p>`) + (L.mise_en_situation?.reussite ? `<p><strong>C'est réussi si :</strong> ${esc(L.mise_en_situation.reussite)}</p>` : '') });
  s.push({ title: 'Je retiens', content: UL(L.je_retiens?.phrases || []) + (L.je_retiens?.mots_cles?.length ? `<p><strong>Mots-clés :</strong> ${L.je_retiens.mots_cles.map(esc).join(' · ')}</p>` : '') });
  return s;
}

const setJob = (id, patch) => supabase.from('course_generation_jobs').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);

// ── Traitement d'un job ─────────────────────────────────────────────────────
async function processJob(job) {
  const t0 = Date.now();
  const { data: video } = await supabase.from('published_videos').select('id,title,transcript_text,transcript_cues,duration_sec').eq('id', job.video_id).single();
  if (!video?.transcript_text) throw new Error('Ce replay n’a pas de transcription exploitable.');

  // 1. EXTRACTION
  await setJob(job.id, { status: 'extracting', progress: 'Extraction du contenu enseigné…' });
  const cues = Array.isArray(video.transcript_cues) ? video.transcript_cues : [];
  const cleaned = (cues.length ? cues.map((c) => c.text).join(' ') : video.transcript_text).replace(/\s+/g, ' ').trim();
  const chunks = [];
  for (let i = 0; i < cleaned.length; i += WINDOW) chunks.push(cleaned.slice(i, i + WINDOW));
  const parts = [];
  for (const [i, c] of chunks.entries()) {
    const t = await llm(SYS_DOC, `Extrait ${i + 1}/${chunks.length} de la séance.\n\n---\n${c}\n---`, { maxTokens: 8000, json: false, temp: 0.2 });
    if (t) parts.push(t);
    await setJob(job.id, { progress: `Extraction ${i + 1}/${chunks.length}…` });
  }
  let doc = parts.join('\n\n');
  if (!doc.trim()) throw new Error('Extraction impossible (moteur IA indisponible).');
  if (doc.length > MAX_DOC) doc = doc.slice(0, MAX_DOC - 200) + '\n\n[…]';
  const srcGrams = grams(doc);

  // 2. PLAN — RÉUTILISE le pivot de l'Atelier s'il existe.
  //
  // L'Atelier unifié (docs/ATELIER_COURS_UNIFIE_SPEC.md) extrait le FOND d'une
  // source UNE fois et le range dans `course_pivots`. Si ce travail a déjà été
  // payé, on ne le refait pas : on repart de là. Le reste du job (rédaction des
  // leçons, rendu, insertion) est INCHANGÉ → la sortie reste identique.
  await setJob(job.id, { status: 'planning', progress: 'Conception du plan pédagogique…' });
  let plan = null;
  const { data: pivot } = await supabase
    .from('course_pivots')
    .select('payload')
    .eq('tenant_id', job.tenant_id)
    .eq('source_type', job.source_type || 'replay')
    .eq('source_id', job.source_id || job.video_id)
    .eq('kind', 'comprehension')
    .is('parent_id', null)
    .maybeSingle();
  if (pivot?.payload?.notions?.length) {
    // Le pivot porte les mêmes champs que SYS_PLAN (titre, promesse, notions,
    // glossaire) : il est directement consommable par l'étape suivante.
    plan = {
      titre: pivot.payload.titre,
      promesse: pivot.payload.promesse,
      notions: pivot.payload.notions,
      glossaire: pivot.payload.glossaire || [],
    };
    console.log(`[course-from-replay] ♻️  pivot réutilisé — ${plan.notions.length} notions, plan NON regénéré`);
    await setJob(job.id, { progress: `Plan repris de l'Atelier (${plan.notions.length} notions)` });
  } else {
    plan = await llm(SYS_PLAN, `DOCUMENT :\n\n${doc}`, { maxTokens: 14000 });
  }
  if (!plan?.notions?.length) throw new Error('Plan pédagogique vide.');

  // 3. LEÇONS (avec contrôle qualité)
  await setJob(job.id, { status: 'writing', progress: `0/${plan.notions.length} leçons` });
  const lessons = [];
  for (const [i, notion] of plan.notions.entries()) {
    let lesson = null, verdict = '';
    for (let attempt = 1; attempt <= 3; attempt++) {
      const extra = verdict ? `\n\nTA VERSION PRÉCÉDENTE A ÉTÉ REFUSÉE : ${verdict}\nCorrige impérativement.` : '';
      lesson = await llm(SYS_LECON, `NOTION : ${notion.titre}\nIdée centrale : ${notion.idee_centrale}\nPourquoi : ${notion.pourquoi}\nAppuis : ${(notion.appuis || []).join(' · ')}\n\nGLOSSAIRE : ${(plan.glossaire || []).map((g) => `${g.terme} = ${g.simple}`).join(' | ')}\n\nDOCUMENT SOURCE (rester fidèle, NE PAS RECOPIER) :\n${doc.slice(0, 22000)}${extra}`, { maxTokens: 16000 });
      if (!lesson) { verdict = 'réponse vide'; continue; }
      const missing = ['amorce', 'intuition', 'definition', 'schema', 'exemple', 'contre_exemple', 'erreur_frequente', 'experience_pensee', 'mise_en_situation', 'je_retiens', 'quiz'].filter((k) => !lesson[k]);
      if (missing.length) { verdict = `blocs manquants : ${missing.join(', ')}`; continue; }
      if (!Array.isArray(lesson.quiz) || lesson.quiz.length < 3 || !lesson.quiz.every((q) => q.explication)) { verdict = 'quiz incomplet (3 questions minimum, chacune expliquée)'; continue; }
      const body = [lesson.intuition, lesson.exemple?.deroule, lesson.contre_exemple?.pourquoi_faux, lesson.experience_pensee?.deroule].filter(Boolean).join(' ');
      const rate = copyRate(body, srcGrams);
      if (rate > 0.12) { verdict = `trop de copie de la source (${Math.round(rate * 100)}%) — reformule entièrement`; continue; }
      verdict = '';
      break;
    }
    if (!verdict && lesson) lessons.push(lesson);
    await setJob(job.id, { progress: `${lessons.length}/${plan.notions.length} leçons` });
  }
  if (!lessons.length) throw new Error('Aucune leçon conforme produite.');

  // 3b. PERSISTE LES LEÇONS COMME PIVOT « ecrit » (Atelier unifié).
  //
  // Ces leçons coûtent l'essentiel du job (~2 min chacune, contrôle qualité
  // inclus). Jusqu'ici elles étaient insérées dans les tables élève puis
  // OUBLIÉES : produire le PDF du même cours relançait toute la chaîne.
  // Rangées ici, les autres rendus (PDF, masterclass, précepteur) les
  // relisent GRATUITEMENT. Best-effort : un échec ici ne doit pas perdre
  // un job qui a réussi.
  try {
    const srcType = job.source_type || 'replay';
    const srcId = job.source_id || job.video_id;
    const { data: root } = await supabase
      .from('course_pivots')
      .select('id')
      .eq('tenant_id', job.tenant_id).eq('source_type', srcType)
      .eq('source_id', srcId).eq('kind', 'comprehension').is('parent_id', null)
      .maybeSingle();
    if (root?.id) {
      await supabase.from('course_pivots').delete()
        .eq('parent_id', root.id).eq('kind', 'ecrit');
      await supabase.from('course_pivots').insert({
        tenant_id: job.tenant_id, source_type: srcType, source_id: srcId,
        kind: 'ecrit', parent_id: root.id,
        payload: { schema_version: 1, kind: 'ecrit', titre: plan.titre, promesse: plan.promesse, lecons: lessons },
        model: process.env.COURSE_ENGINE_MODEL || MODEL,
      });
      console.log(`[course-from-replay] 💾 pivot « ecrit » enregistré — ${lessons.length} leçons réutilisables`);
    }
  } catch (e) {
    console.warn('[course-from-replay] pivot ecrit non enregistré :', e?.message || e);
  }

  // 4. PUBLICATION (brouillon)
  await setJob(job.id, { status: 'publishing', progress: 'Mise en place au poste production…' });
  const carte = plan.notions.map((n, i) => [String(i + 1), n.titre, n.idee_centrale]);
  const gloss = (plan.glossaire || []).map((g) => [g.terme, g.simple, g.rigoureuse]);
  const days = [
    { title: 'Bienvenue — ce que tu vas apprendre', slides: [
      { title: 'La promesse de ce cours', content: P(plan.promesse) + (plan.public ? `<p><strong>Pour qui :</strong> ${esc(plan.public)}</p>` : '') },
      { title: 'La carte du cours', content: TABLE(['#', 'Leçon', 'Idée centrale'], carte) },
      ...(gloss.length ? [{ title: 'Glossaire — les mots du maître', content: TABLE(['Terme', 'En mots simples', 'Définition exacte'], gloss) }] : []),
    ] },
    ...lessons.map((L) => ({ title: L.titre, slides: lessonSlides(L), quiz: { title: `Quiz — ${L.titre}`, questions: L.quiz } })),
    { title: 'Récapitulatif et évaluation',
      slides: [{ title: 'Tableau récapitulatif', content: TABLE(['#', 'Leçon', 'À retenir', 'Mots-clés'], lessons.map((L, i) => [String(i + 1), L.titre, (L.je_retiens?.phrases || [])[0] || '', (L.je_retiens?.mots_cles || []).slice(0, 3).join(' · ')])) }],
      quiz: { title: 'Évaluation finale', questions: lessons.flatMap((L) => (L.quiz || []).slice(0, 1)) } },
  ];
  const weeks = [];
  for (let i = 0; i < days.length; i += 4) weeks.push({ title: `Semaine ${weeks.length + 1}`, days: days.slice(i, i + 4) });

  const { data: course, error: ce } = await supabase.from('courses').insert({
    tenant_id: job.tenant_id, created_by: job.requested_by || null, status: 'draft',
    title: plan.titre, description: plan.promesse,
  }).select('id').single();
  if (ce) throw new Error('Création du cours : ' + ce.message);
  const { data: mod } = await supabase.from('modules').insert({ formation_id: course.id, title: 'Programme', sort_order: 0 }).select('id').single();
  for (const [wi, w] of weeks.entries()) {
    const { data: week } = await supabase.from('formation_weeks').insert({ module_id: mod.id, title: w.title, sort_order: wi }).select('id').single();
    for (const [di, d] of w.days.entries()) {
      const { data: day } = await supabase.from('formation_days').insert({ week_id: week.id, title: d.title, sort_order: di }).select('id').single();
      const rows = [{ day_id: day.id, type: 'powerpoint', sort_order: 0, data: { type: 'slides', title: d.title, slides: d.slides } }];
      if (d.quiz?.questions?.length) rows.push({ day_id: day.id, type: 'quiz', sort_order: 1, data: d.quiz });
      await supabase.from('formation_day_contents').insert(rows);
    }
  }
  await setJob(job.id, {
    status: 'done', course_id: course.id, progress: null,
    metrics: { source: video.title, doc_chars: doc.length, notions: plan.notions.length, lessons: lessons.length, days: days.length, seconds: Math.round((Date.now() - t0) / 1000) },
  });
  console.log(`[course-from-replay] ✅ « ${plan.titre} » — ${lessons.length} leçons, ${days.length} jours (${Math.round((Date.now() - t0) / 60000)} min)`);
  return true;
}

export async function pollCourseFromReplay() {
  if (!DEEPSEEK_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) return 0;
  const { data: jobs } = await supabase.from('course_generation_jobs').select('*').eq('status', 'pending').order('created_at').limit(1);
  if (!jobs?.length) return 0;
  const job = jobs[0];
  try {
    await processJob(job);
    return 1;
  } catch (e) {
    const msg = String(e?.message || e).slice(0, 400);
    console.error('[course-from-replay] ❌', msg);
    await setJob(job.id, { status: 'failed', error_message: msg, progress: null });
    return 0;
  }
}
