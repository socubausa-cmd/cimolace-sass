/// <reference lib="deno.ns" />

/**
 * liri-masterclass-factory — Génère les CHAPITRES × SEGMENTS pédagogiques d'une
 * masterclass à partir d'un TEXTE SOURCE. Remplace la fonction Netlify MORTE du
 * même nom (le front `apps/app/src/hooks/useMasterclassProject.js` l'appelait via
 * `${origin}/.netlify/functions/liri-masterclass-factory` → 404 → fallback regex
 * silencieux). Ici : vraie génération LLM (cascade partagée DeepSeek→Mistral→Grok,
 * palier economy), sortie STRICTE au contrat consommé par le hook (launchBlocs).
 *
 * Contrat de sortie (miroir de buildFallbackFactoryChaptersFromSenseBlocks) :
 *   { chapters: [{ id, order, title, objective, duration, segments: [
 *       { segment_id, name, title, content, key_points[], oral_script, teacher_note, interaction } ] }],
 *     deck_title, subtitle, label, provider }
 *
 * config.toml : [functions.liri-masterclass-factory] verify_jwt = false
 * (on exige un user authentifié via requireUser — la clé anon seule ne suffit pas).
 */
import { corsHeaders } from '../_shared/cors.ts';
import { requireUser } from '../_shared/requireUser.ts';
import { aiChatClaudeDeepSeekGrok } from '../_shared/aiClaudeDeepSeekGrok.ts';

// Segments imposés, alignés sur useMasterclassProject.js (liri-v1 = 21, failure-v2 = 26).
const SEGMENTS_21 = ['Objectif', 'Compétence', 'Connaissance', 'Mise en situation', 'Tension',
  'Expérience de pensée', 'Révélation', 'Leçon simple', 'Leçon développée', 'Analogies',
  'Exemples', 'Reformulation', 'Atelier', 'Erreurs attendues', 'Correction', 'JE RETIENS',
  'Test', 'Cas réel', 'Lien conceptuel', 'Niveau de maîtrise', 'Transition'];
const SEGMENTS_26 = ['Objectif', 'Compétence', 'Prérequis & Nouveau', 'Mise en situation', 'Tension cognitive',
  'Défi sans leçon', 'Recueil des erreurs', 'Expérience de pensée', 'Révélation', 'Leçon courte',
  'Leçon développée', 'Analogies', 'Exemples concrets', 'Reformulation simple', 'Atelier débat',
  'Erreurs attendues', 'Correction guidée', 'Métacognition', 'JE RETIENS', 'Test de compréhension',
  "Défi d'application", 'Boucle de remédiation', 'Cas réel / Témoignage', 'Niveau de maîtrise',
  'Lien conceptuel', 'Transition narrative'];

function str(v: unknown, fb = ''): string { return typeof v === 'string' ? v : (v == null ? fb : String(v)); }
function arr(v: unknown): string[] { return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 4) : []; }

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const auth = await requireUser(req);
  if ('response' in auth) return auth.response;

  const body = await req.json().catch(() => ({}));
  const sourceText = str((body as any)?.sourceText).trim();
  const lang = str((body as any)?.lang, 'fr');
  const pedagogicalModel = str((body as any)?.pedagogicalModel, 'liri-v1');
  if (sourceText.length < 30) return jsonRes({ error: 'sourceText trop court (min 30 caractères).', chapters: [] }, 400);

  const segmentNames = pedagogicalModel === 'failure-v2' ? SEGMENTS_26 : SEGMENTS_21;

  const system = `Tu es un ingénieur pédagogique expert. À partir d'un TEXTE SOURCE, tu conçois une MASTERCLASS structurée en CHAPITRES, chaque chapitre décomposé en SEGMENTS pédagogiques IMPOSÉS. Langue : ${lang}. Tu réponds UNIQUEMENT en JSON valide, sans aucun texte autour, sans backticks.`;
  const userPrompt =
    `TEXTE SOURCE :\n"""\n${sourceText.slice(0, 24000)}\n"""\n\n` +
    `Conçois 3 à 6 CHAPITRES cohérents et progressifs couvrant ce texte. Pour CHAQUE chapitre, remplis EXACTEMENT ces ${segmentNames.length} segments, DANS CET ORDRE et avec CE nom : ${segmentNames.join(' | ')}.\n` +
    `Chaque segment : "content" = contenu pédagogique concret ancré dans le texte (2 à 5 phrases) ; "oral_script" = ce que le formateur DIT à l'oral (1 à 3 phrases) ; "key_points" = 1 à 3 puces courtes ; "teacher_note" = conseil bref au formateur ; "interaction" = question/activité brève si pertinent, sinon "".\n` +
    `Réponds CE JSON EXACT (mêmes clés) :\n` +
    `{"deck_title":"titre du deck","subtitle":"sous-titre","label":"Masterclass","chapters":[{"title":"...","objective":"objectif du chapitre","duration":"25 min","segments":[{"name":"Objectif","content":"...","oral_script":"...","key_points":["..."],"teacher_note":"...","interaction":"..."}]}]}`;

  let text: string | null = null;
  let provider = 'fallback';
  try {
    const r = await aiChatClaudeDeepSeekGrok({
      system,
      messages: [{ role: 'user', content: userPrompt }],
      max_tokens: 8000,
      temperature: 0.5,
      tier: 'economy',
      deepseekRole: 'heavy',
    });
    text = r.text;
    provider = r.provider || 'fallback';
  } catch (_e) {
    text = null;
  }

  let parsed: any = null;
  if (text) {
    try { parsed = JSON.parse(text); }
    catch {
      const s = text.indexOf('{'), e = text.lastIndexOf('}');
      if (s >= 0 && e > s) { try { parsed = JSON.parse(text.slice(s, e + 1)); } catch { parsed = null; } }
    }
  }
  if (!parsed || !Array.isArray(parsed.chapters) || parsed.chapters.length === 0) {
    return jsonRes({ error: 'Génération IA indisponible pour le moment.', chapters: [] }, 502);
  }

  // Normalise au contrat EXACT du hook : segments alignés sur segmentNames (ordre + nom),
  // trous du LLM remplis à vide (le front sait afficher un segment vide sans crash).
  const chapters = parsed.chapters.slice(0, 8).map((ch: any, ci: number) => {
    const bySeg: Record<string, any> = {};
    if (Array.isArray(ch?.segments)) {
      for (const s of ch.segments) if (s && typeof s.name === 'string') bySeg[s.name.trim().toLowerCase()] = s;
    }
    return {
      id: `ch${ci}`,
      order: ci,
      title: str(ch?.title, `Chapitre ${ci + 1}`),
      objective: str(ch?.objective),
      duration: str(ch?.duration, '25 min'),
      segments: segmentNames.map((name, si) => {
        const s = bySeg[name.toLowerCase()] || {};
        return {
          segment_id: si + 1,
          name,
          title: name,
          content: str(s.content),
          key_points: arr(s.key_points),
          oral_script: str(s.oral_script),
          teacher_note: str(s.teacher_note),
          interaction: str(s.interaction),
        };
      }),
    };
  });

  return jsonRes({
    chapters,
    deck_title: str(parsed.deck_title, chapters[0]?.title || 'Masterclass'),
    subtitle: str(parsed.subtitle),
    label: str(parsed.label, 'Masterclass'),
    provider,
  });
});
