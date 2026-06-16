import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { TenantGuard } from '../../tenant/tenant.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentTenant } from '../../tenant/current-tenant.decorator';
import type { TenantContext } from '../../tenant/tenant.types';
import { TenantPaymentConfigService } from './tenant-payment-config.service';
import { TogglePaymentMethodDto, UpsertPaymentMethodDto } from './dto';

/**
 * Config des MOYENS DE PAIEMENT par tenant (back-office → Paramètres → Paiements).
 *
 * Auth : JWT + tenant résolu via header X-Tenant-Slug (TenantGuard) + rôle
 * owner|admin du tenant (RolesGuard). Le tenant courant est injecté par
 * @CurrentTenant (jamais pris du body → pas d'usurpation cross-tenant).
 *
 * Aucun secret en clair ne ressort : toutes les réponses passent par la vue
 * masquée { set, last4 } du service.
 */
@Controller('billing/payment-methods')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('owner', 'admin')
export class TenantPaymentConfigController {
  constructor(private readonly svc: TenantPaymentConfigService) {}

  /** Liste des providers configurés du tenant (credentials masqués). */
  @Get()
  async list(@CurrentTenant() t: TenantContext) {
    return this.svc.list(t);
  }

  /** Upsert d'un provider : chiffre les credentials en clair → enabled=true. */
  @Post()
  async upsert(
    @CurrentTenant() t: TenantContext,
    @Body() body: UpsertPaymentMethodDto,
  ) {
    return this.svc.upsert(t, body);
  }

  /** Test de connexion RÉEL ; met à jour last_test_* et renvoie {ok, message}. */
  @Post(':provider/test')
  async test(
    @CurrentTenant() t: TenantContext,
    @Param('provider') provider: string,
  ) {
    return this.svc.test(t, provider);
  }

  /** Active / désactive un provider. */
  @Patch(':provider')
  async setEnabled(
    @CurrentTenant() t: TenantContext,
    @Param('provider') provider: string,
    @Body() body: TogglePaymentMethodDto,
  ) {
    return this.svc.setEnabled(t, provider, body.enabled);
  }

  /** Supprime la config d'un provider. */
  @Delete(':provider')
  async remove(
    @CurrentTenant() t: TenantContext,
    @Param('provider') provider: string,
  ) {
    return this.svc.remove(t, provider);
  }
}
