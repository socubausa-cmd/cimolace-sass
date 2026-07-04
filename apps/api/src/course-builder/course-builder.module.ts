import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';
import { AiUtilsModule } from '../ai-utils/ai-utils.module';
import { MessagingModule } from '../messaging/messaging.module';
import { CourseBuilderController } from './course-builder.controller';
import { CourseBuilderService } from './course-builder.service';
// MessagingModule exporte TopicsService : LOT 3 — à la finalisation d'une post-prod
// de cours, on alimente (idempotent) le Sujet kind='topic' context_type='course'.
@Module({ imports: [SupabaseModule, TenantModule, AiUtilsModule, MessagingModule], providers: [CourseBuilderService], controllers: [CourseBuilderController], exports: [CourseBuilderService] })
export class CourseBuilderModule {}
