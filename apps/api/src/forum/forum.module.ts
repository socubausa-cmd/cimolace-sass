import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';
import { ForumController } from './forum.controller';
import { ForumService } from './forum.service';

@Module({ imports: [SupabaseModule, TenantModule], providers: [ForumService], controllers: [ForumController], exports: [ForumService] })
export class ForumModule {}
