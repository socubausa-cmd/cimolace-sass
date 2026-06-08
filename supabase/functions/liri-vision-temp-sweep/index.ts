/// <reference lib="deno.ns" />
/**
 * Tâche planifiée ou manuelle : exécute sweep_liri_vision_temp_objects() via service role.
 * Header optionnel : X-Liri-Sweep-Secret doit matcher LIRI_VISION_SWEEP_SECRET si défini.
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

  const secret = Deno.env.get('LIRI_VISION_SWEEP_SECRET') || '';
  if (secret) {
    const h = req.headers.get('X-Liri-Sweep-Secret') || '';
    if (h !== secret) return json(403, { error: { code: 'FORBIDDEN', message: 'Secret invalide' } });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !serviceKey) {
    return json(503, { error: { code: 'MISSING_CONFIG', message: 'Supabase service non configuré' } });
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data, error } = await admin.rpc('sweep_liri_vision_temp_objects');
  if (error) {
    return json(500, { error: { code: 'RPC_FAILED', message: error.message } });
  }
  return json(200, { deleted: typeof data === 'number' ? data : 0, ok: true });
});
