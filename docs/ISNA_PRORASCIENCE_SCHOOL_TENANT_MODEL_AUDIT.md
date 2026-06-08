# Audit ISNA / PRORASCIENCE comme modele tenant ecole

Date: 2026-05-21  
Portee: Cimolace backoffice, tenant ISNA/Prorascience, moteurs LIRI School, API Nest, frontend Vite/React.

## Resume de la conversation

- Le travail se fait maintenant depuis la racine du projet: `/Users/ngowazulu/Downloads/isna_platform_v2`.
- La page `/dev/liri-host-live` a ete lancee pour tester le studio live, puis on a clarifie que l'ecran de connexion vu etait celui du tenant ecole ISNA/LIRI, pas le SaaS Cimolace public.
- On a audite la relation entre Cimolace et ISNA/Prorascience: ISNA apparait comme client Cimolace, avec un app tenant ecole, un site, un contrat, des services actifs, des credentials references et une facturation.
- Le backoffice Cimolace a ete corrige pour que l'authentification et les pages clients fonctionnent sans doubles clients Supabase ni warnings React bloquants.
- Le test smoke Cimolace est passe et a capture les ecrans login, dashboard, clients, details client, services, credentials, operations et billing.
- La question restante est plus profonde: ISNA/Prorascience doit devenir le modele de reference pour creer les prochains tenants ecole dans Cimolace.

## Identite tenant ISNA constatee

Client Cimolace:

- Nom: `ISNA`
- Business name: `ISNA / PRORASCIENCE`
- Type client: `school`
- Plan: `platform`
- Statut: `active`
- Portal slug: `isna`
- Source: `consistency_migration`

Site:

- Nom: `ISNA Academy`
- Domaine: `prorascience.org`
- Sous-domaine: `isna`
- Plan: `platform`
- Statut: `active`
- Environnement: `production`
- Maintenance: `false`

Tenant applicatif:

- Slug: `isna`
- Statut: `active`
- Plan: `platform`
- Infrastructure type: `school`
- Billing status tenant: `unpaid`

Contrat:

- Type: `platform_subscription`
- Statut: `active`
- Debut: `2026-05-20`
- Duree minimale: 12 mois
- Conditions: reprise technique ISNA/PRORASCIENCE

## Moteurs actifs dans ISNA cote Cimolace

Le template officiel `school` active 6 moteurs:

| Moteur | Role |
| --- | --- |
| `liri_smartboard` | Tableau interactif augmente par IA |
| `liri_live` | Diffusion live interactive |
| `liri_replay` | Replay enrichi des sessions live |
| `marketing_creator` | Outils marketing/growth |
| `calendar` | Calendrier et planification |
| `course_builder` | Construction de formations |

Constat runtime: les 6 services sont actifs dans le control-plane ISNA.

## Capacites ecole deja codees cote frontend

Le module ecole generique existe dans `apps/app/src/modules/liri-school`. Il expose 12 moteurs/capacites:

| Capacite | Fichier |
| --- | --- |
| CourseEngine | `courses/courseEngine.js` |
| LessonEngine | `lessons/lessonEngine.js` |
| StudentEngine | `students/studentEngine.js` |
| TeacherEngine | `teachers/teacherEngine.js` |
| LiveEngine | `live/liveEngine.js` |
| SmartboardEngine | `smartboard/smartboardEngine.js` |
| StudioEngine | `studio/studioEngine.js` |
| ReplayEngine | `replay/replayEngine.js` |
| NeuroRecallEngine | `neuro-recall/neuroRecallEngine.js` |
| PaymentEngine | `payments/paymentEngine.js` |
| AdminEngine | `admin/adminEngine.js` |
| MarketingEngine | `marketing/marketingEngine.js` |

Incoherence importante: le backoffice declare seulement 6 moteurs actifs pour le template `school`, alors que le code ecole possede 12 capacites. Il faut donc normaliser:

- soit les 12 deviennent des moteurs facturables/activables dans Cimolace;
- soit les 6 moteurs restent les produits principaux et les 12 deviennent des sous-capacites visibles dans la fiche tenant.

## Catalogue Cimolace disponible

Le catalogue API est expose sous `/catalog`, pas `/cimolace-catalog`.

Routes catalogue:

- `GET /catalog/engines`
- `GET /catalog/templates`
- `GET /catalog/tenant-services`
- `POST /catalog/tenant-services`
- `POST /catalog/apply-template`

Categories de moteurs catalogue:

- IA: `liri_brain`, `liri_masterclass`, `liri_smartboard`, `liri_neuro_recall`
- Live/video: `liri_live`, `liri_replay`, `studio_creator`
- Paiement: `pay_engine`, `stripe_connect`, `cinetpay`
- Communication: `email_engine`, `sms_engine`, `whatsapp_engine`, `chat_engine`
- Contenu: `course_builder`, `forum`, `marketing_creator`
- Calendrier: `calendar`
- MedOS: `med_ehr`, `med_notes`, `med_prescriptions`, `med_forms`, `med_health`, `med_programs`, `med_charting`, `gdpr_engine`
- Mbolo: `mbolo_catalog`, `mbolo_cart`, `mbolo_orders`, `mbolo_inventory`, `mbolo_storefront`, `mbolo_admin`
- Infrastructure: `workflow_engine`, `webhook_engine`, `activity_stream`, `template_engine`, `notif_engine`

Templates existants:

- `school`
- `medos`
- `mbolo`
- `wellness`
- `creator`
- `temple`
- `community`

## APIs backend disponibles

Stack API: NestJS 11, Supabase, LiveKit, Stripe, Twilio, Swagger.

Domaines API presents dans `apps/api/src`:

- Auth: `/auth`
- Tenant: `/tenants`
- Cimolace backoffice: `/cimolace-backoffice`
- Catalogue moteurs: `/catalog`
- Billing: `/billing`, `/billing/webhook`
- Checkout: `/checkout`
- Live: `/lives`
- LiveKit webhook: `/webhooks/livekit`
- LIRI Brain: `/liri/brain`
- Smartboard: `/smartboard`
- Studio: `/studio`
- Replay: `/replay`
- Course Builder: `/course-builder`
- Courses: `/courses`
- Neuro Recall: `/neuro-recall`
- Masterclass Factory: `/masterclass-factory`
- Marketing: `/marketing`
- Booking: `/booking`
- Secretariat: `/secretariat`
- Forum: `/forum`
- Messaging: `/messaging`
- Notifications: `/notifications`
- Chat Engine: `/chat-engine`
- Email Engine: `/email-engine`
- SMS Engine: `/sms-engine`
- Pay Engine: `/pay-engine`
- Video Engine: `/video-engine`
- AI Worker: `/ai-worker`
- IRI pages: `/iri`
- Longia: `/longia`
- Multilang: `/multilang`
- Mbolo: `/mbolo`
- MedOS: `/med/*`

## Technologies frontend disponibles

Stack app: Vite 6, React 19, React Router 7, Supabase JS, LiveKit React, Stripe JS, TanStack Query, Zustand, Framer Motion, Radix UI, Tailwind, Lucide, Three.js/React Three Fiber, Konva/React Konva, TipTap, FullCalendar, Recharts, PDF/PPT/XLSX tooling.

Technologies utiles pour le modele ecole:

- Auth/session: Supabase Auth
- Tenant context: guards + memberships
- Live classes: LiveKit
- Studio/live/replay: LiveKit, Supabase storage, video engine local/Mux/Cloudflare selon config
- IA pedagogique: DeepSeek, OpenAI, Anthropic possibles
- Smartboard: Konva, React Konva, IA generation
- Calendrier: FullCalendar
- Paiements: Stripe, Chariow, CinetPay, PawaPay possibles
- Documents/exports: PDF, PPTX, XLSX

## Providers et credentials observes

References tenant ISNA configurees:

- `supabase_project_ref`: reference infrastructure Supabase du tenant
- `google_oauth_provider`: provider Google Auth reference
- `live_studio_provider`: provider live/studio reference

Diagnostic local:

- Supabase: configure
- LiveKit: configure
- Stripe: configure
- DeepSeek: configure
- Google OAuth: reference, mais preuve locale env absente
- OpenAI: non configure localement
- Anthropic: non configure localement
- Groq: non configure localement
- CinetPay: non configure localement
- Chariow: non configure localement
- PawaPay: non configure localement
- Mux: non configure localement
- Cloudflare Stream: present dans le code, statut non prouve dans le diagnostic ISNA

## Facturation ISNA vers Cimolace

Etat constate:

- Subscription Cimolace active: plan `platform`, montant 0 XOF, periode 2026-05-20 -> 2027-05-20.
- Subscription applicative active: provider `chariow`, plan `platform`, montant 0 XOF.
- Invoice applicative payee: `ISNA-PLATFORM-2026-INIT`, 0 XOF.
- Invoice Cimolace pending: `ISNA-MANUAL-2026-05-21`, 0 XOF.
- Billing profiles: vide.
- Payments: vide.

Incoherence: le tenant applicatif a `billing_status = unpaid`, mais les diagnostics passent parce que les subscriptions sont actives et les impayes positifs sont absents. Pour un modele ecole propre, il faut aligner le statut billing tenant avec la realite contractuelle.

## Gestion ISNA depuis Cimolace

Backoffice expose:

- Stats globales
- Liste/creation/mise a jour clients
- Control-plane client
- Diagnostics client
- Operations tenant
- Activation/desactivation services
- References credentials
- Rotation credentials
- Tickets
- Invoices
- Sites

Ce qui est deja gerable:

- Services actifs/inactifs
- Maintenance
- Credentials references
- Tickets support
- Invoices
- Sites rattaches
- Diagnostics readiness

Ce qui manque pour une gestion complete:

- Vue detaillee des sous-capacites ecole, pas seulement 6 moteurs globaux.
- Quotas/limites par moteur: lives/mois, stockage replay, IA tokens, apprenants, enseignants, cours.
- Usage logs exploitables: aujourd'hui vide.
- Deploiements/status technique: aujourd'hui `lastDeployment = null`.
- Billing profiles et payments reels.
- Statut onboarding paiement pour l'ecole, notamment Stripe Connect/mobile money.
- Preuve Google OAuth reliee au projet Supabase.
- Journal de health-check par provider: Supabase, LiveKit, AI, paiement, storage, email/SMS.
- Template de provisioning complet pour creer une nouvelle ecole depuis ISNA.
- Checklist de configuration vide: les etapes de setup doivent etre seed ou calculees.
- Clarification table tickets: certaines methodes backoffice parlent de `cimolace_support_tickets` alors que les migrations recentes gerent `cimolace_tickets`.

## Modele ecole propose

Le modele ecole Cimolace doit etre structure en 3 couches:

### 1. Moteurs produits facturables

- `school_core`: admin, students, teachers, courses, lessons
- `liri_live`: live interactif
- `liri_replay`: replay et recordings
- `liri_smartboard`: smartboard IA
- `course_builder`: pipelines de creation de cours
- `studio_creator`: studio preparation et production
- `liri_neuro_recall`: memorisation et revision
- `marketing_creator`: growth, popups, banners, promo
- `calendar`: calendrier et rendez-vous
- `pay_engine`: inscriptions, abonnements, paiements
- `communication_pack`: email, SMS, chat, notifications

### 2. Sous-capacites visibles par tenant

- Apprenants
- Enseignants
- Formations
- Lecons
- Live host
- Live participant
- Replay
- Studio
- Smartboard
- Neuro Recall
- Marketing
- Paiement
- Admin ecole

### 3. Providers et preuves

- Supabase project ref
- Supabase auth providers actifs
- LiveKit project
- Storage bucket recordings
- IA providers actifs
- Payment providers actifs
- Email/SMS providers actifs
- Domaine public
- Domaine application

## Priorites pour rendre ISNA pret a cloner

1. Aligner le template `school` avec les vraies capacites ecole.
2. Ajouter une vue backoffice "Modele ecole" qui montre moteurs, sous-capacites, quotas, providers, billing, maintenance.
3. Seed les configuration steps ISNA pour transformer le diagnostic en checklist exploitable.
4. Corriger l'incoherence billing `unpaid` vs subscription active.
5. Ajouter les preuves OAuth Google et providers paiement/mobile money.
6. Ajouter un historique deploy/health/usage par moteur.
7. Transformer ISNA en template de provisioning: nouveau tenant, site, services, credentials references, checklist, billing baseline.

## Mise en oeuvre du 2026-05-21

Premiere couche livree:

- Le template catalogue `school` active maintenant 11 moteurs recommandes: les 6 moteurs ISNA actuels + `studio_creator`, `liri_neuro_recall`, `pay_engine`, `chat_engine`, `notif_engine`.
- Le control-plane Cimolace expose maintenant `schoolModel` pour les tenants ecole.
- La fiche client Cimolace a un onglet `Modèle école`.
- Le diagnostic Cimolace contient un check `school_model` qui distingue:
  - la base ISNA actuelle: 6/6 actifs;
  - le modele ecole clonable recommande: 6/11 actifs;
  - les capacites metier couvertes: 8/12.
- Le modele ecole suit aussi la readiness branding: logo, domaine, couleurs primaire/secondaire/accent et metadata de zones de marque.

Etat ISNA apres patch:

- Base actuelle: `6/6`.
- Modele recommande: `6/11`.
- Capacites metier: `8/12`.
- Moteurs recommandes manquants: `studio_creator`, `liri_neuro_recall`, `pay_engine`, `chat_engine`, `notif_engine`.

Branding configurable prevu:

- `logo_url`
- `primary_domain`
- `brand_colors.primary`
- `brand_colors.secondary`
- `brand_colors.accent`
- `metadata.branding` pour les zones de marque: nom court, nom complet, favicon, contact vitrine, assets et informations d'affichage.

Attention: la base existe cote DB/API, mais plusieurs pages publiques utilisent encore `tenants/isna/tenant.config.js` et des couleurs ISNA en dur. La prochaine etape sera de brancher ces pages sur la configuration tenant runtime pour que le futur tenant ecole change completement de charte sans modifier le code.

Verification:

- Test catalogue: `17/17` passe.
- Build API: passe.
- Build app: passe.
- Smoke Cimolace: passe, captures dans `/private/tmp/cimolace-ui-smoke`.

## Mise en oeuvre du 2026-05-22 — School Engine Manifest

Deuxieme couche livree:

- Ajout d'un manifeste produit ecole dans `apps/api/src/cimolace-backoffice/school-engine-manifest.ts`.
- Le manifeste devient la source lisible pour le pack ecole ISNA/Prorascience:
  - `core`: moteurs obligatoires du socle ecole ;
  - `recommended`: moteurs recommandes pour livrer une ecole complete ;
  - `addon`: moteurs disponibles mais non actives automatiquement.
- Le control-plane Cimolace expose maintenant les informations produit de chaque moteur:
  - label produit ;
  - categorie ;
  - role fonctionnel ;
  - routes principales ;
  - providers requis ;
  - zones branding concernees ;
  - shell system/design ;
  - statut readiness.
- Endpoint ajoute: `GET /cimolace-backoffice/school-model/manifest`.
- L'onglet `Modele ecole` de la fiche client affiche maintenant le shell, les providers et les zones branding de chaque moteur.

Moteurs du pack automatique actuel:

| Tier | Moteurs |
| --- | --- |
| Core | `calendar`, `course_builder`, `liri_live`, `liri_replay`, `liri_smartboard`, `marketing_creator` |
| Recommended | `studio_creator`, `liri_neuro_recall`, `pay_engine`, `chat_engine`, `notif_engine` |
| Addon | `liri_masterclass` |

Lecture produit:

- Le tenant ecole peut deja etre cree et recevoir les 11 moteurs du pack.
- `liri_masterclass` est documente comme addon disponible, pas encore active automatiquement.
- Les moteurs les plus avances (`SmartBoard Designer`, `Studio Creator`, `Arena immersive`, `Replay/Postproduction`) existent, mais demandent encore un shell tenantise complet et des quotas/providers prouvables pour etre consideres comme "produit fini".

## Mise en oeuvre du 2026-05-22 — School Shell Design System runtime

Troisieme couche livree:

- Ajout de `apps/app/src/lib/tenant/schoolShellTheme.js`.
- `useTenantBranding()` expose maintenant `shellTheme` et les variables CSS `--school-*`.
- `StudioDesignerLikeShell` consomme le branding runtime du tenant:
  - logo tenant dans la top bar ;
  - nom du tenant visible dans la coque moteur ;
  - variables CSS `--school-primary`, `--school-secondary`, `--school-accent`, `--school-background` ;
  - fond/grille de shell derive des couleurs tenant ;
  - attribut `data-school-shell="studio-designer"` pour reperer les pages branchees.

Portee actuelle:

- Les pages qui utilisent `StudioDesignerLikeShell` commencent a recevoir le shell tenantise.
- Cela couvre la premiere famille de moteurs creatifs: hub LIRI, builders studio, smartboard/design selon les routes deja branchees a cette coque.
- Les pages historiques qui importent encore `isnaTenantConfig` doivent etre migrees progressivement vers `useTenantBranding()` ou vers le shell commun.

## Mise en oeuvre du 2026-05-22 — Extension shell moteurs ecole

Quatrieme couche livree:

- `Smartboard Designer` consomme maintenant `useTenantBranding()` au niveau racine:
  - variables CSS tenant injectees ;
  - fond du canvas derive du `shellTheme` ;
  - attribut `data-school-shell="smartboard-designer"`.
- `Post-production Dock` consomme maintenant le meme shell runtime:
  - panneau principal aligne sur `--school-shell-panel` ;
  - zone de travail derivee du `shellTheme.gridBackground` ;
  - attribut `data-school-shell="post-production-dock"`.
- `Masterclass Factory` consomme maintenant la marque tenant:
  - fond global configurable ;
  - top bar derivee du theme tenant ;
  - nom du tenant affiche dans le sous-titre ;
  - attribut `data-school-shell="masterclass-factory"`.
- `LiveRoom / Arena LIRI` recoit maintenant les variables `--school-*` via `LiveHostLiveSessionChrome`:
  - fond principal derive du tenant ;
  - grille/theme injectes au niveau racine ;
  - attribut `data-school-shell="liri-live-room"`.

Etat shell runtime apres cette passe:

| Moteur | Etat |
| --- | --- |
| Studio Creator / Hub LIRI | Runtime branding branche via `StudioDesignerLikeShell` |
| Smartboard Designer | Runtime branding branche au shell racine |
| Postproduction | Runtime branding branche au dock designer |
| Masterclass Factory | Runtime branding branche au shell racine |
| Arena / LiveRoom immersive | Runtime branding branche au chrome live |

Reste a faire:

- Remplacer progressivement les couleurs hardcodees `#D4AF37` dans les composants internes par des classes/variables tenant.
- Ajouter dans Cimolace un editeur visuel complet des zones branding: logo, favicon, couleurs, typographie, header, footer, studio, live, admin.
- Ajouter une vue de preuve par moteur: route active, provider configure, quota, statut maintenance, dernier healthcheck.
- Relier les switches moteur Cimolace a la navigation/autorisation UI pour masquer ou verrouiller un moteur desactive.

Verification:

- Build app: passe.

## Mise en oeuvre du 2026-05-26 — Readiness production et gouvernance owner

Couche livraison tenant livree:

- ISNA/Prorascience est maintenant traite comme premier tenant modele ecole dans Cimolace.
- Le provisioning ecole depuis le modele cree et verifie un tenant complet avec 11 moteurs:
  - `calendar`
  - `course_builder`
  - `liri_live`
  - `liri_replay`
  - `liri_smartboard`
  - `marketing_creator`
  - `studio_creator`
  - `liri_neuro_recall`
  - `pay_engine`
  - `chat_engine`
  - `notif_engine`
- Le script E2E `scripts/cimolace-provision-school-e2e.mjs` archive automatiquement le tenant de recette apres verification, sauf option `--keep`.
- Le formulaire Cimolace de provisioning accepte maintenant une charte configurable:
  - police UI ;
  - rayon UI ;
  - zones branding `header`, `footer`, `publicVitrine`, `memberApp`, `liveStudio`, `adminBackoffice`.
- La fiche client Cimolace expose une commande `Preparer owner`:
  - si l'utilisateur Supabase Auth existe, creation/upsert d'un membership `owner` actif ;
  - sinon creation d'une invitation `owner` et tentative d'enqueue email.
- Le diagnostic `Roles ecole` verifie maintenant la gouvernance minimale:
  - `owner` obligatoire ;
  - `admin`, `teacher`, `secretariat`, `student` recommandes selon la livraison.

Readiness production ajoutee:

- Cimolace peut enregistrer des attestations operateur non secretes dans `tenants.metadata.production_readiness`.
- Cles d'attestation actuelles:
  - `domain_dns`
  - `domain_ssl`
  - `google_oauth`
  - `checkout`
  - `email_delivery`
  - `sms_delivery`
- Les diagnostics domaine, Google OAuth, checkout et email/SMS tiennent compte de ces attestations.
- L'onglet `Diagnostic` affiche des actions rapides:
  - `Attester DNS domaine`
  - `Attester SSL domaine`
  - `Attester OAuth Google`
  - `Attester Checkout ecole`
  - `Attester Email`
  - `Attester SMS`

Pourquoi cette couche est importante:

- Cimolace ne doit pas stocker les secrets OAuth, DNS, paiement ou email en clair pour prouver la livraison.
- En production, plusieurs preuves vivent hors de l'API locale: console DNS, Supabase Auth, Stripe/CinetPay/Chariow, provider email/SMS.
- L'attestation donne donc une preuve auditable sans inventer une configuration que le backend ne peut pas lire.

Verification:

- Test unitaire Cimolace: `28/28` passe.
- Build API: passe.
- Build app: passe.
- Smoke Cimolace durci: passe.
- Captures smoke: `/private/tmp/cimolace-ui-smoke`.

Etat actuel du modele:

- Le modele multi-tenant ecole est operationnel pour creer un nouveau tenant sur la base ISNA/Prorascience.
- Le backoffice Cimolace sait voir les moteurs, providers, quotas, branding, billing, roles, maintenance, diagnostics et attestations prod.
- Ce qui reste non automatique: verification DNS/SSL reelle, configuration OAuth Google cote Supabase/Google, test paiement sandbox/reel, test email/SMS provider, upload d'assets au lieu d'URL texte, et enforcement complet des switches moteurs dans toutes les routes UI.

## Mise en oeuvre du 2026-05-22 — Couverture moteur visible dans Cimolace

Couche control plane livree:

- Le backend `buildSchoolModel()` calcule maintenant une couverture operationnelle pour chaque moteur ecole.
- Chaque moteur expose un score et des checks:
  - moteur actif ;
  - shell/design system ;
  - providers/API ;
  - branding ;
  - quotas ;
  - facturation.
- Les blocages sont remontes sous forme exploitable:
  - `moteur_inactif` ;
  - `shell_design_a_finaliser` ;
  - `provider_a_configurer` ;
  - `quota_a_definir` ;
  - `facturation_a_lier` ;
  - `branding_a_completer`.
- La fiche client Cimolace affiche maintenant cette couverture dans l'onglet `Modèle école`, directement dans la table des moteurs.
- La cellule de couverture montre:
  - score `% prêt` ;
  - mini-checks Moteur / Shell / API / Branding / Quotas / Billing ;
  - zones de branding couvertes ;
  - premiers blocages restants.

Impact:

- Cimolace ne dit plus seulement "moteur actif"; il montre si le moteur est réellement livrable pour un prochain tenant ecole.
- On peut distinguer un moteur fonctionnel mais non facturable, un moteur actif mais sans quotas, ou un moteur présent mais sans provider/API.
- ISNA/Prorascience devient un vrai modèle de préparation tenant, pas seulement une école codée dans l'application.

Verification:

- Build API: passe.
- Build app: passe.

## Mise en oeuvre du 2026-05-22 — Action appliquer les quotas recommandes

Couche actionnable livree:

- Ajout de l'endpoint backoffice:
  - `POST /cimolace-backoffice/clients/:clientId/school-model/apply-quotas`
- L'action applique les quotas recommandes de la matrice `SCHOOL_ENGINE_OPERATIONS`.
- Elle n'ecrase pas les quotas deja definis par defaut.
- Pour chaque moteur mis a jour, elle renseigne:
  - `quota_limit` ;
  - `quota_used` si absent ;
  - `config.quota_unit` ;
  - `config.billing_meter` ;
  - `config.quota_source = school_model_recommended`.
- L'action journalise:
  - moteurs modifies ;
  - moteurs ignores ;
  - mode overwrite.
- Dans Cimolace, l'onglet `Modèle école` affiche maintenant:
  - bouton `Appliquer quotas` ;
  - alerte quand des moteurs n'ont pas encore de quota.

Impact:

- Un operateur Cimolace peut corriger un blocage quota sans aller en base.
- Le modele ISNA devient plus proche d'un template exploitable pour provisionner plusieurs ecoles.
- La facturation peut s'appuyer sur des compteurs billing stables.

Verification:

- Build API: passe.
- Build app: passe.

## Mise en oeuvre du 2026-05-22 — Action preparer les providers/API

Couche actionnable livree:

- Ajout de l'endpoint backoffice:
  - `POST /cimolace-backoffice/clients/:clientId/school-model/prepare-providers`
- L'action inspecte les providers requis par les moteurs du modele ecole.
- Pour chaque provider manquant, Cimolace prepare une reference dans `cimolace_credentials`.
- Les providers couverts par cette passe:
  - Supabase ;
  - Supabase Realtime ;
  - LiveKit ;
  - IA ;
  - paiement ;
  - video/storage ;
  - marketing optionnel ;
  - email/SMS optionnel.
- L'action ne stocke pas de secret en clair: elle cree des references operationnelles a completer ou synchroniser.
- Chaque reference indique les moteurs concernes pour savoir pourquoi le provider est necessaire.
- L'action journalise:
  - providers prepares ;
  - providers ignores ;
  - contexte tenant/site.
- Dans Cimolace, l'onglet `Modèle école` affiche maintenant:
  - bouton `Préparer providers` ;
  - bouton `Synchroniser providers` pour inclure aussi les providers deja configures ;
  - alerte quand des moteurs ont des API/providers manquants.

Impact:

- Cimolace commence a gerer la partie infrastructure/API du tenant ecole, pas seulement les pages et les couleurs.
- Un prochain tenant ecole peut recevoir une checklist provider exploitable depuis le backoffice.
- ISNA/Prorascience devient un modele d'infrastructure ecole plus concret: moteurs, quotas, providers et billing commencent a etre relies.

Reste a faire:

- Ajouter une fiche provider detaillee: statut, secret manquant, dernier test, dernier incident, moteur consommateur.
- Brancher les tests de health-check reels par provider au lieu de se limiter aux preuves d'environnement.

Verification:

- Build API: passe.
- Build app: passe.

## Mise en oeuvre du 2026-05-22 — Matrice providers ecole exploitable

Couche preuve livree:

- Le control plane expose maintenant `schoolProviders`.
- Chaque provider ecole est relie a:
  - sa reference Cimolace attendue ;
  - son type de credential ;
  - les moteurs consommateurs ;
  - les preuves d'environnement disponibles ;
  - les blocages restants.
- Les statuts provider sont normalises:
  - `ready`: reference Cimolace presente et provider detecte dans l'environnement ;
  - `partial`: reference ou preuve partielle seulement ;
  - `missing`: reference et preuve absentes.
- Les diagnostics retournent aussi cette matrice via `schoolProviders`.
- Dans Cimolace, la matrice est visible dans:
  - `Diagnostic` ;
  - `API & secrets`.
- L'operateur peut lancer depuis cette matrice:
  - `Préparer manquants` ;
  - `Synchroniser tout`.

Impact:

- Cimolace peut enfin voir pourquoi un provider existe: quels moteurs l'utilisent.
- Les providers ne sont plus seulement des variables `.env`; ils deviennent des objets de pilotage tenant.
- Le modele ISNA/Prorascience devient plus proche d'un template ecole auditable avant clonage.

Reste a faire:

- Ajouter une fiche detaillee par provider avec historique, incidents et dernier health-check.
- Remplacer les preuves d'environnement par de vrais tests de connexion provider quand c'est possible.
- Ajouter une action de ticket automatique quand un provider critique reste `missing`.

Verification:

- Build API: passe.
- Build app: passe.

## Mise en oeuvre du 2026-05-22 — Matrice providers, quotas et billing

Couche exploitation livree:

- Ajout d'une matrice operationnelle `SCHOOL_ENGINE_OPERATIONS`.
- Chaque moteur ecole possede maintenant:
  - providers attendus ;
  - quota par defaut recommande ;
  - unite de quota ;
  - compteur billing cible.
- Les providers sont controles avec des preuves d'environnement:
  - Supabase ;
  - Supabase Realtime ;
  - LiveKit ;
  - IA ;
  - paiement ;
  - video/storage ;
  - marketing optionnel ;
  - email/SMS optionnel.
- La couverture moteur affiche maintenant:
  - nombre d'API configurees ;
  - quota actuel ;
  - quota recommande ;
  - unite ;
  - compteur billing ;
  - abonnement actif ou manquant.

Impact:

- Cimolace peut commencer a piloter les moteurs comme des produits facturables, pas seulement comme des pages.
- Les trous providers/quotas/billing deviennent visibles par moteur.
- Le prochain chantier peut brancher les actions automatiques: appliquer quotas recommandes, ouvrir configuration provider, rattacher un pack.

Verification:

- Build API: passe.
- Build app: passe.

## Mise en oeuvre du 2026-05-22 — Marketing Creator tenantise

Couche complementaire livree:

- `StudioAdCreatorPage` consomme maintenant `useTenantBranding()`.
- Le moteur marketing expose `data-school-shell="marketing-creator"` et `data-tenant-brand`.
- Le shell marketing recoit les variables `--school-*`:
  - fond tenant ;
  - police tenant ;
  - accent tenant.
- Les zones visibles du moteur marketing commencent a consommer `--school-accent`:
  - header ;
  - onglets ;
  - badges ;
  - etapes ;
  - objectifs ;
  - sources ;
  - selection de modules ;
  - champs focus ;
  - CTA de generation/sauvegarde ;
  - canaux publicitaires ;
  - historique/etat vide.

Impact:

- Le moteur `marketing_creator` peut maintenant etre active pour un tenant ecole sans imposer la charte ISNA.
- Le modele ecole couvre mieux la chaine complete: creation pedagogique, live, replay/postproduction et acquisition marketing.

Reste a faire:

- Remonter les quotas/providers marketing dans Cimolace par tenant.
- Ajouter un statut de configuration par canal: Meta, TikTok, YouTube/Google Ads, GA4.
- Relier le moteur aux packs/facturation pour limiter les publications, generations IA et canaux actifs.

Verification:

- Build app: passe.

## Mise en oeuvre du 2026-05-22 — Hubs cours, debat et formation tenantises

Couche complementaire livree:

- `StudioCourseLabPage` consomme maintenant `useTenantBranding()`.
- Le hub cours expose `data-school-shell="studio-course-lab"` et `data-tenant-brand`.
- Les accents fixes du hub cours ont ete remplaces par `--school-accent`.
- `StudioDebateBuilderPage` consomme maintenant `useTenantBranding()`.
- `StudioDebateDetailPage` consomme maintenant `useTenantBranding()`.
- Les pages DebateCore exposent:
  - `data-school-shell="debate-builder"` ;
  - `data-school-shell="debate-detail"`.
- Le loader `StudioFormationPage` expose `data-school-shell="formation-builder"` et consomme les tokens tenant.

Impact:

- Le template ecole couvre mieux les surfaces de creation pedagogique hors live: cours, debat, formation.
- Les prochains tenants peuvent reprendre le modele fonctionnel ISNA sans heriter automatiquement du fond/couleur ISNA sur ces hubs.

Verification:

- Build app: passe.

## Mise en oeuvre du 2026-05-22 — Hub Live Lab et Smartboard Script tenantises

Couche complementaire livree:

- `StudioLiveLabPage` consomme maintenant `useTenantBranding()`.
- Le hub expose `data-school-shell="studio-live-lab"` et `data-tenant-brand`.
- Le hub Live Lab recoit les variables `--school-*`:
  - fond tenant ;
  - police tenant ;
  - accent tenant.
- Les accents fixes du hub ont ete remplaces par `--school-accent`.
- Dans Smartboard Designer:
  - `CanvasModeTabs` utilise `--school-accent` pour le mode actif ;
  - `ScriptCanvasView` utilise `--school-accent` pour le bloc script principal et les indices de points cles.

Impact:

- Le parcours studio live est plus coherent pour un nouveau tenant: hub, preparation, salle immersive et Smartboard commencent a partager la meme charte.
- La personnalisation du template ecole ne s'arrete plus au chrome global; elle descend progressivement dans les outils d'edition.

Verification:

- Build app: passe.

## Mise en oeuvre du 2026-05-22 — Live Arena immersive tenantisee

Nouvelle couche livree:

- `LiveArenaPage` consomme maintenant `useTenantBranding()`.
- La salle live expose `data-school-shell="live-arena"` et `data-tenant-brand`.
- Les ecrans de phase exposent `data-school-shell="live-arena-phase"`:
  - chargement ;
  - connexion ;
  - erreur ;
  - session terminee.
- Le shell Arena recoit les variables `--school-*`:
  - fond tenant ;
  - police tenant ;
  - accent tenant.
- Les accents visibles encore fixes dans cette page ont ete remplaces par `--school-accent`:
  - logo/wordmark de chargement ;
  - cercle de connexion ;
  - bouton code mobile LIRI ;
  - boutons retour / directs / accueil ;
  - avatar salle d'attente ;
  - action "auditeur seulement".

Impact:

- Le moteur `liri_live` / Arena immersive peut maintenant porter l'identite visuelle d'un tenant cree depuis Cimolace.
- Le parcours live est couvert de bout en bout avec la preparation, les phases de connexion et la salle immersive.
- ISNA/Prorascience reste le modele fonctionnel, mais le branding n'est plus impose aux prochains tenants ecole.

Reste a faire:

- Etendre les tokens tenant aux sous-composants profonds de `LiveRoomShell`.
- Ajouter dans Cimolace une vue "couverture branding" par moteur.
- Lier cette couverture aux moteurs actives du tenant et aux packs factures.

Verification:

- Build app: passe.

## Mise en oeuvre du 2026-05-22 — Live Preparation Studio tenantise

Dixieme couche livree:

- `LivePreparationStudioPage` consomme maintenant `useTenantBranding()`.
- La page expose `data-school-shell="live-preparation"` et `data-tenant-brand`.
- Le shell de preparation recoit les variables `--school-*`:
  - fond tenant ;
  - police tenant ;
  - accent tenant.
- Les surfaces principales sont migrees vers `--school-accent`:
  - creation de brouillon ;
  - navigation de sortie ;
  - menu des etapes ;
  - indicateur de sous-ecran ;
  - bloc LIRI audio scenes ;
  - champs et controles LIRI ;
  - launcher script ;
  - historique / resumes IA ;
  - modal script.

Impact:

- Le moteur `liri_live` n'est plus limite a une preparation visuellement ISNA.
- Le template ecole peut maintenant proposer un cockpit de production live plus reutilisable pour les prochains tenants.

Verification:

- Build app: passe.

## Mise en oeuvre du 2026-05-22 — Postproduction Live tenantisee

Neuvieme couche livree:

- `LivePostIntelligencePage` consomme maintenant `useTenantBranding()`.
- La page expose:
  - `data-school-shell="live-post-intelligence"` en vue studio ;
  - `data-school-shell="liri-mobile-postproduction"` en vue mobile LIRI.
- Le shell post-live recoit les variables `--school-*`:
  - fond tenant ;
  - police tenant ;
  - accent tenant ;
  - top bar derivee du `schoolShellTheme`.
- Les accents internes de la page postproduction ont ete migres vers `--school-accent`:
  - sections accordéon ;
  - boutons de replay/export ;
  - notes autosave ;
  - avatars chat/participants ;
  - bloc résumé IA ;
  - liens post-production ;
  - flashcards NeuroRecall ;
  - rapports NeuroRecall ;
  - mindmap.

Impact:

- Le moteur `liri_replay` / postproduction n'est plus visuellement bloque sur ISNA.
- Un prochain tenant ecole peut exploiter la postproduction, les rapports IA et NeuroRecall avec sa propre charte configuree depuis Cimolace.

Verification:

- Build app: passe.

## Mise en oeuvre du 2026-05-22 — Studio Live Immersive tenantise

Huitieme couche livree:

- `StudioLiveImmersivePage` consomme maintenant `useTenantBranding()`.
- La page expose `data-school-shell="studio-live-immersive"` et `data-tenant-brand`.
- Le shell recoit les variables `--school-*`:
  - fond tenant ;
  - police tenant ;
  - accent tenant.
- Les controles visibles du moteur audio scenes utilisent maintenant `--school-accent` pour:
  - focus d'input ;
  - bordure du panneau LIRI audio ;
  - icone du panneau.
- Le rayon du panneau audio consomme `--school-radius`.

Impact:

- Le moteur Arena/LiveRoom immersive gagne une deuxieme surface tenantisee, en plus du chrome host live.
- Un tenant ecole cree depuis le modele ISNA peut avoir une identite propre dans la preparation immersive, pas seulement dans la salle live.

Verification:

- Build app: passe.

## Mise en oeuvre du 2026-05-22 — Course Builder Pro tenantise

Septieme couche livree:

- `StudioCourseBuilderProPage` consomme maintenant `useTenantBranding()`.
- La page expose `data-school-shell="course-builder"` et `data-tenant-brand`.
- Le shell Course Builder recoit les variables `--school-*`:
  - fond tenant ;
  - police tenant ;
  - accent tenant ;
  - top bar derivee du `schoolShellTheme`.
- Les composants internes du Course Builder commencent a sortir du hardcode ISNA:
  - `CourseTreePanel` utilise `--school-accent` pour l'element actif ;
  - `SegmentEditor` utilise `--school-accent` pour icones, focus et actions IA ;
  - `SubchapterEditor` utilise `--school-accent` pour icones et focus ;
  - les CTA principaux de generation/envoi utilisent l'accent tenant.

Impact:

- Le moteur `course_builder` devient reutilisable pour un prochain tenant ecole sans garder l'or ISNA comme couleur d'interface.
- Le modele ISNA sert mieux de template: le moteur conserve la structure pedagogique, mais l'identite visuelle peut venir de Cimolace.

Reste a faire:

- Continuer la migration des couleurs hardcodees dans les autres moteurs studio/live/postproduction.
- Separar les presets pedagogiques volontaires, par exemple une palette "Or", des couleurs de branding tenant.
- Ajouter un controle Cimolace qui liste, moteur par moteur, le pourcentage de couverture design system.

Verification:

- Build app: passe.

## Mise en oeuvre du 2026-05-22 — Editeur design system tenant dans Cimolace

Cinquieme couche livree:

- La fiche client Cimolace possede maintenant un editeur branding plus exploitable:
  - nom court ;
  - nom complet ;
  - logo ;
  - favicon ;
  - domaine canonique ;
  - origine site public ;
  - email vitrine ;
  - couleurs primaire, secondaire, accent ;
  - fond shell ;
  - police UI ;
  - rayon UI ;
  - zones de marque sous forme d'interrupteurs.
- Les zones configurables sont exposees explicitement:
  - `header` ;
  - `footer` ;
  - `publicVitrine` ;
  - `memberApp` ;
  - `liveStudio` ;
  - `adminBackoffice`.
- Un aperçu local du shell tenant a ete ajoute dans le formulaire pour verifier rapidement logo, couleurs, domaine, police et rayon.
- Le backend `updateAppTenantBranding` accepte et persiste maintenant `design_system` dans `metadata.branding.designSystem`.
- Le runtime tenant lit `metadata.branding.designSystem` via `normalizeTenantBranding()`.
- `schoolShellTheme` expose maintenant:
  - `--school-font-family` ;
  - `--school-radius`.

Ce que cela debloque:

- Cimolace peut commencer a piloter la charte graphique d'un tenant ecole sans modification de code.
- Les prochains tenants crees depuis le modele ISNA peuvent recevoir une identite visuelle propre.
- Les moteurs deja branches au shell runtime peuvent consommer progressivement ces tokens.

Reste a faire:

- Faire consommer `--school-font-family` et `--school-radius` dans tous les composants internes, pas seulement au niveau shell.
- Ajouter upload d'assets dans Storage au lieu d'une simple URL texte.
- Ajouter validation d'URL/logo/favicon et preview d'erreur image.
- Ajouter un rapport "moteurs couverts par le design system" dans Cimolace.

Verification:

- Build API: passe.
- Build app: passe.

## Mise en oeuvre du 2026-05-22 — Consommation des tokens UI

Sixieme couche livree:

- Les shells moteurs consomment maintenant `--school-font-family`.
- Les controles visibles des shells commencent a consommer `--school-radius`.
- Moteurs couverts par cette passe:
  - `StudioDesignerLikeShell` ;
  - `Smartboard Designer` ;
  - `Post-production Dock` ;
  - `Masterclass Factory` ;
  - `LiveRoom / Arena immersive`.

Impact:

- Une police configuree dans Cimolace peut commencer a se propager aux moteurs principaux.
- Un rayon UI configure dans Cimolace commence a modifier les controles du shell.
- Le design system n'est plus seulement stocke dans `metadata.branding.designSystem`; il est utilise dans l'interface.

Reste a faire:

- Etendre `--school-radius` aux composants internes profonds: cards, panels, modales, menus.
- Remplacer les couleurs internes hardcodees par `--school-accent`, `--school-primary`, `--school-secondary`.
- Ajouter une page de verification visuelle par moteur depuis Cimolace.

Verification:

- Build app: passe.
