# CIMOLACE Landing V2 — plan editorial et design

Date: 2026-05-26

## Objectif

Refaire la page d'accueil publique de CIMOLACE pour passer d'une vitrine catalogue a une presentation premium de plateforme technologique.

La nouvelle experience doit inspirer les standards de narration produit d'Apple et la clarte commerciale de PayPal, sans copier leur identite. CIMOLACE doit apparaitre comme une infrastructure proprietaire, moderne, africaine, multi-tenant, capable de deployer des OS metier complets.

## Source de verite

Documents audites:

- `docs/CIMOLACE_PLATFORM_AUDIT.md`
- `docs/CIMOLACE_CATALOG_IMPLEMENTATION_STATUS.md`
- `docs/CIMOLACE_ONBOARDING_CATALOG_STATUS.md`
- `docs/ISNA_PRORASCIENCE_SCHOOL_TENANT_MODEL_AUDIT.md`
- `apps/app/src/data/cimolaceOsData.js`
- `apps/app/src/data/cimolaceProductTaxonomy.js`

Synthese validee:

```txt
CIMOLACE
  = SaaS proprietaire multi-tenant
  = catalogue de moteurs technologiques
  = infrastructures metier activables par client
```

ISNA / Prorascience n'est pas la plateforme entiere. C'est le premier modele tenant ecole, utilise pour prouver et industrialiser School OS.

## Positionnement public

Phrase courte:

> CIMOLACE deploie des infrastructures numeriques completes pour creer une ecole, un commerce, un studio, une communaute ou une plateforme metier sans reconstruire la technologie.

Promesse:

> Choisissez un OS metier, personnalisez votre marque, activez les moteurs dont vous avez besoin, puis lancez votre espace avec live, IA, paiements, contenu, donnees et backoffice.

Ce qu'il ne faut pas dire:

- Ne pas presenter CIMOLACE comme une simple ecole.
- Ne pas presenter ISNA comme toute la plateforme.
- Ne pas promettre que tous les moteurs sont production-ready si certains sont encore beta/prototype.
- Ne pas utiliser un discours "outil IA magique" flou. La force est l'infrastructure composee.

## Architecture de pages publiques

### 1. Home — `/` et `/cimolace`

Role: page d'atterrissage premium.

Contenu:

- Hero CIMOLACE, phrase de vision et CTA.
- Probleme: fragmentation des outils.
- Solution: une infrastructure qui assemble moteurs + OS.
- Moteurs phares.
- OS metier.
- ISNA/Prorascience comme preuve ecole.
- Architecture de confiance.
- CTA demo / configurateur.

Objectif conversion:

- `Créer mon infrastructure`
- `Explorer les moteurs`
- `Demander une demo`

### 2. Moteurs — `/cimolace/moteurs`

Role: catalogue technologique public.

Sections:

- Live et video
- IA et pedagogie
- Studio et creation
- Paiement et commerce
- Communication et CRM
- Infrastructure et automation

Chaque moteur doit afficher:

- nom
- categorie
- fonction concrete
- OS ou offres qui l'utilisent
- statut: pret, beta, prototype

Moteurs a presenter:

- LIRI Live Engine
- LIRI Arena Live
- SmartBoard Designer
- MasterScript Live
- Masterclass Factory
- Creator Studio
- VideoPostProduction
- LIRI Brain / Brain Trinity
- LIRI Multilang
- NeuroRecall
- School Engine
- Certification Engine
- Pay Engine / Payment Link Engine
- Stripe Connect / CinetPay / PawaPay selon disponibilite reelle
- Marketing Creator
- CRM Client Hub
- Smart Secretariat
- Booking Engine
- Email Engine
- SMS Engine
- Chat Engine
- Notification Engine
- Workflow Engine
- Template Engine
- Activity Stream

### 3. Infrastructures — `/cimolace/infrastructures`

Role: presenter les OS metier activables.

OS publics:

- School OS
- School Live OS
- Commerce OS
- Creator OS
- Business OS
- Media OS
- Temple OS
- MedOS
- Community OS

Pour chaque OS:

- a qui il s'adresse
- probleme resolu
- moteurs inclus
- exemple de parcours utilisateur
- statut de maturite
- CTA vers detail ou contact

### 4. Ecole — `/cimolace/ecole`

Role: convertir les ecoles et formateurs, avec ISNA/Prorascience comme modele.

Message:

> School OS transforme le modele ISNA / Prorascience en infrastructure ecole reutilisable pour les prochains tenants.

Sections:

- Creer une ecole numerique complete.
- Parcours, classes, enseignants, eleves, parents.
- Live classes, SmartBoard, replays, masterclass, supports IA.
- Branding configurable: logo, couleurs, domaine, charte graphique.
- Moteurs actifs du template school.
- Difference entre tenant ecole et SaaS CIMOLACE.
- CTA: creer une ecole / demander demo.

Points de preuve:

- ISNA / Prorascience est tenant modele.
- Template school active aujourd'hui 6 moteurs officiels: `liri_smartboard`, `liri_live`, `liri_replay`, `marketing_creator`, `calendar`, `course_builder`.
- Le code ecole expose aussi 12 capacites frontend; il faut les presenter comme sous-capacites tant qu'elles ne sont pas toutes normalisees en moteurs facturables.

### 5. Architecture — `/cimolace/architecture`

Role: confiance technique pour clients serieux.

Sections:

- Multi-tenant et isolation.
- Tenant services et moteur activable.
- Frontend: Vercel.
- API: Cloud Run.
- Database/Auth: Supabase.
- Realtime/live: LiveKit et Supabase Realtime.
- Domaines: domaine propre par plateforme.
- Securite: RLS, roles, audit, JWT.
- Environnements: dev, staging, prod.

Ce qui est prouve en prod:

- `https://cimolace.space`
- `https://www.cimolace.space`
- `https://api.cimolace.space/health`
- CORS API valide depuis `https://cimolace.space`

### 6. Tarifs — `/cimolace/tarifs`

Role: clarifier la facturation.

Grille proposee:

- Starter: lancement simple, un OS, limites basses.
- Pro: OS complet, plusieurs moteurs, usage normal.
- Platform: multi-sites, equipe, monitoring, quotas avances.
- Enterprise / Institution: hebergement prive, SLA, integrations.

Important:

- Les prix ne doivent pas etre fixes si la facturation reelle n'est pas stabilisee.
- Afficher "sur devis" pour Platform/Enterprise si besoin.
- Lier chaque plan a des quotas: utilisateurs, live hours, stockage, IA, emails/SMS, paiements.

### 7. Contact / Demo — `/cimolace/contact`

Role: convertir sans friction.

Champs:

- nom
- email
- organisation
- type d'infrastructure souhaitee
- domaine existant
- message

CTA:

- `Demander une demo`
- `Créer une ecole`
- `Parler a l'equipe CIMOLACE`

## Home V2 — structure detaillee

### Section 1 — Hero Apple-like

H1:

> CIMOLACE

Sous-titre:

> L'infrastructure qui permet de creer une ecole, un commerce, un studio ou une plateforme metier complete sans reconstruire la technologie.

CTA:

- `Créer mon infrastructure`
- `Explorer les moteurs`

Visuel:

- Scene immersive plein ecran, pas une carte marketing.
- Representation de plusieurs interfaces CIMOLACE qui s'assemblent: live, smartboard, paiement, backoffice, tenant.
- Sur mobile, hero plus court et CTA visibles sans scroll lourd.

### Section 2 — Le probleme

Titre:

> Les projets modernes meurent dans la fragmentation.

Texte:

> Une ecole assemble Zoom, Drive, WhatsApp, Notion, Stripe, un LMS, un CRM et des fichiers manuels. CIMOLACE remplace cette pile fragile par une infrastructure coherente.

Elements visuels:

- Avant: outils disperses.
- Apres: un OS metier connecte.

### Section 3 — La solution

Titre:

> Un socle. Des moteurs. Des OS metier.

Explication simple:

- Infrastructure: identite, donnees, auth, domaine, backoffice.
- Moteurs: live, IA, paiement, studio, CRM, contenu.
- OS metier: school, commerce, creator, medos, temple, community.

### Section 4 — Moteurs phares

Moteurs en premiere ligne:

- LIRI Live Engine
- SmartBoard Designer
- Masterclass Factory
- Creator Studio
- VideoPostProduction
- Pay Engine
- Marketing Creator
- Brain Trinity

Format:

- grandes sections horizontales, type presentation produit.
- Chaque moteur a une phrase concrete, pas un paragraphe technique.

Exemple:

> SmartBoard Designer transforme un cours en scene visuelle: slides, annotations, tableaux, supports et replay exploitable.

### Section 5 — OS metier

Titre:

> Choisissez un metier, pas une stack.

Cards sobres:

- School OS
- Commerce OS
- Creator OS
- Business OS
- Media OS
- Temple OS
- MedOS
- Community OS

Chaque carte:

- une promesse
- 3 moteurs inclus
- CTA `Voir l'OS`

### Section 6 — Focus School OS / ISNA

Titre:

> ISNA / Prorascience, premier modele ecole.

Texte:

> CIMOLACE transforme l'infrastructure ecole construite autour d'ISNA / Prorascience en modele reutilisable pour les prochains tenants.

Mettre en avant:

- template school
- espace eleve
- live
- smartboard
- replay
- cours
- branding tenant
- domaine
- backoffice

### Section 7 — Branding tenant configurable

Titre:

> Chaque tenant garde sa marque.

Contenu:

- logo
- couleurs
- typographie
- domaine
- nom public
- charte graphique
- footer
- pages legales
- modules visibles

Message:

> CIMOLACE reste le moteur. Le client garde sa vitrine.

### Section 8 — Architecture confiance

Titre:

> Une infrastructure moderne, pas une maquette.

Afficher:

- Vercel pour le web
- Cloud Run pour l'API
- Supabase pour auth/data
- LiveKit pour live realtime
- moteurs tenant-aware
- RLS et roles
- domaine custom

### Section 9 — Parcours en 3 etapes

Inspiration PayPal:

1. Choisissez votre infrastructure.
2. Personnalisez votre tenant.
3. Lancez vos moteurs et commencez a operer.

### Section 10 — CTA final

Titre:

> Votre plateforme peut commencer par un seul tenant.

CTA:

- `Créer mon infrastructure`
- `Demander une demo`

## Direction visuelle

Principes:

- Page narrative, verticale, cinematic.
- Gros titres courts.
- Beaucoup d'espace blanc/noir, peu de texte par ecran.
- Captures produit et visuels immersifs.
- Transitions douces, pas d'animations gratuites.
- Cartes seulement quand elles servent a comparer ou scanner.

Palette proposee:

- Noir profond: fond premium et hero.
- Blanc: sections de clarte et conversion.
- Or discret: confiance / identite.
- Bleu technique: infrastructure.
- Vert: paiement / croissance.
- Violet/cyan: IA/live, mais en accents seulement.

Interdits:

- Ne pas faire une page dominee par un gradient violet.
- Ne pas remplir la page de petites cartes identiques.
- Ne pas utiliser de texte explicatif dans l'app pour decrire le design.
- Ne pas afficher de faux chiffres sans source.

## Assets requis

Captures reelles a produire:

- Backoffice CIMOLACE tenant list/control plane.
- Detail tenant ISNA/Prorascience.
- LIRI live host.
- SmartBoard Designer.
- Masterclass Factory.
- Studio createur LIRI.
- Postproduction/replay.
- Espace eleve.
- Configurateur tenant.

Visuels generes a produire:

- Scene hero CIMOLACE: interfaces flottantes autour d'une infrastructure centrale.
- Scene ecole premium africaine: enseignant + live/smartboard.
- Scene commerce: vendeur + paiement + commande.
- Scene studio createur: camera, prompteur, smartboard.

## Roadmap implementation

### Phase A — Preparation contenu

- Creer `apps/app/src/data/cimolaceLandingV2Content.js`.
- Normaliser la liste moteurs a afficher publiquement.
- Marquer statut moteur: `ready`, `beta`, `prototype`.
- Corriger `marketingSiteDisplay` vers `cimolace.space`.

### Phase B — Nouvelle home

- Creer `apps/app/src/pages/CimolaceLandingV2.jsx`.
- Creer composants:
  - `CimolaceLandingHeroV2`
  - `CimolaceProblemSection`
  - `CimolacePlatformModelSection`
  - `CimolaceEngineShowcase`
  - `CimolaceOsShowcaseV2`
  - `CimolaceSchoolModelSection`
  - `CimolaceBrandingSection`
  - `CimolaceArchitectureTrustSection`
  - `CimolaceLandingCta`
- Brancher `/cimolace` sur V2 apres validation visuelle.

### Phase C — Pages secondaires

- Ajouter `/cimolace/moteurs`.
- Ajouter `/cimolace/infrastructures`.
- Ajouter `/cimolace/ecole`.
- Reprendre `/cimolace/architecture` pour la version confiance.
- Revoir `/cimolace/contact`.

### Phase D — Verification

- Tester desktop et mobile avec Playwright.
- Verifier aucun texte qui deborde.
- Verifier CTA et routes.
- Verifier que la page charge vite malgre les visuels.
- Deployer Vercel.

## Decision immediate

Commencer par la Home V2. Les autres pages peuvent etre ajoutees ensuite, mais la home doit deja contenir les portes vers moteurs, infrastructures, ecole et architecture.

