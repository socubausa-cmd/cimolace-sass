/**
 * 03-generate.mjs — L'AGENT PRÉCEPTEUR-AUTEUR.
 * Transcription TikTok → (1) COURS Précepteur au schéma canonique (fromMasterclass :
 * concepts[{title, scenes[lecon|amorce_croquis|atelier|image_analogie|transition]}]) —
 * les dispositifs (surlignage/encadré/résumé) et la conformité sont garantis en aval
 * par conformCourseSync au rendu ; AUCUNE scène `croquis` émise (géométrie = edge dédiée).
 * (2) MANUEL D'ENSEIGNEMENT (markdown) : objectifs, plan, points clés, ateliers corrigés,
 * erreurs fréquentes, prolongements.
 *
 * LLM : DeepSeek (deepseek-chat, json) → repli Groq (llama-3.3-70b). Clés .env.production.
 * Usage : node tools/precepteur-tiktok/03-generate.mjs [--limit N]
 */
import { sql, q, TENANT_ID, ENV, log } from './common.mjs';

const limit = (() => { const i = process.argv.indexOf('--limit'); return i > -1 ? Number(process.argv[i + 1]) : 2; })();

const SYSTEM = `Tu es LE PRÉCEPTEUR de l'école Prorascience (fondateur : Ngowazulu, « de la prophétie à la science »).
On te donne la TRANSCRIPTION BRUTE d'une courte vidéo d'enseignement du fondateur (TikTok, oral, parfois bruitée).
Ta mission : en faire un COURS ENSEIGNÉ structuré + un MANUEL D'ENSEIGNEMENT.

STYLE (« Sherpas ») : ton complice et direct, accroche-question, UNE idée à la fois, mots-clés forts,
payoff final. Reste STRICTEMENT fidèle au contenu du fondateur : tu structures et clarifies son
enseignement, tu n'inventes JAMAIS de doctrine. Si la transcription est bruitée, reconstruis le sens
probable sans ajouter d'idées étrangères. Langue : français.

Réponds en JSON STRICT (aucun texte hors JSON) :
{
  "title": "titre du cours (court, évocateur)",
  "topic_ok": true|false,   // false si la vidéo n'est PAS un enseignement (pub, danse, annonce) → tout le reste vide
  "concepts": [              // 1 à 3 concepts, chacun = un bloc d'enseignement complet
    {
      "title": "titre du concept",
      "scenes": [
        {"type":"lecon","title":"...","board_text":"phrase-clé courte pour le tableau","narration":"2-4 phrases enseignées, fidèles au fondateur"},
        {"type":"amorce_croquis","narration":"expérience de pensée ou image mentale qui prépare l'idée"},
        {"type":"image_analogie","analogie":"analogie concrète du quotidien","narration":"1-2 phrases qui la déploient"},
        {"type":"atelier","question":"question posée à l'élève","expected_answers":["réponse attendue 1","..."],"expected_errors":["erreur fréquente 1","..."],"reveal_narration":"la révélation du prof après la réponse"},
        {"type":"transition","narration":"pont vers la suite"}
      ]
    }
  ],
  "manual_md": "MANUEL D'ENSEIGNEMENT en markdown : ## Objectifs pédagogiques / ## Plan du cours / ## Points clés (avec les phrases exactes importantes du fondateur) / ## Ateliers & corrigés / ## Erreurs fréquentes des élèves / ## Prolongements (questions ouvertes, pratiques)"
}
Contraintes scènes : chaque concept commence par une lecon ; l'atelier a TOUJOURS question + expected_answers (≥1) + expected_errors (≥1) + reveal_narration ; n'émets JAMAIS de type "croquis". board_text ≤ 90 caractères.`;

async function callLLM(userMsg) {
  const tries = [
    { name: 'deepseek', url: 'https://api.deepseek.com/chat/completions', key: ENV.DEEPSEEK_API_KEY, model: 'deepseek-v4-pro' },
    { name: 'groq', url: 'https://api.groq.com/openai/v1/chat/completions', key: ENV.GROQ_API_KEY, model: 'llama-3.3-70b-versatile' },
  ];
  for (const t of tries) {
    if (!t.key) continue;
    try {
      const res = await fetch(t.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t.key}` },
        body: JSON.stringify({
          model: t.model,
          messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: userMsg }],
          temperature: 0.4,
          response_format: { type: 'json_object' },
          max_tokens: 4000,
        }),
      });
      if (!res.ok) throw new Error(`${t.name} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const j = await res.json();
      const content = j?.choices?.[0]?.message?.content || '';
      return { model: `${t.name}:${t.model}`, data: JSON.parse(content) };
    } catch (e) {
      log(`  ⚠️ ${t.name} → ${String(e.message).slice(0, 140)}`);
    }
  }
  throw new Error('tous les LLM ont échoué');
}

const DEFAULT_ACK = {
  ok: ['Exactement.', 'Tu y es.', 'C’est ça même.', 'Voilà.'],
  partial: ['Presque — pousse d’un cran.', 'Tu tiens un bout du fil…', 'Bonne direction.'],
  wrong: ['Pas tout à fait.', 'Regarde encore.', 'Non — mais l’erreur est instructive.'],
};
const SCENE_TYPES = new Set(['lecon', 'amorce_croquis', 'image_analogie', 'atelier', 'transition']);

/** Sanitize défensif : schéma canonique garanti, jamais de scène croquis, atelier complet. */
function sanitizeCourse(raw, fallbackTitle) {
  const title = String(raw?.title || fallbackTitle || 'Cours du Précepteur').slice(0, 140);
  const concepts = (Array.isArray(raw?.concepts) ? raw.concepts : []).slice(0, 4).map((c, ci) => {
    const scenes = (Array.isArray(c?.scenes) ? c.scenes : [])
      .filter((s) => s && SCENE_TYPES.has(s.type))
      .map((s) => {
        if (s.type === 'lecon') {
          const narration = String(s.narration || s.board_text || '').trim();
          return narration ? { type: 'lecon', ...(s.title ? { title: String(s.title).slice(0, 120) } : {}), board_text: String(s.board_text || narration).slice(0, 160), narration } : null;
        }
        if (s.type === 'atelier') {
          const question = String(s.question || '').trim();
          if (!question) return null;
          const ea = (Array.isArray(s.expected_answers) ? s.expected_answers : []).map(String).filter(Boolean);
          const ee = (Array.isArray(s.expected_errors) ? s.expected_errors : []).map(String).filter(Boolean);
          return {
            type: 'atelier', address: '{{student_name}}', question,
            expected_answers: ea.length ? ea : ['(réponse libre fidèle à la leçon)'],
            expected_errors: ee.length ? ee : ['réponse hors du cadre de la leçon'],
            ack_variants: DEFAULT_ACK,
            reveal_narration: String(s.reveal_narration || 'Voyons cela ensemble.').trim(),
          };
        }
        if (s.type === 'image_analogie') {
          const analogie = String(s.analogie || s.narration || '').trim();
          return analogie ? { type: 'image_analogie', analogie, narration: String(s.narration || analogie).trim() } : null;
        }
        const narration = String(s.narration || '').trim();
        return narration ? { type: s.type, narration } : null;
      })
      .filter(Boolean);
    return scenes.length ? { id: `c${ci + 1}`, title: String(c?.title || `Concept ${ci + 1}`).slice(0, 120), scenes } : null;
  }).filter(Boolean);
  return { title, concepts };
}

const rows = sql(`select s.id, s.external_id, s.title, s.transcript_text from precepteur_sources s
                  where s.tenant_id=${q(TENANT_ID)}::uuid and s.status='transcribed'
                    and not exists (select 1 from precepteur_courses pc where pc.source_id = s.id)
                  order by s.created_at asc limit ${limit};`)
  .split('\n').filter(Boolean).map((l) => {
    const i1 = l.indexOf('|'), i2 = l.indexOf('|', i1 + 1), i3 = l.indexOf('|', i2 + 1);
    return { id: l.slice(0, i1), ext: l.slice(i1 + 1, i2), title: l.slice(i2 + 1, i3), transcript: l.slice(i3 + 1) };
  });
log(`${rows.length} transcription(s) à transformer en cours.`);

for (const r of rows) {
  try {
    const user = `TITRE/LÉGENDE TIKTOK : ${r.title || '(sans titre)'}\n\nTRANSCRIPTION :\n${r.transcript}`;
    const { model, data } = await callLLM(user);
    if (data?.topic_ok === false) {
      sql(`update precepteur_sources set status='skipped', error_message='non-enseignement (topic_ok=false)', updated_at=now() where id=${q(r.id)}::uuid;`);
      log(`⏭️  ${r.ext} — non-enseignement, ignoré.`);
      continue;
    }
    const course = sanitizeCourse(data, r.title);
    if (!course.concepts.length) throw new Error('cours vide après sanitize');
    const manual = String(data?.manual_md || '').trim();
    sql(`insert into precepteur_courses (tenant_id, source_id, title, course, manual_md, model)
         values (${q(TENANT_ID)}::uuid, ${q(r.id)}::uuid, ${q(course.title)}, ${q(JSON.stringify(course))}::jsonb, ${q(manual)}, ${q(model)});`);
    sql(`update precepteur_sources set status='generated', updated_at=now() where id=${q(r.id)}::uuid;`);
    log(`✅ ${r.ext} → « ${course.title} » (${course.concepts.length} concept(s), manuel ${manual.length} car., ${model})`);
  } catch (e) {
    const msg = String(e?.message || e).slice(0, 300);
    sql(`update precepteur_sources set error_message=${q(msg)}, updated_at=now() where id=${q(r.id)}::uuid;`);
    log(`❌ ${r.ext} — ${msg.slice(0, 140)}`);
  }
}
const counts = sql(`select status||':'||count(*) from precepteur_sources where tenant_id=${q(TENANT_ID)}::uuid group by status order by 1;`);
log('État →', counts.replace(/\n/g, '  '), '· cours en base :', sql(`select count(*) from precepteur_courses where tenant_id=${q(TENANT_ID)}::uuid;`));
