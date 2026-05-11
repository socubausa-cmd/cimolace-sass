import { Module } from '@nestjs/common';
import { TenantModule } from '../tenant/tenant.module';
import { LiveController } from './live.controller';
import { LiveService } from './live.service';

@Module({
  imports: [TenantModule],
  providers: [LiveService],
  controllers: [LiveController],
})
export class LiveModule {}
