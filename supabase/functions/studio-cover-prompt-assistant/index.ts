/// <reference lib="deno.ns" />

/**
 * Assistant OpenAI pour affiner le prompt d’image (couverture / miniature live)
 * avant appel à `generate-visual-image`.
 */
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolveTenant, preflightCheck, debitUsage, estimateLlmCost } from '../_shared/aiBilling.ts';

async function resolveUserIdFromRequest(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization');
  if (!authHeader?.toLowerCase().startsWith('bearer ')) return null;
  const jwt = authHeader.slice(7).trim();
  if (!jwt) return null;
  // @ts-ignore Deno
  const url = Deno.env.get('SUPABASE_URL')!;
  // @ts-ignore Deno
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const client = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data: { user }, error } = await client.auth.getUser(jwt);
  if (error || !user?.id) return null;
  return user.id;
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const t = raw.trim();
  try {
    return JSON.parse(t) as Record<string, unknown>;
  } catch {
    const m = t.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/** Post-traitement des champs « ready » : 3 prompts + score — aligné skill .cursor/skills/liri-image-pro/SKILL.md */
function normalizeReadyFields(
  parsed: Record<string, unknown>,
  target: string,
): {
  refined_image_prompt_en: string;
  prompt_tiktok_9_16_en: string;
  prompt_poster_16_9_en: string;
  prompt_ad_4_5_en: string;
  quality_score: number;
  weak_prompt_corrected: boolean;
  correction_note_fr: string;
  risk_note_fr: string;
} {
  let poster = String(parsed.prompt_poster_16_9_en ?? '').trim();
  let tiktok = String(parsed.prompt_tiktok_9_16_en ?? '').trim();
  let ad = String(parsed.prompt_ad_4_5_en ?? '').trim();
  let refined = String(parsed.refined_image_prompt_en ?? '').trim();

  if (!poster && refined) poster = refined;
  if (!refined && poster) refined = poster;
  if (!tiktok && poster) tiktok = poster;
  if (!ad && poster) ad = poster;

  if (target === 'thumbnail' && !poster && refined) poster = refined;

  let score = Number(parsed.quality_score);
  if (!Number.isFinite(score)) score = 0;

  return {
    refined_image_prompt_en: refined || poster,
    prompt_tiktok_9_16_en: tiktok || poster,
    prompt_poster_16_9_en: poster || refined,
    prompt_ad_4_5_en: ad || poster,
    quality_score: score,
    weak_prompt_corrected: Boolean(parsed.weak_prompt_corrected),
    correction_note_fr: String(parsed.correction_note_fr ?? '').trim(),
    risk_note_fr: String(parsed.risk_note_fr ?? '').trim(),
  };
}

function mergeReadyIntoPayload(
  base: Record<string, unknown>,
  normalized: ReturnType<typeof normalizeReadyFields>,
): Record<string, unknown> {
  return {
    ...base,
    refined_image_prompt_en: normalized.refined_image_prompt_en,
    prompt_tiktok_9_16_en: normalized.prompt_tiktok_9_16_en,
    prompt_poster_16_9_en: normalized.prompt_poster_16_9_en,
    prompt_ad_4_5_en: normalized.prompt_ad_4_5_en,
    quality_score: normalized.quality_score,
    weak_prompt_corrected: normalized.weak_prompt_corrected,
    correction_note_fr: normalized.correction_note_fr,
    risk_note_fr: normalized.risk_note_fr,
  };
}

// @ts-ignore Deno
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const userId = await resolveUserIdFromRequest(req);
  if (!userId) {
    return json(401, { error: 'Unauthorized', details: 'JWT requis.' });
  }

  // @ts-ignore Deno
  const openaiKey = String(Deno.env.get('OPENAI_API_KEY') || '').trim();
  if (!openaiKey) {
    return json(503, {
      error: 'OPENAI_API_KEY manquant',
      details: 'Configurez OPENAI_API_KEY sur les secrets Supabase (Edge Functions).',
    });
  }

  let body: {
    step?: string;
    target?: string;
    liveContext?: Record<string, unknown>;
    userPrompt?: string;
    initialUserPrompt?: string;
    clarificationQA?: Array<{ question?: string; answer?: string }>;
    messages?: Array<{ role?: string; content?: string }>;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const step = String(body?.step || 'interpret').toLowerCase();
  const target = body?.target === 'thumbnail' ? 'thumbnail' : 'cover';
  const liveContext = body?.liveContext && typeof body.liveContext === 'object' ? body.liveContext : {};
  const userPrompt = String(body?.userPrompt || '').trim();
  const initialUserPromptChat = String(body?.initialUserPrompt || '').trim();

  const aspectHint =
    target === 'cover'
      ? 'Format visuel large 16:9 (bannière / couverture vidéo). Composition horizontale lisible.'
      : 'Format carré 1:1 (miniature). Sujet fort au centre, lisible en petit.';

  /** Alignement sur le rendu cible LIRI : une grande scène + typo dorée structurée (pas infographie triptyque confuse). */
  const liriPosterReference =
    `\n\nRéférence qualité LIRI / Architect (affiche masterclasse live) :\n` +
    `- Privilégier UNE scène cinématographique principale forte (photo réaliste ou rendu éditorial premium) : sujet en pleine action rituelle ou pédagogique, contre-jour doré chaud, profondeur de champ, détails culturels crédibles. Éviter les grilles « triptyque » avec multiples mini-panneaux et faux titres anglais/gibberish (ex. ORIGIIN/ORICTION).\n` +
    `- Palette : noir profond, or métallique / embossé, bruns terre, ivoire pour le texte ; pas de mélange esthétique chrétien par défaut si le thème est initiatique africain.\n` +
    `- Hiérarchie typo possible sur la couverture live : petit badge LIVE (pastille rouge + picto lecture) en coin ; bandeau « MASTER CLASSE » dans un cadre doré fin ; titre principal très lisible ; ligne intervenant / promesse ; bandeau horizontal doré avec phrase-clé ; deux zones THÉORIE et PRATIQUE avec courtes lignes en français et icônes simples ; fine citation émotionnelle en bas ; ligne de mots-clés en footer si pertinent.\n` +
    `- Dans refined_image_prompt_en / prompts dérivés (anglais), décrire la mise en page ET lister explicitement chaque texte français à afficher sur l’affiche (orthographe et accents corrects), pour que le générateur les rende lisibles. Éviter texte anglais inutile sur l’affiche sauf demande.\n` +
    `- À éviter : surcharge décorative, typo minuscule illisible, style cartoon sauf demande, symboles génériques hors sujet.\n`;

  /** Condensé skill `.cursor/skills/liri-image-pro/SKILL.md` — analyse, score, 3 formats, anti-prompt faible. */
  const liriImageProRules =
    `\n\n[LIRI IMAGE PRO — obligatoire avant toute livraison « ready »]\n` +
    `- Tu agis comme directeur artistique premium : analyser intention, public, émotion ; éviter images « génériques IA », texte illisible, surcharge d’icônes, diagrammes quand une affiche est demandée.\n` +
    `- **Score qualité \`quality_score\` (0–100)** selon : clarté du message /20, impact visuel /20, lisibilité mobile /15, cohérence culturelle /15, émotion /10, potentiel commercial /10, originalité /10.\n` +
    `- **Règle score &lt; 85** : ne livre JAMAIS des prompts faibles sans les avoir **corrigés** au préalable. Si le premier jet serait &lt; 85, réécris les prompts anglais jusqu’à un niveau premium ; mets \`weak_prompt_corrected\`: true et résume en \`correction_note_fr\`.\n` +
    `- **Trois prompts anglais distincts** quand phase est « ready » (ou finalize) :\n` +
    `  • \`prompt_tiktok_9_16_en\` : vertical 9:16 — peu de texte, sujet/visage ou action centrée, contraste fort, safe zones haut/bas pour UI mobile.\n` +
    `  • \`prompt_poster_16_9_en\` : paysage 16:9 — affiche live / bannière premium (${aspectHint}).\n` +
    `  • \`prompt_ad_4_5_en\` : ratio **4:5** — feed réseaux ; préciser dans le prompt « vertical 4:5 portrait crop », titre lisible, hiérarchie claire (taille carrée API peut suivre : composer pour cadre 4:5).\n` +
    `- \`refined_image_prompt_en\` doit être aligné sur **prompt_poster_16_9_en** (copie identique ou variante mineure cohérente).\n` +
    `- \`risk_note_fr\` : court avertissement si un risque subsiste (optionnel, "" sinon).\n`;

  const sharedReadyJsonFields =
    `\n` +
    `  "quality_score": number,\n` +
    `  "weak_prompt_corrected": boolean,\n` +
    `  "correction_note_fr": string,\n` +
    `  "risk_note_fr": string,\n` +
    `  "refined_image_prompt_en": string,\n` +
    `  "prompt_tiktok_9_16_en": string,\n` +
    `  "prompt_poster_16_9_en": string,\n` +
    `  "prompt_ad_4_5_en": string,\n` +
    `  "what_will_be_created_fr": string,\n` +
    `  "composition_notes_fr": string\n`;

  const systemInterpret =
    `Tu es un directeur artistique pour des affiches et visuels de lives éducatifs en ligne (streaming). ` +
    `Tu dialogues en français avec le formateur.\n\n` +
    `Tu dois répondre avec UN SEUL objet JSON valide (pas de markdown autour), schéma strict :\n` +
    `{\n` +
    `  "phase": "need_info" | "ready",\n` +
    `  "assistant_message_fr": string,\n` +
    `  "questions": [ { "id": string, "label": string, "placeholder": string } ],\n` +
    sharedReadyJsonFields.slice(1) +
    `}\n\n` +
    `Règles :\n` +
    `- Utilise liveContext (titre, description du live) pour comprendre le sujet et l’ambiance.\n` +
    `- Si des informations UTILES pour une excellente affiche manquent (public cible, niveau, tonalité, contraintes de marque ou couleurs, éléments à éviter), mets phase à "need_info" et pose AU PLUS 3 questions courtes et pertinentes. Dans ce cas questions non vide ; mets les champs prompts anglais à "" et quality_score à 0.\n` +
    `- Si tu as assez d’éléments dès maintenant, phase "ready", questions []. Applique LIRI IMAGE PRO : trois prompts anglais + score ; corrige tout prompt qui serait encore &lt; 85 avant livraison.\n` +
    `- Quand phase est "ready", les prompts EN ANGLAIS doivent être détaillés pour DALL·E / Imagen — sans texte illisible ni surcharge.\n` +
    `- what_will_be_created_fr : en français, 2 à 5 phrases sur ce que montrera visuellement l’image.\n` +
    `- composition_notes_fr : notes courtes (couleurs, hiérarchie visuelle) en français.\n` +
    `- assistant_message_fr : ton bienveillant ; mentionne brièvement le score et les trois formats si pertinent.` +
    liriPosterReference +
    liriImageProRules;

  const systemChat =
    `Tu es un directeur artistique pour des affiches et visuels de lives éducatifs en ligne (streaming). ` +
    `Tu dialogues en français avec le formateur : pose des questions ciblées sur le public, le ton, les couleurs, ce qu’il faut mettre en avant ou éviter, jusqu’à maîtriser le sujet.\n\n` +
    `Réponds avec UN SEUL objet JSON valide (pas de markdown autour), schéma strict :\n` +
    `{\n` +
    `  "phase": "continue" | "ready",\n` +
    `  "assistant_message_fr": string,\n` +
    sharedReadyJsonFields.slice(1) +
    `}\n\n` +
    `Règles :\n` +
    `- Si tu as encore besoin de précisions pour une excellente affiche, phase "continue" : assistant_message_fr = ta réponse (questions ou synthèse courte). Les prompts anglais peuvent être "" ; quality_score 0.\n` +
    `- Quand tu as assez d’informations, phase "ready" : applique LIRI IMAGE PRO — trois prompts anglais + score ; corrige obligatoirement tout résultat &lt; 85 avant de livrer.\n` +
    `- Réponds au dernier message utilisateur dans la conversation fournie.` +
    liriPosterReference +
    liriImageProRules;

  const systemFinalize =
    `Tu es un directeur artistique pour affiches de lives éducatifs. Le formateur a répondu à tes questions. ` +
    `Réponds avec UN SEUL objet JSON valide, schéma strict :\n` +
    `{\n` +
    `  "assistant_message_fr": string,\n` +
    sharedReadyJsonFields.slice(1) +
    `}\n\n` +
    `assistant_message_fr résume la proposition (français). Applique LIRI IMAGE PRO : trois prompts anglais + score ; refined_image_prompt_en aligné sur prompt_poster_16_9_en ; ${aspectHint}\n` +
    `Pas de texte détaillé illisible dans l’image ; pour une affiche masterclasse, prévoir les phrases françaises exactes à graver dans les prompts.\n` +
    `Ne livre pas de prompts faibles : corrige jusqu’à quality_score ≥ 85.` +
    liriPosterReference +
    liriImageProRules;

  let messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;

  if (step === 'chat') {
    const rawMsgs = Array.isArray(body?.messages) ? body.messages! : [];
    const trimmed = rawMsgs
      .map((m) => ({
        role: String(m?.role || '').toLowerCase() === 'assistant' ? 'assistant' as const : 'user' as const,
        content: String(m?.content || '').trim(),
      }))
      .filter((m) => m.content.length > 0);
    const capped = trimmed.length > 28 ? trimmed.slice(-28) : trimmed;

    if (!initialUserPromptChat) {
      return json(400, { error: 'initialUserPrompt requis pour step chat' });
    }
    if (capped.length < 1) {
      return json(400, { error: 'messages doit contenir au moins un message' });
    }
    const last = capped[capped.length - 1];
    if (last.role !== 'user') {
      return json(400, { error: 'Le dernier message doit être du formateur (user).' });
    }

    const contextBlock =
      `Contexte live (JSON) :\n${JSON.stringify(liveContext)}\n\n` +
      `Format cible : ${target} — ${aspectHint}\n\n` +
      `Idée initiale du formateur (à garder en tête) :\n${initialUserPromptChat}`;

    messages = [
      { role: 'system', content: systemChat },
      { role: 'user', content: contextBlock },
      ...capped.map((m) => ({ role: m.role, content: m.content })),
    ];
  } else if (step === 'finalize') {
    const qa = Array.isArray(body?.clarificationQA) ? body!.clarificationQA! : [];
    if (!qa.length) {
      return json(400, { error: 'clarificationQA requis pour step finalize' });
    }
    if (!userPrompt) {
      return json(400, { error: 'userPrompt requis' });
    }
    const qaStr = qa
      .map((x) => {
        const q = String(x?.question || '').trim();
        const a = String(x?.answer || '').trim();
        return q ? `Q: ${q}\nR: ${a}` : '';
      })
      .filter(Boolean)
      .join('\n\n');
    messages = [
      { role: 'system', content: systemFinalize },
      {
        role: 'user',
        content: JSON.stringify({
          liveContext,
          target,
          aspectHint,
          originalUserIdea: userPrompt,
          clarificationAnswers: qaStr,
        }),
      },
    ];
  } else if (step === 'interpret') {
    if (!userPrompt) {
      return json(400, { error: 'userPrompt requis' });
    }
    messages = [
      { role: 'system', content: systemInterpret },
      {
        role: 'user',
        content: JSON.stringify({
          liveContext,
          target,
          aspectHint,
          userPrompt,
        }),
      },
    ];
  } else {
    return json(400, { error: 'step inconnu : interpret | finalize | chat' });
  }

  const chatModelTokens =
    step === 'chat' ? 3800 : step === 'interpret' || step === 'finalize' ? 4200 : 1600;

  // ─── LIRI Credits — Tenant + preflight ────────────────────────────────
  const billingCtx = await resolveTenant(req, body);
  if (billingCtx) {
    const promptText = messages.map((m) => m.content).join('\n');
    const estimate = await estimateLlmCost(billingCtx, 'openai', 'gpt-4o-mini', promptText, chatModelTokens);
    const reject = await preflightCheck(billingCtx, estimate);
    if (reject) {
      const errBody = await reject.json();
      return new Response(JSON.stringify(errBody), {
        status: reject.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  const billingTrack = { provider: 'openai', model: 'gpt-4o-mini', tokens_in: 0, tokens_out: 0 };

  const abort = new AbortController();
  const t = setTimeout(() => abort.abort(), 55_000);
  let raw = '';
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: step === 'finalize' ? 0.35 : step === 'chat' ? 0.38 : 0.4,
        max_tokens: chatModelTokens,
        response_format: { type: 'json_object' },
        messages,
      }),
      signal: abort.signal,
    });
    clearTimeout(t);
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('studio-cover-prompt-assistant OpenAI', res.status, errText.slice(0, 500));
      return json(502, {
        error: 'OpenAI error',
        details: `HTTP ${res.status}`,
      });
    }
    const data = await res.json();
    raw = String(data?.choices?.[0]?.message?.content || '').trim();
    billingTrack.tokens_in = data?.usage?.prompt_tokens ?? 0;
    billingTrack.tokens_out = data?.usage?.completion_tokens ?? 0;
  } catch (e) {
    clearTimeout(t);
    console.error('studio-cover-prompt-assistant', (e as Error)?.message);
    return json(504, { error: 'Timeout ou échec réseau vers OpenAI.' });
  }

  async function withBilling(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (!billingCtx) return payload;
    const debitIn = await debitUsage(billingCtx, {
      functionName: 'studio-cover-prompt-assistant',
      provider: billingTrack.provider, model: billingTrack.model,
      unitType: 'tokens_in', unitAmount: billingTrack.tokens_in, metadata: { step, target },
    });
    const debitOut = await debitUsage(billingCtx, {
      functionName: 'studio-cover-prompt-assistant',
      provider: billingTrack.provider, model: billingTrack.model,
      unitType: 'tokens_out', unitAmount: billingTrack.tokens_out,
    });
    return {
      ...payload,
      _billing: {
        provider: billingTrack.provider, model: billingTrack.model,
        tokens_in: billingTrack.tokens_in, tokens_out: billingTrack.tokens_out,
        credits_charged: (debitIn.charged ?? 0) + (debitOut.charged ?? 0),
        balance: debitOut.balance ?? debitIn.balance,
      },
    };
  }

  const parsed = extractJsonObject(raw);
  if (!parsed) {
    return json(502, { error: 'Réponse OpenAI invalide', raw: raw.slice(0, 400) });
  }

  if (step === 'finalize') {
    const n = normalizeReadyFields(parsed, target);
    return json(
      200,
      await withBilling(mergeReadyIntoPayload(
        {
          phase: 'ready',
          assistant_message_fr: String(parsed.assistant_message_fr || ''),
          what_will_be_created_fr: String(parsed.what_will_be_created_fr || '').trim(),
          composition_notes_fr: String(parsed.composition_notes_fr || '').trim(),
        },
        n,
      )),
    );
  }

  if (step === 'chat') {
    const phaseChat = parsed.phase === 'ready' ? 'ready' : 'continue';
    if (phaseChat === 'ready') {
      const n = normalizeReadyFields(parsed, target);
      return json(
        200,
        await withBilling(mergeReadyIntoPayload(
          {
            phase: 'ready',
            assistant_message_fr: String(parsed.assistant_message_fr || ''),
            what_will_be_created_fr: String(parsed.what_will_be_created_fr || '').trim(),
            composition_notes_fr: String(parsed.composition_notes_fr || '').trim(),
          },
          n,
        )),
      );
    }
    return json(200, await withBilling({
      phase: 'continue',
      assistant_message_fr: String(parsed.assistant_message_fr || ''),
      refined_image_prompt_en: String(parsed.refined_image_prompt_en || '').trim(),
      prompt_tiktok_9_16_en: String(parsed.prompt_tiktok_9_16_en || '').trim(),
      prompt_poster_16_9_en: String(parsed.prompt_poster_16_9_en || '').trim(),
      prompt_ad_4_5_en: String(parsed.prompt_ad_4_5_en || '').trim(),
      what_will_be_created_fr: String(parsed.what_will_be_created_fr || '').trim(),
      composition_notes_fr: String(parsed.composition_notes_fr || '').trim(),
      quality_score: Number(parsed.quality_score) || 0,
      weak_prompt_corrected: Boolean(parsed.weak_prompt_corrected),
      correction_note_fr: String(parsed.correction_note_fr || '').trim(),
      risk_note_fr: String(parsed.risk_note_fr || '').trim(),
    }));
  }

  const phase = parsed.phase === 'ready' ? 'ready' : 'need_info';
  const questions = Array.isArray(parsed.questions) ? parsed.questions : [];

  if (phase === 'ready') {
    const n = normalizeReadyFields(parsed, target);
    return json(
      200,
      await withBilling(mergeReadyIntoPayload(
        {
          phase: 'ready',
          assistant_message_fr: String(parsed.assistant_message_fr || ''),
          questions: [],
          what_will_be_created_fr: String(parsed.what_will_be_created_fr || '').trim(),
          composition_notes_fr: String(parsed.composition_notes_fr || '').trim(),
        },
        n,
      )),
    );
  }

  return json(200, await withBilling({
    phase: 'need_info',
    assistant_message_fr: String(parsed.assistant_message_fr || ''),
    questions: questions
      .map((q: unknown) => {
        const o = q as Record<string, unknown>;
        const id = String(o?.id || '').trim() || `q_${Math.random().toString(36).slice(2, 9)}`;
        return {
          id,
          label: String(o?.label || '').trim(),
          placeholder: String(o?.placeholder || '').trim(),
        };
      })
      .filter((q: { label: string }) => q.label.length > 0),
    refined_image_prompt_en: '',
    prompt_tiktok_9_16_en: '',
    prompt_poster_16_9_en: '',
    prompt_ad_4_5_en: '',
    what_will_be_created_fr: String(parsed.what_will_be_created_fr || '').trim(),
    composition_notes_fr: String(parsed.composition_notes_fr || '').trim(),
    quality_score: 0,
    weak_prompt_corrected: false,
    correction_note_fr: '',
    risk_note_fr: '',
  }));
});
