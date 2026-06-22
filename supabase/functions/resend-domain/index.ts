/// <reference lib="deno.ns" />
/**
 * resend-domain — gestion no-code de l'expéditeur email PAR TENANT.
 *
 * Résout le tenant par SLUG (signal fiable côté front : fetchTenantContext,
 * public, sans RLS) puis vérifie owner/admin côté serveur (service_role).
 * Le front n'a PAS besoin du tenant_id. La clé Resend n'est jamais renvoyée.
 *
 * Les erreurs MÉTIER renvoient HTTP 200 + { error } (sinon supabase-js masque
 * le message derrière « non-2xx status code »). Seules les exceptions → 500.
 *
 * Actions : get | save | add | verify
 */
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const CENTRAL_RESEND_KEY = Deno.env.get('RESEND_API_KEY') || '';
const RESEND_REGION = Deno.env.get('RESEND_REGION') || 'eu-west-1';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
/** Erreur MÉTIER (affichable) → 200 pour ne pas être masquée par supabase-js. */
const fail = (error: string) => json({ error });

// @ts-ignore - Deno runtime
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const { action, slug, domain, resendApiKey, emailFromName, appBaseUrl } = body;
    const cleanSlug = String(slug || '').trim().toLowerCase();
    if (!cleanSlug) return fail("École (slug) non résolue.");

    // Auth utilisateur
    const authClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    });
    const { data: userData } = await authClient.auth.getUser();
    const user = userData?.user;
    if (!user) return fail('Non authentifié.');

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Résolution tenant par slug (service_role → pas de RLS)
    const { data: tenantRow } = await admin
      .from('tenants').select('id').eq('slug', cleanSlug).maybeSingle();
    if (!tenantRow?.id) return fail(`École « ${cleanSlug} » introuvable.`);
    const tenantId = tenantRow.id as string;

    // Garde owner/admin actif
    const { data: membership } = await admin
      .from('tenant_memberships').select('role')
      .eq('tenant_id', tenantId).eq('user_id', user.id).eq('status', 'active').maybeSingle();
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return fail("Réservé à l'administrateur de l'école.");
    }

    // Réglages actuels
    const { data: settings } = await admin
      .from('tenant_notification_settings')
      .select('email_from, email_from_name, email_domain, email_domain_id, app_base_url, resend_api_key, email_verified')
      .eq('tenant_id', tenantId).maybeSingle();

    // ── get ──
    if (action === 'get') {
      return json({
        ok: true,
        emailFromName: settings?.email_from_name || '',
        emailDomain: settings?.email_domain || '',
        appBaseUrl: settings?.app_base_url || '',
        emailVerified: settings?.email_verified === true,
        hasKey: Boolean(settings?.resend_api_key),
      });
    }

    // ── save ──
    if (action === 'save') {
      await admin.from('tenant_notification_settings').upsert(
        {
          tenant_id: tenantId,
          email_from_name: (emailFromName || '').trim() || null,
          app_base_url: (appBaseUrl || '').trim() || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id' },
      );
      return json({ ok: true });
    }

    // Clé Resend (BYO du tenant si fournie/enregistrée, sinon centrale)
    const newKey = (resendApiKey || '').trim();
    if (newKey) {
      await admin.from('tenant_notification_settings').upsert(
        { tenant_id: tenantId, resend_api_key: newKey, updated_at: new Date().toISOString() },
        { onConflict: 'tenant_id' },
      );
    }
    const key = newKey || settings?.resend_api_key || CENTRAL_RESEND_KEY;
    if (!key) return fail('Aucune clé Resend (ni école ni centrale).');
    const rHeaders = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

    // ── add ──
    if (action === 'add') {
      const dom = String(domain || '').trim().toLowerCase()
        .replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      if (!dom) return fail("Domaine d'envoi requis.");
      const resp = await fetch('https://api.resend.com/domains', {
        method: 'POST', headers: rHeaders,
        body: JSON.stringify({ name: dom, region: RESEND_REGION }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) return fail(data?.message || `Resend HTTP ${resp.status}`);
      await admin.from('tenant_notification_settings').upsert(
        {
          tenant_id: tenantId, email_domain: dom, email_domain_id: data.id,
          email_from: settings?.email_from || `noreply@${dom}`,
          email_verified: false, updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id' },
      );
      return json({ ok: true, domain: dom, status: data.status, records: data.records || [] });
    }

    // ── verify ──
    if (action === 'verify') {
      let domainId = settings?.email_domain_id as string | null;
      // Domaine connu mais sans id (ex. configuré hors de cet écran) → on le
      // retrouve dans la liste Resend par son nom.
      if (!domainId && settings?.email_domain) {
        const listResp = await fetch('https://api.resend.com/domains', { headers: rHeaders });
        const list = await listResp.json().catch(() => ({}));
        const rows = Array.isArray(list?.data) ? list.data : (Array.isArray(list) ? list : []);
        const match = rows.find((d: any) => String(d?.name).toLowerCase() === String(settings.email_domain).toLowerCase());
        if (match?.id) {
          domainId = match.id;
          await admin.from('tenant_notification_settings')
            .update({ email_domain_id: domainId, updated_at: new Date().toISOString() })
            .eq('tenant_id', tenantId);
        }
      }
      if (!domainId) return fail("Aucun domaine configuré — clique d'abord « Configurer le domaine ».");

      await fetch(`https://api.resend.com/domains/${domainId}/verify`, { method: 'POST', headers: rHeaders });
      const resp = await fetch(`https://api.resend.com/domains/${domainId}`, { headers: rHeaders });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) return fail(data?.message || `Resend HTTP ${resp.status}`);
      const verified = data.status === 'verified';
      await admin.from('tenant_notification_settings')
        .update({ email_verified: verified, updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId);
      return json({ ok: true, status: data.status, verified, records: data.records || [] });
    }

    return fail('Action inconnue.');
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
