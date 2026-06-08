# Security Review — Phase 1.5

**Date :** 2026-05-05  
**Branche :** feat/opus-billing-roles  
**Auditeur :** Claude Opus (architecte)  
**Périmètre :** checkout.service.ts · tenant.guard.ts · live.service.ts  
**Statut :** Lecture seule — aucune modification de code dans ce document

---

## Résumé des risques

| Sévérité | Fichier | Risque |
|----------|---------|--------|
| **CRITIQUE** | checkout.service.ts | `payment_status` non vérifié → access pass sans paiement réel |
| **CRITIQUE** | checkout.service.ts | Erreur silencieuse sur upsert access_pass → accès perdu, Stripe ne retry pas |
| **CRITIQUE** | tenant.guard.ts | `req.user` non vérifié → TypeError 500 si guard mal ordonné |
| **ÉLEVÉ** | live.service.ts | Token émis sans vérifier le statut du live (cancelled, etc.) |
| **ÉLEVÉ** | live.service.ts | Pas d'expiry sur access_pass → accès indéfini après paiement |
| **MOYEN** | checkout.service.ts | Pas d'idempotency key Stripe → double session sur retry |
| **MOYEN** | checkout.service.ts | `tenantId` metadata non revalidé côté webhook |
| **MOYEN** | live.service.ts | `findAll` sans pagination → DoS potentiel |
| **MOYEN** | live.service.ts | Room name prédictible → enumeration |
| **MOYEN** | live.service.ts | Messages d'erreur Supabase bruts exposés |
| **FAIBLE** | tenant.guard.ts | Slug non normalisé ni limité en longueur |
| **FAIBLE** | live.service.ts | `select('*')` — surexposition de colonnes |

---

## 1. checkout.service.ts

### CRITIQUE-1 — `payment_status` non vérifié dans le webhook

**Localisation :** `onCheckoutCompleted`, ligne 102–104

```
if (event.type === 'checkout.session.completed') {
  await this.onCheckoutCompleted(event.data.object);
}
```

**Problème :** L'événement `checkout.session.completed` peut se déclencher avec `payment_status: 'unpaid'` pour des méthodes de paiement asynchrones (SEPA, BACS, etc.) ou en mode test. Le code crée un `access_pass` immédiatement sans vérifier si le paiement est réellement encaissé.

**Impact :** Un étudiant peut obtenir l'accès à un live sans avoir payé.

**Correction requise :** Vérifier `session.payment_status === 'paid'` avant de créer l'access_pass. Traiter aussi l'événement `payment_intent.succeeded` ou `charge.succeeded` comme filet secondaire.

---

### CRITIQUE-2 — Erreur silencieuse sur création d'access_pass

**Localisation :** `onCheckoutCompleted`, lignes 126–129

```typescript
if (passError) {
  this.logger.error('Erreur création access_pass', passError.message);
  return;  // ← retourne 200 à Stripe
}
```

**Problème :** En cas d'erreur DB lors de la création de l'access_pass, la fonction retourne silencieusement avec un HTTP 200. Stripe considère le webhook comme traité et ne retentera pas. L'étudiant a payé mais n'a pas son accès.

**Impact :** Paiement encaissé sans contrepartie. Litiges Stripe probables.

**Correction requise :** Lever une exception (5xx) pour forcer Stripe à retenter. Logger l'erreur + envoyer une alerte opérationnelle. Mettre en place une queue de reprise (Inngest ou équivalent).

---

### MOYEN-1 — Pas d'idempotency key sur `stripe.checkout.sessions.create`

**Localisation :** `createSession`, ligne 67

**Problème :** Si le frontend double-poste (retry réseau, double-clic), deux sessions Stripe identiques peuvent être créées pour le même utilisateur/live. Le check d'`access_pass` existant ne protège que contre le doublon d'access_pass, pas contre la double facturation Stripe.

**Correction requise :** Passer `{ idempotencyKey: \`checkout-${userId}-${liveSessionId}\` }` en option à `stripe.checkout.sessions.create`.

---

### MOYEN-2 — `tenantId` metadata non revalidé côté webhook

**Localisation :** `onCheckoutCompleted`, ligne 108–111

**Problème :** Le `tenantId` est lu depuis les métadonnées Stripe, qui ont été écrites par notre API au moment du checkout. La vérification HMAC garantit l'intégrité de l'événement Stripe. Cependant, entre la création de la session et le paiement, le tenant pourrait avoir été supprimé ou suspendu. L'upsert crée quand même un access_pass pour un tenant potentiellement invalide.

**Correction requise :** Vérifier que le tenant existe et est actif (`status = 'active'`) avant d'insérer l'access_pass.

---

### FAIBLE-1 — `liveSessionId` non validé comme UUID

**Localisation :** `createSession`, paramètre entrant

**Problème :** Aucune validation du format UUID sur `liveSessionId` avant la requête DB. Supabase paramètre les requêtes (pas d'injection SQL directe), mais une valeur malformée peut générer une erreur DB non formatée exposée à l'appelant.

**Correction requise :** Ajouter une validation UUID via class-validator dans le DTO d'entrée. Déjà possible si un DTO est utilisé côté controller.

---

## 2. tenant.guard.ts

### CRITIQUE-3 — `req.user` non vérifié avant accès

**Localisation :** `canActivate`, ligne 26

```typescript
req.tenant = await this.tenantService.resolveForUser(slug, req.user.id);
```

**Problème :** Si un développeur décore un endpoint avec `@UseGuards(TenantGuard)` sans `JwtAuthGuard`, `req.user` sera `undefined`. L'accès à `req.user.id` levèrera un `TypeError: Cannot read properties of undefined` → HTTP 500 au lieu d'un 401 propre.

**Impact :** Endpoint exposé sans authentification retourne 500 (informatif sur la stack) et ne bloque pas l'accès proprement. Risque d'erreur de configuration silencieuse.

**Correction requise :**

```typescript
if (!req.user?.id) {
  throw new UnauthorizedException('Utilisateur non authentifié');
}
```

Ajouter cette garde en début de `canActivate`. Documenter l'ordre obligatoire `JwtAuthGuard → TenantGuard` dans les commentaires ou dans AGENTS.md.

---

### FAIBLE-2 — Slug non sanitisé ni limité

**Localisation :** `canActivate`, ligne 20–22

**Problème :** Le header `x-tenant-slug` est utilisé directement sans vérification de longueur ou de format. Un slug de 10 000 caractères sera transmis à la DB. Aucun risque d'injection (Supabase paramètre), mais un risque de DoS par overhead DB.

**Correction requise :** Valider que le slug correspond à `/^[a-z0-9-]{1,64}$/` avant de l'utiliser. Retourner `BadRequestException` si invalide.

---

### FAIBLE-3 — Pas de rate limiting sur la résolution de tenant

**Localisation :** `canActivate`

**Problème :** Un attaquant peut énumérer les slugs tenant existants via des appels répétés. La réponse `404` (slug inconnu) vs `403` (membre absent) permet de distinguer un tenant existant.

**Correction requise :** Rate limiting au niveau API (Fastify plugin ou guard global). Envisager une réponse uniforme `403` pour les deux cas (slug inconnu et membership absent) pour empêcher l'énumération.

---

## 3. live.service.ts

### ÉLEVÉ-1 — Token émis sans vérifier le statut du live

**Localisation :** `getJoinToken`, ligne 74–95

**Problème :** `findOne` récupère le live et vérifie qu'il appartient au tenant, mais ne vérifie pas son statut. Un live `cancelled` ou `ended` peut toujours générer un token LiveKit valide. Un étudiant avec un access_pass actif peut rejoindre une room pour un live annulé.

**Impact :** Consommation de ressources LiveKit inutile. Confusion utilisateur. Possible faille d'accès si la room est réutilisée.

**Correction requise :** Vérifier `live.status` dans `getJoinToken` :
- `'scheduled'` ou `'live'` → autoriser
- `'cancelled'`, `'ended'`, `'draft'` → `ForbiddenException`

---

### ÉLEVÉ-2 — Pas d'expiry sur l'access_pass

**Localisation :** `getJoinToken`, lignes 79–86

**Problème :** La requête filtre uniquement `status: 'active'` sans vérifier de champ `expires_at`. Un étudiant ayant payé un live une fois peut continuer à rejoindre la room LiveKit indéfiniment (même après le live, même des mois plus tard si la room existe encore).

**Impact :** Accès non limité dans le temps. Contournement du modèle "accès replay vs accès live".

**Correction requise :** Ajouter `expires_at TIMESTAMPTZ` à la table `access_passes`. Dans `getJoinToken`, ajouter `.gte('expires_at', new Date().toISOString())` ou laisser null pour accès permanent (replay). Renseigner `expires_at` = fin du live lors de la création de l'access_pass.

---

### MOYEN-3 — `findAll` sans pagination

**Localisation :** `findAll`, lignes 46–54

```typescript
const { data, error } = await this.supabase.client
  .from('live_sessions')
  .select('*')
  .eq('tenant_id', tenantId)
  .order('scheduled_at', { ascending: true });
```

**Problème :** Un tenant avec des milliers de live sessions retournera l'intégralité des enregistrements. Pas de `.limit()` ni de `.range()`.

**Impact :** Overhead mémoire API, latence réseau, DoS potentiel par un tenant légitime avec beaucoup de données.

**Correction requise :** Ajouter pagination `limit` + `offset` (ou curseur). Exposer via query params `?limit=20&offset=0`.

---

### MOYEN-4 — Room name prédictible

**Localisation :** `create`, ligne 22

```typescript
const roomName = `${tenant.slug}_${Date.now()}`;
```

**Problème :** La room LiveKit est nommée avec le slug tenant (connu publiquement) et un timestamp en millisecondes. Un attaquant connaissant le slug et l'heure approximative de création d'un live peut déduire le nom de la room. L'accès reste contrôlé par le token LiveKit, mais l'énumération de rooms est possible.

**Correction requise :** Utiliser `${tenant.slug}_${crypto.randomUUID()}` ou intégrer l'`id` du live (UUID) dans le nom de la room après insertion.

---

### MOYEN-5 — Messages d'erreur Supabase bruts exposés

**Localisation :** `create` (ligne 42), `findAll` (ligne 52)

```typescript
if (error) throw new Error(error.message);
```

**Problème :** L'erreur Supabase brute (qui peut contenir le nom de table, de colonne, contrainte, etc.) est propagée comme `InternalServerErrorException` vers le client via le `GlobalExceptionFilter`.

**Impact :** Fuite d'informations sur le schéma DB. Facilite le fingerprinting de la base.

**Correction requise :** Logger `error.message` (avec Logger NestJS) et lever une exception générique : `throw new InternalServerErrorException('Erreur interne')`.

---

### FAIBLE-4 — `select('*')` sur ressources tenant

**Localisation :** `findAll` (ligne 49), `findOne` (ligne 61)

**Problème :** Sélectionne toutes les colonnes, incluant potentiellement des champs sensibles futurs (clés d'accès, données de facturation, etc.) ajoutés à la table.

**Correction requise :** Lister explicitement les colonnes nécessaires côté API. Ne jamais `select('*')` sur les tables métier exposées via HTTP.

---

## Actions prioritaires (ordre d'urgence)

1. **CRITIQUE-1** — Vérifier `payment_status === 'paid'` dans le webhook Stripe
2. **CRITIQUE-2** — Propager l'erreur DB pour forcer le retry Stripe + alerte opérationnelle
3. **CRITIQUE-3** — Null-check sur `req.user` dans TenantGuard
4. **ÉLEVÉ-1** — Bloquer `getJoinToken` si live non actif
5. **ÉLEVÉ-2** — Ajouter `expires_at` à `access_passes` et le vérifier
6. **MOYEN-1** — Idempotency key Stripe checkout
7. **MOYEN-3** — Pagination sur `findAll`
8. **MOYEN-4** — Nom de room non prédictible
9. **MOYEN-5** — Ne pas exposer les messages d'erreur Supabase
10. **MOYEN-2** — Revalider tenant actif dans le webhook

---

## Ce qui est bien fait

- Vérification HMAC Stripe (`constructEvent`) avant tout traitement webhook — correct.
- `upsert` avec `ignoreDuplicates: true` sur access_pass — protection basique contre les doublons.
- Séparation `JwtAuthGuard` + `TenantGuard` comme guards distincts — bonne architecture.
- Vérification membership + role dans `LiveService.create` via `TenantContext` — correct.
- Vérification `access_pass` uniquement pour les non-hosts dans `getJoinToken` — logique appropriée.
- `webhookSecret` vérifié avant traitement (`replace_me` rejeté) — sécurité config correcte.
- Raw body préservé pour la vérification HMAC — conforme aux exigences Stripe.
