import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';
import { IriController } from './iri.controller';
import { IriService } from './iri.service';
@Module({ imports: [SupabaseModule, TenantModule], providers: [IriService], controllers: [IriController], exports: [IriService] })
export class IriModule {}
