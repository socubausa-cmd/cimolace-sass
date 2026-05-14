import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';
import { BillingController, BillingWebhookController } from './billing.controller';
import { BillingService } from './billing.service';
import { ChariowProvider } from './providers/chariow.provider';
import { CinetPayProvider } from './providers/cinetpay.provider';

@Module({
  imports: [SupabaseModule, TenantModule],
  providers: [BillingService, ChariowProvider, CinetPayProvider],
  controllers: [BillingController, BillingWebhookController],
  exports: [BillingService],
})
export class BillingModule {}
