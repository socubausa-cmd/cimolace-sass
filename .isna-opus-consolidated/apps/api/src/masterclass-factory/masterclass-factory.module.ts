import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';
import { MasterclassFactoryController } from './masterclass-factory.controller';
import { MasterclassFactoryService } from './masterclass-factory.service';
@Module({ imports: [SupabaseModule, TenantModule], providers: [MasterclassFactoryService], controllers: [MasterclassFactoryController], exports: [MasterclassFactoryService] })
export class MasterclassFactoryModule {}
