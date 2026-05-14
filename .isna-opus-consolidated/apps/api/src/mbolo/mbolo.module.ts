import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';
import { MboloController } from './mbolo.controller';
import { MboloService } from './mbolo.service';
@Module({ imports: [SupabaseModule, TenantModule], providers: [MboloService], controllers: [MboloController], exports: [MboloService] })
export class MboloModule {}
