/// <reference lib="deno.ns" />
/**
 * resend-domain — gestion no-code de l'expéditeur email PAR TENANT.
 *
 * Résout le tenant par SLUG (signal fiable côté front : fetchTenantContext,
 * public, sans RLS) puis vérifie owner/admin côté serveur (service_role).
 * Le front n'a PAS besoin de connaître le tenant_id (dette de résolution
 * d'id contournée). La clé Resend n'est jamais renvoyée au front.
 *
 * Actions (body.action) :
 *   - get    : réglages actuels (sans la clé).
 *   - save   : enregistre nom d'expéditeur + URL portail.
 *   - add    : ajoute le domaine dans Resend → renvoie les DNS.
 *   - verify : déclenche la vérification Resend + relit le statut.
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

// @ts-ignore - Deno runtime
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const { action, slug, domain, resendApiKey, emailFromName, appBaseUrl } = body;
    const cleanSlug = String(slug || '').trim().toLowerCase();
    if (!cleanSlug) return json({ error: "École (slug) non résolue." }, 400);

    // ── Auth utilisateur ─────────────────────────────────────────────────────
    const authClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
    });
    const { data: userData } = await authClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: 'Non authentifié' }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // ── Résolution tenant par slug (service_role → pas de RLS) ────────────────
    const { data: tenantRow } = await admin
      .from('tenants').select('id').eq('slug', cleanSlug).maybeSingle();
    if (!tenantRow?.id) return json({ error: `École « ${cleanSlug} » introuvable.` }, 404);
    const tenantId = tenantRow.id as string;

    // ── Garde owner/admin actif ──────────────────────────────────────────────
    const { data: membership } = await admin
      .from('tenant_memberships').select('role')
      .eq('tenant_id', tenantId).eq('user_id', user.id).eq('status', 'active').maybeSingle();
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return json({ error: "Réservé à l'administrateur de l'école." }, 403);
    }

    // ── Réglages actuels ─────────────────────────────────────────────────────
    const { data: settings } = await admin
      .from('tenant_notification_settings')
      .select('email_from, email_from_name, email_domain, email_domain_id, app_base_url, resend_api_key, email_verified')
      .eq('tenant_id', tenantId).maybeSingle();

    // ── ACTION get ───────────────────────────────────────────────────────────
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

    // ── ACTION save (nom d'expéditeur + URL portail) ─────────────────────────
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

    // Clé Resend à utiliser (BYO du tenant si fournie/enregistrée, sinon centrale).
    const newKey = (resendApiKey || '').trim();
    if (newKey) {
      await admin.from('tenant_notification_settings').upsert(
        { tenant_id: tenantId, resend_api_key: newKey, updated_at: new Date().toISOString() },
        { onConflict: 'tenant_id' },
      );
    }
    const key = newKey || settings?.resend_api_key || CENTRAL_RESEND_KEY;
    if (!key) return json({ error: 'Aucune clé Resend (ni tenant ni centrale).' }, 400);
    const rHeaders = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

    // ── ACTION add ───────────────────────────────────────────────────────────
    if (action === 'add') {
      const dom = String(domain || '').trim().toLowerCase()
        .replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      if (!dom) return json({ error: "Domaine d'envoi requis." }, 400);
      const resp = await fetch('https://api.resend.com/domains', {
        method: 'POST', headers: rHeaders,
        body: JSON.stringify({ name: dom, region: RESEND_REGION }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) return json({ error: data?.message || `Resend HTTP ${resp.status}`, code: resp.status });
      await admin.from('tenant_notification_settings').upsert(
        {
          tenant_id: tenantId,
          email_domain: dom,
          email_domain_id: data.id,
          email_from: settings?.email_from || `noreply@${dom}`,
          email_verified: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id' },
      );
      return json({ ok: true, domain: dom, status: data.status, records: data.records || [] });
    }

    // ── ACTION verify ────────────────────────────────────────────────────────
    if (action === 'verify') {
      const domainId = settings?.email_domain_id;
      if (!domainId) return json({ error: "Aucun domaine configuré — ajoutez-le d'abord." }, 400);
      await fetch(`https://api.resend.com/domains/${domainId}/verify`, { method: 'POST', headers: rHeaders });
      const resp = await fetch(`https://api.resend.com/domains/${domainId}`, { headers: rHeaders });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) return json({ error: data?.message || `Resend HTTP ${resp.status}`, code: resp.status });
      const verified = data.status === 'verified';
      await admin.from('tenant_notification_settings')
        .update({ email_verified: verified, updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId);
      return json({ ok: true, status: data.status, verified, records: data.records || [] });
    }

    return json({ error: 'Action inconnue' }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
