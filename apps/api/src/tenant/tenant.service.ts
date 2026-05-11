import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { CreateTenantDto } from './create-tenant.dto';
import type { UpdateBrandingDto } from './update-branding.dto';
import type { TenantContext } from './tenant.types';

type TenantRecord = Omit<TenantContext, 'userRole'>;
type MembershipRecord = { role: TenantContext['userRole'] };

@Injectable()
export class TenantService {
  constructor(private readonly supabase: SupabaseService) {}

  async resolveForUser(slug: string, userId: string): Promise<TenantContext> {
    const { data: tenant, error: tenantErr } = await this.supabase.client
      .from('tenants')
      .select(
        'id, name, slug, plan, status, primary_domain, logo_url, brand_colors, infrastructure_type',
      )
      .eq('slug', slug)
      .single();

    if (tenantErr || !tenant) {
      throw new NotFoundException(`Tenant "${slug}" introuvable`);
    }

    const { data: membership, error: memberErr } = await this.supabase.client
      .from('tenant_memberships')
      .select('role')
      .eq('tenant_id', tenant.id)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (memberErr || !membership) {
      throw new ForbiddenException('Accès à ce tenant refusé');
    }

    const tenantRecord = tenant as TenantRecord;
    const membershipRecord = membership as MembershipRecord;
    return { ...tenantRecord, userRole: membershipRecord.role };
  }

  /** Premier tenant après inscription : JWT requis, pas encore de X-Tenant-Slug. */
  async createForOwner(
    userId: string,
    dto: CreateTenantDto,
  ): Promise<TenantContext> {
    const { data: tenant, error: tErr } = await this.supabase.client
      .from('tenants')
      .insert({
        name: dto.name,
        slug: dto.slug,
        owner_user_id: userId,
        status: 'active',
        plan: 'free',
      })
      .select(
        'id, name, slug, plan, status, primary_domain, logo_url, brand_colors, infrastructure_type',
      )
      .single();

    if (tErr) {
      if (tErr.code === '23505') {
        throw new ConflictException('Ce slug est déjà utilisé');
      }
      throw new BadRequestException(tErr.message);
    }

    if (!tenant) {
      throw new BadRequestException('Création du tenant impossible');
    }

    const { error: mErr } = await this.supabase.client
      .from('tenant_memberships')
      .insert({
        tenant_id: tenant.id,
        user_id: userId,
        role: 'owner',
        status: 'active',
      });

    if (mErr) {
      await this.supabase.client.from('tenants').delete().eq('id', tenant.id);
      throw new BadRequestException(
        mErr.message ?? "Impossible d'associer le propriétaire au tenant",
      );
    }

    return { ...(tenant as TenantRecord), userRole: 'owner' };
  }

  async updateBranding(
    tenantId: string,
    userRole: TenantContext['userRole'],
    dto: UpdateBrandingDto,
  ): Promise<TenantContext> {
    const patch: {
      name?: string;
      logo_url?: string;
      primary_domain?: string;
      brand_colors?: Record<string, string>;
    } = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.logo_url !== undefined) patch.logo_url = dto.logo_url;
    if (dto.primary_domain !== undefined)
      patch.primary_domain = dto.primary_domain;
    if (dto.brand_colors !== undefined)
      patch.brand_colors = { ...dto.brand_colors };

    const { data, error } = await this.supabase.client
      .from('tenants')
      .update(patch)
      .eq('id', tenantId)
      .select(
        'id, name, slug, plan, status, primary_domain, logo_url, brand_colors, infrastructure_type',
      )
      .single();

    if (error || !data) {
      throw new BadRequestException(
        error?.message ?? 'Mise à jour du branding impossible',
      );
    }

    return { ...(data as Omit<TenantContext, 'userRole'>), userRole };
  }
}
