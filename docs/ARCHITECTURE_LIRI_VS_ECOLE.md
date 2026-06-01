# 🏛️ Architecture Cimolace — LIRI vs Moteur ÉCOLE

> **Question stratégique** : dans ISNA Prorascience tout est mélangé. Qui appartient à LIRI (plateforme vidéo/IA transversale, type Zoom) ? Qui appartient au Moteur ÉCOLE (école numérique : année scolaire, formations, élèves, profs) ?

---

## 🔑 Principe de séparation

```
┌─────────────────────────────────────────────────────────────────┐
│                   CIMOLACE PLATFORM SaaS                         │
│        (multi-tenant — billing, auth, tenant, marketing)         │
└────────────────────────────────────────────────────────────────┬┘
                                                                  │
       ┌──────────────────────┬──────────────────────┐
       │                      │                      │
   ┌───▼───┐            ┌─────▼─────┐         ┌──────▼──────┐
   │ LIRI  │            │  ÉCOLE    │         │ Autres      │
   │ (Vidéo│            │ (Scolaire │         │ verticaux   │
   │  + IA)│            │  vertical)│         │ (MedOS,     │
   │       │            │           │         │  Mbolo, …)  │
   └───┬───┘            └─────┬─────┘         └─────────────┘
       │                      │
       │  utilise LIRI ─────► │
       │                      │
       └──── peut tourner SEUL (sans école) ────► sites externes via SDK
```

- **LIRI** = produit **horizontal** (vidéo + IA), utilisable sans école
- **ÉCOLE** = produit **vertical** qui **utilise** LIRI + ajoute la couche pédagogique
- **Plateforme partagée** = blocs techniques utilisés par tous

---

## 1️⃣ LIRI — Plateforme vidéo + IA transversale

> **Définition** : tout ce qui sert au **live vidéo, à la création de contenu vidéo, et à l'intelligence artificielle conversationnelle**. Concurrent direct de Zoom + Riverside + Notion AI. **Ne dépend PAS d'une école.**

### Moteurs LIRI (backend `apps/api/src/`)

| Module | Sous-moteur | Rôle |
|---|---|---|
| `live/` | **LIRI Live** | Sessions live, host/viewer/co-host, salle d'attente |
| `livekit/` | LIRI Live infra | Wrapper WebRTC LiveKit (tokens, rooms, egress) |
| `liri-public/` | **LIRI API v1** | API publique pour sites externes (Zoom-killer) |
| `smartboard/` | **LIRI SmartBoard** | Tableau interactif Konva, scènes pédagogiques |
| `replay/` | **LIRI Replay** | Replay enrichi, post-production, recordings R2 |
| `video-engine/` | LIRI Video | Gestion assets vidéo, encoding, CDN |
| `studio/` | **LIRI Studio Creator** | Préparation production : scènes, assets, versions |
| `neuro-recall/` | **LIRI Neuro Recall** | Mémorisation IA, répétition espacée |
| `masterclass-factory/` | **LIRI Masterclass Factory** | Génération IA de masterclass complètes |
| `liri-brain/` | **LIRI Brain** | Moteur IA conversationnel (assistant) |
| `longia/` | LIRI Longia | LLM spécialisé pour live (assistant temps réel) |

### Pages frontend LIRI (`apps/app/src/pages/`)

| Page | Description |
|---|---|
| `LiveHostPage.jsx` | **Page hôte LIRI** (1536 lignes — Zoom-like complet) |
| `LiveGuestPage.jsx` | Page participant LIRI |
| `LiveStudioPage.jsx` | Studio création session live |
| `LiveClassroomPage.jsx` | Variante école (mais moteur = LIRI) |
| `embed/LiveEmbedPage.jsx` | **Iframe embed** universelle (viewer/host/co-host) |
| `embed/LiveEmbedStudioPage.jsx` | **Studio embed** (créer session depuis site externe) |
| `studio/StudioSmartboardKonvaPage.jsx` | LIRI SmartBoard designer |
| `studio/StudioDebateBuilderPage.jsx` | LIRI Debate Builder |
| `studio/StudioLiriAgentPage.jsx` | LIRI Agent IA |
| `studio/StudioLiriHubPage.jsx` | LIRI Hub central |
| `studio/StudioLiriCourseBuilderPage.jsx` | LIRI Course Builder IA |
| `studio/StudioLiriFormationBuilderPage.jsx` | LIRI Formation Builder IA |
| `studio/StudioLiriBibliothequePage.jsx` | LIRI Bibliothèque IA |
| `studio/StudioLiriImportPage.jsx` | LIRI Import IA |
| `studio/StudioLiriMultilangPage.jsx` | LIRI Multilang IA |
| `studio/StudioLiveImmersivePage.jsx` | LIRI Live Immersif |
| `studio/StudioLiveLabPage.jsx` | LIRI Live Lab |
| `studio/LiveArenaPage.jsx` | LIRI Arena (débats) |
| `studio/LivePreparationStudioPage.jsx` | LIRI prep studio |
| `studio/LiveWaitingRoomPage.jsx` | LIRI salle d'attente |
| `studio/LivePostIntelligencePage.jsx` | LIRI post-production IA |
| `studio/DesignerPostProductionDock.jsx` | LIRI post-prod dock |

### Assets publics LIRI

| Fichier | Description |
|---|---|
| `public/liri-sdk.js` | **SDK universel v2** (Zoom-killer JS) |
| `public/liri-widget.js` | Widget legacy v1 (rétrocompatibilité) |
| `public/liri-demo-sdk.html` | Démo interactive complète |
| `public/liri-demo.html` | Démo widget legacy |

### Tables Supabase LIRI

```sql
live_sessions, live_recordings, live_waiting_room, live_invitations
live_scenes, live_messages, live_signals, live_participants
smartboard_*, studio_*, masterclass_factory_*, neuro_recall_*
tenant_domains (whitelist embed), tenant_api_keys (clés SDK)
tenant_webhooks (events sortants)
```

---

## 2️⃣ MOTEUR ÉCOLE — Vertical scolaire

> **Définition** : tout ce qui est **spécifique à une école** : année scolaire, élèves, professeurs, formations, bulletins, secrétariat. **Utilise LIRI pour le live** mais peut exister sans (école 100% asynchrone par exemple).

### Moteurs ÉCOLE (backend)

| Module | Sous-moteur | Rôle |
|---|---|---|
| `courses/` | **Cours / Leçons** | Structure cours → modules → leçons, progression élèves |
| `course-builder/` | **Course Builder** | Création de formations structurées par profs |
| `booking/` | **Rendez-vous** | Calendrier élève-prof, créneaux |
| `secretariat/` | **Secrétariat** | Gestion admin école (inscriptions, etc.) |
| `forum/` | **Forum** | Forum classe par cours / niveau |

### Pages frontend ÉCOLE

| Page | Description |
|---|---|
| `studio/StudioCourseBuilderPage.jsx` | Course Builder école |
| `studio/StudioCourseBuilderProPage.jsx` | Course Builder Pro |
| `studio/StudioCourseLabPage.jsx` | Course Lab |
| `studio/StudioFormationPage.jsx` | Création formations |
| `studio/StudioFormationLlmBuilderPage.jsx` | Formation IA |
| `studio/StudioCoachingPage.jsx` | Coaching élève |
| `studio/StudioIsnaPipelinePage.jsx` | Pipeline ISNA spécifique |
| `studio/StudioAppointmentPage.jsx` | Rendez-vous |
| `tenant/TenantAdminLivesPage.jsx` | Admin école — liste lives |
| `tenant/TenantAdminStudioPage.jsx` | Admin école — studio |
| `eleve-mobile/*` | Toute l'app mobile élève |

### Tables Supabase ÉCOLE

```sql
courses, modules, lessons, lesson_progress
formations, teachers, students, school_classes
appointments, bookings, school_events_calendar
forum_topics, forum_posts
school_provisionings, student_tracking
```

---

## 3️⃣ Plateforme PARTAGÉE (utilisée par TOUS)

> Blocs techniques utilisés par LIRI, École, MedOS, Mbolo, etc.

| Module | Rôle |
|---|---|
| `auth/` | Authentification Supabase |
| `tenant/` | Multi-tenant resolver |
| `cimolace/` | Plateforme SaaS Cimolace |
| `cimolace-backoffice/` | Back-office plateforme (provisioning écoles) |
| `cimolace-catalog/` | Catalogue plans/produits |
| `billing/`, `checkout/`, `pawapay/`, `pay-engine/` | Paiement Stripe + Mobile Money Afrique |
| `marketing/`, `iri/` | Marketing creator (vitrines, popups) |
| `growth/` | Analytics tenant |
| `messaging/`, `chat-engine/` | Chat interne |
| `notifications/` | Notifications produit |
| `email-engine/`, `sms-engine/` | Communications sortantes |
| `multilang/` | Internationalisation |
| `supabase/`, `common/` | Utilitaires |
| `ai-worker/` | Worker IA générique |

---

## 4️⃣ Autres verticaux (parallèles à ÉCOLE)

| Vertical | Modules |
|---|---|
| **MedOS** (médical) | `medos/`, `med-charting/`, `med-ehr/`, `med-forms/`, `med-gdpr/`, `med-health/`, `med-notes/`, `med-prescriptions/`, `med-programs/` |
| **Mbolo** (commerce africain) | `mbolo/` |

Ces verticaux **utilisent LIRI** pour leurs lives (consultation médicale, live commerce) **sans dépendre du moteur ÉCOLE**.

---

## 🎯 RÉPONSE À LA QUESTION INITIALE

> **« SmartBoard, Studio créateur, Masterclass — c'est LIRI ou École ? »**

**Tous les 3 = LIRI** ✅

- **SmartBoard** : tableau interactif → utilisable dans live médical (annoter une radio), live commerce (présenter un produit), live débat (afficher des arguments) — **pas spécifique école**
- **Studio Créateur** : préparation production live → utile pour tout type de live — **pas spécifique école**
- **Masterclass Factory** : génération IA de contenu vidéo → addon LIRI, **pas activé par défaut** dans le pack école actuel

Le manifeste `school-engine-manifest.ts` les classe `tier: 'core'` pour l'école parce qu'ils sont **activés** pour une école par défaut, mais ils **n'appartiennent pas** au moteur école — ce sont des moteurs LIRI **mis à disposition** de l'école.

---

## 🚨 Le mélange dans ISNA Prorascience

ISNA est un **tenant école** qui a activé **tous les moteurs LIRI** + tous les moteurs école. C'est pour ça qu'on voit tout mélangé : c'est **normal et voulu**. ISNA = école + LIRI complet.

Si on voulait séparer mentalement :
- Ce qui est **propre à ISNA en tant qu'école** : courses, formations, élèves, profs, bulletins, calendrier scolaire
- Ce qu'ISNA **utilise via LIRI** : live, smartboard, studio, replay, neuro-recall, masterclass-factory

---

## 📊 Vue synthétique

```
LIRI (transversal, vendable seul, Zoom-killer)
├── live              ← cœur live vidéo
├── livekit           ← infra WebRTC
├── liri-public       ← API v1 publique (NEW)
├── smartboard        ← tableau interactif
├── studio            ← préparation production
├── replay            ← post-production / replay
├── video-engine      ← gestion assets vidéo
├── neuro-recall      ← mémorisation IA
├── masterclass-factory ← génération IA
├── liri-brain        ← IA conversationnelle
└── longia            ← LLM live

ÉCOLE (vertical pédagogique, utilise LIRI)
├── courses           ← cours, modules, leçons
├── course-builder    ← création formations
├── booking           ← rendez-vous prof/élève
├── secretariat       ← gestion admin
└── forum             ← forum classe

PLATEFORME (socle technique partagé)
├── auth, tenant
├── cimolace*         ← gestion SaaS
├── billing, checkout, pay-engine, pawapay
├── marketing, iri, growth
├── chat-engine, messaging, notifications
├── email-engine, sms-engine, multilang
└── supabase, common, ai-worker

VERTICAUX (parallèles à ÉCOLE)
├── medos + med-*     ← médical
└── mbolo             ← commerce africain
```
