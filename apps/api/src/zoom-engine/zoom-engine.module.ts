import { Module } from '@nestjs/common';
import { ZoomEngineController } from './zoom-engine.controller';
import { ZoomEngineService } from './zoom-engine.service';
import { ZoomOAuthService } from './zoom-oauth.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';

@Module({
  // TenantModule fournit TenantService, requis par TenantGuard (@UseGuards sur listPublished
  // pour résoudre le tenant élève via X-Tenant-Slug). Sans cet import, Nest ne peut pas injecter
  // TenantGuard dans ce module → crash au démarrage (deploy failed).
  imports: [SupabaseModule, TenantModule],
  controllers: [ZoomEngineController],
  providers: [ZoomEngineService, ZoomOAuthService],
  exports: [ZoomEngineService, ZoomOAuthService],
})
export class ZoomEngineModule {}
