# Audit Cimolace Platform V2

Dernière mise à jour : 2026-05-10

## Verdict

Le projet n'est pas seulement "ISNA formateur indépendant". La vision correcte est :

```txt
Cimolace SaaS
  = plateforme propriétaire multi-tenant
  = catalogue de moteurs technologiques
  = plusieurs produits/infrastructures activables par client
```

ISNA / Ecole, LIRI, MedOS, Mbolo / VirtuelMbolo et les autres offres sont des produits ou familles de moteurs fournis par Cimolace. Un client Cimolace doit pouvoir créer un tenant, choisir une infrastructure, puis activer MedOS, Ecole/ISNA, Mbolo ou d'autres produits du catalogue selon son besoin.

## Compréhension validée

- **Cimolace** est la société / plateforme mère.
- **Cimolace OS / SaaS** est le socle multi-tenant qui vend et active des infrastructures métier.
- **Cimolant / Cimolace** est propriétaire des technologies et moteurs : LIRI, VirtuelMbolo / Mbolo, MedOS et autres produits catalogue.
- **ISNA / Ecole** est une infrastructure education/live/formation dans le catalogue, pas toute la plateforme.
- **LIRI** est une famille de moteurs IA/live/contenu réutilisable dans plusieurs infrastructures.
- **MedOS** est l'infrastructure santé, construite sur les moteurs médicaux Cimolace.
- **Mbolo / VirtuelMbolo** est l'infrastructure commerce/mobile money/Afrique.
- **ZahirWellness** est un site client e-commerce deja en ligne, a traiter comme cas pilote pour extraire le moteur Mbolo/VirtuelMbolo sans toucher a la production existante.
- Le modèle produit cible est une activation par tenant via catalogue de services, pas des apps séparées sans socle commun.

## Sources auditées

Documents et dossiers lus :

- `/Users/ngowazulu/Downloads/isna-opus/AGENTS.md`
- `/Users/ngowazulu/Downloads/isna-opus/docs/PRODUCT_FLOWS_V2.md`
- `/Users/ngowazulu/Downloads/isna-opus/docs/TENANCY_AND_BACKEND_BOUNDARIES.md`
- `/Users/ngowazulu/Downloads/isna-opus/docs/PHASE_BILLING_ROLES_SPEC.md`
- `/Users/ngowazulu/Downloads/isna-opus/docs/AGENT_HANDOFF_STATUS_V2.md`
- `/Users/ngowazulu/Downloads/isna-opus/docs/ROADMAP_V2.md`
- `/Users/ngowazulu/Downloads/isna_platform_v2/apps/api/src/cimolace/service-catalog.service.ts`
- `/Users/ngowazulu/Downloads/isna_platform_v2/apps/public-site/src/components/landing/Infrastructures.tsx`
- `/Users/ngowazulu/Downloads/isna_platform_v2/apps/public-site/src/components/landing/EnginesCatalog.tsx`
- `/Users/ngowazulu/Downloads/isna_platform_v2/apps/public-site/src/app/medos/page.tsx`
- `/Users/ngowazulu/Downloads/isna_platform_v2/apps/public-site/src/app/infrastructures/*/page.tsx`
- `/Users/ngowazulu/Downloads/MEDOS_CAHIER_DES_CHARGES.docx`
- `/Users/ngowazulu/Downloads/rapport_practicebetter.md`
- `/Users/ngowazulu/Downloads/template.csv`
- `/Users/ngowazulu/Projects/zahir-app` et copies ZahirWellness detectees comme sources a auditer separement avant toute migration Mbolo.

## Etat reel par dossier

### `isna-opus`

Base la plus stable pour le socle technique :

- Auth JWT Supabase.
- Resolution tenant via `X-Tenant-Slug`.
- Roles de base owner/admin/teacher/student.
- Creation tenant.
- Branding tenant.
- Lives payants.
- Stripe Checkout + webhook signe.
- Creation `access_pass`.
- Token LiveKit protege par tenant + access pass.
- Tests API et E2E backend reel deja passes.

Limite importante : les documents de `isna-opus` ont ete ecrits comme si le MVP "formateur independant" etait toute la strategie. Cette formulation doit etre corrigee mentalement et dans les prochaines docs : ce MVP est le premier vertical valide, pas la limite produit de Cimolace.

### `isna_platform_v2`

Source la plus claire pour la vision Cimolace catalogue :

- Page publique Cimolace.
- Catalogue moteurs.
- Infrastructures activables.
- Prototype MedOS.
- Pricing MedOS / infrastructures.
- Module API `cimolace` avec `ENGINE_CATALOG`, `INFRA_TEMPLATES` et activation dans `tenant_services`.

Limite importante : ce dossier est moins stable pour le socle securite. Les pages marketing affirment parfois des capacites "deja en production" alors que le backend MedOS reste partiel.

## Catalogue detecte

Le catalogue code dans `isna_platform_v2` contient ces familles de moteurs :

- IA : `liri_brain`, `liri_masterclass`, `liri_smartboard`, `liri_neuro_recall`.
- Live / video : `liri_live`, `liri_replay`, `studio_creator`.
- Paiement : `pay_engine`, `stripe_connect`, `cinetpay`.
- Communication : `email_engine`, `sms_engine`, `whatsapp_engine`, `chat_engine`.
- Contenu : `course_builder`, `forum`, `marketing_creator`.
- Agenda : `calendar`.
- Sante / MedOS : `med_ehr`, `med_notes`, `med_prescriptions`, `med_forms`, `med_health`, `med_programs`, `med_charting`, `gdpr_engine`.
- Infrastructure : `workflow_engine`, `webhook_engine`, `activity_stream`, `template_engine`, `notif_engine`.

## Infrastructures detectees

Templates disponibles dans le prototype Cimolace :

- `school` / Ecole en ligne : SmartBoard, LIRI Live, replay, marketing, calendrier.
- `medos` / Sante : EHR, notes SOAP, prescriptions, forms, health tracking, care programs, charting IA, GDPR.
- `wellness` / Bien-etre : care programs, health tracking, calendrier, chat, forum.
- `creator` / Createur : studio, live, replay, paiement, marketing.
- `mbolo` / Boutique Mbolo : paiement, CinetPay, SMS, WhatsApp, notifications.
- `temple` / Spiritualite : live, calendrier, forum, paiement, chat.
- `community` / Communaute : forum, chat, calendrier, paiement, notifications.

Ce modele confirme que MedOS et les autres produits doivent etre activables dans Cimolace, pas maintenus comme visions concurrentes.

Cas special Mbolo : ZahirWellness doit servir de blueprint e-commerce. Le site client existant reste en ligne et ne doit pas etre modifie directement. Reference : `docs/ZAHIR_TO_MBOLO_MIGRATION_STRATEGY.md`.

## Contradictions trouvees

1. Certains documents `isna-opus` disent "ne pas importer MedOS/CIMOLACE". Cette phrase etait correcte comme garde-fou contre une fusion brute, mais elle est fausse si on parle de strategie produit.
2. `PRODUCT_FLOWS_V2.md` verrouille "formateur independant" comme client principal. Cela doit rester le premier MVP/pilote Ecole, pas la definition de Cimolace tout entier.
3. `isna_platform_v2` porte la vision catalogue mais n'a pas le meme niveau de preuve technique que `isna-opus`.
4. Les pages publiques MedOS annoncent plus que le backend ne garantit. Avant commercialisation, il faut aligner marketing, backend, tests et conformite.
5. MedOS manipule des donnees de sante : l'isolation tenant, le RBAC medical, l'audit trail et les exports patient doivent passer avant les features visibles.

## Decision technique recommandee

Ne pas choisir entre `isna-opus` et `isna_platform_v2` comme si l'un annulait l'autre.

La bonne trajectoire :

```txt
Socle stable = isna-opus
Vision catalogue / MedOS / Cimolace OS = isna_platform_v2
Fusion = migration controlee module par module
```

`isna-opus` doit devenir le noyau Cimolace Platform V2. Ensuite on importe proprement :

1. Le modele `tenant_services`.
2. Le catalogue de moteurs.
3. Les templates d'infrastructures.
4. L'onboarding "choisir infrastructure".
5. MedOS comme produit active par tenant.
6. Mbolo / VirtuelMbolo et les autres produits apres stabilisation du catalogue.
7. ZahirWellness comme premier cas pilote Mbolo, via clone/audit et migration progressive.

## Plan d'execution pour rendre le projet coherent

### Phase 1 - Alignement documentaire

- Renommer mentalement le MVP actuel en "MVP Ecole / ISNA".
- Documenter Cimolace comme plateforme mere.
- Documenter chaque produit : Ecole/ISNA, MedOS, Mbolo, Creator, Wellness, Temple, Community.
- Marquer clairement ce qui est production-ready, beta, prototype ou marketing.

### Phase 2 - Socle catalogue dans `isna-opus`

- Ajouter migration `tenant_services`.
- Ajouter table `service_catalog` ou garder catalogue code au depart, puis migrer en DB si necessaire.
- Ajouter `infrastructure_type` sur tenant ou table `tenant_infrastructures`.
- Ajouter API catalogue : lister moteurs, lister templates, activer/desactiver moteur.
- Proteger activation par owner/admin.

### Phase 3 - Onboarding Cimolace

- Remplacer onboarding mono-ISNA par onboarding Cimolace :
  - creation compte,
  - creation tenant,
  - choix infrastructure,
  - activation template,
  - branding,
  - premier objet metier selon infrastructure.

### Phase 4 - MedOS livrable

- Importer MedOS seulement apres le socle catalogue.
- Appliquer RBAC medical strict.
- Ajouter dossier patient, consultation, notes SOAP, prescriptions, formulaires, programmes de soin, suivi habitudes.
- Ajouter audit trail et exports.
- Ajouter tests E2E MedOS.
- Aligner landing page MedOS avec l'etat reel.

### Phase 5 - Autres produits

- Ajouter Mbolo / VirtuelMbolo apres validation Pay Engine + CinetPay/mobile money.
- Ajouter Creator, Wellness, Temple, Community par activation moteurs.
- Garder les moteurs partages dans Cimolace, pas dupliquer la logique par produit.

## Regle pour les prochains agents

Tout agent doit comprendre cette hierarchie :

```txt
Cimolace Platform V2
  -> Tenants
  -> Catalogue moteurs
  -> Infrastructures activables
  -> Produits : ISNA/Ecole, MedOS, Mbolo/VirtuelMbolo, LIRI experiences, etc.
```

Un agent ne doit pas :

- traiter MedOS comme un projet hors sujet ;
- traiter ISNA comme toute la plateforme ;
- fusionner brutalement `isna_platform_v2` dans `isna-opus` ;
- promettre sur le site public une capacite non prouvee par backend + tests ;
- toucher la V1 depuis ce workspace.
