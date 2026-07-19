import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TenantModule } from '../tenant/tenant.module';
import { LiriEntitlementsModule } from '../billing/liri-entitlements.module';
import { MarketingModule } from '../marketing/marketing.module';
import { StudentInviteService } from './student-invite.service';
import { StudentInviteController } from './student-invite.controller';

/**
 * Module OTP d'accès élève (L5). AuthModule fournit le client Supabase service-role
 * (auth.admin + tables) ; TenantModule fournit TenantService requis par TenantGuard.
 */
@Module({
  imports: [AuthModule, TenantModule, LiriEntitlementsModule, MarketingModule],
  controllers: [StudentInviteController],
  providers: [StudentInviteService],
  exports: [StudentInviteService],
})
export class StudentInviteModule {}
