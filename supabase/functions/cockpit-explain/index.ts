/// <reference lib="deno.ns" />

// ─────────────────────────────────────────────────────────────────────────────
// cockpit-explain — Explique EN LANGAGE PATIENT ce que le praticien PARTAGE à
// l'écran pendant une téléconsultation (jumeau 3D, roue de transformation,
// bilan/rapport, ordonnance…). Modèle DeepSeek (comme generate-soap). Reçoit un
// descripteur de scène (JSON self-contained) + le type + le nom du patient, et
// renvoie { title, explanation } court, clair, RASSURANT et NON diagnostique
// (le praticien reste le référent). Sert la vision « cockpit intelligent » :
// l'IA explique ce qui est partagé. AUCUN accès BD — génération pure.
// ─────────────────────────────────────────────────────────────────────────────

import { corsHeaders } from '../_shared/cors.ts';

type ExplainRequest = {
  /** Descripteur de la scène partagée (CockpitScene) — self-contained. */
  scene?: unknown;
  /** Type de scène : 'twin' | 'wheel' | 'report' | 'prescription' | 'image' | 'chart' | string. */
  kind?: string;
  /** Élément précis cliqué (organe, axe de la roue, ligne de rapport…) — optionnel. */
  focus?: string;
  /** Nom du patient (pour personnaliser le ton) — optionnel. */
  patient_name?: string;
  /** Langue de sortie (fr par défaut). */
  language?: string;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });

const safeLang = (v: unknown): string => {
  const s = String(v ?? 'fr').trim().toLowerCase();
  return s && s.length <= 12 ? s : 'fr';
};

const stripFences = (s: string): string =>
  s.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

const KIND_LABEL: Record<string, string> = {
  twin: 'un schéma anatomique (jumeau numérique) où des organes sont colorés selon leur état',
  wheel: 'une roue de transformation avec plusieurs axes de santé notés',
  report: 'un bilan / rapport de santé',
  prescription: 'une ordonnance',
  image: 'une image médicale partagée',
  chart: 'un graphique de suivi',
};

const buildPrompt = (req: ExplainRequest, language: string): string => {
  const kind = String(req.kind || '').trim();
  const what = KIND_LABEL[kind] || 'un élément clinique partagé à l’écran';
  const who = req.patient_name ? ` Le patient s'appelle ${String(req.patient_name).slice(0, 60)}.` : '';
  const focus = req.focus ? `\n\nL'élément PRÉCIS sur lequel se concentrer : "${String(req.focus).slice(0, 120)}".` : '';
  let sceneJson = '';
  try {
    sceneJson = JSON.stringify(req.scene ?? {}).slice(0, 6000);
  } catch {
    sceneJson = '{}';
  }
  return `Tu expliques À UN PATIENT, pendant une téléconsultation, ce que son praticien lui montre à l'écran : ${what}.${who}${focus}

Descripteur de ce qui est affiché (JSON, self-contained) :
${sceneJson}

Rédige en langue "${language}" :
- "title" : un titre court (2-4 mots) de ce qui est montré.
- "explanation" : 2 à 4 phrases SIMPLES et RASSURANTES qui expliquent ce que le patient voit et ce que cela signifie pour lui, en t'appuyant sur le descripteur (couleurs/états, valeurs).

Règles STRICTES :
- Langage grand public, chaleureux, phrases courtes. PAS de jargon non expliqué, PAS de markdown.
- Tu EXPLIQUES, tu ne poses PAS de diagnostic et tu ne prescris rien : le praticien présent reste le référent. Termine en invitant le patient à poser ses questions au praticien.
- N'invente aucune valeur absente du descripteur.
- Réponds UNIQUEMENT par un JSON valide : {"title":"...","explanation":"..."}`;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = (await req.json().catch(() => null)) as ExplainRequest | null;
    if (!body || (!body.scene && !body.kind && !body.focus)) {
      return json({ error: 'Scène à expliquer manquante.' }, 400);
    }
    const language = safeLang(body.language);

    const apiKey = Deno.env.get('DEEPSEEK_API_KEY');
    if (!apiKey) return json({ error: 'Missing DEEPSEEK_API_KEY secret' }, 500);

    const resp = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-chat',
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Tu es un assistant santé qui vulgarise pour les patients. Tu produis UNIQUEMENT du JSON valide. Tu ne poses jamais de diagnostic.' },
          { role: 'user', content: buildPrompt(body, language) },
        ],
      }),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      return json({ error: `DeepSeek error (${resp.status}): ${text.slice(0, 800)}` }, 502);
    }

    const data = await resp.json().catch(() => null);
    const content = data?.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') return json({ error: 'Invalid DeepSeek response' }, 502);

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(stripFences(content));
    } catch {
      return json({ error: 'Explain output is not valid JSON' }, 502);
    }

    const title = String(parsed?.title ?? '').trim().slice(0, 80);
    const explanation = String(parsed?.explanation ?? '').trim().slice(0, 1200);
    if (!explanation) return json({ error: 'Explication vide.' }, 502);
    return json({ title: title || 'Explication', explanation });
  } catch (e) {
    return json({ error: String((e as { message?: string })?.message || e) }, 500);
  }
});
