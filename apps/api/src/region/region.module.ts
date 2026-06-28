import { Global, Module } from '@nestjs/common';
import { RegionService } from './region.service';

/**
 * RegionModule — provides RegionService globally so SupabaseService (and any
 * future region-aware consumer) can inject it without importing the module
 * everywhere. ConfigModule is already global, so RegionService's ConfigService
 * dependency resolves without extra imports.
 */
@Global()
@Module({
  providers: [RegionService],
  exports: [RegionService],
})
export class RegionModule {}
