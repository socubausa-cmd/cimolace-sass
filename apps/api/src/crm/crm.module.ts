import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { TenantModule } from '../tenant/tenant.module';
import { MarketingModule } from '../marketing/marketing.module';
import { LiriPublicModule } from '../liri-public/liri-public.module';
import { MessagingModule } from '../messaging/messaging.module';
import { EmailEngineModule } from '../email-engine/email-engine.module';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';

// MarketingModule = bus d'automations (événements CRM → automations tenant).
// LiriPublicModule = WebhookService (webhooks sortants crm.* signés HMAC vers le SI client).
// MessagingModule = envoi réel d'un message depuis une fiche.
// EmailEngineModule = notification email (assignee de tâche) via la clé Resend du tenant.
@Module({
  imports: [AuthModule, TenantModule, SupabaseModule, MarketingModule, LiriPublicModule, MessagingModule, EmailEngineModule],
  controllers: [CrmController],
  providers: [CrmService],
  exports: [CrmService],
})
export class CrmModule {}
