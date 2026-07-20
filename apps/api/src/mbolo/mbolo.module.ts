import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';
// AuthModule is required because MboloLiveController applies JwtAuthGuard
// (from common/guards), which has AuthService as a constructor dep. NestJS
// resolves guard deps in the importing module's scope, not the guard's.
import { AuthModule } from '../auth/auth.module';
// Mbolo routes ALL video through Liri. We never import LiveKitModule here
// — that would re-introduce the bypass the P5 refactor eliminated for MEDOS.
import { LiveModule } from '../live/live.module';
import { LiriEntitlementsModule } from '../billing/liri-entitlements.module';
// Fournit TenantPaymentConfigService → clé Stripe PAR TENANT (encaissement par boutique).
import { TenantPaymentConfigModule } from '../billing/tenant-payment-config/tenant-payment-config.module';
// Fournit PawaPayService → Mobile Money (dépôts) réutilisant l'infra Cimolace existante.
import { PawaPayModule } from '../pawapay/pawapay.module';
// ApiKeyGuard authentifie les appels storefront par clé API tenant (mbk_…).
// Sa seule dépendance est SupabaseService (fourni par SupabaseModule, importé ici).
import { ApiKeyGuard } from '../auth/api-key.guard';
import { EngineEnabledGuard } from '../common/guards/engine-enabled.guard';
import { MboloController } from './mbolo.controller';
import { MboloService } from './mbolo.service';
import { MboloStorefrontController } from './mbolo-storefront.controller';
import { MboloAdminController } from './mbolo-admin.controller';
import { MboloAdminKeyGuard } from './mbolo-admin-key.guard';
import { MboloEmbedController } from './mbolo-embed.controller';
import { MboloLiveController } from './mbolo-live.controller';
import { MboloLiveService } from './mbolo-live.service';

@Module({
  imports: [SupabaseModule, TenantModule, AuthModule, LiveModule, LiriEntitlementsModule, TenantPaymentConfigModule, PawaPayModule],
  providers: [MboloService, MboloLiveService, ApiKeyGuard, EngineEnabledGuard, MboloAdminKeyGuard],
  controllers: [MboloController, MboloStorefrontController, MboloAdminController, MboloEmbedController, MboloLiveController],
  exports: [MboloService],
})
export class MboloModule {}
