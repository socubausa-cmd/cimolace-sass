import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
@Module({ imports: [SupabaseModule, TenantModule], providers: [CoursesService], controllers: [CoursesController], exports: [CoursesService] })
export class CoursesModule {}
