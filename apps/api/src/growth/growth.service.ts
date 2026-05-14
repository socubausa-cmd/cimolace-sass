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
    const { data } = await (this.supabase.client as any).from('leads').upsert({
      tenant_id: tenantId, email, source, name: name ?? '', status: 'new',
    }, { onConflict: 'tenant_id,email' }).select('*').single();
    return data;
  }

  async listLeads(tenantId: string) {
    const { data } = await (this.supabase.client as any).from('leads').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
    return data ?? [];
  }

  async scoreLead(tenantId: string, leadId: string, score: number) {
    await (this.supabase.client as any).from('leads').update({ score }).eq('id', leadId).eq('tenant_id', tenantId);
  }
}
