# MEDOS — Modes d'intégration officiels Cimolace

Dernière mise à jour : 2026-05-28

## Verdict

MEDOS est le moteur santé de Cimolace. Pour être commercialisable, il doit pouvoir
se brancher sur **trois types de clients** sans imposer la même architecture à
chacun :

```txt
1. Client sans site existant       -> on lui héberge tout (Mode A)
2. Client avec domaine acheté seul -> on héberge l'expérience sous son domaine (Mode B)
3. Client avec site web actif      -> on s'embarque dans son site (Mode C)
```

Cette doc est le pendant santé de `ZAHIR_TO_MBOLO_MIGRATION_STRATEGY.md`. Mêmes
règles : pas de mono-tenant, pas de bascule brutale, pas de bricolage côté client
en ligne.

## Compréhension produit

MEDOS expose aujourd'hui (cf. `apps/api/src/medos/`) :

- API REST NestJS multi-tenant (TenantGuard, RolesGuard, JWT Supabase)
- Tables : `med_patients`, `med_consultation_notes`, `med_forms`, `med_health_*`,
  `med_charting_jobs`, `med_programs`, `med_prescriptions`, `tenant_api_keys`
- Apps : `apps/med-app` (praticien), `apps/patient-portal` (patient),
  `apps/app` (back-office Cimolace), `apps/public-site/app/medos` (landing
  marketing)

Ce qui manque pour être branchable sur un client externe :

- Authentification non-Supabase (clé API tenant) — table existe, service à câbler
- CORS dynamique par domaine tenant
- Résolution tenant par sous-domaine ou domaine personnalisé
- Widget JS embeddable + SDK
- Provisioning de domaine et SSL automatique
- Templates de landing par tenant

## Les trois modes officiels

### Mode A — MEDOS Hébergé

> Le client n'a pas de site. Cimolace fournit toute l'expérience sur un
> sous-domaine `*.medos.cimolace.com`.

```txt
Client onboarding Cimolace
  -> tenant "clinique-marie"
  -> moteur MEDOS activé
  -> https://clinique-marie.medos.cimolace.com
     ├── landing publique brandée
     ├── portail patient
     ├── back-office praticien
     └── dashboard admin tenant
```

Composants techniques :

- Wildcard DNS `*.medos.cimolace.com` -> reverse proxy (Caddy / Cloudflare / Vercel)
- Routage par `Host` header -> tenant_id résolu côté API
- Branding (logo, couleur, contenu landing) éditable depuis `apps/app`
- Templates landing dans `apps/public-site` -> rendu paramétré par tenant

Cible commerciale : nouveau praticien, clinique sans site, créateur de cabinet.

Avantages :

- Time-to-market < 1h pour un nouveau client
- Support et monitoring centralisés
- Cimolace garde 100% du contrôle technique

Limites :

- Pas de personnalisation visuelle profonde
- Sous-domaine cimolace.com visible (pas de white-label fort)

### Mode B — MEDOS Domaine Personnalisé

> Le client a acheté un domaine (`clinique-x.ga`, `medicalcenter.com`). Cimolace
> héberge l'expérience sous ce domaine.

```txt
clinique-x.ga (CNAME -> medos.cimolace.com)
  -> Cimolace résout tenant via Host header
  -> sert exactement le même contenu que Mode A
     mais sous le domaine du client
```

Composants techniques :

- Table `tenant_domains` (à créer) — colonnes : tenant_id, custom_domain,
  ssl_status, verified_at, dns_target
- Vérification DNS automatique (TXT record `cimolace-verify=<token>`)
- Provisioning SSL automatique :
  - Option 1 : Cloudflare for SaaS (recommandée, hostnames API)
  - Option 2 : Caddy reverse proxy avec ACME
  - Option 3 : Vercel custom domains (si front est sur Vercel)
- Résolution tenant : middleware checke `Host` header contre `tenant_domains`
  avant de tomber sur la résolution par `X-Tenant-Slug`
- UI dans `apps/app` -> `/settings/domain` :
  - "Ajouter votre domaine"
  - Instructions DNS générées (CNAME + TXT)
  - Statut vérification + SSL
  - Bouton "Vérifier maintenant"

Cible commerciale : cliniques établies sans équipe dev interne, professionnel
soucieux de son image de marque.

Avantages :

- Branding 100% client (URL, certificat, marque)
- SEO client préservé
- Cimolace garde le contrôle technique total

Limites :

- Complexité ops : SSL, DNS, validation
- Coût Cloudflare for SaaS si > N domaines

### Mode C — MEDOS Embedded

> Le client a déjà un site web actif (ex : ZahirWellness). Il intègre des
> morceaux de MEDOS dans son site existant sans casser quoi que ce soit.

Trois sous-options techniques, à offrir selon le niveau de compétence du client :

#### C.1 — Widget JS embeddable (recommandé en premier)

```html
<!-- sur zahirwellness.com -->
<div id="medos-portal"></div>
<script
  src="https://cdn.cimolace.com/medos/v1/embed.js"
  data-tenant="zahirwellness"
  data-mode="patient-portal"
  data-theme="light"
></script>
```

Composants techniques :

- Bundle JS publié sur CDN (Cloudflare Pages / Vercel Edge / S3+CloudFront)
- Le bundle mounte un composant React dans le `<div>` indiqué
- Auth : le bundle appelle `POST /v1/medos/embed-token` avec la clé publique
  tenant (depuis `data-tenant`), récupère un JWT court-vivant (15 min), s'en
  sert pour appeler l'API
- CORS strict : seuls les domaines whitelistés (`tenant_domains`) peuvent
  charger le widget
- Modes supportés (`data-mode`) :
  - `patient-portal` : portail patient complet
  - `appointment-booker` : prise de RDV uniquement
  - `consent-form` : formulaire de consentement
  - `health-tracker` : journal santé
  - `intake-form` : formulaire d'admission
- Personnalisation : `data-theme`, `data-locale`, `data-primary-color`

#### C.2 — Iframe signée (fallback robuste)

```html
<iframe
  src="https://embed.cimolace.com/medos/portal?tenant=zahirwellness&token=eyJhbGciOi..."
  width="100%"
  height="600"
  frameborder="0"
></iframe>
```

Quand l'utiliser :

- Le client a une CSP stricte qui bloque les scripts tiers
- Le client utilise un framework qui rentre en conflit avec notre bundle
  (Webflow, Squarespace, WordPress sans plugin)
- Le client veut une isolation maximale

Composants techniques :

- Route Next.js `apps/public-site/app/embed/[mode]/page.tsx`
- Token signé HMAC côté serveur client (via backend client ou via webhook
  Cimolace)
- `postMessage` pour redimensionnement dynamique et events (RDV pris, formulaire
  soumis)
- En-tête `Content-Security-Policy: frame-ancestors <domains tenant>` pour
  bloquer l'embed non-autorisé

#### C.3 — API REST publique + SDK (pour clients devs)

```
Authorization: Bearer cml_live_<api_key>
X-Tenant-Slug: zahirwellness
GET https://api.cimolace.com/v1/medos/patients
```

Quand l'utiliser :

- Le client a une équipe dev qui veut construire sa propre UI
- Le client veut intégrer MEDOS dans son propre back-office
- Le client a besoin de webhooks pour synchroniser avec son CRM/ERP

Composants techniques :

- Guard `ApiKeyGuard` qui valide la clé contre `tenant_api_keys` (SHA-256)
- Préfixe de clé visible (`mdk_zahir_`) + secret (`mdk_zahir_a1b2c3...`)
- Rate limiting par tenant (Redis token bucket)
- SDK officiel : `@cimolace/medos-sdk` (TS + Python)
- Webhooks sortants signés HMAC : `note.signed`, `appointment.created`,
  `patient.consented`, `prescription.issued`
- Documentation OpenAPI/Swagger publique

Cible commerciale Mode C : clients établis avec présence web (e-commerce,
contenu, services), comme ZahirWellness.

## Matrice de choix

| Critère client                | Mode A | Mode B | Mode C.1 | Mode C.2 | Mode C.3 |
| ----------------------------- | :----: | :----: | :------: | :------: | :------: |
| Pas de site                   |   ✅   |   ❌   |    ❌    |    ❌    |    ❌    |
| Domaine acheté mais sans site |   ⚠️   |   ✅   |    ❌    |    ❌    |    ❌    |
| Site existant simple          |   ❌   |   ⚠️   |    ✅    |    ✅    |    ⚠️    |
| Site existant avec dev        |   ❌   |   ❌   |    ⚠️    |    ⚠️    |    ✅    |
| CSP stricte / Webflow / Wix   |   ❌   |   ❌   |    ❌    |    ✅    |    ⚠️    |
| Branding fort sous son URL    |   ❌   |   ✅   |    ✅    |    ✅    |    ✅    |
| Cimolace garde la main UI     |   ✅   |   ✅   |    ✅    |    ✅    |    ❌    |
| Time-to-market < 1 jour       |   ✅   |   ⚠️   |    ✅    |    ✅    |    ❌    |

## Cas ZahirWellness

ZahirWellness est positionné dans `ZAHIR_TO_MBOLO_MIGRATION_STRATEGY.md` comme
pilote du moteur **Mbolo** (e-commerce). Pour MEDOS, le positionnement à
clarifier business :

- Si Zahir vend du bien-être (produit) -> Mbolo, pas MEDOS
- Si Zahir propose des consultations / soins / coaching -> MEDOS Mode C
- Si Zahir fait les deux -> activer Mbolo ET MEDOS sur le même tenant

Recommandation technique pour Zahir si MEDOS pertinent :

- Mode C.1 (widget patient-portal) sur une page non critique (`/mon-suivi`,
  `/espace-membre`)
- Phase shadow : 0 trafic réel pendant 1 semaine, validation auth/audit/RGPD
- Bascule progressive : feature flag par patient (10% -> 50% -> 100%)
- Toujours respecter les règles ZAHIR :
  - Ne pas toucher le site Zahir en ligne
  - Clone de travail séparé
  - Pas de copie mono-tenant
  - Pas de bascule brutale

## Règles non-négociables (héritées de Mbolo)

Tout agent travaillant sur l'intégration MEDOS doit respecter :

1. **Ne pas modifier un site client en ligne sans clone de travail séparé**
2. **Ne pas exposer MEDOS sans `tenant_id`, sans audit log, sans tests**
3. **Ne pas mélanger branding client et branding Cimolace**
4. **Ne pas lancer une intégration sans plan de rollback documenté**
5. **Ne pas activer Mode C sans avoir corrigé l'écriture de `medical_audit_log`
   (sinon RGPD bloqué)**
6. **Ne jamais retourner un JWT long-vivant côté navigateur — toujours
   échangé via clé API tenant côté serveur**

## Plan d'implémentation (résumé)

Détail dans `MEDOS_EMBEDDING_IMPLEMENTATION_PLAN.md`. Sprints :

- S0 — Pré-requis : audit log writer, seeds formulaires, fix bugs résiduels
- S1 — Mode C.3 (API + clés tenant) : ApiKeyGuard, embed-token endpoint, CORS
  dynamique
- S2 — Mode C.1 (widget JS) : bundle patient-portal, publication CDN, doc
  intégration
- S3 — Mode C.2 (iframe) : route embed, signing, postMessage
- S4 — Mode A (hébergé) : wildcard DNS, templates landing
- S5 — Mode B (domaine perso) : table tenant_domains, SSL automatique, UI
- S6 — Pilote Zahir : tenant staging, shadow mode, bascule progressive

## Liens

- `ZAHIR_TO_MBOLO_MIGRATION_STRATEGY.md` — pattern parallèle pour e-commerce
- `MEDOS_DELIVERY_PLAN.md` — phases backend MEDOS
- `MEDOS_INTEGRATION_AUDIT_FOR_CIMOLACE.md` — audit socle intégration
- `MEDOS_EMBEDDING_IMPLEMENTATION_PLAN.md` — plan technique détaillé (à venir)
