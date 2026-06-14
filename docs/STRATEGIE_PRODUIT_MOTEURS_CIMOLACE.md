# Stratégie produit Cimolace — moteurs autonomes & politique commerciale

> Répond à : le booking/calendrier intelligent doit-il être un **produit séparé multi-tenant** (concurrent Google Calendar/Calendly) ? séparé de Liri ou embarqué ? Liri doit-il embarquer par défaut tout ISNA (secrétariat, RDV) ou tout séparer ? Et quelle **politique commerciale** pour concurrencer Zoom + les plateformes LLM.
> 2026-06-14.

---

## 0. Le principe qui tranche tout : « moteur = brique autonome ET composable »

Tu as déjà inventé la bonne réponse avec **Liri** : un moteur n'est **jamais « dans » un autre**. Il est :
- **vendable seul** (activable, embeddable via clé API / SDK),
- **composable** : d'autres moteurs/infrastructures l'**activent** et **communiquent** avec lui.

→ La question « séparé OU embarqué » est un **faux dilemme**. La réponse est **les deux**, via le modèle moteur. Applique à Booking exactement ce que tu as fait pour Liri.

```
Plateforme Cimolace
 ├── Moteurs (autonomes, vendables seuls, composables)
 │     Liri (live) · Booking (RDV/calendrier) · Liri Brain (IA) · MedOS · Mbolo · Messaging · Pay …
 └── Infrastructures (bundles prêts à l'emploi)
       École/ISNA = Liri + Booking + Messaging + School-core + Pay …
       Santé/MedOS = MedOS + Booking + Liri + …
```

---

## 1. Le moteur Booking / Calendrier intelligent

**Décision : en faire un moteur AUTONOME `booking_engine` (alias « Liri Booking »), frère de Liri — pas un sous-module de Liri.**

- **Vendable seul** → concurrent **Calendly / Cal.com / Google Calendar** : un client ajoute juste la prise de RDV sur son site (embed API/SDK), sans école ni live. **Point d'entrée à faible friction** (marché énorme, cycle de vente court).
- **Composable** → Liri et l'École l'**activent**. Quand Liri est activé à côté, le moteur Booking **communique** avec lui (pont RDV → séance live, exactement le `booking-start-immersive-live` de v1). Quand Liri n'est pas là, le Booking marche seul (juste un RDV, un ICS, un rappel).
- **Remplace `calendar`** (trop pauvre) dans le catalogue.

> Donc : **ni « séparé de Liri » ni « embarqué dans Liri » exclusivement.** C'est un **moteur indépendant qui sait parler à Liri**. Liri ne le contient pas ; il l'utilise s'il est activé — comme l'École utilise Liri.

**Ce qu'il embarque** (porté de v1) : disponibilités, `secretaryMatching` (scoring pondéré), `timezoneRouting`, création/validation/reschedule RDV, relances, satisfaction, ICS, **et le pont RDV→live** (actif seulement si Liri est activé).

**Pourquoi autonome plutôt qu'« dans Liri » :** un client qui veut juste des RDV (un coach, un cabinet, un artisan) n'a pas besoin du moteur live. Si Booking était « dans Liri », tu lui imposerais Liri → friction et prix. Autonome, il devient un **produit d'appel** indépendant.

---

## 2. Le moteur École / secrétariat : faut-il tout mettre dans Liri ?

**Décision : NON. Liri reste le moteur live pur. Le secrétariat / RDV / messagerie restent des moteurs séparés que l'INFRASTRUCTURE École assemble.**

- Si Liri embarquait par défaut le secrétariat scolaire, les RDV, la messagerie qualifiante… il **perdrait son autonomie** : un site qui veut juste du live (concurrent Zoom) se verrait imposer un secrétariat d'école dont il n'a rien à faire. **Anti-vente.**
- À la place : **ISNA = l'infrastructure « École »** = un **bundle** qui active Liri + Booking + Messaging + School-core + Pay… C'est l'infrastructure (pas Liri) qui reproduit **ISNA v1 au pixel**.
- « Avoir par défaut tout ce qu'ISNA v1 a » = **vrai au niveau de l'infrastructure École**, **faux au niveau du moteur Liri**.

> Règle : **Liri = produit horizontal** (live, vendable à tous). **École = produit vertical** (bundle de moteurs). On ne gonfle jamais l'horizontal avec du vertical.

---

## 3. Politique commerciale — concurrencer Zoom + les plateformes LLM

### Trois produits-moteurs « d'appel » (vendables seuls, embeddables)
| Produit (moteur) | Concurrence | Promesse | Entrée |
|---|---|---|---|
| **Liri Studio** | Zoom, Riverside, StreamYard | Live + smartboard + replay, **white-label, embeddable** dans ton site | clé API / SDK |
| **Booking** | Calendly, Cal.com, Google Calendar | RDV intelligents (routing, secrétariat, rappels, ICS) | clé API / SDK |
| **Liri Brain** | ChatGPT/assistants, plateformes LLM | Assistant IA multi-modèles **branché sur tes données tenant** + tes lives | clé API |

### La vente « solution complète » : les infrastructures
Au-dessus des moteurs, les **infrastructures clé-en-main** (École/ISNA, Santé/MedOS, Créateur, Temple…) = la vente à plus forte valeur, prête à l'emploi, white-label.

### Modèle de tarification recommandé : **land-and-expand**
1. **Land** (entrée à faible friction) : le client active **un** moteur (Booking ou Liri) et l'embed sur son site existant. Prix bas, valeur immédiate.
2. **Expand** : il active d'autres moteurs (Liri + Booking + Brain), puis bascule sur une **infrastructure** complète (son « espace » white-label).
3. **Tarif** : à la carte (par moteur, à l'usage : minutes live, RDV, tokens IA) **OU** packs (infrastructures, abonnement mensuel). Quotas par moteur (déjà prévus dans le back-office).

### Pourquoi tu gagnes contre Zoom et contre les LLM
- **Vs Zoom** (live seul) : toi = live **+ IA + booking + verticaux (école/santé)**, **multi-tenant**, **white-label** (branding du tenant), **embeddable**. Zoom ne sait pas devenir « l'école de quelqu'un ».
- **Vs plateformes LLM** (chat seul) : toi = l'IA **plus** le live, le booking et les **moteurs verticaux** (l'IA agit **dans** un contexte métier réel, pas un chat hors-sol).
- **Vs Calendly** : ton booking est **routé/intelligent** (régions, SLA, secrétariat) **et** se prolonge en **séance live** d'un clic — Calendly s'arrête au créneau.
- **L'effet plateforme** : un client entré par le Booking peut, sans changer d'outil, ajouter le live, l'IA, puis devenir une infrastructure complète. **Chaque moteur est une porte d'entrée vers tout l'écosystème.**

---

## 4. Décisions concrètes qui découlent de cette politique

1. Créer le moteur **`booking_engine`** autonome (porter `_lib/booking/` de v1 en NestJS multi-tenant), avec **mode sans-Liri** (RDV/ICS seuls) et **mode avec-Liri** (pont RDV→live activé si Liri présent).
2. Lui donner sa **clé API / SDK / embed** propre (comme Liri) → vendable seul.
3. **Remplacer `calendar`** par `booking_engine` dans le catalogue (après audit des usages de `'calendar'`).
4. **Ne pas** gonfler Liri : le secrétariat/RDV/messagerie restent des moteurs activés par l'**infrastructure École**, pas par Liri.
5. Garder **ISNA = infrastructure École** comme bundle de référence « pixel-pixel v1 ».
