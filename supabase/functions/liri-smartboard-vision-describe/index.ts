/// <reference lib="deno.ns" />

/** Analyse d’image (capture caméra / canvas) pour le Copilot SmartBoard — Claude vision → OpenAI vision. */
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function stripDataUrl(b64OrDataUrl: string, mimeFallback: string): { b64: string; mime: string } {
  const s = String(b64OrDataUrl || '').trim();
  const m = s.match(/^data:([^;]+);base64,(.+)$/is);
  if (m) {
    return { mime: m[1] || mimeFallback, b64: m[2].replace(/\s/g, '') };
  }
  return { mime: mimeFallback, b64: s.replace(/\s/g, '') };
}

async function describeWithClaude(opts: {
  apiKey: string;
  model: string;
  b64: string;
  mediaType: string;
  userPrompt: string;
}): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': opts.apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: 1200,
      temperature: 0.4,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: opts.mediaType,
                data: opts.b64,
              },
            },
            { type: 'text', text: opts.userPrompt },
          ],
        },
      ],
    }),
  });
  const payload = (await res.json().catch(() => ({}))) as {
    content?: Array<{ type?: string; text?: string }>;
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(payload?.error?.message || `Anthropic HTTP ${res.status}`);
  }
  const text = (payload.content || [])
    .map((b) => (b.type === 'text' ? b.text || '' : ''))
    .join('')
    .trim();
  if (!text) throw new Error('Claude vision: réponse vide');
  return text;
}

async function describeWithOpenAI(opts: {
  apiKey: string;
  model: string;
  b64: string;
  mime: string;
  userPrompt: string;
}): Promise<string> {
  const url = `data:${opts.mime};base64,${opts.b64}`;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: 1200,
      temperature: 0.4,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: opts.userPrompt },
            { type: 'image_url', image_url: { url } },
          ],
        },
      ],
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(data?.error?.message || `OpenAI HTTP ${res.status}`);
  }
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) throw new Error('OpenAI vision: réponse vide');
  return text.trim();
}

// @ts-ignore Deno
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { error: 'Missing Authorization' });

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: { user }, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !user) return json(401, { error: 'Invalid token' });

  let body: {
    imageBase64?: string;
    mimeType?: string;
    lang?: string;
    centralIdea?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  const rawInput = String(body?.imageBase64 || '').trim();
  if (!rawInput) return json(400, { error: 'imageBase64 requis' });

  const mimeFallback = String(body?.mimeType || 'image/jpeg').trim() || 'image/jpeg';
  const { b64, mime } = stripDataUrl(rawInput, mimeFallback);

  if (b64.length < 80) return json(400, { error: 'Image trop petite ou invalide' });
  /** ~4.5 Mo base64 */
  if (b64.length > 6_200_000) {
    return json(413, { error: 'Image trop volumineuse (réduire la résolution).' });
  }

  const lang = String(body?.lang || 'fr').trim();
  const idea = String(body?.centralIdea || '').trim();

  const userPrompt =
    lang === 'en'
      ? `You are the LIRI SmartBoard copilot. Describe what this image shows (educational slide, diagram, photo, whiteboard, etc.) in 3–5 short sentences. Then suggest 2 concrete ways to use it on a teaching slide.${idea ? `\n\nAuthor focus / central idea: ${idea.slice(0, 800)}` : ''}\n\nReply in English, concise.`
      : `Tu es le Copilot SmartBoard LIRI. Décris ce que montre cette image (slide pédagogique, schéma, photo, tableau, etc.) en 3 à 5 phrases courtes. Puis propose 2 pistes concrètes pour l’intégrer dans une scène de cours.${idea ? `\n\nIntention / idée centrale de l’auteur : ${idea.slice(0, 800)}` : ''}\n\nRéponds en français, style clair et actionnable.`;

  // @ts-ignore Deno
  const env = (k: string) => String(Deno.env.get(k) || '').trim();
  /** Ne pas réutiliser le modèle texte seul : la vision exige un modèle multimodal Anthropic. */
  const claudeModel = env('SMARTBOARD_VISION_CLAUDE_MODEL') || 'claude-3-5-haiku-20241022';
  const openaiModel = env('OPENAI_VISION_MODEL') || env('OPENAI_MODEL') || 'gpt-4o-mini';

  // ─── LIRI Credits — Résolution tenant ─────────────────────────────────
  const { resolveTenant, debitUsage } = await import('../_shared/aiBilling.ts');
  const billingCtx = await resolveTenant(req, body);

  const debitVision = async (provider: string, model: string, inputTokens: number, outputTokens: number) => {
    if (!billingCtx) return null;
    await debitUsage(billingCtx, { functionName: 'liri-smartboard-vision-describe', provider, model, unitType: 'tokens_in', unitAmount: inputTokens, metadata: { lang, image_kb: Math.round(b64.length/1024) } });
    const d = await debitUsage(billingCtx, { functionName: 'liri-smartboard-vision-describe', provider, model, unitType: 'tokens_out', unitAmount: outputTokens });
    return { provider, model, tokens_in: inputTokens, tokens_out: outputTokens, credits_charged: d.charged, balance: d.balance };
  };

  const anthropicKey = env('ANTHROPIC_API_KEY');
  if (anthropicKey) {
    try {
      const description = await describeWithClaude({
        apiKey: anthropicKey,
        model: claudeModel,
        b64,
        mediaType: mime,
        userPrompt,
      });
      // Estimation tokens (image ~ 1500 tokens vision, output ~ texte / 4)
      const estInTokens = 1500 + Math.ceil(userPrompt.length / 4);
      const estOutTokens = Math.ceil(description.length / 4);
      const _billing = await debitVision('anthropic', claudeModel, estInTokens, estOutTokens);
      return json(200, { description, provider: 'claude', _billing });
    } catch (e) {
      console.warn('[liri-smartboard-vision-describe] Claude:', (e as Error)?.message);
    }
  }

  const openaiKey = env('OPENAI_API_KEY');
  if (openaiKey) {
    try {
      const description = await describeWithOpenAI({
        apiKey: openaiKey,
        model: openaiModel,
        b64,
        mime,
        userPrompt,
      });
      const estInTokens = 1500 + Math.ceil(userPrompt.length / 4);
      const estOutTokens = Math.ceil(description.length / 4);
      const _billing = await debitVision('openai', openaiModel, estInTokens, estOutTokens);
      return json(200, { description, provider: 'openai', _billing });
    } catch (e) {
      console.warn('[liri-smartboard-vision-describe] OpenAI:', (e as Error)?.message);
    }
  }

  return json(503, {
    error:
      'Aucun fournisseur vision disponible (ANTHROPIC_API_KEY ou OPENAI_API_KEY requis).',
  });
});
