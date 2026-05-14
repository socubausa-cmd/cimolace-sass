import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateClientDto, UpdateClientDto } from './dto/backoffice.dto';

@Injectable()
export class CimolaceBackofficeService {
  constructor(private readonly supabase: SupabaseService) {}

  async getStats() {
    const [tenants, clients, sites] = await Promise.all([
      (this.supabase.client as any).from('tenants').select('id, name, plan, status, created_at').order('created_at', { ascending: false }),
      (this.supabase.client as any).from('cimolace_clients').select('id, name, status, created_at').order('created_at', { ascending: false }),
      (this.supabase.client as any).from('cimolace_sites').select('id, domain, status, created_at').order('created_at', { ascending: false }),
    ]);
    return {
      tenants: tenants.data ?? [], totalTenants: tenants.data?.length ?? 0,
      clients: clients.data ?? [], totalClients: clients.data?.length ?? 0,
      sites: sites.data ?? [], totalSites: sites.data?.length ?? 0,
    };
  }

  async listClients() {
    const { data } = await (this.supabase.client as any).from('cimolace_clients').select('*').order('created_at', { ascending: false });
    return data ?? [];
  }

  async createClient(dto: CreateClientDto) {
    const { data, error } = await (this.supabase.client as any).from('cimolace_clients').insert({
      name: dto.name, email: dto.email ?? '', plan: dto.plan ?? 'starter', status: 'active',
    }).select('*').single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateClient(clientId: string, dto: UpdateClientDto) {
    const patch: any = {};
    if (dto.name) patch.name = dto.name;
    if (dto.email !== undefined) patch.email = dto.email;
    if (dto.status) patch.status = dto.status;
    const { data, error } = await (this.supabase.client as any).from('cimolace_clients').update(patch).eq('id', clientId).select('*').single();
    if (error || !data) throw new NotFoundException('Client introuvable');
    return data;
  }

  async listSites() {
    const { data } = await (this.supabase.client as any).from('cimolace_sites').select('*').order('created_at', { ascending: false });
    return data ?? [];
  }

  async getClientSites(clientId: string) {
    const { data } = await (this.supabase.client as any).from('cimolace_sites').select('*').eq('client_id', clientId);
    return data ?? [];
  }

  // ── Dashboard KPI ─────────────────────────────────────────────────────

  async getDashboardKpi() {
    const [{ count: tenants }, { count: clients }, { count: sites }, { count: subs }] = await Promise.all([
      (this.supabase.client as any).from('tenants').select('*', { count: 'exact', head: true }),
      (this.supabase.client as any).from('cimolace_clients').select('*', { count: 'exact', head: true }),
      (this.supabase.client as any).from('cimolace_sites').select('*', { count: 'exact', head: true }),
      (this.supabase.client as any).from('billing_subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    ]);
    return { totalTenants: tenants, totalClients: clients, totalSites: sites, activeSubscriptions: subs, mrr: subs * 99 };
  }

  // ── Subscriptions ─────────────────────────────────────────────────────

  async listAllSubscriptions() {
    const { data } = await (this.supabase.client as any).from('billing_subscriptions').select('*, tenants(name, slug)').order('created_at', { ascending: false }).limit(50);
    return data ?? [];
  }

  // ── Support Tickets ────────────────────────────────────────────────────

  async listTickets() {
    const { data } = await (this.supabase.client as any).from('cimolace_support_tickets').select('*').order('created_at', { ascending: false }).limit(50);
    return data ?? [];
  }

  async updateTicket(ticketId: string, patch: any) {
    const { data } = await (this.supabase.client as any).from('cimolace_support_tickets').update(patch).eq('id', ticketId).select('*').single();
    return data;
  }
}
