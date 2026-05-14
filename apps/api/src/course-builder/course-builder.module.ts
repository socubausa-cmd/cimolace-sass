import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';
import { CourseBuilderController } from './course-builder.controller';
import { CourseBuilderService } from './course-builder.service';
@Module({ imports: [SupabaseModule, TenantModule], providers: [CourseBuilderService], controllers: [CourseBuilderController], exports: [CourseBuilderService] })
export class CourseBuilderModule {}
