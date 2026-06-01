# Product Flows V2 — Document obligatoire avant développement lourd

## Pourquoi ce document existe

La V2 ne doit pas devenir une architecture complexe sans produit clair.

Avant de coder l'API, les workers ou les modules lourds, il faut verrouiller les flux métier réels : acquisition, tenant, onboarding, branding, paiement, live, vidéo, rôles et données.

## Verdict actuel

```txt
Architecture : forte
Vision produit opérationnelle : insuffisamment cadrée
Risque : coder une infrastructure sans parcours utilisateur validé
```

## Règle de blocage

Aucun développement lourd sur `apps/api`, `apps/worker`, billing, live ou vidéo ne doit commencer sans validation minimale des flux ci-dessous.

---

# 0. Décisions produit verrouillées — NE PAS MODIFIER SANS DÉCISION EXPLICITE

Ces 5 décisions sont verrouillées pour le MVP. Tout code qui les contredit sera rejeté.

## Décision 1 — Client principal unique

```txt
MVP cible UN SEUL avatar : le formateur indépendant.
```

Pourquoi :

- cycle court
- décision rapide
- besoin immédiat de monétiser
- pas de structure complexe
- onboarding simple

Pas d'école, pas d'entreprise, pas de marketplace pour le MVP.

## Décision 2 — Création du tenant

```txt
Auto-création après inscription. Pas de validation manuelle. Pas d'attente de paiement.
```

Pourquoi :

- friction minimale
- onboarding rapide
- test produit immédiat
- conversion optimale

## Décision 3 — Modèle de vente du live

```txt
MVP = paiement à l'unité uniquement. Pas d'abonnement.
```

Pourquoi :

- simple
- compréhensible
- rapide à implémenter
- pas de logique billing complexe
- validation rapide du besoin

## Décision 4 — Parcours student

```txt
Paiement d'abord → compte auto-créé ensuite.
```

Pourquoi :

- réduit friction
- augmente conversion
- standard moderne
- pas de compte obligatoire avant achat

## Décision 5 — Prorascience comme tenant

```txt
OUI. Prorascience est un tenant dans sa propre plateforme.
```

Pourquoi :

- dogfooding obligatoire
- test réel
- crédibilité
- modèle validé
- détection bugs avant clients

---

# 1. Acteurs principaux

## Visitor

Utilisateur non connecté qui découvre le site public.

## Prospect

Utilisateur qui a laissé un email, demandé une démo ou commencé une inscription.

## Tenant Owner

Client principal qui possède un espace SaaS : école, institut, formateur, entreprise ou organisation.

## Admin Tenant

Administrateur interne d'un tenant.

## Teacher / Host

Personne qui crée ou anime des lives, formations, cours et replays.

## Student / Learner

Utilisateur final qui consomme les lives, vidéos, cours, exercices, forum.

## Secretariat / Support

Rôle opérationnel pour rendez-vous, assistance, relances, gestion inscriptions.

## Platform Owner

Administrateur global ISNA/LIRI/CIMOLACE.

---

# 2. Flow principal SaaS — acquisition à activation

## Flow A — Découverte publique

```txt
Visitor arrive sur public-site
  ↓
Lit page commerciale / offre / live / formation
  ↓
Clique CTA : commencer, demander démo, créer espace
  ↓
Devient Prospect
```

## Décisions à valider

- [ ] CTA principal : essai gratuit, demande démo, achat direct ou création espace ?
- [ ] Est-ce que le tenant est créé automatiquement ou après validation manuelle ?
- [ ] Est-ce qu'il y a un plan gratuit ?
- [ ] Est-ce qu'un visiteur peut acheter une formation sans créer de tenant ?

---

# 3. Flow tenant — création espace client

## Flow B — Création tenant

```txt
Prospect crée un compte
  ↓
Choisit type d'organisation
  ↓
Crée Tenant
  ↓
Devient Tenant Owner
  ↓
Configure branding minimal
  ↓
Accède au dashboard
```

## Données minimales tenant

- tenant_id
- name
- slug
- owner_user_id
- plan
- status
- billing_status
- primary_domain
- logo_url
- brand_colors
- timezone
- locale

## Décisions à valider

- [ ] Un utilisateur peut-il posséder plusieurs tenants ?
- [ ] Un tenant peut-il avoir plusieurs domaines ?
- [ ] Le slug tenant est-il obligatoire ?
- [ ] Les tenants sont-ils activés immédiatement ou après paiement ?

---

# 4. Flow onboarding tenant

## Flow C — Configuration initiale

```txt
Tenant Owner arrive dans dashboard
  ↓
Checklist onboarding
  ↓
1. Branding
  ↓
2. Offre ou formation à vendre
  ↓
3. Moyen de paiement
  ↓
4. Planning live ou catalogue vidéo
  ↓
5. Invitation équipe / élèves
  ↓
Tenant activé
```

## MVP onboarding obligatoire

- [ ] Branding minimal
- [ ] Profil organisation
- [ ] Plan / billing status
- [ ] Premier produit ou live
- [ ] Moyen de paiement ou mode test

---

# 5. Flow live payant

## Flow D — Création live

```txt
Teacher/Admin crée un live
  ↓
Choisit titre, date, prix, capacité, replay oui/non
  ↓
API crée LiveSession
  ↓
API crée règles accès/paiement
  ↓
LiveKit room créée au moment nécessaire
  ↓
Page inscription publique/privée générée
```

## Flow E — Achat live par élève

```txt
Student ouvre page live
  ↓
Se connecte ou crée compte
  ↓
Paye ou utilise accès offert
  ↓
Reçoit ticket/access pass
  ↓
Avant live : waiting room
  ↓
Pendant live : accès LiveKit
  ↓
Après live : replay disponible si autorisé
```

## Décisions à valider

- [ ] Live vendu à l'unité ou via abonnement ?
- [ ] Replay inclus ou option payante ?
- [ ] Capacité maximale par plan ?
- [ ] Est-ce que le live peut être gratuit ?
- [ ] Qui peut créer un live ?

---

# 6. Flow vidéo / formation

## Flow F — Création contenu vidéo

```txt
Teacher upload/capture vidéo
  ↓
Vidéo source stockée temporairement
  ↓
Job transcription / chapitrage / mindmap
  ↓
Option post-production SmartBoard/NLE
  ↓
Worker FFmpeg génère export
  ↓
Vidéo finale envoyée vers Mux/Cloudflare Stream
  ↓
Cours publié dans catalogue tenant
```

## Flow G — Consommation cours

```txt
Student achète ou obtient accès
  ↓
Ouvre Lesson Player
  ↓
Regarde vidéo
  ↓
Consulte chapitres, transcript, mindmap
  ↓
Pose questions IA si autorisé
  ↓
Progression sauvegardée
```

## Décisions à valider

- [ ] Vidéo vendue seule, en module ou abonnement ?
- [ ] Quelle limite stockage/temps vidéo par plan ?
- [ ] IA question/réponse incluse ou payante ?
- [ ] Certificat à la fin ?

---

# 7. Flow paiement

## Flow H — Paiement tenant SaaS

```txt
Tenant Owner choisit plan
  ↓
Paiement abonnement
  ↓
Webhook confirme paiement
  ↓
Tenant plan/status mis à jour
  ↓
Limites plan appliquées
```

## Flow I — Paiement élève contenu/live

```txt
Student choisit produit/live
  ↓
Checkout
  ↓
Webhook confirme paiement
  ↓
AccessPass créé
  ↓
Student accède au contenu
```

## Règle stricte

Le paiement ne doit jamais être géré uniquement côté frontend. Tous les accès doivent être accordés côté API après confirmation webhook.

---

# 8. Flow marketing tools

## Flow J — Outil marketing tenant

```txt
Tenant Admin crée promo/popup/banner/proof
  ↓
API valide permissions tenant
  ↓
Objet marketing stocké avec tenant_id
  ↓
Public-site/app affiche selon règles
  ↓
Interactions trackées
```

## Module pilote

Marketing Tools est le premier module à migrer car il teste :

- tenant_id
- rôles
- API V2
- UI V2
- tracking
- sécurité basique

---

# 9. Questions produit bloquantes

Ces questions doivent être répondues avant développement lourd.

## Business model

- [ ] SaaS vendu aux écoles/formateurs ?
- [ ] Marketplace de lives/formations ?
- [ ] Les deux ?
- [ ] Prorascience vend ses propres contenus aussi ?

## Tenant

- [ ] Tenant automatique ou manuel ?
- [ ] Multi-tenant strict par `tenant_id` ?
- [ ] Domaine custom dès MVP ou plus tard ?
- [ ] Branding par tenant dès MVP ?

## Live

- [ ] Live individuel payant ?
- [ ] Live inclus dans abonnement ?
- [ ] Replay automatique ?
- [ ] Capacité par plan ?

## Vidéo

- [ ] Mux ou Cloudflare Stream ?
- [ ] Stockage source temporaire où ?
- [ ] Export SmartBoard dès MVP ou phase 2 ?

## Paiement

- [ ] Stripe prioritaire ?
- [ ] CinetPay/Chariow dès MVP ?
- [ ] Factures tenant ?
- [ ] Commission plateforme ?

---

# 10. MVP recommandé strict

Le MVP ne doit pas tout faire.

## MVP V2 doit prouver

```txt
Un tenant peut créer un espace,
configurer son branding,
créer un live payant,
encaisser un paiement test,
et donner accès à un élève.
```

## MVP inclus

- Site public simple
- Création compte owner
- Création tenant
- Branding minimal
- Création live
- Checkout test
- Access pass
- Accès live LiveKit
- Replay placeholder ou manuel
- Marketing promo basique

## MVP exclut au départ

- Rendu vidéo avancé
- Marketplace complexe
- Multi-domaines custom avancés
- Billing multi-provider complet
- IA lourde complète
- Automation marketing complète
- Mobile natif final

---

# 11. Définition de succès MVP

Le MVP est valide si :

- [ ] Un owner crée son tenant.
- [ ] Il configure nom/logo/couleurs.
- [ ] Il crée un live payant.
- [ ] Un student achète le live en mode test.
- [ ] Le webhook crée un access pass.
- [ ] Le student rejoint le live.
- [ ] Les accès sont filtrés par tenant_id.
- [ ] La V1 reste intacte.
