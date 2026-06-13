import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type { TenantContext } from '../../tenant/tenant.types';

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

export interface AuditFilters {
  limit?: number;
  offset?: number;
  resource?: string;
  action?: string;
  actor_id?: string;
  from?: string; // ISO date
  to?: string; // ISO date
}

export interface AiRunFilters {
  limit?: number;
  offset?: number;
  agent?: string;
  patient_id?: string;
  from?: string;
  to?: string;
}

export interface PagedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

@Injectable()
export class MedAuditService {
  constructor(private readonly supabase: SupabaseService) {}

  private clampLimit(limit?: number): number {
    if (!limit || Number.isNaN(limit) || limit <= 0) return DEFAULT_LIMIT;
    return Math.min(limit, MAX_LIMIT);
  }

  private clampOffset(offset?: number): number {
    if (!offset || Number.isNaN(offset) || offset < 0) return 0;
    return offset;
  }

  async listAuditLog(
    tenant: TenantContext,
    filters: AuditFilters = {},
  ): Promise<PagedResult<any>> {
    const limit = this.clampLimit(filters.limit);
    const offset = this.clampOffset(filters.offset);

    let q = this.supabase.client
      .from('med_audit_log')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenant.id);

    if (filters.resource) q = q.eq('resource', filters.resource);
    if (filters.action) q = q.eq('action', filters.action);
    if (filters.actor_id) q = q.eq('actor_id', filters.actor_id);
    if (filters.from) q = q.gte('created_at', filters.from);
    if (filters.to) q = q.lte('created_at', filters.to);

    const { data, error, count } = await q
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new InternalServerErrorException(error.message);

    return {
      data: data ?? [],
      total: count ?? 0,
      limit,
      offset,
    };
  }

  async listAiRuns(
    tenant: TenantContext,
    filters: AiRunFilters = {},
  ): Promise<PagedResult<any>> {
    const limit = this.clampLimit(filters.limit);
    const offset = this.clampOffset(filters.offset);

    let q = this.supabase.client
      .from('med_ai_agent_runs')
      .select(
        'id, analysis_id, patient_id, agent, prompt_version, model, tokens, latency_ms, error, created_at',
        { count: 'exact' },
      )
      .eq('tenant_id', tenant.id);

    if (filters.agent) q = q.eq('agent', filters.agent);
    if (filters.patient_id) q = q.eq('patient_id', filters.patient_id);
    if (filters.from) q = q.gte('created_at', filters.from);
    if (filters.to) q = q.lte('created_at', filters.to);

    const { data, error, count } = await q
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new InternalServerErrorException(error.message);

    return {
      data: data ?? [],
      total: count ?? 0,
      limit,
      offset,
    };
  }
}
