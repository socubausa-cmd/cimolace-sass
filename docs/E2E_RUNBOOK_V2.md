# E2E Runbook V2 — Module live payant

Dernière mise à jour : 2026-05-10

Objectif : prouver le flux MVP déjà codé dans `isna-opus`, sans toucher à la V1.

Statut audit 2026-05-10 : le backend E2E est passé contre la Supabase V2 configurée, Stripe test et un webhook signé généré localement. Le test manuel restant est le paiement carte Stripe dans le navigateur puis l'entrée LiveKit dans l'app.

Flux à valider :

```txt
owner authentifié
  -> crée tenant
  -> configure branding
  -> crée live payant
student authentifié
  -> crée checkout Stripe
  -> paie en mode test
Stripe webhook
  -> crée access_pass
  -> crée tenant_membership student
student
  -> obtient token LiveKit
  -> rejoint la room
```

Important : le checkout public sans JWT et le compte auto-créé après paiement ne sont pas implémentés dans `isna-opus`. Ne pas les tester comme s'ils existaient.

## Prérequis

- Nouveau projet Supabase dev/staging V2.
- Projet Stripe test.
- Projet LiveKit Cloud ou sandbox LiveKit.
- Stripe CLI installé localement.
- Secrets dans `.env` locaux seulement, jamais commit.

Variables API minimales :

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
LIVEKIT_URL=
FRONTEND_URL=http://localhost:3001
```

Variables app minimales :

```bash
VITE_API_URL=http://localhost:4000
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_LIVEKIT_URL=
```

## Base de données

Appliquer les migrations dans cet ordre :

```txt
supabase/migrations/20250505000001_tenants.sql
supabase/migrations/20250505000002_access_passes.sql
supabase/migrations/20250505000003_live_sessions.sql
supabase/migrations/20250505000004_marketing.sql
supabase/migrations/20250505000005_billing.sql
```

La migration billing existe mais ne doit pas déclencher le développement billing maintenant.

Vérification rapide dans Supabase SQL Editor :

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'tenants',
    'tenant_memberships',
    'access_passes',
    'live_sessions'
  )
order by table_name;
```

Résultat attendu : les 4 tables sont présentes.

## Utilisateurs de test

Créer deux utilisateurs Supabase Auth dans le dashboard ou via l'API Supabase :

```txt
owner@example.test
student@example.test
```

Récupérer un access token JWT pour chacun. Le code API ne fournit pas encore de login complet ; l'app utilise un champ debug pour coller le token.

Dans les commandes ci-dessous :

```bash
OWNER_TOKEN=...
STUDENT_TOKEN=...
TENANT_SLUG=isna-e2e
API=http://localhost:4000
```

## Lancer les services

Terminal 1 :

```bash
npm run dev:api
```

Terminal 2 :

```bash
npm run dev:app
```

Terminal 3 :

```bash
stripe listen --forward-to localhost:4000/checkout/webhook/stripe
```

Copier le `whsec_...` dans `STRIPE_WEBHOOK_SECRET`, puis relancer l'API.

## Étape 1 — Créer le tenant owner

```bash
curl -sS -X POST "$API/tenants" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ISNA E2E",
    "slug": "isna-e2e"
  }'
```

Résultat attendu : `data.slug` vaut `isna-e2e` et `data.userRole` vaut `owner`.

## Étape 2 — Configurer le branding

```bash
curl -sS -X PATCH "$API/tenants/current/branding" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "X-Tenant-Slug: $TENANT_SLUG" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ISNA E2E Academy",
    "brand_colors": {
      "primary": "#0f766e",
      "accent": "#f59e0b"
    }
  }'
```

Résultat attendu : `data.name` vaut `ISNA E2E Academy`.

## Étape 3 — Créer un live payant

```bash
LIVE_RESPONSE=$(curl -sS -X POST "$API/lives" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "X-Tenant-Slug: $TENANT_SLUG" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Live E2E ISNA",
    "description": "Validation du module pilote",
    "scheduledAt": "2026-06-01T18:00:00.000Z",
    "priceCents": 1900,
    "currency": "EUR",
    "capacity": 50,
    "replayEnabled": true
  }')
```

Extraire l'id :

```bash
LIVE_ID=$(printf '%s' "$LIVE_RESPONSE" | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>console.log(JSON.parse(s).data.id))")
```

Résultat attendu : `LIVE_ID` contient un UUID.

## Étape 4 — Vérifier que le student n'a pas encore accès

```bash
curl -i -sS "$API/lives/$LIVE_ID/token" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "X-Tenant-Slug: $TENANT_SLUG"
```

Résultat attendu avant paiement : `403`, car le student n'a pas encore de membership/access pass.

## Étape 5 — Créer une session Checkout

```bash
CHECKOUT_RESPONSE=$(curl -sS -X POST "$API/checkout/sessions" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"liveSessionId\":\"$LIVE_ID\"}")
```

Extraire l'URL :

```bash
CHECKOUT_URL=$(printf '%s' "$CHECKOUT_RESPONSE" | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>console.log(JSON.parse(s).data.checkoutUrl))")
```

Ouvrir l'URL et payer avec une carte test Stripe :

```txt
4242 4242 4242 4242
date future
CVC quelconque
```

Résultat attendu : Stripe redirige vers `/lives/:id/join?payment=success`.

## Étape 6 — Vérifier les effets webhook

Dans Supabase SQL Editor :

```sql
select tenant_id, user_id, resource_type, resource_id, status, payment_id
from access_passes
where resource_id = '<LIVE_ID>';
```

Résultat attendu : une ligne `status = 'active'` pour le student.

```sql
select tenant_id, user_id, role, status
from tenant_memberships
where tenant_id = (
  select tenant_id from live_sessions where id = '<LIVE_ID>'
)
order by role;
```

Résultat attendu : owner actif et student actif.

## Étape 7 — Obtenir le token LiveKit student

```bash
curl -sS "$API/lives/$LIVE_ID/token" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -H "X-Tenant-Slug: $TENANT_SLUG"
```

Résultat attendu : `data.token` et `data.roomName` sont présents.

## Étape 8 — Tester via l'app

Ouvrir :

```txt
http://localhost:3001/lives/<LIVE_ID>/join
```

Utiliser le mode debug de l'app pour coller :

- `STUDENT_TOKEN`
- tenant slug `isna-e2e`

Résultat attendu : la room LiveKit se charge après obtention du token.

## Critères de succès

- Owner peut créer tenant, branding et live.
- Student ne peut pas rejoindre avant paiement.
- Stripe Checkout est créé avec URL valide.
- Webhook Stripe signé crée `access_passes`.
- Webhook Stripe crée `tenant_memberships` student.
- Student peut obtenir un token LiveKit après paiement.
- L'app peut rejoindre la room LiveKit.

## Si ça casse

Corriger seulement le bug révélé, puis relancer le même scénario.

Priorité des corrections :

1. Mauvaise config ou secret absent.
2. Migration/RLS manquante.
3. JWT Supabase invalide.
4. Stripe webhook non signé ou raw body absent.
5. Incohérence `tenant_id` / membership / access pass.
6. LiveKit token invalide.

Ne pas ajouter le checkout public ni le billing SaaS pendant cette validation.
