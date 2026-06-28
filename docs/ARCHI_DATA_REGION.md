# Architecture — Data residency multi-région (MEDOS / Cimolace)

> Statut : **FONDATION posée, adoption INCRÉMENTALE non commencée.** Zéro tenant
> n'est non-`global` aujourd'hui. Ce document décrit le mécanisme prêt à l'emploi
> et la marche à suivre pour onboarder un tenant français sur une instance HDS,
> **le jour où il existera**. Rien à faire maintenant côté call-sites.

## Pourquoi

MEDOS héberge des données de santé (PHI). Un tenant **français** exige à terme
un hébergement **HDS** (Hébergeur de Données de Santé, agréé Santé) dans l'**EEE**.
On ne veut PAS migrer tout MEDOS vers HDS aujourd'hui (coût, complexité, zéro
client FR), mais on veut pouvoir **brancher** une instance HDS dédiée pour les
futurs tenants FR **sans réarchitecturer**.

La fondation rend le système « region-ready » : chaque tenant porte une
**région de résidence** (`tenants.data_region`), et la couche d'accès aux
données sait router la connexion Supabase vers la bonne instance selon cette
région — tout en garantissant **zéro changement** pour les tenants existants.

## Pattern retenu — Option B (instance dédiée par région)

Plutôt que de partitionner une seule base (Option A, RLS par région) ou de faire
du sharding applicatif lourd (Option D), on retient l'**Option B** :

- **Une instance Supabase par région.**
  - `global` → la base mutualisée **actuelle** (tous les tenants d'aujourd'hui).
  - `eu-hds` → une instance **dédiée** HDS France (OVHcloud Healthcare, par ex.),
    provisionnée plus tard, qui n'hébergera que les données des tenants FR.
- Le routage se fait **à la connexion** : on choisit le bon `SupabaseClient`
  selon la région du tenant. Pas de réécriture des requêtes ni du schéma — les
  tables `med_*` sont les mêmes des deux côtés.

```
                        ┌──────────────────────────┐
  tenant.data_region ── │  SupabaseService          │
   'global' (défaut)    │   .forTenant(tenant)      │
                        │   .forRegion(region)      │
                        └───────────┬──────────────┘
                                    │  (cache 1 client / région)
              ┌─────────────────────┴─────────────────────┐
        region='global'                               region='eu-hds'
      SUPABASE_URL /                              SUPABASE_URL_EU_HDS /
      SUPABASE_SERVICE_ROLE_KEY                  SUPABASE_SERVICE_ROLE_KEY_EU_HDS
              │                                            │
   ┌──────────▼──────────┐                      ┌──────────▼──────────┐
   │  Base mutualisée     │                      │  Instance HDS France │
   │  (= this.client)     │                      │  (EEE, agréée Santé) │
   └──────────────────────┘                      └──────────────────────┘
```

## RÈGLE D'OR — passthrough `global` (zéro régression)

Le cœur de la sûreté de cette fondation :

> **`forRegion('global')` et `forTenant(tenant 'global'/sans data_region)`
> renvoient EXACTEMENT le `this.client` actuel — le même objet (identité), pas
> un nouveau client.**

Concrètement, dans `SupabaseService` :

- Le constructeur crée **un seul** client (`createClient` appelé **une fois**,
  comme avant) et **amorce le cache** : `regionClients.set('global', this.client)`.
- `forRegion(region)` normalise la région ; si elle vaut `'global'` (ou
  `null`/`undefined`/`''`), il **retourne `this.client` directement** — aucun
  nouveau client, aucune lecture d'env supplémentaire.
- Tout tenant existant a `data_region = 'global'` (défaut DB) → `forTenant(t)`
  rend le client mutualisé → **comportement strictement identique**.

Les régions **non-`global`** créent un client **à la demande** (lazy), **mis en
cache par région** (une instance par région, réutilisée), via `RegionService`.

## Composants livrés (le mécanisme, déjà câblé)

| Élément | Fichier | Rôle |
|---|---|---|
| Colonne `tenants.data_region` | `supabase/migrations/20260628160000_tenants_data_region.sql` | Source de vérité de la résidence (TEXT, défaut `'global'`, idempotente, **NON appliquée**) |
| `RegionService` | `apps/api/src/region/region.service.ts` | Mappe région → `{ url, serviceKey }` lus dans l'ENV ; liste des régions connues ; défaut `'global'` ; **erreur explicite** si région demandée mais non provisionnée |
| `RegionModule` | `apps/api/src/region/region.module.ts` | Fournit `RegionService` globalement |
| `SupabaseService.forRegion()` / `.forTenant()` | `apps/api/src/supabase/supabase.service.ts` | Renvoient un `SupabaseClient` **caché par région** ; **passthrough `global`** garanti |
| `TenantContext.data_region` | `apps/api/src/tenant/tenant.types.ts` + `resolveTenant` dans `tenant.service.ts` | La région du tenant remonte dans le contexte (défaut `'global'`) |

### Régions connues & variables d'environnement

Déclarées dans `REGION_ENV` (`region.service.ts`). Ajouter une région = **une
entrée** + ses deux variables d'env. Aucun changement dans les consommateurs.

| Région | URL | Service-role key | Provisionné ? |
|---|---|---|---|
| `global` | `SUPABASE_URL` | `SUPABASE_SERVICE_ROLE_KEY` | **Oui** (requis au boot) |
| `eu-hds` | `SUPABASE_URL_EU_HDS` | `SUPABASE_SERVICE_ROLE_KEY_EU_HDS` | Non (à provisionner) |

Demander `eu-hds` avant d'avoir posé ces deux variables **lève une erreur
explicite** (« Région « eu-hds » non provisionnée … ») — fail-loud, jamais de
fallback silencieux qui écrirait du PHI FR dans la base mutualisée.

## Onboarder un tenant français sur HDS (procédure, le jour venu)

1. **Provisionner l'instance HDS.** Créer le projet Supabase (ou Postgres
   managé) chez un hébergeur **agréé HDS** en **France/EEE** (ex : OVHcloud
   Healthcare). Y appliquer le **même schéma `med_*`** que la base mutualisée
   (mêmes migrations). Poser les variables d'env côté API (Railway `isna-api`) :
   `SUPABASE_URL_EU_HDS` + `SUPABASE_SERVICE_ROLE_KEY_EU_HDS`.

2. **Basculer le tenant.** Une fois ses données prêtes côté HDS :
   ```sql
   UPDATE tenants SET data_region = 'eu-hds' WHERE slug = '<tenant_fr>';
   ```

3. **Migrer les données `med_*` de ce tenant** depuis la base mutualisée vers
   l'instance HDS (export/import scoping `tenant_id`), puis les **purger** de la
   base mutualisée. (À faire AVANT/PENDANT une fenêtre de bascule maîtrisée.)

4. **Adopter `forTenant(tenant)` dans les services PHI MEDOS.** Remplacer, dans
   les call-sites MEDOS qui touchent du PHI, `this.supabase.client` par
   `this.supabase.forTenant(tenant)` (le `tenant` provient du `TenantContext`,
   qui porte désormais `data_region`). C'est **incrémental** : chaque service
   migré route automatiquement vers HDS pour les tenants `eu-hds` et reste
   identique pour les `global`.

## État d'adoption — IMPORTANT

- **Mécanisme : PRÊT.** Migration + `RegionService` + `forRegion`/`forTenant` +
  `TenantContext.data_region` sont en place et build/tests verts.
- **Adoption des call-sites : NON commencée, et c'est VOLONTAIRE.** Les centaines
  de `this.supabase.client` existants **n'ont pas** été retrofittés — ce serait
  risqué et prématuré (zéro tenant FR aujourd'hui). On les migrera vers
  `forTenant(tenant)` **de façon incrémentale**, service par service, **quand un
  tenant français existera**.
- **Tant que tout le monde est `global`**, `forTenant`/`forRegion` rendent le
  client mutualisé → l'app se comporte exactement comme avant.

## Garde-fous

- **Idempotence migration** : `ADD COLUMN IF NOT EXISTS` — rejouable sans risque.
  ⚠️ **NON appliquée** (à passer via `run-sql.js` / `db push` en prod).
- **Fail-loud** : aucune région non provisionnée ne tombe en silence sur la base
  mutualisée (anti-fuite PHI). Erreur explicite à la place.
- **Identité du client `global`** préservée → garantit zéro régression et
  conserve le contrat du constructeur (un seul `createClient`).
