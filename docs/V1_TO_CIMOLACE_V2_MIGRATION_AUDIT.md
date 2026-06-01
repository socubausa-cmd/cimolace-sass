# Audit migration backend ISNA V1 vers Cimolace / ISNA V2

Derniere mise a jour : 2026-05-10

## Verdict

Non, tout le backend des produits ISNA V1 n'a pas encore ete migre en produit Cimolace multi-tenant.

Ce qui est migre dans `isna-opus` : le socle critique V2.

- Tenants.
- Memberships tenant.
- Auth Supabase JWT.
- Guards tenant + roles de base.
- Lives payants.
- Checkout Stripe pour live a l'unite.
- Webhook Stripe signe.
- `access_pass`.
- Token LiveKit protege.
- Marketing minimal schema + routes.
- Spec billing SaaS tenant.

Ce qui n'est pas encore migre : la grande majorite des produits backend V1.

L'ancien projet `/Users/ngowazulu/Downloads/isna_app` contient environ :

- 215 tables detectees dans les migrations Supabase.
- 234 Netlify Functions JavaScript.
- 32 Supabase Edge Functions Deno.
- Plusieurs familles produit completes ou semi-completes : LIRI, live immersif, booking, billing multi-paiement, marketing avance, course builder, replay, forum, messagerie, secretariat, mobile eleve, back-office Cimolace.

## Sources auditees

- Ancien projet : `/Users/ngowazulu/Downloads/isna_app`
- Nouveau socle stable : `/Users/ngowazulu/Downloads/isna-opus`
- Prototype catalogue / MedOS : `/Users/ngowazulu/Downloads/isna_platform_v2`
- Audit V1 existant : `/Users/ngowazulu/Downloads/isna_app/docs/AUDIT_ARCHITECTURE_ISNA_APP.md`
- Plan refactor school : `/Users/ngowazulu/Downloads/isna_app/docs/CIMOLACE_LIRI_SCHOOL_REFACTORING_PLAN.md`
- Plan back-office Cimolace : `/Users/ngowazulu/Downloads/isna_app/docs/CIMOLACE_BACKOFFICE_PLAN.md`
- Inventaire V2 : `/Users/ngowazulu/Downloads/isna-opus/docs/MIGRATIONS_INVENTORY.md`
- Audit plateforme : `/Users/ngowazulu/Downloads/isna-opus/docs/CIMOLACE_PLATFORM_AUDIT.md`

## Etat de l'ancien backend ISNA V1

`isna_app` est une application V1 tres riche, mais pas un SaaS multi-tenant propre.

Architecture observee :

- Front React/Vite monolithique.
- Backend Netlify Functions.
- Backend Supabase Edge Functions en parallele.
- Supabase Postgres avec beaucoup de migrations.
- LiveKit.
- Paiements Chariow, CinetPay, NOWPayments, PayPal, traces Stripe.
- Capacitor mobile.
- LIRI / SmartBoard / course builder / live / replay / NeuroRecall.

Le document V1 `AUDIT_ARCHITECTURE_ISNA_APP.md` dit explicitement :

> V1 n'est pas un SaaS multi-tenant. C'est une mono-ecole avec un echafaudage SaaS jamais branche.

Points critiques V1 confirmes :

- Double runtime backend Netlify + Supabase Edge.
- Beaucoup de fonctions `service_role`.
- Tables metier historiques souvent sans `tenant_id`.
- Logique ISNA / Prorascience parfois codee en dur.
- Billing et live fonctionnels sur happy path mais pas prets pour plusieurs tenants.
- Plusieurs modules ont deja des idees Cimolace, mais pas encore un modele uniforme.

## Modules V1 detectes

### Socle identite / tenant

V1 contient :

- `profiles`
- roles owner/admin/teacher/secretariat/student/etc.
- tables Cimolace : `cimolace_tenants`, `cimolace_sites`, `cimolace_services`, `cimolace_clients`, `cimolace_subscriptions`, etc.
- essais de custom JWT claims.
- essais de `tenant_id`.

Etat V2 :

- Migre partiellement et mieux structure dans `isna-opus`.
- `tenants` et `tenant_memberships` existent.
- TenantGuard existe.
- Le modele catalogue `tenant_services` n'est pas encore dans `isna-opus`.

Statut : **partiel mais base V2 meilleure**.

### Live / LiveKit / acces payant

V1 contient :

- `live_sessions`.
- participants, questions, chat, transcripts, summaries, recordings.
- `livekit-create-room`, `livekit-get-token`, recording start/stop, webhook LiveKit.
- live immersif separe : `immersive-livekit-*`.
- invite links, waiting room, proctor camera, mobile camera, join codes.

Etat V2 :

- Migre seulement le coeur MVP :
  - create live,
  - checkout,
  - access pass,
  - token LiveKit.
- Pas encore migre :
  - chat live,
  - questions/reponses,
  - transcripts,
  - summaries,
  - recordings R2,
  - mobile camera,
  - waiting room,
  - live immersif,
  - participants avances,
  - invitations avancees.

Statut : **socle migre, produit live V1 non migre completement**.

### Billing / paiements

V1 contient :

- Chariow.
- CinetPay.
- NOWPayments.
- PayPal.
- Stripe partiel / code mort.
- subscriptions, invoices, payment logs, renewal cycles, DLQ, cron cursors.
- paiements VirtuelMbolo.
- licences, manual activation, one-time formations.

Etat V2 :

- `isna-opus` a seulement Stripe Checkout pour achat live a l'unite.
- `isna-opus` a une migration/spec billing SaaS tenant, mais l'API billing SaaS n'est pas terminee.
- `isna-sonnet` / `isna-flash` contiennent des morceaux billing, non consolides.
- `isna_platform_v2` a un module billing prototype.

Statut : **non migre comme produit Cimolace complet**.

### LIRI / IA / SmartBoard

V1 contient :

- `liri-masterclass-factory`.
- `liri-smartboard-*`.
- `liri-slide-generate`.
- `liri-summary-generate`.
- `liri-mindmap-generate`.
- `liri-konva-course-copilot`.
- `liri-orchestrator-*`.
- `liri-multilang-*`.
- `longia-*`.
- prompts et shared engines.
- versions de workspace LIRI.

Etat V2 :

- `isna_platform_v2` liste les moteurs LIRI dans le catalogue.
- `isna-opus` n'a pas encore migre les vrais moteurs backend LIRI.
- `apps/worker` dans `isna-opus` contient seulement des placeholders IA/video/email.

Statut : **catalogue reconnu, backend produit non migre**.

### Course builder / ecole

V1 contient :

- formations, modules, weeks, lessons, progress.
- course builder pipeline.
- render enqueue/status/worker.
- postproduction versions.
- master script, segmentation IA, illustrations.
- school life records, announcements, gradebook, attendance.

Etat V2 :

- Pas migre dans `isna-opus`.
- Le MVP V2 ne contient que lives payants et pas encore l'ecole complete.

Statut : **non migre**.

### Booking / secretariat / rendez-vous

V1 contient :

- appointments.
- appointment_requests.
- availability_slots.
- secretaries, secretary teams.
- reminders, satisfaction, reschedule.
- booking live session bootstrap.
- smart booking engine.
- regions France/Gabon.

Etat V2 :

- Pas migre dans `isna-opus`.
- Pas integre au modele Cimolace catalogue.

Statut : **non migre**.

### Marketing / growth

V1 contient :

- campaigns.
- funnels.
- funnel_steps.
- leads.
- segments.
- automations.
- payment recovery.
- analytics.
- ad creatives.

Etat V2 :

- `isna-opus` a un marketing minimal : `promo_codes`, `popups`, `banners`.
- Service API present mais persistance a finaliser selon l'audit precedent.
- Pas de migration complete du growth engine V1.

Statut : **partiel minimal**.

### Forum / communaute / messagerie

V1 contient :

- forum functions.
- communities.
- community_members.
- community_messages.
- mail inbox / IMAP.
- response engine.
- org inbound emails.
- notifications.

Etat V2 :

- Pas migre dans `isna-opus`.
- Phase forum/notifications encore future.

Statut : **non migre**.

### Replay / video / recordings

V1 contient :

- live_recordings.
- replay_augmentation_jobs.
- replay assets.
- FFmpeg workers.
- R2 migration scripts.
- summaries, reports, mindmaps.

Etat V2 :

- `apps/worker` contient placeholders `processVideo`.
- Pas de vrai replay worker migre.
- Pas de R2 tenant prefix finalise dans V2.

Statut : **non migre**.

### Cimolace back-office proprietaire

V1 contient :

- plan documentaire complet.
- tables `cimolace_*`.
- back-office client/proprietaire en conception.
- fonctions `cimolace-checkout`, `cimolace-chariow-webhook`.

Etat V2 :

- `isna_platform_v2` porte une landing Cimolace et un catalogue.
- `isna-opus` n'a pas encore le back-office proprietaire Cimolace.

Statut : **prototype/documente, non migre dans le socle stable**.

### MedOS

V1 contient quelques traces medicales / patient intake, mais MedOS est surtout dans `isna_platform_v2` et les documents MedOS.

Etat V2 :

- `isna_platform_v2` a un prototype API MedOS.
- `isna-opus` n'a pas encore importe MedOS.
- MedOS doit venir apres `tenant_services` / catalogue.

Statut : **prototype separe, non integre au noyau stable**.

### Mbolo / VirtuelMbolo / ZahirWellness

ZahirWellness est un projet client e-commerce deja en ligne. Il ne faut pas le traiter comme un simple dossier a fusionner.

Role correct :

- reference produit pour le moteur e-commerce Mbolo ;
- cas pilote "site existant + integration moteur Cimolace" ;
- futur tenant `zahirwellness` ou integration externe branchee sur API Mbolo ;
- boutique avec domaine, branding et back-office personnalises.

Statut V2 :

- `isna_platform_v2` a seulement le template `mbolo`.
- `isna-opus` n'a pas encore le moteur e-commerce.
- le repo Zahir doit etre clone/audite sans toucher a la production.

Reference : `docs/ZAHIR_TO_MBOLO_MIGRATION_STRATEGY.md`.

## Tableau de migration V1 -> V2

| Domaine | V1 existe | Dans `isna-opus` | Dans `isna_platform_v2` | Statut |
|---|---:|---:|---:|---|
| Tenants / memberships | Partiel/decor SaaS | Oui | Oui | A consolider |
| Auth JWT Supabase | Oui | Oui | Oui partiel | Migre pour MVP |
| TenantGuard / isolation | Faible en V1 | Oui | Partiel | Migre mieux en V2 |
| Live payant simple | Oui | Oui | Oui partiel | Migre coeur MVP |
| Access pass | Equivalent partiel | Oui | Non central | Migre coeur MVP |
| Live avance / immersif | Oui | Non | Non | A migrer |
| Chat/questions/transcripts live | Oui | Non | Non | A migrer |
| Recordings/replay/R2 | Oui | Non | Non | A migrer |
| Course builder | Oui | Non | Non | A migrer |
| LIRI SmartBoard | Oui | Non | Catalogue seulement | A migrer |
| LIRI Masterclass/Orchestrator | Oui | Non | Catalogue seulement | A migrer |
| NeuroRecall | Oui | Non | Catalogue seulement | A migrer |
| Booking / secretariat | Oui | Non | Non | A migrer |
| Billing multi-provider | Oui | Spec/migration Stripe SaaS partielle | Prototype | A migrer/refondre |
| CinetPay / mobile money | Oui | Non | Catalogue Mbolo | A migrer |
| PayPal / NOWPayments / Chariow | Oui | Non | Non | Decision produit requise |
| Marketing avance | Oui | Minimal | Partiel landing | A migrer |
| Forum / communaute | Oui | Non | Catalogue | A migrer |
| Messagerie / email inbox | Oui | Non | Non | A migrer |
| Back-office Cimolace proprietaire | Plans + tables | Non | Partiel public/catalogue | A construire |
| MedOS | Cahier + prototype separe | Non | Oui prototype | A integrer apres catalogue |
| Mobile eleve Capacitor | Oui | Non | Non | A decider plus tard |

## Ce qui est deja vraiment acquis dans V2

Le meilleur acquis V2 est qualitatif : `isna-opus` repart sur un modele plus sain.

- Monorepo separe : public site, app connectee, API, worker.
- Backend API dedie NestJS.
- Pas de Netlify comme backend principal.
- Tenant explicite.
- `tenant_id` dans les tables MVP.
- Checkout eleve separe du billing SaaS.
- Webhook Stripe signe et teste.
- Tests backend reels du parcours critique.

Donc V2 n'est pas vide. Mais elle n'a pas encore recupere tout le patrimoine produit V1.

## Regle de migration recommandee

Ne pas copier les 234 Netlify Functions dans NestJS telles quelles.

Migration correcte :

1. Extraire les domaines V1.
2. Pour chaque domaine, redessiner le modele multi-tenant.
3. Ajouter `tenant_id` sur toutes les ressources metier.
4. Definir les roles.
5. Definir les RLS.
6. Migrer les endpoints utiles seulement.
7. Ajouter tests.
8. Supprimer les doublons Netlify / Edge.

## Ordre conseille

1. Socle catalogue Cimolace : `tenant_services`, engines, infrastructure templates.
2. Ecole/ISNA produit pilote : courses, students, teachers, live avance.
3. LIRI core : SmartBoard, Masterclass, course builder, NeuroRecall.
4. Replay/video workers.
5. Booking/secretariat.
6. Billing SaaS tenant + Pay Engine multi-provider.
7. Marketing/growth avance.
8. Forum/communaute/messaging.
9. MedOS.
10. Mbolo/VirtuelMbolo.
11. Mobile eleve.

## Conclusion

La migration a commence, mais elle n'est pas terminee.

`isna-opus` est la meilleure base pour Cimolace V2 parce qu'il prouve les invariants les plus importants : tenant, paiement, access pass, LiveKit, Supabase JWT. Mais il ne contient encore qu'une petite partie du backend produit V1.

Le prochain vrai chantier n'est pas "continuer a coder MedOS directement". Le prochain chantier est de poser le **catalogue Cimolace multi-tenant**, puis migrer les produits V1 un par un comme moteurs activables.
