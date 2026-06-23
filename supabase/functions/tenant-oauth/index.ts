/// <reference lib="deno.ns" />
/**
 * tenant-oauth — lecture/écriture NO-CODE des credentials Google OAuth de
 * l'école (tenant_oauth_providers, provider='google').
 *
 * Même pattern que les autres réglages tenant : résout le tenant par SLUG +
 * garde owner/admin (service_role). Le front n'a pas besoin du tenant_id.
 * Erreurs métier en HTTP 200 + { error }. Le Client Secret n'est jamais
 * renvoyé au front (flag hasSecret) ; vide à l'enregistrement = inchangé.
 *
 * Actions : get | save
 */
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const CALLBACK_URI = `${SUPABASE_URL}/functions/v1/oauth-callback`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
const fail = (error: string) => json({ error });

// @ts-ignore - Deno runtime
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const { action, slug, clientId, clientSecret, appName, isActive } = body;
    const cleanSlug = String(slug || '').trim().toLowerCase();
    if (!cleanSlug) return fail("École (slug) non résolue.");

    const authClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    });
    const { data: userData } = await authClient.auth.getUser();
    const user = userData?.user;
    if (!user) return fail('Non authentifié.');

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: tenantRow } = await admin
      .from('tenants').select('id').eq('slug', cleanSlug).maybeSingle();
    if (!tenantRow?.id) return fail(`École « ${cleanSlug} » introuvable.`);
    const tenantId = tenantRow.id as string;

    const { data: membership } = await admin
      .from('tenant_memberships').select('role')
      .eq('tenant_id', tenantId).eq('user_id', user.id).eq('status', 'active').maybeSingle();
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return fail("Réservé à l'administrateur de l'école.");
    }

    if (action === 'get') {
      const { data } = await admin
        .from('tenant_oauth_providers')
        .select('client_id, app_name, is_active, client_secret')
        .eq('tenant_id', tenantId).eq('provider', 'google').maybeSingle();
      return json({
        ok: true,
        clientId: data?.client_id || '',
        appName: data?.app_name || '',
        isActive: data?.is_active ?? true,
        hasSecret: Boolean(data?.client_secret),
        exists: Boolean(data),
        callbackUri: CALLBACK_URI,
      });
    }

    if (action === 'save') {
      const { data: existing } = await admin
        .from('tenant_oauth_providers')
        .select('id, client_secret')
        .eq('tenant_id', tenantId).eq('provider', 'google').maybeSingle();

      const cid = String(clientId || '').trim();
      if (!cid) return fail('Le Client ID Google est requis.');
      const sec = String(clientSecret || '').trim() || existing?.client_secret || '';
      if (!sec) return fail('Le Client Secret Google est requis.');

      const payload = {
        tenant_id: tenantId, provider: 'google',
        client_id: cid, client_secret: sec,
        app_name: String(appName || '').trim() || null,
        authorized_redirect_uri: CALLBACK_URI,
        is_active: Boolean(isActive), updated_at: new Date().toISOString(),
      };
      const { error: dbError } = existing?.id
        ? await admin.from('tenant_oauth_providers').update(payload).eq('id', existing.id)
        : await admin.from('tenant_oauth_providers').insert(payload);
      if (dbError) return fail(dbError.message || "Échec de l'enregistrement.");
      return json({ ok: true });
    }

    return fail('Action inconnue.');
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
