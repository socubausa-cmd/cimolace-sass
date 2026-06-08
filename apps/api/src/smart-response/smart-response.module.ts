import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';
import { AuthModule } from '../auth/auth.module';
import { AiBillingModule } from '../ai-billing/ai-billing.module';
import { SmartResponseService } from './smart-response.service';
import { SmartResponseController } from './smart-response.controller';

@Module({
  imports: [SupabaseModule, TenantModule, AuthModule, AiBillingModule],
  providers: [SmartResponseService],
  controllers: [SmartResponseController],
  exports: [SmartResponseService],
})
export class SmartResponseModule {}
