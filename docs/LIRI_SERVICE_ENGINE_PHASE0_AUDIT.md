# LIRI Service Engine — PHASE 0 : audit de l'existant

Audit conduit le 7 août 2026 sur la base de production et le dépôt.
Méthode : inventaire réel (401 tables interrogées, comptages de lignes,
lecture des modules), pas lecture de documentation.

**Le comptage de lignes est le discriminant central de ce rapport.** Une table
peut exister, être bien conçue, et n'avoir jamais servi. Plusieurs des « moteurs »
que le cahier des charges suppose absents existent en schéma mais sont vides ;
d'autres qu'on croirait à construire tournent déjà en production.

---

## 1. EXISTANT — réutilisable tel quel

### Multi-tenant et rôles — solide, à ne pas retoucher

`tenants` (6), `tenant_memberships` (71), `profiles` (52).
`TenantGuard` pose `req.tenant.userRole` = rôle porté par l'**appartenance**,
et `RolesGuard` le lit. C'est le bon modèle, et il est déjà appliqué partout.

⚠️ Leçon récente à ne pas reperdre (7 août) : une policy RLS qui interroge
`profiles.role` — l'ancien rôle GLOBAL — au lieu de `tenant_memberships` donne
des droits à des comptes qui ne devraient pas en avoir, et en refuse aux vrais
propriétaires. Toute nouvelle table du Service Engine doit se cloisonner par
`tenant_memberships`, jamais par `profiles.role`.

### Booking Engine — beaucoup plus complet que le cahier ne le suppose

Module `apps/api/src/booking/` : 4 contrôleurs, un dossier `engine/`.
Endpoints déjà en place :

```
GET  :slug/availability          POST slots            GET  slots/availability
POST :slug/appointment-request   GET  master-calendar  GET  settings
POST reschedule/request          POST reschedule/:token
POST invitations/send            POST invitations/respond
POST reminders/schedule          POST reminders/cron-tick
GET  satisfaction/:apptId        POST satisfaction/respond
GET  appointments/:id/ics
POST appointments/:id/start-live      ← le pont Booking → LIRI Live EXISTE
```

Tables vivantes : `appointments` (17), `booking_slots` (17),
`booking_invitations` (12), plus report, rappels, satisfaction, événements.

**Le §17 du cahier des charges (LIRI Live automatique) est donc déjà couvert
à ~80 %.** Il reste à le déclencher depuis un *service* plutôt que depuis un
rendez-vous créé à la main.

### LIRI Live — 49 tables, mature

`live_sessions` (101), scènes, blueprints, scripts, participants,
enregistrements, salle d'attente, invitations, codes de participation.
Le moteur scénarisé du §20 (Worship) existe : `live_scenes`, `live_scripts`,
`live_script_sections`.

### Paiement — éprouvé en production, sur deux fournisseurs

Stripe (carte, EUR) et pawaPay (Mobile Money, XAF/XOF) fonctionnent réellement :
`cagnotte_donations` (36 dons), `digital_orders` (vente du livre), `pawapay_deposits`.
Le peg CFA, la normalisation MSISDN et la réconciliation paresseuse sont écrits
et testés.

### Notifications — complet

`email_queue` + worker Resend (expéditeur par tenant), WhatsApp Cloud API
(gabarit `rdv_notification` en production), SMS, push, préférences.

### Verticales déjà présentes

| Verticale | État |
|---|---|
| **Care** (MEDOS) | `med_appointments` (36), `med_practitioner_availability` (5), dossiers, imagerie, téléconsultation |
| **Learn** | formations, vie scolaire, vidéothèque, forum, présence |
| **Worship** | scènes, scripts, cagnotte, RDV de prière |
| **Commerce** (mbolo) | `mbolo_products` (6), `mbolo_orders` (8), variantes, catégories |

### CRM

`crm_contacts` + `crm_activities`, déjà alimentés par la cagnotte, la boutique
et les demandes d'accompagnement.

---

## 2. PARTIEL — existe, mais ne couvre pas le besoin

### ⛔ `services` n'est PAS multi-tenant

**C'est le point le plus important de cet audit.**

```
services : AUCUNE colonne tenant_id → table GLOBALE
2 lignes : vitalis-detox, vitalis-premium (offres Prorascience)
```

Schéma actuel : `slug`, `nameFr/En`, `descriptionFr/En`, `featuresFr/En`,
`priceEUR`, `priceOverrides`, `serviceType`, `durationDays`, `durationMinutes`,
`image`, `icon`, `gallery`, `faqFr/En`, `isActive`, `sortOrder`.

Manquent, par rapport au §5 : capacité, individuel/groupe, mode de délivrance,
temps de préparation, tampon entre rendez-vous, acompte, annulation,
remboursement, questionnaire, documents requis, personnel autorisé,
localisation, options, extras, ressources, abonnement requis, pack, promotion.

**Y ajouter les services des tenants sans `tenant_id` créerait une fuite
inter-tenant immédiate.** C'est rédhibitoire.

### ⚠️ `tenant_services` ne désigne PAS des services vendus

64 lignes, mais son contenu est : `liri_brain`, `liri_live`, `liri_replay`,
`course_builder`, `liri_masterclass`, `liri_smartboard`, `studio_creator`…

C'est **l'activation des moteurs Cimolace par tenant**, pas le catalogue d'un
tenant vers ses clients. Le nom est un piège : tout développeur qui lit
« tenant_services » croira avoir trouvé le catalogue. À documenter fortement,
voire à renommer (`tenant_enabled_engines`).

### Abstraction de paiement — déclarée mais contournée

`billing/payment-provider.interface.ts` déclare six fournisseurs
(stripe, chariow, cinetpay, pawapay, nowpayments, paypal).
`billing/providers/` n'en implémente que **trois** : chariow, cinetpay,
nowpayments-paypal.

**Stripe et pawaPay — les deux seuls réellement utilisés — ne passent pas par
l'abstraction.** Ils vivent dans `stripe-rest.util.ts` et le module `pawapay/`.

De plus `CreateCheckoutInput` est taillé pour l'abonnement (`planId`,
`priceCents`) : il ne sait pas décrire une réservation, un pack ou un devis.

### Disponibilités — deux systèmes, aucun par service

- par **tenant** : `tenants.metadata.booking_availability`
- par **praticien MEDOS** : `med_practitioner_availability` (5)

Rien par service, ni par membre d'équipe hors MEDOS. Le §7 demande les deux.

### Abonnements — dans le mauvais sens

`billing_plans` (66), `billing_subscriptions` (16), `billing_invoices` (10)
décrivent **Cimolace → tenant** (le SaaS facture ses clients).
Le §10 demande **tenant → client final**. Le moteur est réutilisable dans sa
mécanique (Stripe, renouvellement, webhooks) mais pas dans son modèle.

### Crédits — existent, mais pour l'IA

`ai_credit_balances`, `ai_credit_transactions` (419), `ai_quotas`,
`ai_plan_quotas`. La mécanique de débit/solde est écrite et éprouvée.
Le §11 demande des crédits **de prestation** (2 coiffures/mois). Le patron est
réutilisable, le domaine non.

---

## 3. MANQUANT — à construire

| Besoin | §  | Remarque |
|---|---|---|
| Catalogue de services **par tenant** | 5 | le cœur du cahier des charges |
| Catégories / sous-catégories | 5 | |
| Modes de délivrance (LIRI / sur place / domicile / hybride / groupe / événement / devis) | 6 | |
| Affectation à un membre d'équipe | 8 | rôle `provider` inexistant |
| Options, extras, ressources | 5 | |
| Zones de déplacement, frais, rayon | 9 | |
| Crédits de prestation | 11 | patron IA réutilisable |
| Packs | 12 | |
| Promotions / coupons | 13 | |
| Devis | 14 | |
| Panier et commande **unifiés** | 15 | voir CONFLITS |
| Espace client centralisé | 25 | |
| Page publique LIRI Space / marketplace | 24 | |
| Vertical Experience Engine | 23 | `tenant_type` n'existe pas |
| Bus d'événements / automatisations | 29 | |
| AI Service Builder | 28 | |

---

## 4. CONFLITS — à traiter avant d'écrire une ligne

### ⛔ 1. Il existe DÉJÀ quatre systèmes de commandes parallèles

C'est précisément l'anti-pattern que le §22 interdit — et il est déjà installé :

| Table | Lignes | Pour |
|---|---|---|
| `cagnotte_donations` | 36 | dons |
| `mbolo_orders` | 8 | boutique mbolo |
| `digital_orders` | — | vente du livre |
| `pawapay_deposits` | 2 | Mobile Money brut |

Et en face, **le commerce générique n'a jamais servi** :
`orders` (0), `order_items` (0), `cart_items` (0), `checkouts` (0),
`payments` (0), `payment_transactions` (0), `invoices` (0), `subscriptions` (0).

**Ajouter un cinquième silo aggraverait le problème.** Décision structurante à
prendre : soit le Service Engine adopte `orders`/`order_items` (vides, donc
libres de contrainte) comme table de commande unique et on y migre
progressivement les silos, soit on assume définitivement les silos. Le cahier
des charges tranche pour l'unification (§15).

### ⛔ 2. `services` global (voir PARTIEL)

Deux issues :
- **(a)** ajouter `tenant_id` à `services` et migrer les 2 lignes existantes
  vers le tenant `isna`. Peu de données à déplacer, table réutilisée, nom
  conservé. **Recommandé.**
- **(b)** créer `liri_services` à côté et laisser `services` mourir. Crée un
  doublon de plus, contre l'esprit du §22.

### ⚠️ 3. Trois tables d'abonnement

`subscriptions` (0), `billing_subscriptions` (16), `cimolace_subscriptions` (2).
La table vide est la seule libre. Décider laquelle porte le tenant → client.

### ⚠️ 4. Deux moteurs de rendez-vous

`appointments` + `booking_slots` (LIRI) et `med_appointments` (MEDOS).
Le Service Engine doit s'appuyer sur le premier et laisser MEDOS intact —
la cloison MEDOS ≠ Formation est une règle établie du projet.

### ⚠️ 5. Le rôle `provider` n'existe pas

`TenantRole` = owner, admin, member, viewer, teacher, practitioner,
clinic_admin, receptionist, patient, secretariat.
Le §33 demande `provider` et `staff`. `practitioner` peut jouer ce rôle en
Care ; il en faut un générique pour Beauty/Business.

### ⚠️ 6. Nommage `tenant_services` (voir PARTIEL)

---

## 5. MODÈLE DE DONNÉES PROPOSÉ

Principe : **étendre plutôt que dupliquer**, et n'introduire une table que
lorsqu'aucune existante ne peut porter le besoin.

### On étend

```
services              + tenant_id (⛔ bloquant), delivery_mode, capacity,
                        is_group, buffer_before/after, deposit_*, cancellation_*,
                        requires_booking, requires_payment, questionnaire_id,
                        category_id, is_public
orders / order_items    (vides) → deviennent la commande unifiée
subscriptions           (vide)  → devient tenant → client
booking_slots           + service_id, provider_user_id
appointments            + service_id, order_id
TenantRole              + 'provider'
tenants.metadata        + tenant_type (healthcare|education|worship|beauty|business)
```

### On crée

```
service_categories        service_options        service_providers
service_availability      service_resources      service_zones (domicile)
packs / pack_items        promotions / coupons   quotes / quote_items
service_credits (ledger, calqué sur ai_credit_transactions)
liri_space (vitrine publique du tenant)
automation_events (bus)
```

### On ne touche pas

MEDOS, LIRI Live, formations, forum, messagerie, CRM, notifications.

---

## 6. PLAN DE MIGRATION SANS CASSE

1. `alter table services add column tenant_id uuid references tenants(id)` —
   nullable d'abord, puis remplir les 2 lignes avec le tenant `isna`, puis
   `not null`. RLS ajoutée ensuite, jamais avant le remplissage.
2. Aucune suppression de table à ce stade. Les silos (cagnotte, mbolo,
   digital_orders) restent en place et continuent de fonctionner ; la migration
   vers `orders` se fait silo par silo, après que le nouveau chemin soit prouvé.
3. Toute nouvelle table : `tenant_id not null` + RLS par `tenant_memberships`
   via fonction `SECURITY DEFINER` (les sous-requêtes d'une policy sont
   elles-mêmes filtrées par RLS — piège vérifié le 7 août sur `site_reviews`).
4. Migrations par psql hors-bande, jamais `supabase db push`.

---

## 7. PHASAGE PROPOSÉ (révisé après audit)

Le cahier des charges prévoit 11 phases. L'audit permet d'en raccourcir
plusieurs et d'en réordonner une.

| Phase | Contenu | Écart avec le cahier |
|---|---|---|
| **1** | `services` multi-tenant + catégories + Service Builder | inchangé |
| **2** | Disponibilités par service et par membre | le Booking Engine existe déjà : on le **branche**, on ne le réécrit pas |
| **3** | Commande unifiée + paiement via l'abstraction (y intégrer Stripe et pawaPay, aujourd'hui hors abstraction) | plus lourd que prévu |
| **4** | Booking → LIRI Live depuis un service | **quasi fait** (`start-live` existe) |
| **5** | Abonnements tenant → client + crédits de prestation | patron IA réutilisable |
| **6** | Packs, promotions, devis | inchangé |
| **7** | Équipe, ressources, domicile | rôle `provider` à ajouter |
| **8** | Page publique LIRI Space | inchangé |
| **9** | Vertical Experience Engine (`tenant_type`) | inchangé |
| **10** | AI Service Builder | inchangé |
| **11** | Automatisations, analytics | inchangé |

**Recommandation d'ordre** : traiter la **phase 3 avant la 2**. Le conflit des
quatre systèmes de commandes est structurant ; le résoudre après avoir branché
les réservations obligerait à tout reprendre.

---

## 8. DÉCISIONS QUI APPARTIENNENT AU FONDATEUR

Trois arbitrages conditionnent tout le reste. Ils ne sont pas techniques.

1. **Commande unifiée ou silos assumés ?** Unifier coûte une migration des
   quatre silos existants ; ne pas unifier condamne à un cinquième silo à
   chaque nouveau produit.
2. **`services` étendue ou nouvelle table ?** Étendre est plus propre et le
   volume de données est négligeable (2 lignes).
3. **Marketplace publique (§24) — maintenant ou plus tard ?** Elle change la
   modélisation de la visibilité dès la phase 1 (`is_public`, `slug` global).

Tant que ces trois points ne sont pas tranchés, écrire du code reviendrait à
parier sur une réponse.
