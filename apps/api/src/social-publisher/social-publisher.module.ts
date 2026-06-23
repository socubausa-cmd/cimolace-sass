import { Module } from '@nestjs/common';
import { SocialPublisherController } from './social-publisher.controller';
import { SocialPublisherService } from './social-publisher.service';
import { SocialOAuthController } from './social-oauth.controller';
import { SocialOAuthService } from './social-oauth.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  imports: [SupabaseModule, TenantModule],
  controllers: [SocialPublisherController, SocialOAuthController],
  providers: [SocialPublisherService, SocialOAuthService],
  exports: [SocialPublisherService],
})
export class SocialPublisherModule {}
