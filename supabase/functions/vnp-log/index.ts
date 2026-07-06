/// <reference lib="deno.ns" />
/**
 * vnp-log — journal d'événements de la conversation VNP « vibe-surfing » (spec §6).
 *
 * Public (pré-signup, --no-verify-jwt). Body { type, payload?, tenantSlug?, userSession?, source? }.
 * Insert server-side dans `analytics_events` via SERVICE ROLE (le VNP est anonyme → pas d'insert client).
 * Répond TOUJOURS 200 { ok:true } — même en erreur — pour ne JAMAIS bruiter le front (fire-and-forget).
 * Anti-abus edge public : type validé contre une allowlist, payload borné à 4 Ko.
 */
import { corsHeaders } from '../_shared/cors.ts';

const ok = () =>
  new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

// Types canoniques autorisés (doc §6). Tout autre type est ignoré silencieusement.
const ALLOWED = new Set([
  'node_opened', 'vnp_chat', 'action_triggered', 'contact_submitted', 'tenant_created',
  'unanswered_question', 'phase_transition', 'shortcut_click', 'edge_chat', 'edge_agent_brain',
]);

// @ts-ignore
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const type = String(body?.type || '').slice(0, 60);
    if (!ALLOWED.has(type)) return ok(); // type inconnu → drop silencieux

    // @ts-ignore
    const url = Deno.env.get('SUPABASE_URL');
    // @ts-ignore
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return ok();

    let payload = body?.payload && typeof body.payload === 'object' ? body.payload : {};
    let payloadStr = '{}';
    try { payloadStr = JSON.stringify(payload); } catch { payloadStr = '{}'; }
    if (payloadStr.length > 4000) payloadStr = JSON.stringify({ _truncated: true });

    // Insert best-effort ; on n'attend PAS l'échec pour répondre (mais on await pour éviter un abort).
    await fetch(`${url}/rest/v1/analytics_events`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        type,
        payload: JSON.parse(payloadStr),
        tenant_slug: body?.tenantSlug ? String(body.tenantSlug).slice(0, 60) : null,
        user_session: body?.userSession ? String(body.userSession).slice(0, 80) : null,
        source: body?.source ? String(body.source).slice(0, 30) : 'vnp',
      }),
    }).catch(() => {});

    return ok();
  } catch {
    return ok();
  }
});
