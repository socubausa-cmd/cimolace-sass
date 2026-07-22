import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class GrowthService {
  constructor(private readonly supabase: SupabaseService) {}

  async getTenantStats(tenantId: string) {
    const client = this.supabase.client as any;
    const cnt = (q: any) => q.then((r: any) => r.count ?? 0);
    const [members, lives, courses, revenue, students, published, modules, lessons, videos] = await Promise.all([
      client.from('tenant_memberships').select('*', { count: 'exact' }).eq('tenant_id', tenantId),
      client.from('live_sessions').select('*', { count: 'exact' }).eq('tenant_id', tenantId),
      client.from('courses').select('*', { count: 'exact' }).eq('tenant_id', tenantId),
      client.from('invoices').select('amount_paid_cents').eq('tenant_id', tenantId).eq('status', 'paid'),
      // Compteurs TABLEAU DE BORD (famille de tables VIVANTE, tenant-scopée) — le front
      // les lisait en direct Supabase sans scope → RLS renvoyait 0 partout.
      cnt(client.from('tenant_memberships').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('role', 'student').eq('status', 'active')),
      cnt(client.from('courses').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'published')),
      cnt(client.from('course_modules').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)),
      cnt(client.from('course_lessons').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)),
      cnt(client.from('course_lessons').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).not('video_url', 'is', null).neq('video_url', '')),
    ]);
    const paidRows = revenue.data ?? [];
    return {
      totalMembers: members.count ?? 0,
      totalLives: lives.count ?? 0,
      totalCourses: courses.count ?? 0,
      totalRevenueCents: paidRows.reduce((s: number, r: any) => s + (r.amount_paid_cents ?? 0), 0),
      totalStudents: students,
      publishedCourses: published,
      totalModules: modules,
      totalLessons: lessons,
      totalVideos: videos,
      paidInvoices: paidRows.length,
    };
  }

  async getLeadStats(tenantId: string) {
    const { data } = await (this.supabase.client as any).from('leads')
      .select('status, count').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(100);
    return data ?? [];
  }

  /**
   * CONTACT UNIFIÉ : garantit qu'un email a un `crm_contacts` (le CRM = UNE notion de
   * contact, pas 3 surfaces). Select-then-insert idempotent ; lie le lead_id. Fire-and-forget.
   */
  private async ensureCrmContact(
    tenantId: string,
    opts: { email?: string | null; name?: string | null; leadId?: string | null; source?: string | null; userId?: string | null },
  ): Promise<void> {
    const client = this.supabase.client as any;
    const email = String(opts?.email ?? '').trim().toLowerCase();
    if (!email) return;
    try {
      const { data: existing } = await client.from('crm_contacts').select('id, lead_id, user_id').eq('tenant_id', tenantId).eq('email', email).maybeSingle();
      if (existing) {
        const patch: Record<string, any> = {};
        if (opts.leadId && !existing.lead_id) patch.lead_id = opts.leadId;
        if (opts.userId && !existing.user_id) patch.user_id = opts.userId;
        if (Object.keys(patch).length) {
          patch.updated_at = new Date().toISOString();
          await client.from('crm_contacts').update(patch).eq('id', existing.id);
        }
        return;
      }
      const parts = String(opts.name ?? '').trim().split(/\s+/).filter(Boolean);
      await client.from('crm_contacts').insert({
        tenant_id: tenantId, email,
        first_name: parts[0] ?? null, last_name: parts.length > 1 ? parts.slice(1).join(' ') : null,
        source: opts.source ?? 'lead', status: 'active', lead_id: opts.leadId ?? null, user_id: opts.userId ?? null,
      });
    } catch { /* jamais bloquant */ }
  }

  async createLead(tenantId: string, email: string, source: string, name?: string) {
    // select-then-insert : l'upsert supabase-js onConflict échouait silencieusement (leads=0 en prod).
    const client = this.supabase.client as any;
    const em = String(email ?? '').trim().toLowerCase();
    let lead: any;
    const { data: existing } = await client.from('leads').select('*').eq('tenant_id', tenantId).eq('email', em).maybeSingle();
    if (existing) lead = existing;
    else {
      const { data } = await client.from('leads')
        .insert({ tenant_id: tenantId, email: em, source, name: name ?? '', status: 'new' })
        .select('*').single();
      lead = data;
    }
    // Contact unifié : tout lead a désormais un crm_contact (une seule notion de contact).
    await this.ensureCrmContact(tenantId, { email: em, name, leadId: lead?.id, source: source ?? 'lead' });
    return lead;
  }

  async listLeads(tenantId: string) {
    const { data } = await (this.supabase.client as any).from('leads').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
    return data ?? [];
  }

  async scoreLead(tenantId: string, leadId: string, score: number) {
    await (this.supabase.client as any).from('leads').update({ score }).eq('id', leadId).eq('tenant_id', tenantId);
  }

  /**
   * HUB 360° — vue unifiee d'un contact a travers TOUS les moteurs.
   * Resout l'identite (profiles par email) puis fan-out tenant-scope :
   * CRM (contact/lead) + École/LIRI (membership) + mbolo (commandes) +
   * RDV/MEDOS (appointments) + messagerie/forum (conversations).
   */
  async getContact360(tenantId: string, emailRaw: string) {
    const email = String(emailRaw ?? '').trim().toLowerCase();
    if (!email) return { email: '', identity: { resolved: false }, engines_touched: [], connected: 0 };
    const client = this.supabase.client as any;

    // Identité = profiles (le hub). Résolution guardée (profiles peut ne pas exposer 'email').
    let prof: any = null;
    let userId: string | null = null;
    try {
      const r = await client.from('profiles').select('*').ilike('email', email).maybeSingle();
      prof = r?.data ?? null;
      userId = prof?.id ?? null;
    } catch { /* identité non résolue → fan-out par email quand même */ }

    // Dossier patient MEDOS (pont messagerie clinique) : résolu par `patient_user_id`
    // (med_patients n'a PAS de colonne email → l'identité passe par le compte). Rattache
    // les fils `med_message_threads` (silo MEDOS) au hub 360°. Guardé (fail-silent).
    let medPatientId: string | null = null;
    if (userId) {
      try {
        const rp = await client.from('med_patients').select('id').eq('tenant_id', tenantId).eq('patient_user_id', userId).maybeSingle();
        medPatientId = rp?.data?.id ?? null;
      } catch { /* MEDOS non provisionné pour ce tenant → ignore */ }
    }

    const nil = Promise.resolve({ data: null });
    const nilArr = Promise.resolve({ data: [] });
    const [ordersByEmail, ordersByUser, contact, lead, membership, convs, appts, medThreads] = await Promise.all([
      client.from('mbolo_orders').select('id, order_number, total_cents, currency, status, payment_status, created_at').eq('tenant_id', tenantId).eq('customer_email', email).order('created_at', { ascending: false }),
      userId ? client.from('mbolo_orders').select('id, order_number, total_cents, currency, status, payment_status, created_at').eq('tenant_id', tenantId).eq('user_id', userId) : nilArr,
      client.from('crm_contacts').select('*').eq('tenant_id', tenantId).eq('email', email).maybeSingle(),
      client.from('leads').select('*').eq('tenant_id', tenantId).eq('email', email).maybeSingle(),
      userId ? client.from('tenant_memberships').select('role, status, created_at').eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle() : nil,
      userId ? client.from('conversation_participants').select('conversation_id').eq('tenant_id', tenantId).eq('user_id', userId) : nilArr,
      userId ? client.from('appointments').select('id, status, source, created_at').eq('tenant_id', tenantId).eq('student_id', userId).order('created_at', { ascending: false }) : nilArr,
      medPatientId ? client.from('med_message_threads').select('id, subject, status, last_message_at').eq('tenant_id', tenantId).eq('patient_id', medPatientId).order('last_message_at', { ascending: false }) : nilArr,
    ]);

    const orderMap = new Map<string, any>();
    for (const o of [...(ordersByEmail?.data ?? []), ...(ordersByUser?.data ?? [])]) orderMap.set(o.id, o);
    const orders = [...orderMap.values()];
    const convCount = (convs?.data ?? []).length;
    const apptList = appts?.data ?? [];
    const medThreadList = medThreads?.data ?? [];

    const enginesTouched = [
      membership?.data ? 'ecole/liri' : null,
      orders.length ? 'mbolo (boutique)' : null,
      apptList.length ? 'rdv/medos' : null,
      convCount ? 'messagerie/forum' : null,
      medThreadList.length ? 'medos (messagerie)' : null,
      (contact?.data || lead?.data) ? 'crm' : null,
    ].filter(Boolean) as string[];

    return {
      email,
      identity: { user_id: userId, profile: prof, resolved: !!userId },
      crm: { contact: contact?.data ?? null, lead: lead?.data ?? null },
      membership: membership?.data ?? null,
      mbolo: { orders, count: orders.length, total_cents: orders.reduce((s: number, o: any) => s + (o.total_cents ?? 0), 0) },
      rdv: { appointments: apptList, count: apptList.length },
      messaging: { conversations: convCount },
      medos_messaging: { threads: medThreadList, count: medThreadList.length },
      engines_touched: enginesTouched,
      connected: enginesTouched.length,
    };
  }
}
