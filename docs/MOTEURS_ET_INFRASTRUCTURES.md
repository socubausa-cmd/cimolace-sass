# Moteurs vs Infrastructures — référence canonique

> Clarifie la différence entre **un moteur** (la techno) et **une infrastructure** (le produit prêt à l'emploi).
> Source de vérité : `apps/api/src/cimolace-catalog/cimolace-catalog.service.ts` (exposé par `GET /catalog`).
> Dernière mise à jour : 2026-06-14.

---

## 1. La distinction

| | **Moteur** (engine) | **Infrastructure** (template) |
|---|---|---|
| C'est quoi | Une **brique technologique** qui détient une capacité (le live, le smartboard, le paiement, l'EHR…). | Une **solution prête à l'emploi** pour un secteur : un **bundle de moteurs** déjà assemblés. |
| Exemple | `liri_live`, `pay_engine`, `med_ehr` | `school` (École), `medos` (Santé), `mbolo` (E-commerce) |
| Qui l'utilise | Activé pour un tenant via `tenant_services`. | Choisi à l'onboarding → applique tous ses moteurs d'un coup (`POST /catalog/apply-template`). |
| Vendu | À la carte / par pack. | Comme une offre clé en main. |

**Règle :** une infrastructure **n'a pas** de techno propre — elle **assemble** des moteurs. Un moteur **ne dépend pas** d'une infrastructure (un même moteur sert plusieurs infrastructures : ex. `liri_live` sert École, Creator, Temple).

---

## 2. Les 37 MOTEURS (par catégorie)

| Catégorie | Moteurs (`service_key`) |
|---|---|
| **IA** | `liri_brain` (assistant), `liri_masterclass`, `liri_smartboard`, `liri_neuro_recall` |
| **Live / Vidéo** *(cœur LIRI)* | `liri_live`, `liri_replay`, `studio_creator` |
| **Paiement** | `pay_engine`, `stripe_connect`, `cinetpay` |
| **Communication** | `email_engine`, `sms_engine`, `whatsapp_engine`, `chat_engine` |
| **Contenu** | `course_builder`, `forum`, `marketing_creator` |
| **Calendrier** | `calendar` |
| **MedOS (santé)** | `med_ehr`, `med_notes`, `med_prescriptions`, `med_forms`, `med_health`, `med_programs`, `med_charting`, `gdpr_engine` |
| **Mbolo (e-commerce)** | `mbolo_catalog`, `mbolo_cart`, `mbolo_orders`, `mbolo_inventory`, `mbolo_storefront`, `mbolo_admin` |
| **Infrastructure technique** | `workflow_engine`, `webhook_engine`, `activity_stream`, `template_engine`, `notif_engine` |

> **Liri Studio** (le moteur live autonome, vendable seul) = `liri_live` + `liri_replay` + `liri_smartboard` + `studio_creator` + `liri_neuro_recall`. C'est la techno live de Cimolace, indépendante de toute infrastructure.

---

## 2b. Liri : moteur, Portail, Studio — qui est quoi

« Liri » désigne **deux choses** : le **produit/moteur** (la techno live) ET des **pages d'interface**. D'où la confusion. Voici la grille :

| Terme | C'est quoi | Route | Nature |
|---|---|---|---|
| **Liri** (le produit/moteur) | La **techno live** de Cimolace = les moteurs `liri_live`, `liri_replay`, `liri_smartboard`, `studio_creator`, `liri_neuro_recall`. | — (ce sont des moteurs activables) | **MOTEUR** |
| **Liri Portail** | La **page d'accueil / cockpit** du produit Liri : vue d'ensemble (mes lives, replays, activité, revenus, stats). C'est là qu'on **atterrit**. | `/liri` | **PAGE** (vue) |
| **Liri Studio** | Le **hub des outils de création / production** : préparer un live, Course/Formation Builder, Masterclass, Smartboard Designer. C'est là qu'on **crée**. | `/studio/liri` | **PAGE** (création) |
| **Liri Brain** | L'**assistant IA conversationnel** multi-modèles (DeepSeek / Claude / GPT) : chat, conversations, outils. Appuyé sur l'API `/liri/brain/*`. | `/liri/brain` (canonique) · `/dashboard/liri` (alias legacy) | **PAGE** (IA) |

**À retenir :**
- Ce sont **3 surfaces DISTINCTES**, pas des doublons : Portail = on **consulte** · Studio = on **crée** · Brain = on **discute avec l'IA**. (Le nom de route `/dashboard/liri` était trompeur — c'est en réalité Liri Brain ; nom canonique ajouté : `/liri/brain`.)
- **Liri ≠ ISNA.** Liri est un **moteur**. ISNA est un **tenant** (école) qui **active** ce moteur. Portail / Studio / Brain Liri apparaissent **dans** l'espace ISNA **parce qu'ISNA a activé Liri** — pas parce qu'ils appartiennent à ISNA. Le même Liri peut tourner pour Zahir, un créateur, ou seul sur un site externe (via clé API).

> ✅ **Tranché :** les 3 surfaces sont conservées (fonctions différentes). Seul le **nommage** est corrigé : Liri Brain a désormais la route canonique `/liri/brain` (l'ancien `/dashboard/liri` reste en alias rétro-compatible). À terme : renommer le composant `DashboardLiri` → `LiriBrainPage` et migrer les liens internes vers `/liri/brain`.

---

## 2c. Parcours d'un LIVE : quelle interface, à quel moment ?

Le cycle de vie d'un live passe par **des pages différentes selon l'étape**. ⚠️ Piège de nommage majeur : **« Arena » n'est PAS la préparation — c'est la séance live elle-même.** La préparation étape par étape, c'est **`LivePreparationStudioPage`**.

| Étape | Page | Route |
|---|---|---|
| 1. Voir / gérer mes lives | LiriPortalPage / LivesLibraryPage | `/liri`, `/lives` |
| 2. **Préparer le live (wizard étape par étape : scènes, couches, smartboard, autosave)** | **`LivePreparationStudioPage`** | `/studio/live-preparation/:sessionId` |
| 3. Salle d'attente | Waiting room | `/live/waiting/:sessionId` |
| 4. **Être EN LIVE (hôte) — la séance** | **`LiveHostPage`** *(alias « Arena »)* | `/live/host/:sessionId` **et** `/studio/live-arena/:sessionId` |
| 5. Rejoindre (invité / participant) | `LiveGuestPage` | `/live/:sessionId` |
| 6. Companion (téléphone / caméra mobile) | Immersive / MobileCamera | `/live/phone`, `/live/mobile-camera` |
| 7. Après le live (post-production, replay, IA) | `LivePostIntelligencePage` | `/studio/live-post/:sessionId` |
| — Embarqué sur un site externe du tenant | LiveEmbed (iframe) | `/embed/live/:sessionId`, `/embed/studio` |

**Le bon modèle mental :**
- **Préparer** (configurer, étape par étape) = **`LivePreparationStudioPage`** (`/studio/live-preparation/:sessionId`). ← *c'est ça qu'on prend souvent pour « Arena »*.
- **Être en live** (la séance, héberger) = **`LiveHostPage`** (`/live/host/:sessionId`). **« Arena » (`/studio/live-arena/:sessionId`) rend exactement cette même `LiveHostPage`.**

> ⚠️ **Confusions de noms à arbitrer (non corrigées — routing partagé) :**
> 1. **« Arena » = la séance live**, pas la prépa. `/studio/live-arena/:sessionId` → **`LiveHostPage`** (la même page que `/live/host/:sessionId`). Le mot « Arena » laisse croire à une étape de configuration → trompeur. Reco : renommer « Arena » en **« Salle live »**, garder « **Preparation Studio** » pour la prépa.
> 2. L'ancienne salle immersive OBS (`/studio/live-arena-obs/:sessionId`, composant `LiveArenaPage`) est **désactivée** : elle **redirige** vers `/studio/live-arena` (`LiveHostPage`). Tout converge donc vers **une seule salle live**.
>
> Quand **Liri est embarqué** dans le site externe d'un tenant (clé API / SDK), ce ne sont **pas** ces routes qui s'ouvrent mais les routes **`/embed/*`** (iframe) — le live s'affiche **dans** le site du client, sans quitter son domaine.

---

## 3. Les 7 INFRASTRUCTURES (templates) et leurs moteurs

| Infrastructure | `type` | Moteurs assemblés |
|---|---|---|
| **École / ISNA** | `school` | **core** : `liri_smartboard`, `liri_live`, `liri_replay`, `marketing_creator`, `calendar`, `course_builder` · **recommended** : `studio_creator`, `liri_neuro_recall`, `pay_engine`, `chat_engine`, `notif_engine` (11 ; `liri_masterclass` = addon) |
| **MedOS — Santé** | `medos` | `med_ehr`, `med_notes`, `med_prescriptions`, `med_forms`, `med_health`, `med_programs`, `med_charting`, `gdpr_engine` |
| **Mbolo / VirtuelMbolo** | `mbolo` | `pay_engine`, `cinetpay`, `sms_engine`, `whatsapp_engine`, `notif_engine`, `mbolo_catalog`, `mbolo_cart`, `mbolo_orders`, `mbolo_inventory`, `mbolo_storefront`, `mbolo_admin` |
| **Wellness / Bien-être** | `wellness` | `med_programs`, `med_health`, `calendar`, `chat_engine`, `forum` |
| **Creator / Créateur** | `creator` | `studio_creator`, `liri_live`, `liri_replay`, `pay_engine`, `marketing_creator` |
| **Temple / Spiritualité** | `temple` | `liri_live`, `calendar`, `forum`, `pay_engine`, `chat_engine` |
| **Community / Communauté** | `community` | `forum`, `chat_engine`, `calendar`, `pay_engine`, `notif_engine` |

---

## 4. ✅ Conflit `school` 6-vs-11 — RÉSOLU

Deux sources backend se contredisaient sur l'infrastructure **École** :

- `cimolace-catalog/cimolace-catalog.service.ts` → `INFRA_TEMPLATES.school` = **6 moteurs** (périmé).
- `cimolace-backoffice/school-engine-manifest.ts` → **11 moteurs** (6 `core` + 5 `recommended`) + `liri_masterclass` addon.

L'équipe avait **déjà tranché pour 11** (le provisioning école du back-office crée 11 moteurs depuis 2026-05-26). Le catalogue était simplement resté en retard.

**Fix appliqué** : `INFRA_TEMPLATES.school` aligné sur **11 moteurs** (core + recommended ; `liri_masterclass` reste addon). Les trois sources concordent désormais : catalogue (11) = manifeste (11) = front `lib/infrastructures.ts` (11). `apply-template` provisionnera bien les 11.

---

## 5. Règle d'or (rappel)

**La source de vérité du catalogue = le backend** (`cimolace-catalog.service.ts`, exposé par `GET /catalog/engines` et `GET /catalog/templates`). Toute liste statique ailleurs (front `lib/infrastructures.ts`, docs) n'est qu'un **aperçu** et doit s'aligner dessus, jamais l'inverse.
