import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class GrowthService {
  constructor(private readonly supabase: SupabaseService) {}

  async getTenantStats(tenantId: string) {
    const [members, lives, courses, revenue] = await Promise.all([
      (this.supabase.client as any).from('tenant_memberships').select('*', { count: 'exact' }).eq('tenant_id', tenantId),
      (this.supabase.client as any).from('live_sessions').select('*', { count: 'exact' }).eq('tenant_id', tenantId),
      (this.supabase.client as any).from('courses').select('*', { count: 'exact' }).eq('tenant_id', tenantId),
      (this.supabase.client as any).from('invoices').select('amount_paid_cents').eq('tenant_id', tenantId).eq('status', 'paid'),
    ]);
    return {
      totalMembers: members.count ?? 0,
      totalLives: lives.count ?? 0,
      totalCourses: courses.count ?? 0,
      totalRevenueCents: (revenue.data ?? []).reduce((s: number, r: any) => s + (r.amount_paid_cents ?? 0), 0),
    };
  }

  async getLeadStats(tenantId: string) {
    const { data } = await (this.supabase.client as any).from('leads')
      .select('status, count').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(100);
    return data ?? [];
  }

  async createLead(tenantId: string, email: string, source: string, name?: string) {
    // select-then-insert : l'upsert supabase-js onConflict échouait silencieusement (leads=0 en prod).
    const client = this.supabase.client as any;
    const em = String(email ?? '').trim().toLowerCase();
    const { data: existing } = await client.from('leads').select('*').eq('tenant_id', tenantId).eq('email', em).maybeSingle();
    if (existing) return existing;
    const { data } = await client.from('leads')
      .insert({ tenant_id: tenantId, email: em, source, name: name ?? '', status: 'new' })
      .select('*').single();
    return data;
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

    const nil = Promise.resolve({ data: null });
    const nilArr = Promise.resolve({ data: [] });
    const [ordersByEmail, ordersByUser, contact, lead, membership, convs, appts] = await Promise.all([
      client.from('mbolo_orders').select('id, order_number, total_cents, currency, status, payment_status, created_at').eq('tenant_id', tenantId).eq('customer_email', email).order('created_at', { ascending: false }),
      userId ? client.from('mbolo_orders').select('id, order_number, total_cents, currency, status, payment_status, created_at').eq('tenant_id', tenantId).eq('user_id', userId) : nilArr,
      client.from('crm_contacts').select('*').eq('tenant_id', tenantId).eq('email', email).maybeSingle(),
      client.from('leads').select('*').eq('tenant_id', tenantId).eq('email', email).maybeSingle(),
      userId ? client.from('tenant_memberships').select('role, status, created_at').eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle() : nil,
      userId ? client.from('conversation_participants').select('conversation_id').eq('tenant_id', tenantId).eq('user_id', userId) : nilArr,
      userId ? client.from('appointments').select('id, status, source, created_at').eq('tenant_id', tenantId).eq('student_id', userId).order('created_at', { ascending: false }) : nilArr,
    ]);

    const orderMap = new Map<string, any>();
    for (const o of [...(ordersByEmail?.data ?? []), ...(ordersByUser?.data ?? [])]) orderMap.set(o.id, o);
    const orders = [...orderMap.values()];
    const convCount = (convs?.data ?? []).length;
    const apptList = appts?.data ?? [];

    const enginesTouched = [
      membership?.data ? 'ecole/liri' : null,
      orders.length ? 'mbolo (boutique)' : null,
      apptList.length ? 'rdv/medos' : null,
      convCount ? 'messagerie/forum' : null,
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
      engines_touched: enginesTouched,
      connected: enginesTouched.length,
    };
  }
}
