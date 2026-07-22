import { Global, Module } from '@nestjs/common';
import { UsageService } from './usage.service';
import { UsageController } from './usage.controller';

/**
 * Compteur d'usage (minutes live + crédits IA) — @Global pour que les gardes
 * s'injectent partout (LiveService, webhook LiveKit, billing, IA) sans câbler
 * chaque module. SupabaseModule est déjà @Global.
 */
@Global()
@Module({
  controllers: [UsageController],
  providers: [UsageService],
  exports: [UsageService],
})
export class UsageModule {}
