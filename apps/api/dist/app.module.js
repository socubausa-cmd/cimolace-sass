"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const health_controller_1 = require("./health.controller");
const supabase_module_1 = require("./supabase/supabase.module");
const livekit_module_1 = require("./livekit/livekit.module");
const auth_module_1 = require("./auth/auth.module");
const tenant_module_1 = require("./tenant/tenant.module");
const cimolace_module_1 = require("./cimolace/cimolace.module");
const cimolace_backoffice_module_1 = require("./cimolace-backoffice/cimolace-backoffice.module");
const cimolace_catalog_module_1 = require("./cimolace-catalog/cimolace-catalog.module");
const billing_module_1 = require("./billing/billing.module");
const checkout_module_1 = require("./checkout/checkout.module");
const live_module_1 = require("./live/live.module");
const marketing_module_1 = require("./marketing/marketing.module");
const notifications_module_1 = require("./notifications/notifications.module");
const course_builder_module_1 = require("./course-builder/course-builder.module");
const courses_module_1 = require("./courses/courses.module");
const booking_module_1 = require("./booking/booking.module");
const secretariat_module_1 = require("./secretariat/secretariat.module");
const forum_module_1 = require("./forum/forum.module");
const smart_response_module_1 = require("./smart-response/smart-response.module");
const immersive_live_module_1 = require("./immersive-live/immersive-live.module");
const replay_module_1 = require("./replay/replay.module");
const smartboard_module_1 = require("./smartboard/smartboard.module");
const studio_module_1 = require("./studio/studio.module");
const neuro_recall_module_1 = require("./neuro-recall/neuro-recall.module");
const pay_engine_module_1 = require("./pay-engine/pay-engine.module");
const chat_engine_module_1 = require("./chat-engine/chat-engine.module");
const masterclass_factory_module_1 = require("./masterclass-factory/masterclass-factory.module");
const video_engine_module_1 = require("./video-engine/video-engine.module");
const liri_brain_module_1 = require("./liri-brain/liri-brain.module");
const knowledge_module_1 = require("./knowledge/knowledge.module");
const longia_module_1 = require("./longia/longia.module");
const multilang_module_1 = require("./multilang/multilang.module");
const ai_worker_module_1 = require("./ai-worker/ai-worker.module");
const iri_module_1 = require("./iri/iri.module");
const growth_module_1 = require("./growth/growth.module");
const email_engine_module_1 = require("./email-engine/email-engine.module");
const sms_engine_module_1 = require("./sms-engine/sms-engine.module");
const messaging_module_1 = require("./messaging/messaging.module");
const liri_public_module_1 = require("./liri-public/liri-public.module");
const ai_billing_module_1 = require("./ai-billing/ai-billing.module");
const signup_module_1 = require("./signup/signup.module");
const medos_module_1 = require("./medos/medos.module");
const mbolo_module_1 = require("./mbolo/mbolo.module");
const auth_handoff_module_1 = require("./auth-handoff/auth-handoff.module");
const ai_utils_module_1 = require("./ai-utils/ai-utils.module");
const email_imap_module_1 = require("./email-imap/email-imap.module");
const team_invites_module_1 = require("./team-invites/team-invites.module");
const public_reviews_module_1 = require("./public-reviews/public-reviews.module");
const zoom_engine_module_1 = require("./zoom-engine/zoom-engine.module");
const social_publisher_module_1 = require("./social-publisher/social-publisher.module");
const school_paths_module_1 = require("./school-paths/school-paths.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        controllers: [health_controller_1.HealthController],
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            supabase_module_1.SupabaseModule,
            livekit_module_1.LiveKitModule,
            auth_module_1.AuthModule,
            tenant_module_1.TenantModule,
            cimolace_module_1.CimolaceModule,
            cimolace_backoffice_module_1.CimolaceBackofficeModule,
            cimolace_catalog_module_1.CimolaceCatalogModule,
            billing_module_1.BillingModule,
            checkout_module_1.CheckoutModule,
            live_module_1.LiveModule,
            marketing_module_1.MarketingModule,
            notifications_module_1.NotificationsModule,
            courses_module_1.CoursesModule,
            booking_module_1.BookingModule,
            secretariat_module_1.SecretariatModule,
            forum_module_1.ForumModule,
            smart_response_module_1.SmartResponseModule,
            immersive_live_module_1.ImmersiveLiveModule,
            course_builder_module_1.CourseBuilderModule,
            replay_module_1.ReplayModule,
            smartboard_module_1.SmartboardModule,
            studio_module_1.StudioModule,
            neuro_recall_module_1.NeuroRecallModule,
            pay_engine_module_1.PayEngineModule,
            chat_engine_module_1.ChatEngineModule,
            masterclass_factory_module_1.MasterclassFactoryModule,
            video_engine_module_1.VideoEngineModule,
            liri_brain_module_1.LiriBrainModule,
            knowledge_module_1.KnowledgeModule,
            longia_module_1.LongiaModule,
            multilang_module_1.MultilangModule,
            ai_worker_module_1.AiWorkerModule,
            iri_module_1.IriModule,
            growth_module_1.GrowthModule,
            email_engine_module_1.EmailEngineModule,
            sms_engine_module_1.SmsEngineModule,
            messaging_module_1.MessagingModule,
            liri_public_module_1.LiriPublicModule,
            ai_billing_module_1.AiBillingModule,
            signup_module_1.SignupModule,
            medos_module_1.MedosModule,
            auth_handoff_module_1.AuthHandoffModule,
            mbolo_module_1.MboloModule,
            ai_utils_module_1.AiUtilsModule,
            email_imap_module_1.EmailImapModule,
            team_invites_module_1.TeamInvitesModule,
            public_reviews_module_1.PublicReviewsModule,
            zoom_engine_module_1.ZoomEngineModule,
            social_publisher_module_1.SocialPublisherModule,
            school_paths_module_1.SchoolPathsModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map