import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';
import { AuthModule } from '../auth/auth.module';
import { EmailImapService } from './email-imap.service';
import { EmailImapController } from './email-imap.controller';

@Module({
  imports: [SupabaseModule, TenantModule, AuthModule],
  providers: [EmailImapService],
  controllers: [EmailImapController],
  exports: [EmailImapService],
})
export class EmailImapModule {}
