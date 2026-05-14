import { Module } from '@nestjs/common';
import { AiWorkerController } from './ai-worker.controller';
import { AiWorkerService } from './ai-worker.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [AiWorkerController],
  providers: [AiWorkerService],
  exports: [AiWorkerService],
})
export class AiWorkerModule {}
