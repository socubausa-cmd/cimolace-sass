# Cimolace — Architecture & Source de vérité

Dernière mise à jour : 2026-05-28
Statut : **canonique** — toute autre doc qui contredit celui-ci est obsolète.

## 1. Le vocabulaire — à respecter strictement

Trois niveaux distincts, ne jamais confondre :

```
┌──────────────────────────────────────────────────────────┐
│  CIMOLACE — la plateforme SaaS                           │
│  (la marque, l'OS, le code, les serveurs, l'équipe)      │
│                                                          │
│   ┌────────────────────────────────────────────────┐    │
│   │  MOTEURS (engines)                             │    │
│   │  MEDOS, Mbolo, LIRI, Course Builder, Booking,  │    │
│   │  PayEngine, Smartboard, Live, GDPR Engine, …   │    │
│   └────────────────────────────────────────────────┘    │
│                                                          │
│   ┌────────────────────────────────────────────────┐    │
│   │  TENANTS (clients qui utilisent les moteurs)   │    │
│   │  - ISNA          (école sciences africaines)   │    │
│   │  - Zahir         (wellness)                    │    │
│   │  - Prorascience  (formation)                   │    │
│   │  - Djilowah                                    │    │
│   │  - …                                           │    │
│   └────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

**Règles immuables :**

1. **Cimolace n'est pas un tenant.** C'est la plateforme.
2. **Un moteur n'est pas un tenant.** MEDOS n'est pas une entreprise, c'est une feature de Cimolace.
3. **Un tenant active un ou plusieurs moteurs.** ISNA active LIRI + Course Builder. Zahir active Mbolo + MEDOS. Etc.
4. **Tout passe par Cimolace.** Pas de service direct entre tenants. Pas de moteur autonome.

## 2. Mapping des domaines (cible)

État actuel **non conforme** → cible **conforme** :

| Domaine | Aujourd'hui | Cible |
|---|---|---|
| `cimolace.space` | apps/app (montre marketing ISNA) ❌ | **apps/public-site** (marketing SaaS Cimolace) ✅ |
| `app.cimolace.space` | n'existe pas | **apps/app** (admin Cimolace + dashboards tenants) ✅ |
| `api.cimolace.space` | apps/api ✅ | apps/api ✅ |
| `*.medos.cimolace.space` | n'existe pas | **apps/public-site** (Mode A — portails MEDOS hébergés par tenant) ✅ |
| `isna.cimolace.space` | n'existe pas | **apps/app** (tenant ISNA résolu par sous-domaine) ✅ |
| `zahir.cimolace.space` | n'existe pas | **apps/app** (tenant Zahir résolu par sous-domaine) ✅ |
| `prorascience.cimolace.space` | n'existe pas | **apps/app** (tenant Prorascience) ✅ |
| `<client.com>` custom | n'existe pas | **apps/public-site** via `tenant_domains.custom_host` (Mode B) ✅ |
| `zahirwellness.com` externe | site client autonome | **site client externe** + widget Cimolace embeddé (Mode C) ✅ |

## 3. Les 5 applications Cimolace (le code)

| App | Rôle | Audience | Stack |
|---|---|---|---|
| **apps/api** | Cerveau API multi-tenant. TOUTES les routes business passent ici. Le seul à parler à Supabase. | Tous (interne + tenants + sites externes via clé API) | NestJS, Node 22 |
| **apps/public-site** | Vitrine Cimolace + portails MEDOS hébergés (Mode A) + landing pages tenants (Mode B) + iframe embed (Mode C.2) + widget CDN (Mode C.1) | Visiteurs anonymes, patients/utilisateurs des tenants | Next.js 15 |
| **apps/app** | Dashboard admin Cimolace (gérer les tenants, leurs moteurs, leurs clés, leurs domaines) + dashboard tenant (un membre d'un tenant gère ses données métier) | Staff Cimolace + admins tenants + utilisateurs métier d'un tenant | React + Vite |
| **apps/med-app** | Frontend dédié praticien MEDOS. Branché à apps/api. Sera servi sur `medos.<tenant>.cimolace.space` ou intégré dans apps/app via route. | Praticiens d'un tenant MEDOS | React + Vite |
| **apps/patient-portal** | Frontend dédié patient. Idem, branché à apps/api. | Patients d'un tenant MEDOS | React + Vite |

**Note** : `apps/med-app` et `apps/patient-portal` sont des **interfaces verticales spécialisées** pour le moteur MEDOS. À long terme elles peuvent être absorbées dans `apps/app` (qui sait afficher l'UI du moteur activé par le tenant). Mais elles existent aujourd'hui comme apps séparées.

## 4. Catalogue des moteurs

Source : [apps/api/src/cimolace-catalog/cimolace-catalog.service.ts](apps/api/src/cimolace-catalog/cimolace-catalog.service.ts)

| Moteur | Préfixe service_key | Tables principales | Apps frontend |
|---|---|---|---|
| **MEDOS** | `med_*`, `gdpr_engine` | `med_patients`, `med_consultation_notes`, `med_prescriptions`, … (32 tables) | med-app, patient-portal, widget JS |
| **Mbolo** | `mbolo_*` | `mbolo_products`, `mbolo_orders`, `mbolo_carts`, … | apps/app (storefront) + sites externes via API |
| **LIRI** | `liri_*` | `liri_videos`, `liri_streams`, `liri_archives` | apps/app + apps/public-site |
| **Course Builder** | `course_*` | `courses`, `course_lessons`, `course_enrollments` | apps/app |
| **Booking** | `booking_*` | `bookings`, `appointments` | apps/app |
| **Pay Engine** | `payment_*`, `billing_*`, `pawapay_*` | `subscriptions`, `payments`, `invoices` | apps/app + checkout |
| **Smartboard** | `smartboard_*` | `smartboard_decks`, `smartboard_slides` | apps/app |
| **Live** | `live_*` | `live_sessions` | apps/app |
| **Notifications** | `notif_*` | `notifications` | global |
| **Marketing CRM** | `marketing_*` | `crm_*` | apps/app |
| **Schools (ISNA tenant template)** | `school_*` | `school_provisionings` | apps/app via cimolace-backoffice |

Un tenant active des moteurs via la table `tenant_services(tenant_id, service_key, active)`. Le `MedosEnabledGuard` (et équivalents pour les autres moteurs) vérifie cette table à chaque requête.

## 5. Comment un tenant se connecte (4 façons)

Voir [MEDOS_INTEGRATION_MODES.md](MEDOS_INTEGRATION_MODES.md) pour le détail MEDOS — même logique pour tous les moteurs.

### Mode 0 — Tenant interne Cimolace (cas ISNA, Prorascience)

Le tenant n'a pas de domaine propre. Il vit sur `<tenant>.cimolace.space` (sous-domaine Cimolace). Apps/app résout le tenant par le sous-domaine.

### Mode A — Tenant hébergé Cimolace (cas nouveaux clients sans site)

Identique au Mode 0 mais public/branding personnalisé. URL : `<slug>.medos.cimolace.space` pour la partie MEDOS, `<slug>.mbolo.cimolace.space` pour Mbolo, etc.

### Mode B — Domaine personnalisé hébergé (cas clinique avec domaine acheté)

Le tenant a acheté `clinique-x.com`. CNAME vers Cimolace, Cimolace sert l'expérience sous ce domaine via la table `tenant_domains.usage = 'custom_host'`. Provisioning SSL via Cloudflare for SaaS.

### Mode C — Embedded dans site externe (cas Zahir, Toteme)

Le tenant a son propre site (ex : `zahirwellness.com`). Il intègre Cimolace dans son site via :
- **C.1** : widget JS `<script src="https://cimolace.space/medos/v1/embed.js" data-tenant="zahir" data-mode="patient-portal">`
- **C.2** : iframe `https://cimolace.space/embed/[mode]?tenant=zahir`
- **C.3** : API REST `Authorization: Bearer mdk_zahir_<secret>` côté serveur client

Tous protégés par `tenant_domains.usage = 'embed_origin'` (CORS dynamique).

## 6. Identités — qui fait quoi

| Identité | Auth | Rôles MEDOS possibles | Exemple |
|---|---|---|---|
| **Staff Cimolace** | JWT Supabase + `cimolace_staff_members` membership | n/a — vue sur tous tenants | toi (ngowazulu) |
| **Admin tenant** (owner) | JWT Supabase + `tenant_memberships.role='owner'` | toutes opérations sur SES tenant | dirigeant Zahir |
| **Praticien tenant** | JWT Supabase + `role='practitioner'` | CRUD patients/notes/prescriptions de SON tenant | Dr X chez Zahir |
| **Patient** | JWT Supabase + `role='patient'` | lecture SES données + soumettre formulaires/santé | client Zahir |
| **Réceptionniste** | JWT Supabase + `role='receptionist'` | gestion RDV + invitations patients | secrétaire Zahir |
| **Backend client externe** (Mode C.3) | clé API tenant (`mdk_*`) | role synthétique `clinic_admin` sur SON tenant | backend zahirwellness.com |
| **Visiteur widget** (Mode C.1/C.2) | embed-token JWT 15 min | scope limité par mode (ex: `patient-portal`) | utilisateur lambda sur zahirwellness.com |
| **Service role** | Supabase service key | tout — utilisé par apps/api uniquement | apps/api → DB |

## 7. Source de vérité — où chaque info vit

**Une seule règle :** apps/api est l'autorité unique. Tout passe par lui.

| Type d'info | Source | Lecteurs |
|---|---|---|
| Tenants et leurs services activés | `tenants`, `tenant_services` dans Supabase | apps/api uniquement (filtré par tenant_id) |
| Membres tenant + rôles | `tenant_memberships` | apps/api |
| Domaines whitelistés (embed + custom host) | `tenant_domains` | apps/api (CORS dynamique) |
| Clés API tenant | `tenant_api_keys` (hash seulement) | apps/api (ApiKeyGuard) |
| Données médicales | tables `med_*` | apps/api (filtré par tenant_id + RLS) |
| Données e-commerce | tables `mbolo_*` | apps/api (filtré par tenant_id + RLS) |
| Identités utilisateurs | `auth.users` Supabase | apps/api via service role |
| Catalogue des moteurs | `cimolace-catalog.service.ts` (en code) | apps/api → exposé via `/catalog` |
| Pricing & engines disponibles | hardcodé dans le catalogue | apps/api |
| Tarification réelle d'un tenant | `subscriptions`, `payments` | apps/api |

**Pas de duplication.** Aucune autre app ne stocke ces infos. Frontend = vue projetée de l'API.

## 8. Plan de remise en ordre (concret)

### Phase 1 — Domaines (action immédiate)

1. **Réassigner `cimolace.space` au projet Vercel `public-site`** (pas `app`).
   Commande : retirer du projet `app`, ajouter au projet `public-site`, attendre propagation DNS.
2. **Ajouter `app.cimolace.space` au projet Vercel `app`** comme nouveau domaine principal.
3. **Configurer wildcard `*.cimolace.space` sur Cloudflare → Vercel** (pour les sous-domaines tenants).
4. **Configurer wildcard `*.medos.cimolace.space`** pointant vers `public-site` (Mode A).

### Phase 2 — Routing tenant dans les apps

5. Dans `apps/app/src/main.tsx` : middleware qui résout `req.host` pour extraire le tenant. Si host = `isna.cimolace.space`, tenant = `isna`. Stocker dans `tenantStore`.
6. Dans `apps/public-site/middleware.ts` : middleware qui résout `req.host` pour Mode A (wildcard `*.medos.cimolace.space` → `tenant_slug` extrait).
7. Tous les appels API depuis frontend incluent `X-Tenant-Slug: <tenant>`. apps/api résout via `TenantGuard`.

### Phase 3 — Renommage des modules (cohérence)

8. Le legacy `MedEhrModule`, `MedNotesModule`, etc. dans apps/api doublonnent `MedosModule`. **Plan : retirer les legacy, ne garder que MedosModule.** Aujourd'hui ils coexistent et c'est confus.
9. Pareil pour `apps/app/src/pages/AdminDashboard.jsx` : il y en a deux (un dans `pages/`, un dans `pages/admin/`). Garder un seul.

### Phase 4 — Doc

10. Ce fichier devient la **seule** source d'architecture. Toute autre doc qui dit "ISNA est Cimolace" ou "MEDOS est un produit" est obsolète et doit être marquée comme telle ou supprimée.
11. Marketing : la page `/medos` sur Cimolace explique "MEDOS = moteur santé de Cimolace, activable pour ton cabinet". Pas "Vous voulez utiliser MEDOS ? Allez sur medos.com" (ce site n'existe pas, MEDOS n'est pas un produit séparé).

## 9. Ce qui DOIT changer dans le code dès aujourd'hui

| Fichier | Problème | Fix |
|---|---|---|
| Vercel project `app` → `cimolace.space` | Domaine sur la mauvaise app | Réassigner à `public-site` |
| apps/app par défaut affiche ISNA-LIRI | Devrait afficher dashboard Cimolace (login → tenants list) ou rediriger vers cimolace.space pour les visiteurs non-staff | Refactoriser le router racine de apps/app |
| apps/api MedEhrModule + MedNotesModule + … (legacy) | Doublonne MedosModule | À supprimer après vérification que rien ne les utilise |
| docs/MEDOS_*.md anciennes | Certaines parlent de MEDOS comme produit autonome | Lire et ajouter en haut : "MEDOS est un moteur Cimolace, voir CIMOLACE_ARCHITECTURE_SOURCE_OF_TRUTH.md" |

## 10. Phrase de référence à utiliser publiquement

> **Cimolace** est l'OS qui propulse des plateformes SaaS multi-secteurs. **MEDOS** est son moteur santé, **Mbolo** son moteur e-commerce, **LIRI** son moteur média. Nos clients (ISNA, Zahir, Prorascience…) activent les moteurs dont ils ont besoin et obtiennent leur propre espace, leur propre URL, leur propre branding.

C'est cette phrase qui doit guider toute communication marketing.

## 11. Diagramme final

```
                        ┌─────────────────────────┐
                        │      CIMOLACE SaaS      │
                        │    (cimolace.space)     │
                        └────────────┬────────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
        ┌─────▼─────┐         ┌──────▼──────┐        ┌──────▼──────┐
        │  MEDOS    │         │   Mbolo     │        │    LIRI     │
        │  (santé)  │         │ (e-comm)    │        │  (média)    │
        └─────┬─────┘         └──────┬──────┘        └──────┬──────┘
              │                      │                      │
       ┌──────┼──────┐               │                      │
       │      │      │               │                      │
   ┌───▼──┐ ┌─▼──┐ ┌─▼────┐    ┌─────▼─────┐         ┌──────▼─────┐
   │Zahir │ │Cli-│ │ Mode │    │  Zahir    │         │   ISNA     │
   │Mode C│ │niq │ │  A   │    │ (Mbolo+   │         │  (LIRI +   │
   │embed │ │Mode│ │médos.│    │  MEDOS)   │         │  Courses)  │
   │      │ │ B  │ │  …   │    └───────────┘         └────────────┘
   └──────┘ └────┘ └──────┘    zahir.cimolace.space  isna.cimolace.space
   zahir.com client.com  *.medos.cimolace.space
```

ISNA et Zahir sont **chacun un seul tenant**, mais ils peuvent activer plusieurs moteurs en parallèle.
