# Phase Billing & Rôles — Spécification Architecture

**Date :** 2026-05-05  
**Branche :** feat/opus-billing-roles  
**Auteur :** Claude Opus (architecte)  
**Statut :** Spec uniquement — aucun code applicatif

---

## Contexte

Cette spec couvre la Phase 5 (Billing SaaS) et le raffinement Phase 1 (Rôles fins) de la roadmap V2.

Le billing élève (achat live à l'unité via `checkout.service.ts`) est déjà implémenté en Phase 1.5 et n'est pas dans le scope de cette spec.

Ce document spécifie :
1. Le schéma SQL des tables billing SaaS tenant
2. La matrice de permissions des 6 rôles tenant
3. Le guard `RolesGuard` générique et le décorateur `@Roles(...)`
4. Les endpoints billing SaaS (spec fonctionnelle, pas de code)

---

## 1. Schéma SQL — Tables Billing SaaS

### Principes de conception

- Toutes les tables ont `tenant_id` — isolation multi-tenant stricte
- `stripe_*_id` en `TEXT UNIQUE` pour idempotence et déduplication webhook
- `billing_events` est le journal d'audit immuable de tous les événements Stripe
- Les tables sont liées entre elles mais `billing_events` peut exister sans `invoice_id` (ex. : événements de subscription sans facture)
- RLS Supabase en garde-fou secondaire sur toutes les tables

---

### Table : `subscriptions`

Abonnement SaaS d'un tenant à un plan ISNA.

```sql
CREATE TABLE subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Identifiants Stripe
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id     TEXT NOT NULL,
  stripe_price_id        TEXT,

  -- Plan et statut
  plan                  TEXT NOT NULL
                          CHECK (plan IN ('starter', 'pro', 'business')),
  status                TEXT NOT NULL DEFAULT 'trialing'
                          CHECK (status IN (
                            'trialing',
                            'active',
                            'past_due',
                            'cancelled',
                            'incomplete',
                            'incomplete_expired',
                            'unpaid'
                          )),

  -- Période courante
  current_period_start  TIMESTAMPTZ,
  current_period_end    TIMESTAMPTZ,
  trial_end             TIMESTAMPTZ,
  cancel_at_period_end  BOOLEAN NOT NULL DEFAULT FALSE,
  cancelled_at          TIMESTAMPTZ,

  -- Métadonnées
  metadata              JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX idx_subscriptions_tenant_id
  ON subscriptions(tenant_id);

CREATE INDEX idx_subscriptions_stripe_customer_id
  ON subscriptions(stripe_customer_id);

CREATE INDEX idx_subscriptions_status
  ON subscriptions(status)
  WHERE status IN ('active', 'trialing', 'past_due');

-- RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- La logique métier est dans l'API ; RLS = filet de sécurité
CREATE POLICY "service_role_full_access" ON subscriptions
  TO service_role USING (true) WITH CHECK (true);
```

**Contraintes métier :**
- Un tenant peut avoir au plus une subscription active à la fois (enforced côté API, non via UNIQUE pour permettre l'historique)
- `stripe_customer_id` est créé une fois par tenant et réutilisé
- La transition de plan (upgrade/downgrade) crée un nouvel enregistrement + archive l'ancien

---

### Table : `invoices`

Factures générées par Stripe pour les abonnements SaaS tenant.

```sql
CREATE TABLE invoices (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id          UUID REFERENCES subscriptions(id) ON DELETE SET NULL,

  -- Identifiants Stripe
  stripe_invoice_id        TEXT UNIQUE NOT NULL,
  stripe_payment_intent_id TEXT,
  stripe_charge_id         TEXT,

  -- Montant
  amount_cents             INTEGER NOT NULL CHECK (amount_cents >= 0),
  amount_paid_cents        INTEGER NOT NULL DEFAULT 0,
  currency                 TEXT NOT NULL DEFAULT 'EUR',

  -- Statut
  status                   TEXT NOT NULL
                             CHECK (status IN (
                               'draft',
                               'open',
                               'paid',
                               'void',
                               'uncollectible'
                             )),

  -- Période facturée
  period_start             TIMESTAMPTZ,
  period_end               TIMESTAMPTZ,

  -- URLs Stripe
  invoice_url              TEXT,
  invoice_pdf              TEXT,

  -- Dates clés
  paid_at                  TIMESTAMPTZ,
  due_date                 TIMESTAMPTZ,
  next_payment_attempt     TIMESTAMPTZ,

  -- Métadonnées
  metadata                 JSONB,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX idx_invoices_tenant_id
  ON invoices(tenant_id);

CREATE INDEX idx_invoices_subscription_id
  ON invoices(subscription_id);

CREATE INDEX idx_invoices_stripe_invoice_id
  ON invoices(stripe_invoice_id);

CREATE INDEX idx_invoices_status
  ON invoices(status, tenant_id);

-- RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access" ON invoices
  TO service_role USING (true) WITH CHECK (true);
```

**Contraintes métier :**
- Une facture est créée uniquement à partir d'un événement webhook Stripe confirmé
- `stripe_invoice_id` est la clé d'idempotence pour les webhooks
- Les factures ne sont jamais modifiées manuellement — uniquement via webhook
- Les factures `void` et `uncollectible` sont conservées pour l'audit

---

### Table : `billing_events`

Journal d'audit immuable de tous les événements Stripe reçus (billing SaaS uniquement).

```sql
CREATE TABLE billing_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Références optionnelles (peuvent être NULL si l'event précède la création des entités)
  subscription_id   UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  invoice_id        UUID REFERENCES invoices(id) ON DELETE SET NULL,

  -- Identifiant Stripe pour idempotence webhook
  stripe_event_id   TEXT UNIQUE NOT NULL,

  -- Type d'événement Stripe
  event_type        TEXT NOT NULL,
  -- Exemples :
  --   customer.subscription.created
  --   customer.subscription.updated
  --   customer.subscription.deleted
  --   invoice.paid
  --   invoice.payment_failed
  --   invoice.payment_action_required
  --   customer.subscription.trial_will_end

  -- Payload brut Stripe (pour replay/debug)
  payload           JSONB NOT NULL,

  -- Traitement
  processed         BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at      TIMESTAMPTZ,
  error             TEXT,              -- message d'erreur si traitement échoué
  retry_count       INTEGER NOT NULL DEFAULT 0,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX idx_billing_events_tenant_id
  ON billing_events(tenant_id);

CREATE INDEX idx_billing_events_stripe_event_id
  ON billing_events(stripe_event_id);

CREATE INDEX idx_billing_events_event_type
  ON billing_events(event_type);

CREATE INDEX idx_billing_events_unprocessed
  ON billing_events(processed, created_at)
  WHERE processed = FALSE;

-- RLS
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access" ON billing_events
  TO service_role USING (true) WITH CHECK (true);
```

**Contraintes métier :**
- Insérer l'event avant de le traiter (pattern "inbox") — permet de détecter les doublons
- `stripe_event_id UNIQUE` garantit l'idempotence : un event déjà reçu est ignoré
- La table est append-only — pas de UPDATE sauf `processed` / `processed_at` / `error`
- Un job de maintenance purge les events traités de plus de 90 jours

---

### Vue utilitaire : `billing_status_view`

Vue dénormalisée pour le dashboard tenant (lecture uniquement).

```sql
CREATE VIEW billing_status_view AS
SELECT
  t.id AS tenant_id,
  t.name AS tenant_name,
  t.plan,
  t.billing_status,
  s.id AS subscription_id,
  s.stripe_subscription_id,
  s.status AS subscription_status,
  s.current_period_end,
  s.cancel_at_period_end,
  s.trial_end,
  (
    SELECT COUNT(*)
    FROM invoices i
    WHERE i.tenant_id = t.id AND i.status = 'paid'
  ) AS paid_invoices_count
FROM tenants t
LEFT JOIN subscriptions s
  ON s.tenant_id = t.id
  AND s.status IN ('active', 'trialing', 'past_due');
```

---

## 2. Rôles Tenant — Matrice de Permissions

### Définition des rôles

| Rôle | Description |
|------|-------------|
| `owner` | Propriétaire du tenant — tous les droits, accès billing |
| `admin` | Administrateur délégué — gestion opérationnelle complète, pas d'accès billing critique |
| `teacher` | Formateur/animateur — crée et gère ses propres lives et cours |
| `secretariat` | Secrétariat — gestion inscriptions, contacts, planning |
| `support` | Support client — lecture seule sur les membres et les passes |
| `student` | Étudiant/apprenant — accès aux contenus achetés uniquement |

---

### Matrice de permissions par endpoint

Légende : ✅ autorisé · ❌ interdit · 🔐 autorisé si resource propre · ⚠️ owner seulement

#### Tenant Management

| Endpoint | owner | admin | teacher | secretariat | support | student |
|----------|-------|-------|---------|-------------|---------|---------|
| GET /tenants/current | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| PATCH /tenants/current | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| PATCH /tenants/current/branding | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| DELETE /tenants/current | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ |

#### Members & Invitations

| Endpoint | owner | admin | teacher | secretariat | support | student |
|----------|-------|-------|---------|-------------|---------|---------|
| GET /members | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| POST /members/invite | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| PATCH /members/:id/role | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| DELETE /members/:id | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

*Note : Un admin ne peut pas modifier le rôle de l'owner — enforced côté API.*

#### Lives

| Endpoint | owner | admin | teacher | secretariat | support | student |
|----------|-------|-------|---------|-------------|---------|---------|
| POST /lives | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| GET /lives | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| GET /lives/:id | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| PATCH /lives/:id | ✅ | ✅ | 🔐 | ❌ | ❌ | ❌ |
| DELETE /lives/:id | ✅ | ✅ | 🔐 | ❌ | ❌ | ❌ |
| GET /lives/:id/token | ✅ | ✅ | ✅ | ❌ | ❌ | 🔐* |

*\* student : uniquement si access_pass actif*

#### Billing SaaS (abonnement du tenant)

| Endpoint | owner | admin | teacher | secretariat | support | student |
|----------|-------|-------|---------|-------------|---------|---------|
| GET /billing/subscription | ⚠️ | ✅ | ❌ | ❌ | ❌ | ❌ |
| POST /billing/subscription | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ |
| PATCH /billing/subscription | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ |
| DELETE /billing/subscription | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ |
| GET /billing/invoices | ⚠️ | ✅ | ❌ | ❌ | ❌ | ❌ |
| GET /billing/invoices/:id | ⚠️ | ✅ | ❌ | ❌ | ❌ | ❌ |
| POST /billing/portal | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ |

#### Checkout Élève (achat live à l'unité)

| Endpoint | owner | admin | teacher | secretariat | support | student |
|----------|-------|-------|---------|-------------|---------|---------|
| POST /checkout/sessions | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| POST /checkout/webhook/stripe | public (HMAC) | — | — | — | — | — |

#### Access Passes

| Endpoint | owner | admin | teacher | secretariat | support | student |
|----------|-------|-------|---------|-------------|---------|---------|
| GET /access-passes | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| GET /access-passes/mine | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

#### Marketing

| Endpoint | owner | admin | teacher | secretariat | support | student |
|----------|-------|-------|---------|-------------|---------|---------|
| POST /marketing/* | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| GET /marketing/* | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |

---

## 3. Guard RolesGuard — Spécification

### Type TenantRole

```typescript
// packages/types/src/tenant-role.ts

export const TENANT_ROLES = [
  'owner',
  'admin',
  'teacher',
  'secretariat',
  'support',
  'student',
] as const;

export type TenantRole = (typeof TENANT_ROLES)[number];
```

---

### Décorateur @Roles(...)

```typescript
// apps/api/src/common/decorators/roles.decorator.ts

import { SetMetadata } from '@nestjs/common';
import type { TenantRole } from '@isna/types';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: TenantRole[]) =>
  SetMetadata(ROLES_KEY, roles);
```

**Usage :**

```typescript
@Post()
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('owner', 'admin', 'teacher')
create(@Body() dto: CreateLiveDto) { ... }
```

---

### Guard RolesGuard

```typescript
// apps/api/src/common/guards/roles.guard.ts

import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { TenantRole } from '@isna/types';
import type { TenantContext } from '../../tenant/tenant.types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<TenantRole[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    // Pas de @Roles(...) → endpoint ouvert à tous les membres authentifiés du tenant
    if (!required?.length) return true;

    const req = ctx.switchToHttp().getRequest<{ tenant: TenantContext }>();
    const tenant = req.tenant;

    // TenantGuard doit être exécuté avant RolesGuard
    if (!tenant?.userRole) {
      throw new ForbiddenException('Contexte tenant manquant');
    }

    if (!required.includes(tenant.userRole as TenantRole)) {
      throw new ForbiddenException(
        `Rôle requis : ${required.join(' | ')} — rôle actuel : ${tenant.userRole}`,
      );
    }

    return true;
  }
}
```

---

### Ordre obligatoire des guards

```
JwtAuthGuard   →   TenantGuard   →   RolesGuard
     ↓                  ↓                ↓
 req.user.id       req.tenant       vérification
 (JWT valide)   (membership actif)   du rôle
```

Chaque guard dépend du suivant. Inverser l'ordre cause un crash.

**Recommandation :** Enregistrer `RolesGuard` comme guard global dans `AppModule` avec `APP_GUARD` — il sera no-op si `@Roles(...)` est absent. Garder `JwtAuthGuard` et `TenantGuard` en décorateurs explicites sur les controllers pour rester lisible.

---

### Cas spéciaux à gérer dans les services (pas dans RolesGuard)

| Cas | Comportement attendu |
|-----|---------------------|
| Teacher modifie son propre live | Autorisé — vérifier `live.host_user_id === user.id` dans le service |
| Admin modifie le rôle de l'owner | Interdit — vérifier côté service avant l'update |
| Owner annule son abonnement | Demande confirmation — logique de safety dans le service billing |
| Student accède au token sans access_pass | `ForbiddenException` dans `LiveService.getJoinToken` |

---

## 4. Spec Endpoints Billing SaaS

Ces endpoints gèrent l'abonnement **du tenant formateur à la plateforme ISNA** (paiement SaaS mensuel/annuel). À ne pas confondre avec le checkout élève (achat à l'unité d'un live).

---

### 4.1 GET /billing/subscription

**Description :** Retourne l'abonnement SaaS actif du tenant.

**Guards :** `JwtAuthGuard`, `TenantGuard`, `RolesGuard` avec `@Roles('owner', 'admin')`

**Réponse 200 :**
```json
{
  "data": {
    "id": "uuid",
    "plan": "pro",
    "status": "active",
    "stripeSubscriptionId": "sub_...",
    "currentPeriodStart": "2026-05-01T00:00:00Z",
    "currentPeriodEnd": "2026-06-01T00:00:00Z",
    "cancelAtPeriodEnd": false,
    "trialEnd": null
  }
}
```

**Réponse 404 :** Tenant sans abonnement actif.

---

### 4.2 POST /billing/subscription

**Description :** Crée un abonnement Stripe pour le tenant. Génère un `stripe_customer_id` si inexistant. Retourne une URL de confirmation de paiement Stripe.

**Guards :** `@Roles('owner')`

**Body :**
```json
{
  "plan": "pro",
  "interval": "month"
}
```

**Réponse 201 :**
```json
{
  "data": {
    "subscriptionId": "uuid",
    "checkoutUrl": "https://checkout.stripe.com/..."
  }
}
```

**Règles métier :**
- Un tenant avec un abonnement `active` ou `trialing` ne peut pas en créer un second — retourner 409.
- Le `stripe_customer_id` est stocké sur le tenant (ou sur la subscription) et réutilisé.

---

### 4.3 PATCH /billing/subscription

**Description :** Modifie le plan (upgrade ou downgrade). Le changement de plan est immédiat (prorata Stripe) ou différé à la prochaine période selon la config.

**Guards :** `@Roles('owner')`

**Body :**
```json
{
  "plan": "business"
}
```

**Réponse 200 :**
```json
{
  "data": {
    "id": "uuid",
    "plan": "business",
    "status": "active"
  }
}
```

**Règles métier :**
- Uniquement si abonnement `active`.
- Downgrade vers `starter` requiert vérification des limites (ex. : si le tenant a plus de N lives que le plan permet).

---

### 4.4 DELETE /billing/subscription

**Description :** Annule l'abonnement à la fin de la période courante. Ne coupe pas l'accès immédiatement.

**Guards :** `@Roles('owner')`

**Réponse 200 :**
```json
{
  "data": {
    "id": "uuid",
    "cancelAtPeriodEnd": true,
    "currentPeriodEnd": "2026-06-01T00:00:00Z"
  }
}
```

**Règles métier :**
- Stripe met `cancel_at_period_end: true` — ne pas supprimer en base immédiatement.
- Le webhook `customer.subscription.deleted` mettra `status: 'cancelled'` + `billing_status: 'suspended'` sur le tenant.

---

### 4.5 GET /billing/invoices

**Description :** Liste les factures du tenant, paginées, triées par date décroissante.

**Guards :** `@Roles('owner', 'admin')`

**Query params :** `?limit=10&offset=0&status=paid`

**Réponse 200 :**
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "stripeInvoiceId": "in_...",
        "amountCents": 4900,
        "currency": "EUR",
        "status": "paid",
        "paidAt": "2026-05-01T12:00:00Z",
        "invoiceUrl": "https://...",
        "invoicePdf": "https://..."
      }
    ],
    "total": 4,
    "limit": 10,
    "offset": 0
  }
}
```

---

### 4.6 GET /billing/invoices/:id

**Description :** Détail d'une facture avec URL de téléchargement PDF.

**Guards :** `@Roles('owner', 'admin')`

**Réponse 200 :** Objet facture complet.

**Règles métier :**
- Vérifier que `invoice.tenant_id === tenant.id` — ne jamais retourner une facture d'un autre tenant même si l'ID est connu.

---

### 4.7 POST /billing/portal

**Description :** Crée une session Stripe Customer Portal permettant au tenant owner de gérer sa carte bancaire, télécharger ses factures, modifier son adresse de facturation.

**Guards :** `@Roles('owner')`

**Réponse 201 :**
```json
{
  "data": {
    "portalUrl": "https://billing.stripe.com/session/..."
  }
}
```

**Règles métier :**
- Requiert un `stripe_customer_id` existant — 400 si le tenant n'a jamais souscrit.
- URL valide 5 minutes (TTL Stripe Customer Portal).
- `return_url` → dashboard tenant.

---

### 4.8 POST /billing/webhook/stripe

**Description :** Webhook Stripe dédié aux événements billing SaaS. Endpoint distinct du webhook checkout élève (`/checkout/webhook/stripe`).

**Auth :** Public — vérification HMAC `STRIPE_BILLING_WEBHOOK_SECRET` (secret distinct du webhook checkout).

**Événements gérés :**

| Événement Stripe | Action |
|-----------------|--------|
| `customer.subscription.created` | Créer `subscription` en base, `billing_event` |
| `customer.subscription.updated` | Mettre à jour `subscription.status`, `plan`, `current_period_*` |
| `customer.subscription.deleted` | Mettre `status: 'cancelled'`, mettre `billing_status: 'suspended'` sur le tenant |
| `customer.subscription.trial_will_end` | Envoyer email alerte J-3 (via worker) |
| `invoice.paid` | Créer/mettre à jour `invoice.status: 'paid'`, `billing_event` |
| `invoice.payment_failed` | Mettre `invoice.status: 'open'`, `billing_event`, envoyer alerte |
| `invoice.payment_action_required` | `billing_event`, envoyer email 3D Secure au tenant owner |

**Réponse :** Toujours 200 si HMAC valide (même si traitement interne échoue — géré via `billing_events.processed`).

**Pattern idempotence :**
1. Vérifier HMAC Stripe
2. Insérer `billing_event` avec `stripe_event_id` (UNIQUE) — si conflit → retourner 200 sans retraitement
3. Traiter l'événement de façon synchrone ou dispatcher vers un job Inngest

---

## 5. Variables d'environnement requises

```bash
# Billing SaaS (en plus des variables checkout existantes)
STRIPE_BILLING_WEBHOOK_SECRET=whsec_...   # Secret webhook billing (distinct de checkout)
STRIPE_PLAN_STARTER_PRICE_ID=price_...    # Price ID Stripe plan Starter
STRIPE_PLAN_PRO_PRICE_ID=price_...        # Price ID Stripe plan Pro
STRIPE_PLAN_BUSINESS_PRICE_ID=price_...   # Price ID Stripe plan Business
STRIPE_PORTAL_CONFIGURATION_ID=bpc_...   # Configuration Stripe Customer Portal (optionnel)
```

---

## 6. Décisions d'architecture à valider avant implémentation

- [ ] **Plans disponibles** — noms, prix, limites (nb lives, nb membres, stockage, etc.)
- [ ] **Trial gratuit** — durée ? obligatoire ou opt-in ?
- [ ] **Upgrade immédiat vs fin de période** — comportement Stripe (prorata ou non) ?
- [ ] **Webhook unique vs séparé** — garder `/checkout/webhook/stripe` et créer `/billing/webhook/stripe` séparés pour des secrets distincts (recommandé)
- [ ] **Suspension automatique** — à quel délai après `past_due` le tenant est suspendu ?
- [ ] **Downgrade** — vérifier limites plan avant d'autoriser ou bloquer proprement ?
- [ ] **Multi-owner billing** — un seul owner peut gérer l'abo ou plusieurs admins peuvent voir les factures (matrice ci-dessus : admin peut voir, pas modifier)
