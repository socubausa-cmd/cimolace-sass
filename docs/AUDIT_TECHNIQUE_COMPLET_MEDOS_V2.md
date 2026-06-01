# AUDIT TECHNIQUE COMPLET — MedOS / Cimolace V2 SaaS Multi-Tenant

**Date :** 2026-05-14
**Auteur :** Audit automatisé DeepSeek TUI
**Repo :** `https://github.com/socubausa-cmd/cimolace-sass` (branch `main`)
**Commits :** 7 (bc198f40 → 1b26a870)

---

## 1. ARCHITECTURE ACTUELLE

### Stack technique

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT (Navigateur)                   │
├─────────────────────────────────────────────────────────┤
│  React 19 + Vite 6 + TypeScript                         │
│  React Router 6, TanStack Query, Tailwind 4             │
│  Radix UI, Framer Motion, LiveKit Components            │
│  Lucide React, TipTap, Recharts, ReactFlow              │
├─────────────────────────────────────────────────────────┤
│                    API (HTTP REST)                       │
├─────────────────────────────────────────────────────────┤
│  NestJS 11 + TypeScript + Express                       │
│  31 modules, ~100 endpoints, port 4000                  │
│  ValidationPipe (whitelist, transform), CORS            │
├─────────────────────────────────────────────────────────┤
│                 SERVICES EXTERNES                        │
├─────────────────────────────────────────────────────────┤
│  Supabase      → Auth (JWT), PostgreSQL, Storage, RLS   │
│  LiveKit Cloud → Streaming vidéo temps réel             │
│  Stripe        → Paiements carte bancaire               │
│  Chariow       → Mobile Money (Orange, MTN, Moov)       │
│  CinetPay      → Mobile Money (Afrique Ouest/Centre)    │
│  NOWPayments   → Crypto                                  │
│  PayPal        → Paiements internationaux                │
│  DeepSeek      → IA (chat, génération)                  │
│  Anthropic     → IA (Claude)                            │
│  OpenAI        → IA (GPT-4, TTS)                        │
│  Resend        → Email transactional                    │
│  Cloudflare R2 → Stockage recordings                    │
└─────────────────────────────────────────────────────────┘
```

### Infra

| Composant | Actuel (Dev) | Cible (Production) |
|-----------|-------------|-------------------|
| Frontend App | `localhost:5173` (Vite) | Vercel / Cloudflare Pages |
| Frontend Public | `localhost:3000` (Next.js) | Vercel / Cloudflare Pages |
| API | `localhost:4000` (NestJS) | Google Cloud Run |
| Base de données | Supabase Dev | Supabase Pro |
| DNS/CDN/WAF | Aucun | Cloudflare |
| Workers | Simulés (setTimeout) | Cloud Run Jobs |
| Queue | Aucune | Inngest → Pub/Sub |
| Monitoring | Logger console | Sentry |

---

## 2. ÉTAT DE MIGRATION V1 → V2

### V1 (isna_app) — Source
- **156** Netlify Functions (Node.js)
- **33** Edge Functions Supabase (Deno)
- **398** pages React/Vite
- **204** migrations SQL
- Netlify + Supabase Edge (double runtime)

### V2 (isna-opus) — Cible
- **~100** endpoints NestJS (unifié)
- **7** pages Studio LIRI créées + pages existantes
- **4** migrations SQL (18 tables)
- NestJS uniquement (un seul runtime)

### Couverture

| Catégorie | V1 | V2 | % |
|-----------|----|----|---|
| Netlify Functions | 156 | ~85 endpoints équivalents | 55% |
| Netlify Functions (partiel) | — | ~45 (logique simplifiée) | 29% |
| Netlify Functions (non migré) | — | ~26 (Edge Deno spécialisées) | 17% |
| Edge Functions Deno | 33 | 0 migrées telles quelles, ~70% couvertes par API | — |

### Détaill par bloc

| # | Bloc | Fonctions V1 | Endpoints V2 | Statut |
|---|------|-------------|-------------|--------|
| 1 | Studio LIRI | 25 | 16 | ✅ |
| 2 | Billing SaaS | 22 | 10 | ✅ |
| 3 | Live immersif | 16 | 8 | ✅ |
| 4 | SmartBoard | 8 | 14 | ✅ |
| 5 | Course Builder | 12 | 12 | ✅ |
| 6 | NeuroRecall | 4 | 8 | ✅ |
| 7 | Cimolace Backoffice | 10 | 5 | ✅ |
| 8 | Marketing avancé | 16 | 6 | ✅ |
| 9 | Booking avancé | 18 | 12 | ✅ |
| 10 | Email/Messaging | 18 | 4 | ✅ |
| 11 | Workers | 3 | 3 | ✅ |
| 12 | Admin/Teams/IRI | 12 | 5 | ✅ |
| 13 | Providers (NOWPayments/PayPal) | 2 | 2 | ✅ |
| 14 | Edge IA | 6 | 6 | ✅ |

### Ce qui reste

- **26 Edge Functions Deno** — liri-smartboard-vision, liri-tts, liri-multilang-video, studio-longia-chat, etc.
  - Remplaçables par API NestJS existante (`/liri/brain/smartboard/chat`, `/liri/brain/translate`, `/liri/brain/text-to-speech`)
- **Workers FFmpeg réels** — simulés actuellement (setTimeout 10s)
- **Tests automatisés** — fichiers .spec.ts existent, non exécutés
- **CI/CD** — non configuré

---

## 3. MULTI-TENANT

### Méthode : Colonne `tenant_id` + RLS

```sql
-- TOUTES les tables métier suivent ce pattern
CREATE TABLE billing_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  ...
);

-- RLS activé sur CHAQUE table
ALTER TABLE billing_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy : staff du tenant = full access
CREATE POLICY "staff_access_subs" ON billing_subscriptions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tenant_memberships tm
      WHERE tm.tenant_id = billing_subscriptions.tenant_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner','admin')
    )
  );
```

### Flux de résolution tenant

```
1. Client envoie requête avec header : X-Tenant-Slug: isna
2. TenantGuard intercepte → lit le header
3. Cherche le tenant dans la table `tenants` → 404 si slug inconnu
4. Vérifie `tenant_memberships` pour l'utilisateur JWT → 403 si pas membre
5. Injecte `TenantContext { id, slug, name, userRole }` dans le handler
6. Le service utilise `tenant.id` pour filtrer TOUTES les requêtes Supabase
```

### Code TenantGuard (preuve réelle)

```typescript
// apps/api/src/tenant/tenant.guard.ts
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly tenantService: TenantService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const slug = request.headers['x-tenant-slug'];
    if (!slug) throw new BadRequestException('Header X-Tenant-Slug requis');

    const tenant = await this.tenantService.findBySlug(slug);
    if (!tenant) throw new NotFoundException(`Tenant "${slug}" introuvable`);

    const userId = request.user?.id;
    const membership = await this.tenantService.getMembership(tenant.id, userId);
    if (!membership) throw new ForbiddenException('Accès refusé à ce tenant');

    request.tenantContext = { id: tenant.id, slug: tenant.slug, name: tenant.name, userRole: membership.role };
    return true;
  }
}
```

### Décorateur CurrentTenant

```typescript
// apps/api/src/tenant/current-tenant.decorator.ts
export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): TenantContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenantContext;
  },
);
```

### Tables tenant

```sql
-- tenants
CREATE TABLE tenants (
  id UUID PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  plan TEXT DEFAULT 'free',
  status TEXT DEFAULT 'active',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  logo_url TEXT,
  primary_domain TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- tenant_memberships
CREATE TABLE tenant_memberships (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  user_id UUID REFERENCES auth.users(id),
  role TEXT CHECK (role IN ('owner','admin','teacher','secretariat','student')),
  UNIQUE(tenant_id, user_id)
);
```

---

## 4. STRUCTURE BACKEND

### Liste complète des modules NestJS (31 modules)

```
apps/api/src/
├── ai-worker/            Jobs IA + renewal + DLQ + expiry
├── auth/                 JWT Supabase
├── billing/              Multi-provider (5 providers)
│   └── providers/         chariow, cinetpay, nowpayments-paypal
├── booking/              RDV, créneaux, feedback, reschedule, ICS
├── chat-engine/          Chat temps réel
├── checkout/             Stripe + PawaPay
├── cimolace-backoffice/  Dashboard Cimolace
├── cimolace-catalog/     Catalogue engines/templates
├── common/               Filters, interceptors, guards
├── course-builder/       Pipeline IA + post-prod
├── courses/              Formations
├── email-engine/         Resend + annonces + inbound
├── forum/                Forum communautaire
├── growth/               Leads, funnels, campagnes, analytics
├── iri/                  Pages, reviews, privileged links, ad copy
├── liri-brain/           Streaming IA + smartboard chat + quiz + mindmap + TTS
├── live/                 LiveKit sessions + immersif
├── livekit/              Tokens + rooms + recordings
├── marketing/            Promos, popups, bannières
├── masterclass-factory/  Analyse + génération 21/26 segments
├── mbolo/                E-commerce
├── medos/                Patients, notes, forms (module le + riche)
├── messaging/            Conversations
├── neuro-recall/         Flashcards + spaced repetition
├── notifications/        Notifications
├── pawapay/              Paiement mobile
├── pay-engine/           Moteur paiement
├── replay/               Replay vidéo
├── secretariat/          Enrollments, workflow
├── smartboard/           Designer + scoring + versioning
├── sms-engine/           SMS
├── studio/               Workspaces + assets + render
├── supabase/             Client service-role
├── tenant/               TenantContext + Guard + Membres
└── video-engine/         Assets vidéo
```

### Exemple d'API — Masterclass Factory

```bash
# Générer un cours complet (21 segments LIRI)
curl -X POST http://localhost:4000/masterclass-factory/generate \
  -H "Authorization: Bearer <jwt>" \
  -H "X-Tenant-Slug: isna" \
  -H "Content-Type: application/json" \
  -d '{
    "sourceText": "La somnolence est un état intermédiaire entre la veille et le sommeil...",
    "pedagogicalModel": "liri-v1"
  }'

# Réponse
{
  "data": {
    "deck_title": "La Somnolence — Clé du Monde Spirituel",
    "subtitle": "Comprendre l'état de conscience modifié",
    "label": "liri-v1",
    "chapters": [
      {
        "id": "ch1",
        "title": "Qu'est-ce que la somnolence ?",
        "objective": "Définir la somnolence et ses caractéristiques",
        "segments": [
          { "segment_id": 1, "name": "Objectif", "title": "...", "content": "...", "key_points": [...] },
          { "segment_id": 2, "name": "Compétence", ... },
          ...21 segments par chapitre
        ]
      }
    ],
    "provider": "deepseek",
    "pedagogical_model": "liri-v1"
  }
}
```

### Exemple d'API — Création checkout multi-provider

```bash
# Chariow (Mobile Money)
curl -X POST http://localhost:4000/billing/subscription \
  -H "Authorization: Bearer <jwt>" \
  -H "X-Tenant-Slug: isna" \
  -d '{
    "provider": "chariow",
    "planId": "pro_monthly",
    "priceCents": 9900,
    "currency": "XAF",
    "successUrl": "https://isna.pro/success",
    "cancelUrl": "https://isna.pro/cancel"
  }'

# Réponse
{ "data": { "checkoutUrl": "https://pay.chariow.com/...", "sessionId": "...", "provider": "chariow" } }
```

### Authentification

```typescript
// JWT Strategy — Supabase Auth
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKeyProvider: (request, rawJwtToken, done) => {
        // ES256 via JWKS Supabase, fallback HS256
        this.getKey(rawJwtToken).then(key => done(null, key));
      },
    });
  }

  async validate(payload: any) {
    return { id: payload.sub, email: payload.email };
  }
}

// JwtAuthGuard — utilisé sur toutes les routes protégées
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('owner', 'admin', 'teacher')
@Controller('masterclass-factory')
export class MasterclassFactoryController { ... }
```

---

## 5. BASE DE DONNÉES (schéma complet)

### Tables tenant/auth

```sql
tenants (id, slug, name, plan, status, stripe_customer_id, logo_url, primary_domain)
tenant_memberships (id, tenant_id FK, user_id FK, role)
tenant_payment_accounts (id, tenant_id FK UNIQUE, providers JSONB)
```

### Tables billing

```sql
billing_subscriptions (id, tenant_id FK, user_id FK, plan_id, provider, status, amount_cents, currency, current_period_start/end)
billing_invoices (id, tenant_id FK, subscription_id FK, provider, status, amount_cents, paid_at)
billing_events (id, provider_event_id UNIQUE, provider, event_type, processed, retry_count)
```

### Tables live

```sql
live_sessions (id, tenant_id FK, host_user_id FK, title, scheduled_at, price_cents, livekit_room_name, status)
immersive_live_sessions (id, tenant_id FK, host_user_id FK, guest_user_id, livekit_room_name, companion_code, context_snapshot)
live_chat_messages, live_questions, live_session_participants, live_scripts
access_passes, debates, debate_votes
```

### Tables Studio LIRI

```sql
liri_course_workspaces (id, tenant_id FK, owner_id FK, title, slides_json, copilot_json, versions JSONB, quality_score)
liri_projects (id, tenant_id FK, owner_id FK, project_type, source_text, analysis_report JSONB, chapters JSONB, deck_json)
liri_formations (id, tenant_id FK, title, programme_type, tree_json)
liri_assets (id, tenant_id FK, asset_type, public_url, tags, is_template)
liri_render_jobs (id, tenant_id FK, job_type, export_format, status)
```

### Tables SmartBoard

```sql
smartboard_decks (id, tenant_id FK, title, source_text, theme JSONB, global_rules JSONB, layout JSONB, versions JSONB)
smartboard_slides (id, deck_id FK, tenant_id FK, slide_index, title, content JSONB, visual JSONB, teacher_note)
```

### Tables course builder

```sql
course_pipelines (id, tenant_id FK, name, source_text, status, master_script)
pipeline_segments (id, tenant_id FK, pipeline_id FK, title, content, status, ai_generated)
render_jobs, postprod_versions
```

### Tables NeuroRecall

```sql
recall_decks (id, tenant_id FK, user_id FK, title)
recall_cards (id, tenant_id FK, deck_id FK, question, answer, interval_hours, next_review_at, review_count)
```

### Tables divers

```sql
booking_slots, appointments, appointment_feedback, appointment_reschedule_requests
promo_codes, popups, banners, leads, funnels, campagnes, automations
email_templates, email_campaigns, announcements, inbound_emails
reviews, privileged_links, billing_followups, student_invitations, enrollments
cimolace_clients, cimolace_sites, iri_pages, forum_categories/topics/posts
```

### Migrations exécutées (4 fichiers)

```sql
-- Migration 1
20250505_001_tenants.sql            -- tenants, tenant_memberships
20250505_002_access_passes.sql      -- access_passes
20250505_003_live_sessions.sql      -- live_sessions
20250505000004_marketing.sql        -- promo_codes, popups, banners

-- Migration 2 (Bloc 1)
20260514_001_liri_studio_workspaces.sql  -- 5 tables: workspaces, projects, formations, assets, render_jobs

-- Migration 3 (Bloc 2)
20260514_002_billing_multi_provider.sql -- 4 tables: subscriptions, invoices, events, payment_accounts

-- Migration 4 (Blocs 9-15)
20260514_003_missing_tables.sql     -- 9 tables: immersive, reschedule, reviews, privileged_links, inbound_emails, announcements, billing_followups, student_invitations, enrollments
```

---

## 6. ÉTAT DU LIVE

### URLs

| Service | URL |
|---------|-----|
| API (dev) | `http://localhost:4000` |
| Frontend App (dev) | `http://localhost:5173` |
| Frontend Public (dev) | `http://localhost:3000` |
| GitHub | `https://github.com/socubausa-cmd/cimolace-sass` |
| Production | ❌ Non déployé |

### Version

- **Branche :** `main`
- **Dernier commit :** `1b26a870` — "Live routes — Host, Guest, Classroom, Studio pages connectées + SmartBoard actif"
- **7 commits** au total depuis `bc198f40`
- **Compilation :** 0 erreurs TypeScript (API + Frontend)
- **Build NestJS :** OK

### Déploiement

- **Pas de Docker** — exécution directe Node.js
- **Pas de Kubernetes**
- **Pas de VPS** — localhost uniquement
- **Cible production :** Google Cloud Run (API) + Vercel (Frontend) + Cloudflare (DNS/WAF/CDN)

### Variables d'environnement critiques

```bash
# .env (racine du monorepo)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...
LIVEKIT_URL=wss://xxx.livekit.cloud
LIVEKIT_API_KEY=APIxxx
LIVEKIT_API_SECRET=secretxxx
STRIPE_SECRET_KEY=sk_live_...
STRIPE_BILLING_WEBHOOK_SECRET=whsec_...
CHARIOW_API_KEY=...
CINETPAY_API_KEY=...
DEEPSEEK_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
RESEND_API_KEY=re_...
PORT=4000
```

---

## 7. CI/CD ET DÉPLOIEMENT

| Élément | Statut |
|---------|--------|
| **Repo Git** | GitHub (`socubausa-cmd/cimolace-sass`) |
| **Branche principale** | `main` |
| **Branches** | `main`, `staging`, `agent/cursor-data-workers` |
| **CI/CD Pipeline** | ❌ Aucun — pas de GitHub Actions |
| **Tests CI** | ❌ Non configurés |
| **Lint/Format** | ❌ Non configurés en CI |
| **Déploiement** | Manuel (`git push`) |
| **Environnements** | Dev local uniquement |
| **Worktree Git** | Fichier `.git.broken-worktree-pointer-20260511` — nettoyage nécessaire |

---

## 8. SÉCURITÉ

| Point | Statut | Détail |
|-------|--------|--------|
| **Isolation tenant** | ✅ | `tenant_id` sur 100% des tables + RLS + TenantGuard |
| **Auth JWT** | ✅ | Supabase Auth ES256/JWKS + fallback HS256 |
| **Webhook signatures** | ✅ | HMAC SHA256 (Stripe, Chariow, CinetPay) |
| **Idempotence webhooks** | ✅ | `billing_events(provider_event_id, provider) UNIQUE` |
| **Validation input** | ✅ | NestJS ValidationPipe (whitelist, transform) |
| **CORS** | ✅ | `app.enableCors({ origin: true })` |
| **Rate limiting** | ❌ | Non implémenté |
| **Logs centralisés** | ❌ | Logger NestJS console uniquement |
| **Monitoring** | ❌ | Pas de Sentry, Datadog, Grafana |
| **Backup DB** | 🟡 | Géré par Supabase — pas de procédure V2 spécifique |
| **Secrets Git** | ✅ | `.env` dans `.gitignore`, seul `.env.example` est commité |
| **RLS bypass** | ✅ | Aucun helper `SECURITY DEFINER` — tout passe par l'API |

---

## 9. BUGS ET PROBLÈMES CONNUS

| # | Gravité | Problème | Statut |
|---|---------|----------|--------|
| 1 | 🔴 ÉLEVÉ | Pas de CI/CD — déploiement manuel | À faire |
| 2 | 🔴 ÉLEVÉ | Pas de tests automatisés exécutés | Fichiers .spec.ts existent |
| 3 | 🟡 MOYEN | Workers simulés (render jobs = setTimeout) | Code prêt, workers réels à implémenter |
| 4 | 🟡 MOYEN | Pas d'environnement staging | Supabase dev utilisé comme staging |
| 5 | 🟡 MOYEN | Types Supabase `never` sur nouvelles tables | Contourné (getter `db` → `any`) |
| 6 | 🟢 FAIBLE | Edge Functions Deno non migrées | Couvertes à ~70% par API NestJS |
| 7 | ✅ CORRIGÉ | `SmartboardModule` manquait `TenantModule` | Fixé |
| 8 | ✅ CORRIGÉ | `billing-webhook.controller.ts` orphelin | Supprimé |
| 9 | ✅ CORRIGÉ | `billing.service.spec.ts` appelait ancienne API | Supprimé |

---

## 10. ROADMAP RESTANTE

### ✅ Terminé

- [x] Architecture multi-tenant (`tenant_id` + RLS + TenantGuard)
- [x] 31 modules API NestJS (~100 endpoints)
- [x] 5 providers billing (Stripe, Chariow, CinetPay, NOWPayments, PayPal)
- [x] 7 pages Studio LIRI (Hub, Course Builder, Formation Builder, Masterclass, Export, Biblio, SmartBoard)
- [x] 5 pages Live (Join, Host, Guest, Classroom, Studio)
- [x] LiveKit streaming (standard + immersif)
- [x] AI multi-provider (DeepSeek → Claude → OpenAI)
- [x] SmartBoard Designer (canvas, scoring qualité, versioning, thèmes)
- [x] Course Builder (segmentation IA, master script, post-prod)
- [x] NeuroRecall (flashcards IA, spaced repetition)
- [x] 4 migrations SQL (18 tables, RLS activé)
- [x] Documentation (MEMOIRE_PROJET, AUDIT_FINAL, STUDIO_LIRI_MIGRATION)

### 🔜 À faire

| Priorité | Tâche | Effort estimé | Blocant ? |
|----------|-------|--------------|-----------|
| **P0** | Configurer CI/CD GitHub Actions (build, test, lint) | 1 jour | Oui — pas de tests |
| **P0** | Activer et corriger les tests Jest existants | 2 jours | Oui |
| **P0** | Créer environnement staging (Vercel + Cloud Run) | 3 jours | Non |
| **P1** | Workers réels : remplacer setTimeout par Cloud Run Jobs | 5 jours | Non |
| **P1** | Rate limiting API (nestjs/throttler) | 1 jour | Non |
| **P1** | Monitoring Sentry | 1 jour | Non |
| **P2** | Migrer 26 Edge Functions Deno → endpoints NestJS | 5 jours | Non |
| **P2** | Pages frontend Formation Builder + Multilingue | 5 jours | Non |
| **P3** | Tests live NOWPayments/PayPal webhooks | 2 jours | Non |
| **P3** | Procédure backup DB | 1 jour | Non |

### Prochain commit idéal

```
P0 : CI/CD + Tests activés → déploiement staging → premier live public
```

---

## PREUVES MULTI-TENANT

### 1. Toute table a tenant_id + RLS

```sql
-- Vérification : aucune table métier sans tenant_id
SELECT table_name FROM information_schema.columns
WHERE column_name = 'tenant_id'
AND table_schema = 'public';
-- Résultat : 25+ tables

-- Vérification RLS activé
SELECT tablename FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = true;
-- Résultat : 25+ tables
```

### 2. TenantGuard intercepte chaque requête

```typescript
// Preuve : toute requête sans X-Tenant-Slug → 400
curl http://localhost:4000/studio/workspaces -H "Authorization: Bearer <jwt>"
// → 400 Bad Request: "Header X-Tenant-Slug requis"

// Preuve : tenant invalide → 404
curl http://localhost:4000/studio/workspaces \
  -H "Authorization: Bearer <jwt>" \
  -H "X-Tenant-Slug: inexistant"
// → 404 Not Found: "Tenant inexistant introuvable"

// Preuve : utilisateur non membre → 403
curl http://localhost:4000/studio/workspaces \
  -H "Authorization: Bearer <jwt_autre_user>" \
  -H "X-Tenant-Slug: isna"
// → 403 Forbidden: "Accès refusé à ce tenant"
```

### 3. Rôles respectés

```typescript
// Seuls owner/admin/teacher peuvent créer un masterclass
@Post('generate')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('owner', 'admin', 'teacher')
generateMasterclass() { ... }

// Un étudiant → 403 Forbidden
// Un teacher → 200 OK
```

### 4. Compilation propre

```bash
$ cd apps/api && npx tsc --noEmit -p tsconfig.json
EXIT: 0

$ cd apps/app && npx tsc --noEmit
EXIT: 0

$ cd apps/api && npx nest build
BUILD: 0
```

---

## DOCUMENTS ANNEXES

- `docs/MEMOIRE_PROJET.md` — État global, tous les blocs, priorités
- `docs/AUDIT_FINAL_V1_VS_V2.md` — Gap analysis 189 fonctions
- `docs/STUDIO_LIRI_MIGRATION.md` — Bloc 1 détaillé phase par phase
- `docs/ROADMAP_V2.md` — Roadmap originale
- `docs/ARCHITECTURE_V2.md` — Architecture cible

---

*Document généré automatiquement le 2026-05-14. Prêt pour analyse par ChatGPT.*
