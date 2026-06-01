/// <reference lib="deno.ns" />
/**
 * LIRI TTS — synthèse vocale avec chaîne :
 * - tier `live` : ElevenLabs Flash v2.5 → fallback Google Cloud TTS
 * - tier `export` : ElevenLabs Multilingual v2 → fallback Google Cloud TTS
 *
 * Secrets : ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID (optionnel), GOOGLE_CLOUD_TTS_API_KEY
 */
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  ELEVENLABS_MODEL_EXPORT,
  ELEVENLABS_MODEL_LIVE,
  synthesizeWithFallback,
  type TtsTier,
} from '../_shared/liriTtsProviders.ts';
import { resolveTenant, debitUsage, preflightCheck, estimateTtsCost } from '../_shared/aiBilling.ts';

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

// @ts-ignore Deno
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  // @ts-ignore Deno
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  // @ts-ignore Deno
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return json(401, { error: 'Missing Authorization' });
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: { user }, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !user) {
    return json(401, { error: 'Invalid token' });
  }

  let bodyIn: { text?: string; languageCode?: string; tier?: string } = {};
  try {
    bodyIn = (await req.json()) as typeof bodyIn;
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  const text = String(bodyIn.text || '').trim();
  if (text.length < 1) {
    return json(400, { error: 'text required' });
  }
  const clipped = text.slice(0, 4500);
  const languageCode = String(bodyIn.languageCode || 'en').slice(0, 12);
  const tierRaw = String(bodyIn.tier || 'live').toLowerCase();
  const tier: TtsTier = tierRaw === 'export' ? 'export' : 'live';

  // @ts-ignore Deno
  const elevenKey = Deno.env.get('ELEVENLABS_API_KEY')?.trim();
  // @ts-ignore Deno
  const elevenVoiceId = Deno.env.get('ELEVENLABS_VOICE_ID')?.trim();
  // @ts-ignore Deno
  const googleKey = Deno.env.get('GOOGLE_CLOUD_TTS_API_KEY')?.trim();

  if (!elevenKey && !googleKey) {
    return json(503, {
      error: 'TTS not configured',
      detail: 'Set ELEVENLABS_API_KEY and/or GOOGLE_CLOUD_TTS_API_KEY on the Edge function',
    });
  }

  // ─── LIRI Credits — Preflight ────────────────────────────────────────
  const billingCtx = await resolveTenant(req, bodyIn);
  if (billingCtx) {
    const ttsModel = tier === 'export' ? ELEVENLABS_MODEL_EXPORT : ELEVENLABS_MODEL_LIVE;
    const estimate = await estimateTtsCost(billingCtx, 'elevenlabs', ttsModel, clipped);
    const reject = await preflightCheck(billingCtx, estimate);
    if (reject) return reject;
  }

  try {
    const { bytes, mimeType, provider } = await synthesizeWithFallback(clipped, tier, languageCode, {
      elevenKey,
      elevenVoiceId,
      googleKey,
    });

    // ─── LIRI Credits — Débit après synthèse réussie ────────────────────
    let billingInfo: Record<string, unknown> | null = null;
    if (billingCtx) {
      const ttsModel = tier === 'export' ? ELEVENLABS_MODEL_EXPORT : ELEVENLABS_MODEL_LIVE;
      const providerKey = provider === 'google' ? 'google' : 'elevenlabs';
      const modelKey = provider === 'google' ? 'tts-neural' : ttsModel;
      const debit = await debitUsage(billingCtx, {
        functionName: 'liri-tts',
        provider: providerKey,
        model: modelKey,
        unitType: 'chars',
        unitAmount: clipped.length,
        metadata: { language: languageCode, tier, audio_bytes: bytes.length },
      });
      billingInfo = {
        provider: providerKey,
        model: modelKey,
        chars: clipped.length,
        credits_charged: debit.charged,
        balance: debit.balance,
      };
    }

    return json(200, {
      audioBase64: bytesToBase64(bytes),
      mimeType,
      provider,
      tier,
      _billing: billingInfo,
      modelHint: tier === 'export' ? ELEVENLABS_MODEL_EXPORT : ELEVENLABS_MODEL_LIVE,
    });
  } catch (e) {
    const msg = (e as Error)?.message || String(e);
    return json(502, { error: msg });
  }
});
