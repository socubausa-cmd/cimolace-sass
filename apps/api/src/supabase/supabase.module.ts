import { Global, Module } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { RegionModule } from '../region/region.module';

@Global()
@Module({
  // RegionModule supplies RegionService (also @Global) so SupabaseService can
  // inject it for multi-region routing. Additive: 'global' tenants are
  // unaffected.
  imports: [RegionModule],
  providers: [SupabaseService],
  exports: [SupabaseService],
})
export class SupabaseModule {}
