/// <reference lib="deno.ns" />
/**
 * tenant-payments — lecture/écriture NO-CODE des credentials de paiement
 * (Stripe + PayPal) PAR TENANT, dans tenant_payment_providers.
 *
 * Même pattern que resend-domain / tenant-whatsapp : résout le tenant par SLUG
 * + vérifie owner/admin côté serveur (service_role). Le front n'a pas besoin
 * du tenant_id. Erreurs métier en HTTP 200 + { error }.
 *
 * Sécurité : les SECRETS (secret_key, webhook_secret) ne sont JAMAIS renvoyés
 * au front (on n'expose qu'un flag hasSecret/hasWebhook). À l'enregistrement,
 * un secret laissé vide conserve l'ancien (pas d'écrasement).
 *
 * Actions : get | save  (body.provider = 'stripe' | 'paypal' pour save)
 */
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

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
    const { action, slug, provider, publicKey, secretKey, webhookSecret, mode, isActive } = body;
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
      const { data: rows } = await admin
        .from('tenant_payment_providers')
        .select('provider, public_key, mode, is_active, secret_key, webhook_secret')
        .eq('tenant_id', tenantId).in('provider', ['stripe', 'paypal']);
      const find = (p: string) => (rows || []).find((r: any) => r.provider === p);
      const s = find('stripe');
      const pp = find('paypal');
      return json({
        ok: true,
        stripe: {
          publicKey: s?.public_key || '', mode: s?.mode || 'test',
          isActive: s?.is_active ?? true, hasSecret: Boolean(s?.secret_key),
          hasWebhook: Boolean(s?.webhook_secret), exists: Boolean(s),
        },
        paypal: {
          publicKey: pp?.public_key || '', mode: pp?.mode || 'sandbox',
          isActive: pp?.is_active ?? true, hasSecret: Boolean(pp?.secret_key), exists: Boolean(pp),
        },
      });
    }

    if (action === 'save') {
      const prov = provider === 'paypal' ? 'paypal' : 'stripe';
      const { data: existing } = await admin
        .from('tenant_payment_providers')
        .select('id, secret_key, webhook_secret')
        .eq('tenant_id', tenantId).eq('provider', prov).maybeSingle();

      const pub = String(publicKey || '').trim();
      if (!pub) return fail(prov === 'paypal' ? 'Le Client ID est requis.' : 'La clé publiable est requise.');
      const sec = String(secretKey || '').trim() || existing?.secret_key || '';
      if (!sec) return fail(prov === 'paypal' ? 'Le Client Secret est requis.' : 'La clé secrète est requise.');

      const payload: Record<string, unknown> = {
        tenant_id: tenantId, provider: prov,
        public_key: pub, secret_key: sec,
        mode: mode || (prov === 'paypal' ? 'sandbox' : 'test'),
        is_active: Boolean(isActive), updated_at: new Date().toISOString(),
      };
      if (prov === 'stripe') {
        payload.webhook_secret = String(webhookSecret || '').trim() || existing?.webhook_secret || null;
      }

      const { error: dbError } = existing?.id
        ? await admin.from('tenant_payment_providers').update(payload).eq('id', existing.id)
        : await admin.from('tenant_payment_providers').insert(payload);
      if (dbError) return fail(dbError.message || "Échec de l'enregistrement.");
      return json({ ok: true });
    }

    return fail('Action inconnue.');
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
