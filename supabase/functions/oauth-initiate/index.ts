/**
 * Edge Function: oauth-initiate
 *
 * Démarre le flux Google OAuth pour un tenant.
 *
 * Stratégie à 2 niveaux :
 *   1. Tenant a ses propres credentials → son nom apparaît sur l'écran Google
 *   2. Pas de credentials tenant → fallback sur les credentials plateforme Cimolace
 *      (l'écran Google affiche "Cimolace" — fonctionne sans aucune configuration)
 *
 * POST body: { tenant_slug: string, return_to?: string }
 * Retourne: { redirect_url: string, mode: 'tenant' | 'platform' }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL               = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GOOGLE_AUTH_ENDPOINT       = 'https://accounts.google.com/o/oauth2/v2/auth';

// ── Credentials plateforme (fallback no-code pour tous les tenants) ──────────
const PLATFORM_CLIENT_ID         = Deno.env.get('PLATFORM_GOOGLE_CLIENT_ID') ?? '';
const PLATFORM_REDIRECT_URI      = Deno.env.get('PLATFORM_GOOGLE_REDIRECT_URI')
  ?? `${SUPABASE_URL}/functions/v1/oauth-callback`;

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Méthode non autorisée' }, 405);
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { tenant_slug?: string; return_to?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Corps de requête JSON invalide' }, 400);
  }

  const tenantSlug = String(body.tenant_slug || '').trim().toLowerCase();
  const returnTo   = String(body.return_to   || '').trim();

  if (!tenantSlug) {
    return json({ error: 'tenant_slug est requis' }, 400);
  }

  // ── Supabase admin client ─────────────────────────────────────────────────
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // ── Charger le tenant ─────────────────────────────────────────────────────
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('id, slug')
    .eq('slug', tenantSlug)
    .single();

  if (tenantError || !tenant) {
    console.error('[oauth-initiate] tenant not found:', tenantSlug, tenantError?.message);
    return json({ error: 'Tenant introuvable', code: 'tenant_not_found' }, 404);
  }

  // ── Résoudre les credentials à utiliser ──────────────────────────────────
  //   Niveau 1 : credentials du tenant (son nom sur l'écran Google)
  //   Niveau 2 : credentials plateforme Cimolace (fallback no-code)
  let clientId:     string;
  let redirectUri:  string;
  let mode: 'tenant' | 'platform';

  const { data: tenantCreds } = await supabase
    .from('tenant_oauth_providers')
    .select('client_id, authorized_redirect_uri')
    .eq('tenant_id', tenant.id)
    .eq('provider', 'google')
    .eq('is_active', true)
    .maybeSingle();

  if (tenantCreds?.client_id) {
    // ✅ Niveau 1 — branding école
    clientId    = tenantCreds.client_id;
    redirectUri = tenantCreds.authorized_redirect_uri;
    mode        = 'tenant';
    console.log('[oauth-initiate] using tenant credentials for', tenantSlug);
  } else if (PLATFORM_CLIENT_ID) {
    // ✅ Niveau 2 — no-code plateforme
    clientId    = PLATFORM_CLIENT_ID;
    redirectUri = PLATFORM_REDIRECT_URI;
    mode        = 'platform';
    console.log('[oauth-initiate] using platform credentials for', tenantSlug);
  } else {
    // ❌ Aucun credential disponible (plateforme pas encore configurée)
    console.warn('[oauth-initiate] no credentials available for', tenantSlug);
    return json({
      error: 'Google OAuth non configuré. Contactez le support Cimolace.',
      code: 'oauth_not_configured',
    }, 404);
  }

  // ── Générer un état CSRF unique ──────────────────────────────────────────
  const state     = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error: insertError } = await supabase.from('oauth_states').insert({
    state,
    tenant_id:   tenant.id,
    tenant_slug: tenant.slug,
    return_to:   returnTo || null,
    expires_at:  expiresAt,
  });

  if (insertError) {
    console.error('[oauth-initiate] state insert error:', insertError.message);
    return json({ error: 'Impossible de démarrer le flux OAuth', code: 'state_error' }, 500);
  }

  // ── Construire l'URL Google OAuth ────────────────────────────────────────
  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'code',
    scope:         'openid email profile',
    state,
    access_type:   'offline',
    prompt:        'select_account',
  });

  return json({
    redirect_url: `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`,
    mode,
  });
});
