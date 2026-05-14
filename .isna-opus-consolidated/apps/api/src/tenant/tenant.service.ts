import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import type { CreateTenantDto } from './create-tenant.dto';
import type { UpdateBrandingDto } from './update-branding.dto';
import type { TenantContext } from './tenant.types';

type TenantRecord = Omit<TenantContext, 'userRole'>;
type MembershipRecord = { role: TenantContext['userRole'] };

@Injectable()
export class TenantService {
  constructor(private readonly supabase: SupabaseService, private readonly config: ConfigService) {}

  async resolveForUser(slug: string, userId: string): Promise<TenantContext> {
    const { data: tenant, error: tenantErr } = await this.supabase.client.from('tenants').select('id, name, slug, plan, status, primary_domain, logo_url, brand_colors, infrastructure_type').eq('slug', slug).single();
    if (tenantErr || !tenant) throw new NotFoundException(`Tenant "${slug}" introuvable`);
    const { data: membership, error: memberErr } = await this.supabase.client.from('tenant_memberships').select('role').eq('tenant_id', tenant.id).eq('user_id', userId).eq('status', 'active').single();
    if (memberErr || !membership) throw new ForbiddenException('Accès à ce tenant refusé');
    const tenantRecord = tenant as TenantRecord;
    const membershipRecord = membership as MembershipRecord;
    return { ...tenantRecord, userRole: membershipRecord.role };
  }

  async createForOwner(userId: string, dto: CreateTenantDto): Promise<TenantContext> {
    const { data: tenant, error: tErr } = await this.supabase.client.from('tenants').insert({ name: dto.name, slug: dto.slug, owner_user_id: userId, status: 'active', plan: 'free' }).select('id, name, slug, plan, status, primary_domain, logo_url, brand_colors, infrastructure_type').single();
    if (tErr) { if (tErr.code === '23505') throw new ConflictException('Ce slug est déjà utilisé'); throw new BadRequestException(tErr.message); }
    if (!tenant) throw new BadRequestException('Création du tenant impossible');
    const { error: mErr } = await this.supabase.client.from('tenant_memberships').insert({ tenant_id: tenant.id, user_id: userId, role: 'owner', status: 'active' });
    if (mErr) { await this.supabase.client.from('tenants').delete().eq('id', tenant.id); throw new BadRequestException(mErr.message ?? "Impossible d'associer le propriétaire"); }
    return { ...(tenant as TenantRecord), userRole: 'owner' };
  }

  async updateBranding(tenantId: string, userRole: TenantContext['userRole'], dto: UpdateBrandingDto): Promise<TenantContext> {
    const patch: any = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.logo_url !== undefined) patch.logo_url = dto.logo_url;
    if (dto.primary_domain !== undefined) patch.primary_domain = dto.primary_domain;
    if (dto.brand_colors !== undefined) patch.brand_colors = { ...dto.brand_colors };
    const { data, error } = await this.supabase.client.from('tenants').update(patch).eq('id', tenantId).select('id, name, slug, plan, status, primary_domain, logo_url, brand_colors, infrastructure_type').single();
    if (error || !data) throw new BadRequestException(error?.message ?? 'Mise à jour du branding impossible');
    return { ...(data as Omit<TenantContext, 'userRole'>), userRole };
  }

  // ── Members ──────────────────────────────────────────────────────────────

  async listMembers(tenantId: string) {
    const { data } = await (this.supabase.client as any).from('tenant_memberships').select('id, user_id, role, status, created_at').eq('tenant_id', tenantId).order('created_at');
    return data ?? [];
  }

  async inviteMember(tenantId: string, email: string, role: string) {
    // Look up user by email via Supabase Auth admin
    const supabaseUrl = this.config.get<string>('SUPABASE_URL') ?? '';
    const serviceKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    let userId: string | null = null;
    try {
      const resp = await fetch(`${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, { headers: { 'Authorization': `Bearer ${serviceKey}`, 'apikey': serviceKey } });
      const users = await resp.json() as any[];
      if (users?.length > 0) userId = users[0].id;
    } catch { /* user not found yet — will be invited by email */ }

    if (userId) {
      const { data, error } = await (this.supabase.client as any).from('tenant_memberships').upsert({ tenant_id: tenantId, user_id: userId, role, status: 'active' }, { onConflict: 'tenant_id,user_id' }).select('*').single();
      if (error) throw new BadRequestException(error.message);
      return { ...data, invited: true, method: 'direct' };
    }

    // Store pending invitation
    const { data } = await (this.supabase.client as any).from('tenant_invitations').insert({ tenant_id: tenantId, email, role, status: 'pending', token: Buffer.from(`${tenantId}:${email}:${Date.now()}`).toString('base64').slice(0, 48) }).select('*').single();
    return { ...data, invited: true, method: 'email' };
  }

  async updateMemberRole(tenantId: string, userId: string, role: string) {
    const { data } = await (this.supabase.client as any).from('tenant_memberships').update({ role }).eq('tenant_id', tenantId).eq('user_id', userId).select('*').single();
    return data;
  }

  async removeMember(tenantId: string, userId: string) {
    await (this.supabase.client as any).from('tenant_memberships').delete().eq('tenant_id', tenantId).eq('user_id', userId);
  }

  async getMyTenants(userId: string) {
    const { data } = await (this.supabase.client as any).from('tenant_memberships').select('tenant_id, role, tenants:tenant_id(id, name, slug, plan, logo_url)').eq('user_id', userId).eq('status', 'active');
    return data ?? [];
  }

  // ── Dashboard ────────────────────────────────────────────────────────────

  async getDashboard(tenantId: string) {
    const [members, lives, courses, appointments, orders, memberships] = await Promise.all([
      (this.supabase.client as any).from('tenant_memberships').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      (this.supabase.client as any).from('live_sessions').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      (this.supabase.client as any).from('courses').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      (this.supabase.client as any).from('appointments').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      (this.supabase.client as any).from('mbolo_orders').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      (this.supabase.client as any).from('tenant_memberships').select('role, count').eq('tenant_id', tenantId),
    ]);
    return {
      totalMembers: members.count ?? 0,
      totalLives: lives.count ?? 0,
      totalCourses: courses.count ?? 0,
      totalAppointments: appointments.count ?? 0,
      totalOrders: orders.count ?? 0,
      roles: memberships.data ?? [],
    };
  }
}
