import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { SupabaseService } from './supabase/supabase.service';

// Origines statiquement autorisées — à adapter par environnement via ENV
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

const STATIC_ORIGINS =
  ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : DEFAULT_DEV_ORIGINS;

/**
 * Cache mémoire des domaines tenant whitelistés.
 * Évite un round-trip DB à chaque preflight CORS.
 * TTL court (60s) pour propager les ajouts/retraits sans redémarrer l'API.
 */
const tenantDomainsCache: { value: Set<string>; expiresAt: number } = {
  value: new Set(),
  expiresAt: 0,
};

async function loadTenantDomains(
  supabase: SupabaseService,
): Promise<Set<string>> {
  const now = Date.now();
  if (now < tenantDomainsCache.expiresAt && tenantDomainsCache.value.size > 0) {
    return tenantDomainsCache.value;
  }
  const { data } = await (supabase.client as any)
    .from('tenant_domains')
    .select('domain')
    .in('usage', ['embed_origin', 'custom_host'])
    .eq('status', 'active');

  const set = new Set<string>(
    ((data ?? []) as Array<{ domain: string }>).map((d) =>
      d.domain.toLowerCase(),
    ),
  );
  tenantDomainsCache.value = set;
  tenantDomainsCache.expiresAt = now + 60_000;
  return set;
}

function extractHost(origin: string): string {
  try {
    return new URL(origin).host.toLowerCase();
  } catch {
    return origin.toLowerCase();
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // ── Sécurité HTTP headers ──────────────────────────────────────────────────
  app.use(
    helmet({
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
    }),
  );

  // ── CORS strict + dynamique pour les domaines tenant (embed_origin + custom_host) ──
  // Logique :
  //   1. Origin dans STATIC_ORIGINS (Cimolace + dev) → autorisé
  //   2. Sinon : lookup `tenant_domains` (cache 60s)
  //   3. Sinon : refusé
  const supabase = app.get(SupabaseService);
  app.enableCors({
    origin: async (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) {
        // Appels server-to-server sans Origin (curl, SDK Node) — autorisé
        return callback(null, true);
      }
      const normalizedOrigin = origin.toLowerCase();
      if (STATIC_ORIGINS.includes(normalizedOrigin)) {
        return callback(null, true);
      }
      try {
        const host = extractHost(normalizedOrigin);
        const allowed = await loadTenantDomains(supabase);
        if (allowed.has(host)) {
          return callback(null, true);
        }
      } catch (err) {
        // En cas d'erreur DB, on refuse l'Origin pour rester strict
        return callback(null, false);
      }
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Slug'],
    credentials: true,
  });
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      forbidNonWhitelisted: false,
    }),
  );

  // Swagger / OpenAPI
  const config = new DocumentBuilder()
    .setTitle('Cimolace API V2')
    .setDescription(
      'API multi-tenant ISNA / LIRI / Cimolace / MedOS — 34 modules, 320+ routes',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .addApiKey(
      { type: 'apiKey', name: 'X-Tenant-Slug', in: 'header' },
      'tenant',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = Number(process.env.PORT) || 4000;
  await app.listen(port, '0.0.0.0');
  console.log('Swagger disponible sur http://localhost:' + port + '/docs');
}
void bootstrap().catch((err) => {
  console.error('BOOTSTRAP ERROR:', err?.message || err);
  process.exit(1);
});
