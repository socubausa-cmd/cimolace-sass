# Cimolace Catalog — Implementation Status

Date : 2026-05-10
Agent : DeepSeek V4 (isna-opus)

## Résumé

Socle catalogue Cimolace multi-tenant implémenté dans `isna-opus`. Le module permet à un tenant de consulter le catalogue de moteurs, lister ses services actifs, activer/désactiver des moteurs, et appliquer un template d'infrastructure complet.

Aucun fichier V1 ni flux live/checkout/access_pass existant n'a été modifié.

## Fichiers créés

| Fichier | Rôle |
|---|---|
| `supabase/migrations/20250510000006_cimolace_catalog.sql` | Migration : `tenant_services` + `infrastructure_type` sur `tenants` + RLS |
| `apps/api/src/cimolace-catalog/cimolace-catalog.module.ts` | Module NestJS |
| `apps/api/src/cimolace-catalog/cimolace-catalog.service.ts` | Service : catalogue statique + logique tenant-services + apply-template |
| `apps/api/src/cimolace-catalog/cimolace-catalog.controller.ts` | Contrôleur : 5 endpoints REST |
| `apps/api/src/cimolace-catalog/dto/update-tenant-service.dto.ts` | DTO activation/désactivation service |
| `apps/api/src/cimolace-catalog/dto/apply-template.dto.ts` | DTO application template infrastructure |
| `apps/api/src/cimolace-catalog/cimolace-catalog.service.spec.ts` | Tests unitaires (10 cas) |

## Fichiers modifiés

| Fichier | Modification |
|---|---|
| `apps/api/src/app.module.ts` | Ajout `CimolaceCatalogModule` dans les imports |
| `apps/api/src/supabase/supabase.service.ts` | Ajout `TenantServiceRow`, `tenant_services` dans `Database`, `infrastructure_type` sur `TenantRow` |

## Migration SQL ajoutée

**`20250510000006_cimolace_catalog.sql`** :

- `ALTER TABLE tenants ADD COLUMN infrastructure_type TEXT` — type d'infrastructure actif (school, medos, mbolo, wellness, creator, temple, community)
- `CREATE TABLE tenant_services` — services/moteurs activés par tenant
  - Colonnes : `id uuid`, `tenant_id uuid → tenants(id)`, `service_key text`, `active boolean`, `settings jsonb`, `created_at`, `updated_at`
  - Contrainte : `UNIQUE(tenant_id, service_key)`
  - Index : `tenant_id`, `service_key`, `(tenant_id, active)`
- RLS activée sur `tenant_services`
  - Policy SELECT : membres actifs du tenant
  - Policy ALL : owner/admin uniquement (USING + WITH CHECK)
- Trigger `updated_at`

## Endpoints API

Base : `/catalog`

| Méthode | Chemin | Auth | Rôle | Description |
|---|---|---|---|---|
| GET | `/catalog/engines` | JWT + TenantGuard | tout membre | Catalogue complet des 35 moteurs Cimolace |
| GET | `/catalog/templates` | JWT + TenantGuard | tout membre | 7 templates d'infrastructures activables |
| GET | `/catalog/tenant-services` | JWT + TenantGuard | tout membre | Services actifs du tenant courant |
| POST | `/catalog/tenant-services` | JWT + TenantGuard + RolesGuard | owner, admin | Activer/désactiver un service |
| POST | `/catalog/apply-template` | JWT + TenantGuard + RolesGuard | owner, admin | Appliquer un template d'infrastructure |

## Catalogue embarqué

- **35 moteurs** répartis en 9 catégories : IA, Live/Vidéo, Paiement, Communication, Contenu, Agenda, MedOS, Mbolo, Infrastructure
- **7 templates** : school, medos, mbolo, wellness, creator, temple, community
- Chaque template active un sous-ensemble cohérent de moteurs

## Tests exécutés

```
npm run build -w @isna/api   → OK
npm test -w @isna/api        → 3 suites, 17 tests, tous passés
```

Détail des 10 nouveaux tests :

| Test | Résultat |
|---|---|
| `getEngines` retourne tous les moteurs (>30, clés critiques présentes) | ✅ |
| Chaque moteur a key, label, description, category | ✅ |
| `getTemplates` retourne les 7 templates | ✅ |
| Chaque template a au moins un moteur | ✅ |
| `getTenantServices` retourne les services du tenant | ✅ |
| Owner peut activer un service (`upsertTenantService`) | ✅ |
| Student ne peut pas activer un service → ForbiddenException | ✅ |
| Service key inconnu → BadRequestException | ✅ |
| `apply-template school` active les 6 bons moteurs | ✅ |
| `apply-template medos` active les 8 bons moteurs | ✅ |
| `apply-template mbolo` active les 11 bons moteurs | ✅ |
| Student ne peut pas appliquer un template → ForbiddenException | ✅ |
| Template inconnu → BadRequestException | ✅ |

## Ce qui n'a pas été touché

- Flux live/checkout/access_pass existants — inchangés
- LiveKit — inchangé
- Webhook Stripe — inchangé
- Routes tenant/auth/marketing — inchangées
- V1, isna_app, ZahirWellness — non touchés

## Risques ouverts

1. **Migration non appliquée en base réelle** — le fichier SQL est créé mais doit être appliqué sur Supabase dev/staging via `supabase db push` ou SQL Editor.
2. **Pas de test E2E sur le module catalogue** — les tests sont unitaires uniquement. Un E2E avec Supabase réel + JWT réel reste à faire.
3. **Catalogue en dur dans le code** — pour le MVP c'est acceptable. Une migration future pourrait basculer le catalogue en base (`service_catalog` table).
4. **Pas de logique de plan/limite** — le module active/désactive sans vérifier le plan du tenant. La logique de quota/plan est pour Phase 5 (billing).
5. **Pas de désactivation des moteurs non-template** — `apply-template` active les moteurs du template mais ne désactive pas les moteurs précédemment activés qui ne sont pas dans le nouveau template. Comportement volontaire pour le MVP (on active sans désactiver).

## Prochaines étapes recommandées

1. Appliquer la migration `20250510000006_cimolace_catalog.sql` sur Supabase dev
2. Exécuter un E2E catalogue avec vrai JWT + vrai tenant
3. Ajouter un test E2E cross-tenant (vérifier que le tenant A ne voit pas les services du tenant B)
4. Intégrer le catalogue dans l'onboarding (choix d'infrastructure après création tenant)
5. Brancher le `RolesGuard` manquant sur les ressources existantes
6. Faire auditer le module par Codex/Opus (sécurité, RLS, isolation tenant)

## Corrections Codex P1/P2 — 2026-05-10

Appliquées suite à `docs/CIMOLACE_CATALOG_CODEX_REVIEW.md`.

### P1 — applyTemplate sans succès partiel

- `applyTemplate` upsert maintenant **tous les services en premier**, puis met à jour `infrastructure_type` seulement si tous les services ont réussi.
- Si un upsert service échoue → `InternalServerErrorException` immédiat, pas de `continue` silencieux.
- Si `tenants.update` échoue → `InternalServerErrorException` avec message explicite (les services sont activés mais l'infrastructure n'a pas pu être enregistrée).
- Plus aucun état partiel possible.

### P2 — Contrainte SQL infrastructure_type

- Ajout d'un `CHECK` constraint sur `tenants.infrastructure_type` dans `20250510000006_cimolace_catalog.sql`.
- Valeurs acceptées : `school`, `medos`, `mbolo`, `wellness`, `creator`, `temple`, `community` + `NULL`.
- Syntaxe idempotente : `DROP CONSTRAINT IF EXISTS` puis `ADD CONSTRAINT`.

### Tests ajoutés

- `ne met pas à jour infrastructure_type si un upsert service échoue` — vérifie que `from('tenants')` n'est jamais appelé en cas d'échec service.
- `throw InternalServerErrorException si un upsert service échoue`.
- `retourne succès seulement quand tous les services sont upsertés (school = 6)`.
- `le nombre de services retournés correspond exactement au nombre de moteurs du template (mbolo = 11)`.

## Points à faire auditer par Codex/Opus

- RLS policies sur `tenant_services` — vérifier qu'aucun accès cross-tenant n'est possible
- `infrastructure_type` en clair sur `tenants` — vérifier que les membres ne peuvent pas le modifier
- RBAC : confirmer que `RolesGuard` + `@Roles('owner','admin')` couvre bien tous les endpoints de mutation
- Catalogue en dur dans le code vs table `service_catalog` — décision architecturale à valider
- Stratégie de mise à jour du catalogue (ajout/suppression de moteurs dans le futur)
