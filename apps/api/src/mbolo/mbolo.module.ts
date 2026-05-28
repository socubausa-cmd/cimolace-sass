import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';
// Mbolo routes ALL video through Liri. We never import LiveKitModule here
// — that would re-introduce the bypass the P5 refactor eliminated for MEDOS.
import { LiveModule } from '../live/live.module';
import { MboloController } from './mbolo.controller';
import { MboloService } from './mbolo.service';
import { MboloLiveController } from './mbolo-live.controller';
import { MboloLiveService } from './mbolo-live.service';

@Module({
  imports: [SupabaseModule, TenantModule, LiveModule],
  providers: [MboloService, MboloLiveService],
  controllers: [MboloController, MboloLiveController],
  exports: [MboloService],
})
export class MboloModule {}
