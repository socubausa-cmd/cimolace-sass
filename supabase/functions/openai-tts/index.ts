// OPENAI TTS — voix NATURELLE type NotebookLM / mode vocal ChatGPT (gpt-4o-mini-tts).
// POST https://api.openai.com/v1/audio/speech  { model, voice, input, instructions, speed }
// Renvoie { audioBase64, mimeType, voice } (comme liri-tts / mistral-tts). Auth = JWT requis.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, obj: Record<string, unknown>) =>
  new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// Voix OpenAI multilingues, chaleureuses (parlent le français naturellement).
const ALLOWED_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer', 'verse'];
const DEFAULT_VOICE = 'coral';
const DEFAULT_MODEL = 'gpt-4o-mini-tts';
const FR_INSTRUCTIONS =
  'Parle FRANÇAIS comme si tu EXPLIQUAIS à un ami assis en face de toi — décontracté, chaleureux, complice. ' +
  'SURTOUT PAS un ton de lecture ni de livre audio, PAS monocorde. C’est une VRAIE conversation : ' +
  'varie beaucoup l’intonation, insiste sur les mots importants, ralentis sur les idées-clés, accélère un peu sur le reste, ' +
  'fais de VRAIES respirations et de vraies pauses (silences) aux virgules et entre les phrases, monte nettement le ton aux questions. ' +
  'Ajoute le naturel d’un prof qui réfléchit à voix haute. Énergie vivante, jamais plat, jamais robotique.';

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  // @ts-ignore Deno btoa
  return btoa(bin);
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
  const key = (Deno.env.get('OPENAI_API_KEY') || '').trim();
  if (!key) return json(503, { error: 'OPENAI_API_KEY not configured' });

  let body: { text?: string; input?: string; voice?: string; speed?: number; model?: string } = {};
  try { body = await req.json(); } catch { return json(400, { error: 'Invalid JSON' }); }
  const text = String(body.text || body.input || '').trim().slice(0, 4000);
  if (!text) return json(400, { error: 'text required' });

  const voice = ALLOWED_VOICES.includes(String(body.voice)) ? String(body.voice) : DEFAULT_VOICE;
  const speed = Math.max(0.5, Math.min(1.4, Number(body.speed) || 1.0));
  const model = String(body.model || DEFAULT_MODEL);

  const call = async (mdl: string, withInstructions: boolean) => {
    const payload: Record<string, unknown> = { model: mdl, voice, input: text, response_format: 'mp3', speed };
    if (withInstructions) payload.instructions = FR_INSTRUCTIONS; // supporté par gpt-4o-mini-tts
    return fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  };

  try {
    let resp = await call(model, model.includes('gpt-4o'));
    // repli si le modèle gpt-4o-mini-tts n'est pas dispo sur le compte → tts-1-hd
    if (!resp.ok && (resp.status === 400 || resp.status === 404)) {
      resp = await call('tts-1-hd', false);
    }
    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      return json(resp.status === 401 ? 502 : resp.status, { error: `openai ${resp.status}`, detail: detail.slice(0, 300), voice });
    }
    const audioBase64 = bytesToBase64(new Uint8Array(await resp.arrayBuffer()));
    if (!audioBase64) return json(502, { error: 'no audio from openai', voice });
    return json(200, { audioBase64, mimeType: 'audio/mpeg', voice, provider: 'openai-tts' });
  } catch (e) {
    return json(500, { error: String((e as Error)?.message || e) });
  }
});
