import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { TenantApiKeyService } from './tenant-api-key.service';

class CreateApiKeyDto {
  @IsString()
  @IsNotEmpty()
  label: string;
}

@Controller('tenants/api-keys')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('owner', 'admin')
export class TenantApiKeyController {
  constructor(private readonly apiKeyService: TenantApiKeyService) {}

  /** Liste les clés actives du tenant courant. */
  @Get()
  async list(@Req() req: any) {
    const keys = await this.apiKeyService.listKeys(req.tenant.id);
    return { data: keys };
  }

  /**
   * Crée une nouvelle clé API pour le tenant courant.
   * La clé brute n'est retournée QU'UNE SEULE FOIS — l'owner doit la copier immédiatement.
   */
  @Post()
  async create(@Req() req: any, @Body() dto: CreateApiKeyDto) {
    const result = await this.apiKeyService.createKey(
      req.tenant.id,
      dto.label,
      req.user.id,
    );
    return {
      data: result,
      warning: 'Conservez cette clé en lieu sûr — elle ne sera plus affichée.',
    };
  }

  /** Révoque une clé (soft delete irréversible). */
  @Delete(':keyId')
  async revoke(@Req() req: any, @Param('keyId') keyId: string) {
    const result = await this.apiKeyService.revokeKey(keyId, req.tenant.id);
    return { data: result };
  }
}
