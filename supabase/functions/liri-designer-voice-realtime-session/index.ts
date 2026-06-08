/// <reference lib="deno.ns" />
/**
 * Crée une session OpenAI Realtime et renvoie le client_secret éphémère (WebRTC / WS).
 * Secrets : OPENAI_API_KEY ; option OPENAI_REALTIME_MODEL (défaut gpt-4o-realtime-preview).
 */
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// @ts-ignore Deno
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json(401, { error: { code: 'MISSING_AUTH', message: 'Authorization requis' } });

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: { user }, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !user) return json(401, { error: { code: 'INVALID_TOKEN', message: 'Token invalide' } });

  const openaiKey = Deno.env.get('OPENAI_API_KEY') || '';
  if (!openaiKey) {
    return json(503, {
      error: {
        code: 'OPENAI_NOT_CONFIGURED',
        message: 'OPENAI_API_KEY manquant sur le projet Edge.',
      },
    });
  }

  const model =
    Deno.env.get('OPENAI_REALTIME_MODEL') || 'gpt-4o-realtime-preview-2024-12-17';

  let bodyIn: { voice?: string; instructions?: string } = {};
  try {
    if ((req.headers.get('Content-Length') || '0') !== '0') {
      bodyIn = (await req.json()) as typeof bodyIn;
    }
  } catch {
    bodyIn = {};
  }

  const res = await fetch('https://api.openai.com/v1/realtime/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      voice: bodyIn.voice || 'alloy',
      modalities: ['text', 'audio'],
      instructions:
        bodyIn.instructions ||
        'Tu es le Copilot pédagogique LIRI pour un SmartBoard. Réponses courtes et actionnables en français.',
    }),
  });

  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      typeof data.error === 'object' && data.error && 'message' in (data.error as object)
        ? String((data.error as { message?: string }).message)
        : res.statusText;
    return json(502, {
      error: {
        code: 'OPENAI_SESSION_FAILED',
        message: msg,
      },
    });
  }

  return json(200, {
    ok: true,
    model: data.model ?? model,
    client_secret: data.client_secret ?? null,
    expires_at: data.expires_at ?? null,
    id: data.id ?? null,
  });
});
