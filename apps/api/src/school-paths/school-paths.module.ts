import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { SchoolPathsController } from './school-paths.controller';
import { SchoolPathsService } from './school-paths.service';

@Module({ imports: [SupabaseModule], providers: [SchoolPathsService], controllers: [SchoolPathsController], exports: [SchoolPathsService] })
export class SchoolPathsModule {}
