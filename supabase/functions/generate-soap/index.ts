/// <reference lib="deno.ns" />

// ─────────────────────────────────────────────────────────────────────────────
// generate-soap — Génère une note SOAP structurée (S/O/A/P) à partir de la
// TRANSCRIPTION d'une téléconsultation (dictée live du praticien, cf. scribe
// Web Speech côté salle). Modèle : DeepSeek (comme translate-transcript /
// summarize). Retourne du JSON { subjective, objective, assessment, plan }.
// Le front (cockpit MEDOS) alimente `transcript`, revoit le SOAP, puis
// enregistre la note (POST /med/patients/:id/notes) et la partage (scène soap).
// AUCUN accès BD ici — génération pure.
// ─────────────────────────────────────────────────────────────────────────────

import { corsHeaders } from '../_shared/cors.ts';

type TranscriptLine = { text?: string };

type GenerateSoapRequest = {
  /** Transcription : texte libre OU tableau de lignes { text }. */
  transcript?: string | TranscriptLine[];
  /** Langue de sortie (fr par défaut). */
  language?: string;
  /** Contexte patient optionnel (nom, sexe, motif, antécédents…) — aide le modèle. */
  patientContext?: Record<string, unknown>;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });

const normalizeTranscript = (t: unknown): string => {
  if (typeof t === 'string') return t.trim();
  if (Array.isArray(t)) {
    return t
      .map((l) => (l && typeof l === 'object' ? String((l as TranscriptLine).text ?? '') : String(l ?? '')))
      .map((s) => s.trim())
      .filter(Boolean)
      .join('\n');
  }
  return '';
};

const safeLang = (v: unknown): string => {
  const s = String(v ?? 'fr').trim().toLowerCase();
  return s && s.length <= 12 ? s : 'fr';
};

const buildPrompt = (transcript: string, language: string, ctx?: Record<string, unknown>): string => {
  const ctxLine = ctx && Object.keys(ctx).length
    ? `\n\nContexte patient (indicatif, ne pas inventer au-delà) :\n${JSON.stringify(ctx)}`
    : '';
  return `Tu es un assistant médical. À partir de la TRANSCRIPTION d'une téléconsultation ci-dessous, rédige une note clinique SOAP concise, structurée et cliniquement pertinente, en langue "${language}".

Structure SOAP :
- subjective (S) : motif, symptômes et éléments RAPPORTÉS par le patient (ses mots).
- objective (O) : signes objectifs, constantes, observations du praticien MENTIONNÉS dans l'échange (n'invente PAS de valeurs non dites ; si rien, indique "Non renseigné à l'oral").
- assessment (A) : analyse / hypothèses diagnostiques évoquées.
- plan (P) : conduite à tenir, traitement, examens, suivi évoqués.

Règles STRICTES :
- Reste FIDÈLE à la transcription : n'invente aucun fait, chiffre ou diagnostic non évoqué.
- Style clinique, phrases courtes. Pas de markdown, pas de listes à puces dans les valeurs.
- Ceci est une AIDE à la rédaction (assistant), pas un diagnostic médical définitif.
- Réponds UNIQUEMENT par un JSON valide, rien d'autre :
{"subjective":"...","objective":"...","assessment":"...","plan":"..."}${ctxLine}

TRANSCRIPTION :
${transcript}`;
};

const stripFences = (s: string): string =>
  s.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = (await req.json().catch(() => null)) as GenerateSoapRequest | null;
    const transcript = normalizeTranscript(body?.transcript).slice(0, 24000);
    const language = safeLang(body?.language);
    const patientContext = body?.patientContext && typeof body.patientContext === 'object' ? body.patientContext : undefined;

    if (!transcript || transcript.length < 12) {
      return json({ error: 'Transcription vide ou trop courte pour générer un SOAP.' }, 400);
    }

    const apiKey = Deno.env.get('DEEPSEEK_API_KEY');
    if (!apiKey) return json({ error: 'Missing DEEPSEEK_API_KEY secret' }, 500);

    const resp = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-chat',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Tu es un scribe médical. Tu produis UNIQUEMENT du JSON valide.' },
          { role: 'user', content: buildPrompt(transcript, language, patientContext) },
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
      return json({ error: 'SOAP output is not valid JSON' }, 502);
    }

    const pick = (k: string) => String(parsed?.[k] ?? '').trim();
    return json({
      subjective: pick('subjective'),
      objective: pick('objective'),
      assessment: pick('assessment'),
      plan: pick('plan'),
    });
  } catch (e) {
    return json({ error: String((e as { message?: string })?.message || e) }, 500);
  }
});
