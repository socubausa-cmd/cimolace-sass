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
    return { leadId, score };
  }

  // ── Funnels ──────────────────────────────────────────────────────────────

  async listFunnels(tenantId: string) {
    const { data } = await (this.supabase.client as any).from('funnels').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
    return data ?? [];
  }

  async createFunnel(tenantId: string, name: string, steps: any[]) {
    const { data } = await (this.supabase.client as any).from('funnels').insert({
      tenant_id: tenantId, name, steps, status: 'draft',
    }).select('*').single();
    return data;
  }

  // ── Campaigns ────────────────────────────────────────────────────────────

  async listCampaigns(tenantId: string) {
    const { data } = await (this.supabase.client as any).from('campaigns').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
    return data ?? [];
  }

  async createCampaign(tenantId: string, name: string, funnelId?: string) {
    const { data } = await (this.supabase.client as any).from('campaigns').insert({
      tenant_id: tenantId, name, funnel_id: funnelId, status: 'draft',
    }).select('*').single();
    return data;
  }

  async startCampaign(tenantId: string, campaignId: string) {
    await (this.supabase.client as any).from('campaigns').update({ status: 'active', started_at: new Date().toISOString() }).eq('id', campaignId).eq('tenant_id', tenantId);
    return { campaignId, status: 'active' };
  }

  // ── Automations ──────────────────────────────────────────────────────────

  async listAutomations(tenantId: string) {
    const { data } = await (this.supabase.client as any).from('automations').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
    return data ?? [];
  }

  async createAutomation(tenantId: string, name: string, trigger: string, action: string) {
    const { data } = await (this.supabase.client as any).from('automations').insert({
      tenant_id: tenantId, name, trigger_type: trigger, action_type: action, status: 'draft',
    }).select('*').single();
    return data;
  }

  // ── Analytics ────────────────────────────────────────────────────────────

  async getAnalytics(tenantId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [leads, newLeadsThisMonth, { count: activeSubs }] = await Promise.all([
      (this.supabase.client as any).from('leads').select('*', { count: 'exact' }).eq('tenant_id', tenantId),
      (this.supabase.client as any).from('leads').select('*', { count: 'exact' }).eq('tenant_id', tenantId).gte('created_at', monthStart),
      (this.supabase.client as any).from('billing_subscriptions').select('*', { count: 'exact' }).eq('tenant_id', tenantId).eq('status', 'active'),
    ]);

    return {
      totalLeads: leads.count ?? 0,
      newLeadsThisMonth: newLeadsThisMonth.count ?? 0,
      activeSubscriptions: activeSubs ?? 0,
      conversionRate: leads.count > 0 ? Math.round(((activeSubs ?? 0) / leads.count) * 100) : 0,
    };
  }
}
