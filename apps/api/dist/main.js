"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const swagger_1 = require("@nestjs/swagger");
const helmet_1 = __importDefault(require("helmet"));
const app_module_1 = require("./app.module");
const http_exception_filter_1 = require("./common/filters/http-exception.filter");
const response_interceptor_1 = require("./common/interceptors/response.interceptor");
const supabase_service_1 = require("./supabase/supabase.service");
const ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
const DEFAULT_DEV_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
];
const STATIC_ORIGINS = ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : DEFAULT_DEV_ORIGINS;
const tenantDomainsCache = {
    value: new Set(),
    expiresAt: 0,
};
async function loadTenantDomains(supabase) {
    const now = Date.now();
    if (now < tenantDomainsCache.expiresAt && tenantDomainsCache.value.size > 0) {
        return tenantDomainsCache.value;
    }
    const { data } = await supabase.client
        .from('tenant_domains')
        .select('domain')
        .in('usage', ['embed_origin', 'custom_host'])
        .eq('status', 'active');
    const set = new Set((data ?? []).map((d) => d.domain.toLowerCase()));
    tenantDomainsCache.value = set;
    tenantDomainsCache.expiresAt = now + 60_000;
    return set;
}
function extractHost(origin) {
    try {
        return new URL(origin).host.toLowerCase();
    }
    catch {
        return origin.toLowerCase();
    }
}
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, { rawBody: true });
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", 'data:', 'https:'],
                connectSrc: ["'self'"],
                fontSrc: ["'self'", 'https:'],
                objectSrc: ["'none'"],
                upgradeInsecureRequests: [],
            },
        },
        hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
        frameguard: { action: 'deny' },
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }));
    const supabase = app.get(supabase_service_1.SupabaseService);
    app.enableCors({
        origin: async (origin, callback) => {
            if (!origin) {
                return callback(null, true);
            }
            const normalizedOrigin = origin.toLowerCase();
            if (STATIC_ORIGINS.includes(normalizedOrigin)) {
                return callback(null, true);
            }
            const cimolaceHostedHost = extractHost(normalizedOrigin);
            if (cimolaceHostedHost === 'cimolace.space' ||
                cimolaceHostedHost.endsWith('.cimolace.space')) {
                return callback(null, true);
            }
            try {
                const host = extractHost(normalizedOrigin);
                const allowed = await loadTenantDomains(supabase);
                if (allowed.has(host)) {
                    return callback(null, true);
                }
            }
            catch (err) {
                return callback(null, false);
            }
            return callback(null, false);
        },
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Slug'],
        credentials: true,
    });
    app.useGlobalFilters(new http_exception_filter_1.GlobalExceptionFilter());
    app.useGlobalInterceptors(new response_interceptor_1.ResponseInterceptor(app.get(core_1.Reflector)));
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        forbidNonWhitelisted: false,
    }));
    const config = new swagger_1.DocumentBuilder()
        .setTitle('Cimolace API V2')
        .setDescription('API multi-tenant ISNA / LIRI / Cimolace / MedOS — 34 modules, 320+ routes')
        .setVersion('0.1.0')
        .addBearerAuth()
        .addApiKey({ type: 'apiKey', name: 'X-Tenant-Slug', in: 'header' }, 'tenant')
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    swagger_1.SwaggerModule.setup('docs', app, document);
    const port = Number(process.env.PORT) || 4000;
    await app.listen(port, '0.0.0.0');
    console.log('Swagger disponible sur http://localhost:' + port + '/docs');
}
void bootstrap().catch((err) => {
    console.error('BOOTSTRAP ERROR:', err?.message || err);
    process.exit(1);
});
//# sourceMappingURL=main.js.map