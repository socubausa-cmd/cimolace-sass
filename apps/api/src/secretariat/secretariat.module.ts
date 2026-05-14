import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';
import { SecretariatController } from './secretariat.controller';
import { SecretariatService } from './secretariat.service';

@Module({ imports: [SupabaseModule, TenantModule], providers: [SecretariatService], controllers: [SecretariatController], exports: [SecretariatService] })
export class SecretariatModule {}
