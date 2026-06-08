import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';
import { AuthModule } from '../auth/auth.module';
import { AiBillingService } from './ai-billing.service';
import { AiBillingController } from './ai-billing.controller';
import { AiBillingStripeController } from './ai-billing-stripe.controller';

@Module({
  imports: [SupabaseModule, TenantModule, AuthModule],
  controllers: [AiBillingController, AiBillingStripeController],
  providers: [AiBillingService],
  exports: [AiBillingService],
})
export class AiBillingModule {}
