import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthHandoffController } from './auth-handoff.controller';
import { AuthHandoffService } from './auth-handoff.service';

@Module({
  imports: [AuthModule, SupabaseModule],
  controllers: [AuthHandoffController],
  providers: [AuthHandoffService],
})
export class AuthHandoffModule {}
