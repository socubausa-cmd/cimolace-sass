/// <reference lib="deno.ns" />
/**
 * vnp-log — journal d'événements de la conversation VNP « vibe-surfing » (spec §6).
 *
 * Public (pré-signup, --no-verify-jwt). Body { type, payload?, tenantSlug?, userSession?, source? }.
 * Insert server-side dans `analytics_events` via SERVICE ROLE (le VNP est anonyme → pas d'insert client).
 * Répond TOUJOURS 200 { ok:true } — même en erreur — pour ne JAMAIS bruiter le front (fire-and-forget).
 *
 * Durcissement (audit VNP #2, sécurité) :
 *  - CORS restreinte (parité edge `vnp`) : ne reflète QUE les origines autorisées (fini `*`).
 *  - `tenantSlug` validé contre VNP_ALLOWED_SLUGS (défaut `isna`) → un slug arbitraire ne pollue plus
 *    l'attribution analytics d'un autre tenant (l'event est loggé mais tenant_slug=null).
 *  - type validé contre une allowlist, payload borné à 4 Ko (inchangé).
 */

// CORS restreinte : reflète uniquement les origines autorisées (localhost, *.cimolace.space,
// prorascience.org, previews *-cimolace.vercel.app). Parité avec allowedOrigin() de l'edge vnp.
const ORIGIN_ALLOW: RegExp[] = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https:\/\/([a-z0-9-]+\.)*cimolace\.space$/,
  /^https:\/\/(www\.)?prorascience\.org$/,
  /^https:\/\/[a-z0-9-]+-cimolace\.vercel\.app$/,
];
function corsFor(req: Request): Record<string, string> {
  const o = req.headers.get('origin') || '';
  const h: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    Vary: 'Origin',
  };
  if (ORIGIN_ALLOW.some((re) => re.test(o))) h['Access-Control-Allow-Origin'] = o;
  return h;
}

// Slugs autorisés à recevoir des events ATTRIBUÉS (parité isAllowedLeadSlug de l'edge vnp).
// CSV surchargeable sans redéploiement du code.
function allowedSlug(slug: string): boolean {
  // @ts-ignore
  const csv = String(Deno.env.get('VNP_ALLOWED_SLUGS') || 'isna');
  const set = new Set(csv.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
  return set.has(String(slug || '').trim().toLowerCase());
}

const ok = (cors: Record<string, string>) =>
  new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });

// Types canoniques autorisés (doc §6). Tout autre type est ignoré silencieusement.
const ALLOWED = new Set([
  'node_opened', 'vnp_chat', 'action_triggered', 'contact_submitted', 'tenant_created',
  'unanswered_question', 'phase_transition', 'shortcut_click', 'edge_chat', 'edge_agent_brain',
]);

// @ts-ignore
Deno.serve(async (req: Request) => {
  const cors = corsFor(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const type = String(body?.type || '').slice(0, 60);
    if (!ALLOWED.has(type)) return ok(cors); // type inconnu → drop silencieux

    // @ts-ignore
    const url = Deno.env.get('SUPABASE_URL');
    // @ts-ignore
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return ok(cors);

    let payload = body?.payload && typeof body.payload === 'object' ? body.payload : {};
    let payloadStr = '{}';
    try { payloadStr = JSON.stringify(payload); } catch { payloadStr = '{}'; }
    if (payloadStr.length > 4000) payloadStr = JSON.stringify({ _truncated: true });

    // Slug validé : un slug non autorisé n'est PAS écrit (tenant_slug=null) → pas de pollution cross-tenant.
    const rawSlug = body?.tenantSlug ? String(body.tenantSlug).slice(0, 60) : '';
    const tenant_slug = rawSlug && allowedSlug(rawSlug) ? rawSlug.trim().toLowerCase() : null;

    // Insert best-effort ; on n'attend PAS l'échec pour répondre (mais on await pour éviter un abort).
    await fetch(`${url}/rest/v1/analytics_events`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({
        type,
        payload: JSON.parse(payloadStr),
        tenant_slug,
        user_session: body?.userSession ? String(body.userSession).slice(0, 80) : null,
        source: body?.source ? String(body.source).slice(0, 30) : 'vnp',
      }),
    }).catch(() => {});

    return ok(cors);
  } catch {
    return ok(cors);
  }
});
