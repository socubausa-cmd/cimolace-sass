import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';
import { AuthModule } from '../auth/auth.module';
import { TeamInvitesService } from './team-invites.service';
import { TeamInvitesController } from './team-invites.controller';

@Module({
  imports: [SupabaseModule, TenantModule, AuthModule],
  providers: [TeamInvitesService],
  controllers: [TeamInvitesController],
  exports: [TeamInvitesService],
})
export class TeamInvitesModule {}
