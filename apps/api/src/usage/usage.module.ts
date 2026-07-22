import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TenantModule } from '../tenant/tenant.module';
import { UsageService } from './usage.service';
import { UsageController } from './usage.controller';

/**
 * Compteur d'usage (minutes live + crédits IA) — @Global pour que les gardes
 * s'injectent partout (LiveService, webhook LiveKit, billing, IA) sans câbler
 * chaque module. SupabaseModule est déjà @Global. AuthModule/TenantModule sont
 * requis par les gardes du contrôleur (JwtAuthGuard→AuthService, TenantGuard) —
 * sans eux le conteneur CRASHE AU BOOT (healthcheck → deploy failed).
 */
@Global()
@Module({
  imports: [AuthModule, TenantModule],
  controllers: [UsageController],
  providers: [UsageService],
  exports: [UsageService],
})
export class UsageModule {}
