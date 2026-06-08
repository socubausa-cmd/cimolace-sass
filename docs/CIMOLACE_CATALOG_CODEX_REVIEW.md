# Review Codex — Socle catalogue Cimolace

Date : 2026-05-10

## Verdict

Le socle catalogue Cimolace implemente par DeepSeek est globalement conforme au brief et peut servir de base pour la suite.

Etat : **accepte avec corrections demandees avant integration onboarding**.

## Verifications faites

- Lecture migration `20250510000006_cimolace_catalog.sql`.
- Lecture module `apps/api/src/cimolace-catalog/*`.
- Lecture DTOs.
- Lecture integration `AppModule`.
- Lecture `SupabaseService` types.
- Verification guards existants `TenantGuard`, `RolesGuard`, `@Roles`.
- Execution :

```bash
npm run build -w @isna/api
npm test -w @isna/api
```

Resultat :

- Build API OK.
- Tests API OK : 3 suites, 17 tests.

## Ce qui est bon

- Les endpoints catalogue sont bien sous `JwtAuthGuard + TenantGuard`.
- Les mutations sont bien sous `RolesGuard + @Roles('owner', 'admin')`.
- Les services sont toujours ecrits avec `tenant_id` venant du tenant courant.
- Le catalogue contient bien les familles LIRI, MedOS, Mbolo, paiement, communication, infrastructure.
- Le template Mbolo inclut maintenant les moteurs e-commerce dedies : catalog, cart, orders, inventory, storefront, admin.
- Aucune route live/checkout/access_pass n'a ete modifiee.
- Les tests unitaires couvrent les principaux cas heureux et refus student.

## Points a corriger

### P1 — `applyTemplate` peut laisser un etat partiel

Fichier : `apps/api/src/cimolace-catalog/cimolace-catalog.service.ts`

Probleme :

- `applyTemplate` met d'abord a jour `tenants.infrastructure_type`.
- Ensuite il upsert les moteurs un par un.
- Si un upsert echoue, le code fait `continue` et retourne quand meme un succes avec moins de services.

Risque :

- Un tenant peut afficher `infrastructure_type = medos` ou `mbolo` alors que tous les moteurs requis ne sont pas actifs.
- L'onboarding pourrait croire que l'infrastructure est prete alors que le template est incomplet.

Correction recommandee :

- Ne pas ignorer les erreurs d'upsert.
- Soit faire un upsert bulk des services puis update `infrastructure_type` seulement si tout est OK.
- Soit throw au premier echec et ne jamais retourner succes partiel.
- Ideal : RPC SQL transactionnelle plus tard. Pour MVP, throw au premier echec est acceptable.

### P2 — Pas de contrainte DB sur `infrastructure_type`

Fichier : `supabase/migrations/20250510000006_cimolace_catalog.sql`

Probleme :

- `infrastructure_type` est un `TEXT` libre.
- L'API DTO limite les valeurs, mais la base n'a pas de check constraint.

Risque :

- Donnees incoherentes si insertion/update hors API ou script service-role.

Correction recommandee :

Ajouter une contrainte :

```sql
ALTER TABLE tenants
  ADD CONSTRAINT tenants_infrastructure_type_check
  CHECK (
    infrastructure_type IS NULL OR
    infrastructure_type IN ('school','medos','mbolo','wellness','creator','temple','community')
  );
```

### P2 — Tests cross-tenant encore absents

Probleme :

- Les tests verifient que le service appelle `tenant_services`, mais pas un vrai scenario tenant A / tenant B.
- Les tests actuels sont unitaires avec mocks, pas E2E Supabase.

Correction recommandee :

- Ajouter un test E2E apres application migration Supabase dev.
- Verifier qu'un token membre tenant A ne lit/modifie jamais tenant B via `X-Tenant-Slug`.

### P3 — Catalogue en dur acceptable mais a verrouiller comme source temporaire

Probleme :

- Le catalogue est en code statique.

Avis :

- OK pour MVP et pour eviter une sur-architecture.
- A documenter comme source temporaire jusqu'a stabilisation des offres.
- Ne pas creer `service_catalog` DB maintenant sauf besoin admin/back-office.

## Decision architecture

Le choix `infrastructure_type` sur `tenants` est acceptable pour le MVP, car un tenant commence avec une infrastructure principale.

Attention : a long terme, un tenant pourra vouloir plusieurs infrastructures ou moteurs transversaux. Dans ce cas :

- garder `tenants.infrastructure_type` comme infrastructure principale ;
- utiliser `tenant_services` comme verite d'activation moteur ;
- ajouter plus tard `tenant_infrastructures` si plusieurs infrastructures principales deviennent necessaires.

## Prochaines etapes recommandees

1. Corriger `applyTemplate` pour ne jamais retourner succes partiel.
2. Ajouter check constraint sur `tenants.infrastructure_type`.
3. Appliquer la migration en Supabase dev/staging.
4. Lancer E2E catalogue avec vrais JWT owner/admin/student.
5. Ensuite seulement brancher le choix d'infrastructure dans l'onboarding.

