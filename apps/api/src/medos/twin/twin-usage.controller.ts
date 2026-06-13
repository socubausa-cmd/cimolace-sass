import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentTenant } from '../../tenant/current-tenant.decorator';
import { TenantGuard } from '../../tenant/tenant.guard';
import type { TenantContext } from '../../tenant/tenant.types';
import { MedosEnabledGuard } from '../medos-enabled.guard';
import { TwinEnabledGuard } from './twin-enabled.guard';
import { SupabaseService } from '../../supabase/supabase.service';

/**
 * Coût estimé en USD par million de tokens output — tarif Claude sonnet-4-6.
 * Le tarif input n'est volontairement pas comptabilisé : on logge uniquement
 * un compteur "tokens" global qu'on assimile aux tokens output pour donner
 * une majoration prudente du coût.
 */
const COST_PER_MTOK_OUTPUT = 15;

type AgentRunRow = {
  tenant_id: string;
  agent: string | null;
  tokens: number | null;
  created_at: string;
};

type ByDay = { date: string; tokens: number; cost_usd: number };
type ByAgent = { agent: string; tokens: number; runs: number; cost_usd: number };

@ApiTags('MedOS — Bio Digital Twin (Admin Usage)')
@ApiBearerAuth()
@Controller('med/twin/admin')
@UseGuards(
  JwtAuthGuard,
  TenantGuard,
  MedosEnabledGuard,
  TwinEnabledGuard,
  RolesGuard,
)
export class TwinUsageController {
  constructor(private readonly supabase: SupabaseService) {}

  private get db(): any {
    return this.supabase.client as any;
  }

  /**
   * GET /med/twin/admin/usage?from=YYYY-MM-DD&to=YYYY-MM-DD
   * Agrège la consommation IA (tokens + coût estimé) sur la période demandée
   * pour le tenant courant.
   */
  @Get('usage')
  @Roles('owner')
  async usage(
    @CurrentTenant() tenant: TenantContext,
    @Query('from') fromRaw?: string,
    @Query('to') toRaw?: string,
  ): Promise<{
    period: { from: string; to: string };
    total_tokens: number;
    total_runs: number;
    total_cost_usd: number;
    by_day: ByDay[];
    by_agent: ByAgent[];
  }> {
    const now = new Date();
    const defaultFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const defaultTo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    const from = this.parseDate(fromRaw, defaultFrom);
    const to = this.parseDate(toRaw, defaultTo);

    // borne haute exclusive en UTC : on prend le jour J à 23:59:59.999
    const toExclusive = new Date(to.getTime());
    toExclusive.setUTCHours(23, 59, 59, 999);

    const { data, error } = await this.db
      .from('med_ai_agent_runs')
      .select('tenant_id, agent, tokens, created_at')
      .eq('tenant_id', tenant.id)
      .gte('created_at', from.toISOString())
      .lte('created_at', toExclusive.toISOString());

    if (error) {
      // remonte l'erreur au format Nest standard
      throw new Error(error.message ?? 'Failed to read med_ai_agent_runs');
    }

    const rows: AgentRunRow[] = data ?? [];

    const byDayMap = new Map<string, { tokens: number }>();
    const byAgentMap = new Map<string, { tokens: number; runs: number }>();
    let totalTokens = 0;
    let totalRuns = 0;

    for (const row of rows) {
      const tokens = Number.isFinite(row.tokens as number) ? Number(row.tokens) : 0;
      totalTokens += tokens;
      totalRuns += 1;

      const day = (row.created_at || '').slice(0, 10);
      if (day) {
        const cur = byDayMap.get(day) ?? { tokens: 0 };
        cur.tokens += tokens;
        byDayMap.set(day, cur);
      }

      const agent = row.agent || 'unknown';
      const curA = byAgentMap.get(agent) ?? { tokens: 0, runs: 0 };
      curA.tokens += tokens;
      curA.runs += 1;
      byAgentMap.set(agent, curA);
    }

    const by_day: ByDay[] = Array.from(byDayMap.entries())
      .map(([date, v]) => ({
        date,
        tokens: v.tokens,
        cost_usd: this.tokensToCost(v.tokens),
      }))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    const by_agent: ByAgent[] = Array.from(byAgentMap.entries())
      .map(([agent, v]) => ({
        agent,
        tokens: v.tokens,
        runs: v.runs,
        cost_usd: this.tokensToCost(v.tokens),
      }))
      .sort((a, b) => b.tokens - a.tokens);

    return {
      period: {
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
      },
      total_tokens: totalTokens,
      total_runs: totalRuns,
      total_cost_usd: this.tokensToCost(totalTokens),
      by_day,
      by_agent,
    };
  }

  private tokensToCost(tokens: number): number {
    return Math.round(((tokens / 1_000_000) * COST_PER_MTOK_OUTPUT) * 10_000) / 10_000;
  }

  private parseDate(raw: string | undefined, fallback: Date): Date {
    if (!raw) return fallback;
    // Attendu : YYYY-MM-DD (interprété en UTC midnight).
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (!m) return fallback;
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    const dt = new Date(Date.UTC(y, mo, d));
    return Number.isNaN(dt.getTime()) ? fallback : dt;
  }
}
