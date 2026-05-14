import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TenantService } from './tenant.service';
import { TenantController } from './tenant.controller';
import { TenantApiKeyController } from './tenant-api-key.controller';

@Module({
  imports: [AuthModule],
  controllers: [TenantController, TenantApiKeyController],
  providers: [TenantService],
  exports: [TenantService],
})
export class TenantModule {}
