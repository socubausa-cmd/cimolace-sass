import { Module } from '@nestjs/common';
import { TenantModule } from '../../tenant/tenant.module';
import { MedAuditController } from './med-audit.controller';
import { MedAuditService } from './med-audit.service';

@Module({
  imports: [TenantModule],
  controllers: [MedAuditController],
  providers: [MedAuditService],
  exports: [MedAuditService],
})
export class MedAuditAdminModule {}
