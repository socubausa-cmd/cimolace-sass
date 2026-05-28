import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CimolaceStaffGuard } from '../../cimolace-backoffice/cimolace-staff.guard';
import { SupabaseService } from '../../supabase/supabase.service';
import { ApiKeysService } from './api-keys.service';

type AuthRequest = Request & { user: { id: string; email?: string } };
type CreateKeyDto = { label: string };

/**
 * Admin Cimolace — gestion des clés API tenant pour intégration externe (Mode C.3).
 *
 * Toutes les routes nécessitent un JWT Supabase valide + le staff Cimolace
 * (membership `cimolace_staff_members` actif, ou email whitelisté).
 *
 * UI : `apps/app/src/pages/AdminApiKeys.tsx` (à créer en parallèle).
 */
@ApiTags('Cimolace Admin — API Keys')
@ApiBearerAuth()
@Controller('admin/tenants/:tenantId/api-keys')
@UseGuards(JwtAuthGuard, CimolaceStaffGuard)
export class ApiKeysController {
  constructor(
    private readonly apiKeysService: ApiKeysService,
    private readonly supabase: SupabaseService,
  ) {}

  /**
   * Crée une nouvelle clé API pour le tenant.
   *
   * IMPORTANT : la valeur brute (`raw_key`) n'est retournée qu'à cet appel
   * et ne peut JAMAIS être récupérée ensuite. Le client doit la stocker
   * immédiatement de manière sécurisée.
   */
  @Post()
  async create(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateKeyDto,
    @Req() req: AuthRequest,
  ) {
    const tenant = await this.resolveTenant(tenantId);
    return this.apiKeysService.createKey(
      tenant.id,
      tenant.slug,
      dto.label,
      req.user.id,
    );
  }

  /**
   * Liste les clés actives et révoquées pour ce tenant.
   * Aucune valeur brute n'est exposée (impossible techniquement).
   */
  @Get()
  async list(@Param('tenantId') tenantId: string) {
    return this.apiKeysService.listKeys(tenantId);
  }

  /**
   * Révoque une clé. L'effet est immédiat (next request avec cette clé → 401).
   */
  @Delete(':keyId')
  async revoke(
    @Param('tenantId') tenantId: string,
    @Param('keyId') keyId: string,
  ) {
    return this.apiKeysService.revokeKey(tenantId, keyId);
  }

  // ─────────────────────────────────────────────────────────────────────

  private async resolveTenant(
    tenantId: string,
  ): Promise<{ id: string; slug: string }> {
    const { data, error } = await (this.supabase.client as any)
      .from('tenants')
      .select('id, slug')
      .eq('id', tenantId)
      .maybeSingle();

    if (error || !data) {
      throw new NotFoundException(`Tenant ${tenantId} introuvable`);
    }

    return data as { id: string; slug: string };
  }
}
