# Tenancy and Backend Boundaries V2

## Objectif

Éviter le double-backend confus entre Supabase et l'API V2.

---

# 1. Décision multi-tenant

La V2 utilise une base Postgres unique avec isolation logique par `tenant_id`.

```txt
users/profiles
  ↓
tenant_memberships
  ↓
tenants
  ↓
ressources tenant-scoped
```

## Tables tenant-scoped

Toute ressource métier doit avoir `tenant_id` sauf exception documentée.

Exemples :

- live_sessions
- courses
- products
- orders
- access_passes
- marketing_discounts
- marketing_popups
- marketing_banners
- forum_threads
- media_assets
- render_jobs

---

# 2. Modèle tenant minimal

## tenants

- id
- name
- slug
- owner_user_id
- status
- plan
- billing_status
- primary_domain
- logo_url
- brand_colors
- timezone
- locale
- created_at
- updated_at

## tenant_memberships

- id
- tenant_id
- user_id
- role
- status
- created_at

## roles tenant

- owner
- admin
- teacher
- student
- secretariat
- support

## platform roles

- platform_owner
- platform_admin

---

# 3. Responsabilités Supabase

Supabase gère :

- Postgres
- Auth
- Storage pour petits fichiers/documents/images
- Realtime simple
- RLS de défense
- migrations SQL

Supabase ne doit pas être utilisé comme seul backend métier pour :

- paiements
- attribution accès après paiement
- création tokens LiveKit
- logique billing
- orchestration vidéo
- jobs IA
- permission admin sensible
- webhooks externes

---

# 4. Responsabilités API V2

L'API V2 gère :

- règles métier
- validation input
- permissions tenant
- rôles
- paiements
- webhooks
- création access pass
- création live
- tokens LiveKit
- appels providers IA
- lancement jobs workers
- génération URLs signées sensibles

---

# 5. Responsabilités frontend

Le frontend gère :

- UI
- formulaires
- état local
- affichage
- appels API
- auth session client

Le frontend ne doit pas :

- décider qu'un paiement donne accès
- créer un access pass directement
- créer un token LiveKit directement
- écrire des données critiques sans API
- contourner les permissions tenant

---

# 6. RLS Supabase

RLS reste obligatoire comme défense secondaire.

Mais la logique métier principale doit être dans l'API.

Règle :

```txt
API = décision métier
RLS = garde-fou base de données
```

---

# 7. Domaines tenant

## MVP

- sous-domaines ou slugs applicatifs
- exemple : `/t/:tenantSlug`

## Plus tard

- domaines custom
- mapping `tenant_domains`
- validation DNS
- SSL via plateforme hosting/CDN

---

# 8. Branding tenant

Branding minimal dès MVP :

- logo
- couleur primaire
- couleur secondaire
- nom public
- slug

Branding avancé plus tard :

- thème complet
- pages publiques tenant
- emails custom
- domaines custom

---

# 9. Règle de conception API

Chaque endpoint métier sensible doit recevoir ou résoudre un `tenant_id`.

Exemples :

```txt
POST /tenants
GET /tenants/:tenantId/dashboard
POST /tenants/:tenantId/lives
POST /tenants/:tenantId/marketing/discounts
POST /tenants/:tenantId/products
```

L'API doit vérifier :

1. utilisateur authentifié
2. membership tenant
3. rôle suffisant
4. statut tenant actif
5. limites plan

---

# 10. Question encore ouverte

À valider avant schéma final :

- [ ] Un utilisateur peut-il appartenir à plusieurs tenants ? Recommandation : oui.
- [ ] Un tenant peut-il vendre à des étudiants externes ? Recommandation : oui.
- [ ] Prorascience est-il lui-même un tenant ? Recommandation : oui, tenant système.
- [ ] Marketplace globale dès MVP ? Recommandation : non.
