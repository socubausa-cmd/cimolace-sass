/// <reference lib="deno.ns" />
/**
 * tenant-by-host — résout le SLUG d'un tenant depuis un hostname, via la table
 * tenant_domains (service_role → bypass RLS).
 *
 * Sert de fallback à useResolvedTenantSlug sur les routes "propres" (sans
 * /t/:slug dans l'URL, ex: /admin/settings du tenant primaire sur son propre
 * domaine). Aucune donnée sensible : on ne renvoie que { slug, name }.
 *
 * Body: { host }  (sinon on lit x-forwarded-host / host de la requête)
 */
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeHost(raw: string): string {
  let host = String(raw || '').trim().toLowerCase();
  host = host.replace(/^https?:\/\//, ''); // au cas où une URL complète arrive
  host = host.split('/')[0]; // garde uniquement l'autorité (host[:port])
  return host;
}

// @ts-ignore - Deno runtime
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const raw = body.host || req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
    const host = normalizeHost(raw);
    if (!host) return json({ slug: null });

    // Candidats : host exact + variante www. (un seul des deux est en base).
    const candidates = [host];
    if (host.startsWith('www.')) candidates.push(host.slice(4));
    else candidates.push(`www.${host}`);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Aligné sur l'API getTenantByHost : SEUL un domaine `custom_host` ACTIF d'un
    // tenant ACTIF résout un slug (un embed_origin — simple whitelist CORS — ou un
    // domaine révoqué/pending ne doit JAMAIS brander un host). Anti-fuite cloison.
    const { data: doms } = await admin
      .from('tenant_domains')
      .select('tenant_id, domain')
      .in('domain', candidates)
      .eq('usage', 'custom_host')
      .eq('status', 'active')
      .limit(1);
    const tenantId = doms?.[0]?.tenant_id;
    if (!tenantId) return json({ slug: null });

    const { data: tenant } = await admin
      .from('tenants')
      .select('slug, name, status')
      .eq('id', tenantId)
      .maybeSingle();
    if (tenant && tenant.status !== 'active') return json({ slug: null });

    return json({ slug: tenant?.slug || null, name: tenant?.name || null });
  } catch (e) {
    // Fail-soft : pas de slug plutôt qu'une erreur qui casse l'écran.
    return json({ slug: null, error: String(e) });
  }
});
