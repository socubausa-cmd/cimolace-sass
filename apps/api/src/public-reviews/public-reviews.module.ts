import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';
import { AuthModule } from '../auth/auth.module';
import { PublicReviewsService } from './public-reviews.service';
import { PublicReviewsController } from './public-reviews.controller';

@Module({
  imports: [SupabaseModule, TenantModule, AuthModule],
  providers: [PublicReviewsService],
  controllers: [PublicReviewsController],
  exports: [PublicReviewsService],
})
export class PublicReviewsModule {}
