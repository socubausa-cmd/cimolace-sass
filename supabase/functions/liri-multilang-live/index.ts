/// <reference lib="deno.ns" />
/**
 * liri-multilang-live — démarre une session traduction live (enregistrement DB + estimation crédits).
 * POST { room_label?, source_lang?, target_langs?, estimated_minutes?, participant_hint?, metadata? }
 */
import { corsHeaders } from '../_shared/cors.ts';
import { startLiveSession } from '../_shared/liriMultilangLive.ts';
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

  // @ts-ignore Deno
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  // @ts-ignore Deno
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return json(401, { error: 'Missing Authorization' });

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: { user }, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !user) return json(401, { error: 'Invalid token' });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  try {
    const out = await startLiveSession(admin, user.id, body);
    return json(200, out);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json(500, { error: msg });
  }
});
