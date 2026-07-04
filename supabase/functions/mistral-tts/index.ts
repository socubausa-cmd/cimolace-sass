// MISTRAL VOXTRAL TTS — voix française réaliste (voxtral-mini-tts-2603).
// POST https://api.mistral.ai/v1/audio/speech  { model, input, voice }
// Renvoie { audioBase64, mimeType, voice } (comme liri-tts). Auth = JWT de session requis.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, obj: Record<string, unknown>) =>
  new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const MODEL = 'voxtral-mini-tts-2603';
let _frVoice: string | null = null;

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  // @ts-ignore Deno btoa
  return btoa(bin);
}

// Trouve une voix preset FRANÇAISE (sinon celle demandée, sinon repli).
async function frenchVoice(key: string, requested?: string): Promise<string> {
  if (requested) return requested;
  if (_frVoice) return _frVoice;
  try {
    const r = await fetch('https://api.mistral.ai/v1/audio/voices', { headers: { Authorization: `Bearer ${key}` } });
    if (r.ok) {
      const data = await r.json();
      const arr: any[] = Array.isArray(data) ? data : (data?.voices || data?.data || []);
      const isFr = (v: any) => /(\bfr\b|fr[_-]|french|français|france)/i.test(`${v?.id || ''} ${v?.name || ''} ${v?.language || ''} ${v?.locale || ''} ${v?.lang || ''}`);
      const fr = arr.find(isFr);
      const id = fr?.id || fr?.name || fr?.voice_id;
      if (id) { _frVoice = String(id); return _frVoice; }
    }
  } catch { /* on tombe sur le repli */ }
  _frVoice = 'casual_male'; // repli si le listing échoue (à ajuster avec le vrai nom FR)
  return _frVoice;
}

// @ts-ignore Deno
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'POST only' });

  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return json(401, { error: 'Missing Authorization' });

  // @ts-ignore Deno
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  // @ts-ignore Deno
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const admin = createClient(supabaseUrl, serviceKey);
  const { data: { user }, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !user) return json(401, { error: 'Invalid token' });

  // @ts-ignore Deno
  const key = (Deno.env.get('MISTRAL_API_KEY') || '').trim();
  if (!key) return json(503, { error: 'MISTRAL_API_KEY not configured' });

  let body: { text?: string; input?: string; voice?: string } = {};
  try { body = await req.json(); } catch { return json(400, { error: 'Invalid JSON' }); }
  const text = String(body.text || body.input || '').trim().slice(0, 4000);
  if (!text) return json(400, { error: 'text required' });

  const voice = await frenchVoice(key, body.voice);

  try {
    const resp = await fetch('https://api.mistral.ai/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, input: text, voice, response_format: 'mp3' }),
    });
    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      return json(resp.status === 401 ? 502 : resp.status, { error: `mistral ${resp.status}`, detail: detail.slice(0, 300), voice });
    }
    const ct = resp.headers.get('content-type') || '';
    let audioBase64 = '';
    if (ct.includes('application/json')) {
      const j = await resp.json();
      audioBase64 = String(j?.audio_data || j?.audio || j?.audioBase64 || j?.data || '');
    } else {
      audioBase64 = bytesToBase64(new Uint8Array(await resp.arrayBuffer()));
    }
    if (!audioBase64) return json(502, { error: 'no audio from mistral', voice });
    return json(200, { audioBase64, mimeType: 'audio/mpeg', voice, provider: 'mistral-voxtral' });
  } catch (e) {
    return json(500, { error: String((e as Error)?.message || e) });
  }
});
