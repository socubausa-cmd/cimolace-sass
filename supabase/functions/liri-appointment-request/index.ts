/// <reference lib="deno.ns" />
/**
 * liri-appointment-request — crée une DEMANDE de rendez-vous SANS créneau depuis le
 * chat conversationnel LIRI (LiriRendezVousPage). Écriture côté SERVEUR (service_role)
 * car les tables RDV ne sont pas écrivables par le client (RLS / non exposées PostgREST).
 *
 * Le secrétariat planifie ensuite le créneau → status='requested', slot_id NULL.
 * Les 4 réponses (sujet/description/email/whatsapp) sont packées dans `notes`.
 *
 * Auth : JWT élève (Authorization: Bearer …). Tenant résolu via tenant_memberships.
 * Cible : student_appointments en priorité, fallback appointment_requests.
 *
 * Body : { subject, description, email, whatsapp }
 * Réponse : { ok, requestId, table } | { error, detail }
 */
import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const token = (req.headers.get('authorization') || req.headers.get('x-user-jwt') || '')
      .replace(/^Bearer\s+/i, '').trim();
    if (!token) return json({ error: 'unauthenticated' }, 401);
    if (!SUPABASE_URL || !SERVICE_ROLE) return json({ error: 'server_misconfigured' }, 500);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    const user = userData?.user;
    if (userErr || !user) return json({ error: 'invalid_token' }, 401);

    const body = await req.json().catch(() => ({}));
    const subject = String(body.subject || '').trim();
    const description = String(body.description || '').trim();
    const email = String(body.email || '').trim();
    const whatsapp = String(body.whatsapp || '').trim();

    if (subject.length < 3) return json({ error: 'invalid_subject' }, 422);
    if (!EMAIL_RE.test(email)) return json({ error: 'invalid_email' }, 422);
    if (whatsapp.replace(/\D/g, '').length < 8) return json({ error: 'invalid_whatsapp' }, 422);

    // Tenant de l'élève (membership active).
    let tenantId: string | null = null;
    const { data: mem } = await admin
      .from('tenant_memberships')
      .select('tenant_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
    tenantId = (mem as { tenant_id?: string } | null)?.tenant_id ?? null;

    const notes = [
      `Sujet : ${subject}`,
      `Description : ${description || '—'}`,
      `E-mail : ${email}`,
      `WhatsApp : ${whatsapp}`,
    ].join('\n');

    const row: Record<string, unknown> = {
      student_id: user.id,
      slot_id: null,
      status: 'requested',
      notes,
      source: 'liri-rdv-chat',
    };
    if (tenantId) row.tenant_id = tenantId;

    let inserted: { table: string; id: string | null } | null = null;
    let lastErr: string | null = null;
    for (const table of ['student_appointments', 'appointment_requests']) {
      const { data, error } = await admin.from(table).insert(row).select('id').maybeSingle();
      if (!error) { inserted = { table, id: (data as { id?: string } | null)?.id ?? null }; break; }
      lastErr = error.message;
    }
    if (!inserted) return json({ error: 'insert_failed', detail: lastErr || 'no target table' }, 500);

    return json({ ok: true, requestId: inserted.id, table: inserted.table });
  } catch (e) {
    return json({ error: 'server_error', detail: String((e as Error)?.message || e) }, 500);
  }
});
