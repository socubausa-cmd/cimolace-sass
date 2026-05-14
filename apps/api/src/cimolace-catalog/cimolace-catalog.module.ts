import { Module } from '@nestjs/common';
import { TenantModule } from '../tenant/tenant.module';
import { CimolaceCatalogController } from './cimolace-catalog.controller';
import { CimolaceCatalogService } from './cimolace-catalog.service';

@Module({
  imports: [TenantModule],
  providers: [CimolaceCatalogService],
  controllers: [CimolaceCatalogController],
})
export class CimolaceCatalogModule {}
