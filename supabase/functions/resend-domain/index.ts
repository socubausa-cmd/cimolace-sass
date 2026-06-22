/// <reference lib="deno.ns" />
/**
 * resend-domain — gestion no-code des domaines d'envoi Resend PAR TENANT.
 *
 * Actions (body.action) :
 *   - add    : ajoute le domaine du tenant dans Resend → renvoie les DNS à poser.
 *   - verify : déclenche la vérification Resend puis relit le statut.
 *   - status : relit le statut + les enregistrements DNS.
 *
 * Clé Resend utilisée : celle du tenant (tenant_notification_settings.resend_api_key,
 * mode BYO / domaine custom) si présente, sinon la clé centrale Cimolace
 * (env RESEND_API_KEY). La clé n'est JAMAIS renvoyée au front.
 *
 * Sécurité : l'appelant doit être owner/admin ACTIF du tenant (tenant_memberships).
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
    const { action, tenantId, domain, resendApiKey } = await req.json().catch(() => ({}));
    if (!tenantId) return json({ error: 'tenantId requis' }, 400);

    // ── 1) Auth : owner/admin actif du tenant ───────────────────────────────
    const authHeader = req.headers.get('Authorization') || '';
    const authClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await authClient.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: 'Non authentifié' }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: membership } = await admin
      .from('tenant_memberships')
      .select('role')
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return json({ error: "Réservé à l'administrateur de l'école" }, 403);
    }

    // ── 2) Réglages + clé Resend à utiliser ─────────────────────────────────
    const { data: settings } = await admin
      .from('tenant_notification_settings')
      .select('resend_api_key, email_domain, email_domain_id, email_from')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    // Nouvelle clé BYO fournie → on l'enregistre (jamais renvoyée au front).
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

    // ── ACTION add ──────────────────────────────────────────────────────────
    if (action === 'add') {
      const dom = String(domain || '')
        .trim().toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/\/.*$/, '');
      if (!dom) return json({ error: 'Domaine requis' }, 400);

      const resp = await fetch('https://api.resend.com/domains', {
        method: 'POST',
        headers: rHeaders,
        body: JSON.stringify({ name: dom, region: RESEND_REGION }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        return json({ error: data?.message || `Resend HTTP ${resp.status}`, code: resp.status });
      }
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
      return json({ ok: true, domain: dom, id: data.id, status: data.status, records: data.records || [] });
    }

    // ── ACTION verify / status ───────────────────────────────────────────────
    if (action === 'verify' || action === 'status') {
      const domainId = settings?.email_domain_id;
      if (!domainId) return json({ error: "Aucun domaine configuré — ajoutez-le d'abord." }, 400);

      if (action === 'verify') {
        await fetch(`https://api.resend.com/domains/${domainId}/verify`, { method: 'POST', headers: rHeaders });
      }
      const resp = await fetch(`https://api.resend.com/domains/${domainId}`, { headers: rHeaders });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        return json({ error: data?.message || `Resend HTTP ${resp.status}`, code: resp.status });
      }
      const verified = data.status === 'verified';
      await admin
        .from('tenant_notification_settings')
        .update({ email_verified: verified, updated_at: new Date().toISOString() })
        .eq('tenant_id', tenantId);
      return json({ ok: true, status: data.status, verified, records: data.records || [] });
    }

    return json({ error: 'Action inconnue' }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
