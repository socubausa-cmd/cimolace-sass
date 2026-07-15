import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthModule } from "../auth/auth.module";
import { TenantModule } from "../tenant/tenant.module";
import { LiveKitModule } from "../livekit/livekit.module";
import { LiriEntitlementsModule } from "../billing/liri-entitlements.module";
import { SupabaseModule } from "../supabase/supabase.module";
import { EmailEngineModule } from "../email-engine/email-engine.module";
import { LiveService } from "./live.service";
import { LiveController } from "./live.controller";
import { LiveReplayFileController } from "./live-replay-file.controller";
import { LiriAdminController } from "./liri-admin.controller";
import { LiveGuestPublicController } from "./live-guest-public.controller";
import { LiveEmbedService } from "./embed/live-embed.service";
import { LiveEmbedController } from "./embed/live-embed.controller";
import { LiveEmbedTokenGuard } from "./embed/live-embed-token.guard";
// Webhook moved from LiveKitModule to here so it can dispatch to Liri.
import { LiveKitWebhookController } from "../livekit/livekit-webhook.controller";
import { LiveKitWebhookService } from "../livekit/livekit-webhook.service";

@Module({
  imports: [
    AuthModule,
    TenantModule,
    LiveKitModule,
    LiriEntitlementsModule,
    SupabaseModule,
    // Email « replay prêt » envoyé au patient + praticien quand l'egress d'une
    // TÉLÉCONSULTATION se termine (dispatch dans LiveKitWebhookService).
    EmailEngineModule,
    // JwtModule pour signer/vérifier les embed tokens LIRI (30 min lifetime).
    // Le secret est résolu à la demande via ConfigService dans les services
    // — on ne le passe pas ici pour éviter de coupler au bootstrap.
    JwtModule.register({}),
  ],
  controllers: [
    // IMPORTANT : LiveEmbedController AVANT LiveController
    // sinon @Post(':id/token') dans LiveController capture /lives/embed/token
    LiveEmbedController,
    LiveReplayFileController,
    LiveController,
    LiriAdminController,
    LiveGuestPublicController,
    LiveKitWebhookController,
  ],
  providers: [
    LiveService,
    LiveEmbedService,
    LiveEmbedTokenGuard,
    LiveKitWebhookService,
  ],
  exports: [LiveService, LiveEmbedService],
})
export class LiveModule {}
