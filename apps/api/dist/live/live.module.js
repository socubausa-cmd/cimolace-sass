"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveModule = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const auth_module_1 = require("../auth/auth.module");
const tenant_module_1 = require("../tenant/tenant.module");
const livekit_module_1 = require("../livekit/livekit.module");
const liri_entitlements_module_1 = require("../billing/liri-entitlements.module");
const supabase_module_1 = require("../supabase/supabase.module");
const live_service_1 = require("./live.service");
const live_controller_1 = require("./live.controller");
const live_replay_file_controller_1 = require("./live-replay-file.controller");
const liri_admin_controller_1 = require("./liri-admin.controller");
const live_embed_service_1 = require("./embed/live-embed.service");
const live_embed_controller_1 = require("./embed/live-embed.controller");
const live_embed_token_guard_1 = require("./embed/live-embed-token.guard");
const livekit_webhook_controller_1 = require("../livekit/livekit-webhook.controller");
const livekit_webhook_service_1 = require("../livekit/livekit-webhook.service");
let LiveModule = class LiveModule {
};
exports.LiveModule = LiveModule;
exports.LiveModule = LiveModule = __decorate([
    (0, common_1.Module)({
        imports: [
            auth_module_1.AuthModule,
            tenant_module_1.TenantModule,
            livekit_module_1.LiveKitModule,
            liri_entitlements_module_1.LiriEntitlementsModule,
            supabase_module_1.SupabaseModule,
            jwt_1.JwtModule.register({}),
        ],
        controllers: [
            live_embed_controller_1.LiveEmbedController,
            live_replay_file_controller_1.LiveReplayFileController,
            live_controller_1.LiveController,
            liri_admin_controller_1.LiriAdminController,
            livekit_webhook_controller_1.LiveKitWebhookController,
        ],
        providers: [
            live_service_1.LiveService,
            live_embed_service_1.LiveEmbedService,
            live_embed_token_guard_1.LiveEmbedTokenGuard,
            livekit_webhook_service_1.LiveKitWebhookService,
        ],
        exports: [live_service_1.LiveService, live_embed_service_1.LiveEmbedService],
    })
], LiveModule);
//# sourceMappingURL=live.module.js.map