import { Module } from '@nestjs/common';
import { RolesGuard } from '../common/guards/roles.guard';
import { TenantController } from './tenant.controller';
import { TenantGuard } from './tenant.guard';
import { TenantService } from './tenant.service';

@Module({
  providers: [TenantService, TenantGuard, RolesGuard],
  controllers: [TenantController],
  exports: [TenantService, TenantGuard, RolesGuard],
})
export class TenantModule {}
