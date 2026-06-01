import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';
import { AuthModule } from '../auth/auth.module';
import { AiBillingModule } from '../ai-billing/ai-billing.module';
import { AiUtilsService } from './ai-utils.service';
import { AiUtilsController } from './ai-utils.controller';

@Module({
  imports: [SupabaseModule, TenantModule, AuthModule, AiBillingModule],
  providers: [AiUtilsService],
  controllers: [AiUtilsController],
  exports: [AiUtilsService],
})
export class AiUtilsModule {}
