# Strategie ZahirWellness vers Mbolo / VirtuelMbolo

Derniere mise a jour : 2026-05-10

## Verdict

ZahirWellness ne doit pas etre modifie directement.

ZahirWellness est un site client deja en ligne, cree par Cimolace/ngowazulu. Il doit servir de reference terrain pour construire le moteur e-commerce Cimolace : **Mbolo / VirtuelMbolo**.

Le bon modele n'est pas :

```txt
copier Zahir dans Cimolace et casser l'existant
```

Le bon modele est :

```txt
ZahirWellness actuel
  -> reste en ligne
  -> est clone/audite en lecture seule
  -> sert de blueprint e-commerce
  -> devient progressivement un tenant ou une integration moteur Cimolace
```

## Compréhension produit

Mbolo / VirtuelMbolo est le moteur e-commerce de Cimolace. Il doit devenir la base "Shopify Cimolace" :

- catalogue produits ;
- panier ;
- commandes ;
- paiements locaux / mobile money ;
- back-office marchand ;
- notifications client ;
- domaine personnalise ;
- branding complet ;
- API e-commerce reutilisable ;
- installation dans un site existant.

ZahirWellness est le cas client reel :

- site deja en production ;
- boutique personnalisee ;
- back-office propre au client ;
- mono-tenant aujourd'hui ;
- code source disponible ;
- hebergement/charge technique a terme porte par Cimolace ;
- domaine et experience client restent ZahirWellness.

## Deux offres commerciales Cimolace a documenter

### 1. Plateforme hebergee complete

Le client cree son espace dans Cimolace, choisit l'infrastructure Mbolo, puis Cimolace heberge toute l'experience :

```txt
Client -> Cimolace onboarding -> tenant -> Mbolo -> boutique + back-office + domaine
```

Exemples :

- nouvelle boutique ;
- createur qui veut vendre ;
- commerce sans site existant.

### 2. Integration moteur dans site existant

Le client a deja son site et veut seulement installer un moteur Cimolace.

```txt
Site existant client
  -> garde son domaine et son frontend
  -> branche API/SDK Cimolace
  -> active un moteur : Mbolo, LIRI, MedOS, etc.
```

ZahirWellness doit etre documente comme ce cas :

```txt
ZahirWellness
  -> site client existant
  -> integration du moteur Mbolo/VirtuelMbolo
  -> back-office personnalise
  -> infrastructure technique Cimolace
```

Cela devient une option commerciale officielle : "Vous gardez votre site, Cimolace installe seulement le moteur dont vous avez besoin."

## Critique

### Ce qui est bon

- ZahirWellness est deja un produit concret, pas une idee abstraite.
- Le code source donne une base e-commerce reelle.
- Le client existant force a penser domaine personnalise, branding, back-office et contraintes de production.
- C'est un excellent pilote pour transformer Mbolo en moteur commercialisable.

### Risques

1. **Risque de casser un client en ligne**  
   Interdiction de modifier le projet prod directement.

2. **Risque de copier une logique mono-tenant dans un moteur multi-tenant**  
   Le code Zahir doit etre extrait en domaines generiques, pas recopie tel quel.

3. **Risque de melanger marque client et moteur Cimolace**  
   ZahirWellness est une marque client. Mbolo est le moteur Cimolace. Les deux doivent rester separes.

4. **Risque de contrat / propriete / donnees**  
   Meme si le code a ete cree par toi, il faut garder une separation claire : donnees client, domaine, commandes, paiements, branding.

5. **Risque d'architecture hybride non documentee**  
   Si un site client utilise seulement l'API Mbolo, il faut documenter auth, tokens, webhooks, CORS, quotas, facturation, support.

6. **Risque de dette si on garde le mono-tenant trop longtemps**  
   Le clone doit servir a extraire un moteur, pas devenir une seconde V1.

## Proposition d'architecture

### Couche Cimolace

Dans `isna-opus`, ajouter a terme :

```txt
apps/api/src/mbolo
  catalog
  products
  inventory
  carts
  orders
  payments
  customers
  notifications
  storefront-api
  admin-api
```

Tables cible :

```txt
mbolo_stores
mbolo_products
mbolo_product_variants
mbolo_collections
mbolo_inventory
mbolo_customers
mbolo_carts
mbolo_orders
mbolo_order_items
mbolo_payments
mbolo_shipping_methods
mbolo_discounts
mbolo_storefront_tokens
mbolo_webhooks
```

Toutes les tables doivent avoir `tenant_id`.

### Couche ZahirWellness

Zahir devient :

```txt
tenant: zahirwellness
infrastructure: mbolo
mode: embedded_site
domain: domaine Zahir
branding: ZahirWellness
features:
  - catalog
  - orders
  - payments
  - backoffice
  - notifications
```

Zahir peut garder :

- son domaine ;
- son design ;
- ses contenus ;
- son back-office personnalise ;
- ses regles commerciales.

Mais les charges techniques passent progressivement vers Cimolace :

- API ;
- base de donnees ;
- paiements ;
- notifications ;
- logs ;
- sauvegardes ;
- monitoring ;
- securite.

## Plan de migration recommande

### Phase 0 - Protection

- Identifier le repo source ZahirWellness exact.
- Creer un clone de travail separe.
- Ne jamais travailler directement sur le projet prod.
- Documenter URL prod, stack, variables, deploy, domaines, providers paiement.

### Phase 1 - Audit Zahir

- Cartographier les pages.
- Cartographier le back-office.
- Cartographier le schema DB/API.
- Cartographier paiements, commandes, produits, clients, notifications.
- Identifier ce qui est generique e-commerce vs specifique Zahir.

### Phase 2 - Modele Mbolo generique

- Definir le domaine e-commerce Cimolace.
- Creer schema multi-tenant Mbolo.
- Definir roles : owner, admin, merchant, staff, customer.
- Definir API publique storefront et API admin.
- Definir webhooks et tokens d'integration site externe.

### Phase 3 - Premier moteur Mbolo dans Cimolace

- Implementer Mbolo dans `isna-opus`.
- Garder le site Zahir en place.
- Creer un tenant `zahirwellness` dans dev/staging.
- Importer des donnees test depuis Zahir.
- Verifier catalogue -> panier -> commande -> paiement -> notification.

### Phase 4 - Integration Zahir sans bascule brutale

- Brancher une page ou un flux non critique sur l'API Mbolo.
- Comparer avec le comportement prod.
- Ajouter feature flags.
- Faire shadow mode si possible : lecture depuis Mbolo sans encaisser d'abord.
- Ensuite basculer progressivement.

### Phase 5 - Offre commerciale

Documenter dans Cimolace :

- "Mbolo heberge complet" ;
- "Mbolo integration dans site existant" ;
- "Moteur seul : API + back-office" ;
- "Moteur + migration de site existant" ;
- "Moteur white-label avec domaine client".

## Regle pour les agents

Tout agent doit respecter ceci :

- Ne pas toucher au site ZahirWellness en ligne.
- Ne pas modifier le repo source avant audit et clone de travail.
- Ne pas copier du code mono-tenant sans extraction multi-tenant.
- Ne pas melanger branding Zahir et branding Mbolo.
- Ne pas lancer Mbolo avant d'avoir `tenant_id`, RBAC, paiements signes, logs et tests.
- Documenter chaque decision dans le rapport de migration Mbolo.

