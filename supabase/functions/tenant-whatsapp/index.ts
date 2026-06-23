/// <reference lib="deno.ns" />
/**
 * tenant-whatsapp — lecture/écriture NO-CODE du numéro WhatsApp de l'école.
 *
 * Même pattern que resend-domain : résout le tenant par SLUG (fiable, public)
 * + vérifie owner/admin côté serveur (service_role). Le front n'a pas besoin
 * du tenant_id. Erreurs métier en HTTP 200 + { error }.
 *
 * Actions : get | save
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
    const { action, slug, whatsappNumber, channelEnabled } = body;
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
        .from('tenant_notification_settings')
        .select('whatsapp_school_number, whatsapp_channel_enabled')
        .eq('tenant_id', tenantId).maybeSingle();
      return json({
        ok: true,
        whatsappNumber: data?.whatsapp_school_number || '',
        channelEnabled: data?.whatsapp_channel_enabled === true,
      });
    }

    if (action === 'save') {
      const num = String(whatsappNumber || '').trim();
      if (num && !/^\+[1-9]\d{6,14}$/.test(num)) {
        return fail('Numéro invalide. Format international E.164 attendu, ex : +24166863336.');
      }
      await admin.from('tenant_notification_settings').upsert(
        {
          tenant_id: tenantId,
          whatsapp_school_number: num || null,
          whatsapp_channel_enabled: Boolean(channelEnabled),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id' },
      );
      return json({ ok: true });
    }

    return fail('Action inconnue.');
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
