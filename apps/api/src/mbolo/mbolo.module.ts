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
import { MboloController } from './mbolo.controller';
import { MboloService } from './mbolo.service';
import { MboloLiveController } from './mbolo-live.controller';
import { MboloLiveService } from './mbolo-live.service';

@Module({
  imports: [SupabaseModule, TenantModule, AuthModule, LiveModule],
  providers: [MboloService, MboloLiveService],
  controllers: [MboloController, MboloLiveController],
  exports: [MboloService],
})
export class MboloModule {}
