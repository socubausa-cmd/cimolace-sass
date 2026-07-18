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
// ApiKeyGuard authentifie les appels storefront par clé API tenant (mbk_…).
// Sa seule dépendance est SupabaseService (fourni par SupabaseModule, importé ici).
import { ApiKeyGuard } from '../auth/api-key.guard';
import { EngineEnabledGuard } from '../common/guards/engine-enabled.guard';
import { MboloController } from './mbolo.controller';
import { MboloService } from './mbolo.service';
import { MboloStorefrontController } from './mbolo-storefront.controller';
import { MboloEmbedController } from './mbolo-embed.controller';
import { MboloLiveController } from './mbolo-live.controller';
import { MboloLiveService } from './mbolo-live.service';

@Module({
  imports: [SupabaseModule, TenantModule, AuthModule, LiveModule, LiriEntitlementsModule],
  providers: [MboloService, MboloLiveService, ApiKeyGuard, EngineEnabledGuard],
  controllers: [MboloController, MboloStorefrontController, MboloEmbedController, MboloLiveController],
  exports: [MboloService],
})
export class MboloModule {}
