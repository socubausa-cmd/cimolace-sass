import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { TenantGuard } from "../common/guards/tenant.guard";
import { LiveService } from "./live.service";

/**
 * Liri admin endpoints — billing minutes consumption aggregated across all
 * engines that called Liri.issueTokenForSession (MEDOS teleconsult, Mbolo
 * live shopping, ISNA classes, ...).
 *
 * Auth: tenant-scoped JWT. Any staff role of the calling tenant can read
 * their own consumption (helps the cabinet read "how much video time did
 * we use this month?"). Cross-tenant Cimolace staff reads come through
 * the existing CimolaceStaffGuard pattern.
 */
@Controller("liri/admin")
@UseGuards(JwtAuthGuard, TenantGuard)
export class LiriAdminController {
  constructor(private readonly live: LiveService) {}

  /**
   * Aggregate video minutes consumed by the calling tenant inside the
   * [from, to] window. Defaults: from = first day of current month, to =
   * now. Returned shape:
   *   [{ purpose, session_count, total_seconds, total_minutes }, ...]
   * Open sessions (no ended_at yet) are excluded.
   */
  @Get("consumption")
  async consumption(
    @Req() req: any,
    @Query("from") fromQuery?: string,
    @Query("to") toQuery?: string,
  ) {
    const tenantId = req.tenant.id;
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);

    const from = fromQuery ?? defaultFrom.toISOString();
    const to = toQuery ?? now.toISOString();

    const breakdown = await this.live.getLiriConsumption(tenantId, from, to);

    const totalSeconds = breakdown.reduce((s, b) => s + b.total_seconds, 0);
    // Return the raw payload — the global ResponseInterceptor wraps every
    // non-@SkipResponseWrapper response in { data: … }. Wrapping here too
    // would double-encapsulate (the bug this endpoint had).
    return {
      tenant_id: tenantId,
      window: { from, to },
      total_minutes: Math.round(totalSeconds / 60),
      total_seconds: totalSeconds,
      breakdown,
    };
  }
}
