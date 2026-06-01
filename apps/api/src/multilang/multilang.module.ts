import { Module } from '@nestjs/common';
import { TenantModule } from '../tenant/tenant.module';
import { MultilangController } from './multilang.controller';
import { MultilangService } from './multilang.service';

@Module({
  imports: [TenantModule],
  providers: [MultilangService],
  controllers: [MultilangController],
  exports: [MultilangService],
})
export class MultilangModule {}
