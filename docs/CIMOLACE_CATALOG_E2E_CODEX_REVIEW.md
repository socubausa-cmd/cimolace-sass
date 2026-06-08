# Review Codex — E2E catalogue Cimolace

Date : 2026-05-10

## Verdict

Le socle catalogue Cimolace est **valide pour passer a l'integration onboarding**.

DeepSeek a execute l'E2E reel sur Supabase dev et le rapport est coherent avec le code audite. Les tests locaux repassent.

## Verifications Codex

- Rapport lu : `docs/CIMOLACE_CATALOG_E2E_REPORT.md`.
- Migration relue : `supabase/migrations/20250510000006_cimolace_catalog.sql`.
- Catalogue relu : `apps/api/src/cimolace-catalog/cimolace-catalog.service.ts`.
- Tests relances :

```bash
npm run build -w @isna/api
npm test -w @isna/api
```

Resultat :

- Build API OK.
- Tests API OK : 3 suites, 21 tests.

## Points valides

- Migration appliquee sur Supabase dev `fwfupxvmwtxbtbjdeqvu`.
- `tenant_services` existe.
- `tenants.infrastructure_type` existe.
- `tenants_infrastructure_type_check` existe.
- RLS activee sur `tenant_services`.
- Policies lecture membre et mutation owner/admin presentes.
- API catalogue testee avec vrais JWT Supabase.
- `TenantGuard` bloque le cross-tenant.
- `RolesGuard` bloque le student sur mutation.
- RLS REST directe filtre les services selon membership.

## Notes importantes

### Catalogue : 37 moteurs

Le code contient 37 moteurs, pas 35. Ce n'est pas un bug : les moteurs Mbolo ajoutes rendent le chiffre plus large que la documentation initiale. Les prochaines docs doivent parler de 37 moteurs ou de "35+" / "catalogue evolutif".

### API service-role et RLS

L'API NestJS utilise `SUPABASE_SERVICE_ROLE_KEY`, donc les requetes faites par `SupabaseService` bypassent la RLS Postgres. La securite API repose donc sur :

- `JwtAuthGuard`
- `TenantGuard`
- `RolesGuard`
- le fait que `tenant_id` vient du tenant courant, jamais du body

La RLS reste utile pour les acces REST/directs avec token utilisateur. Ce point est normal pour le MVP, mais doit rester explicite.

### `applyTemplate` cumulatif

`applyTemplate` active les moteurs du nouveau template sans desactiver les anciens moteurs. Exemple observe :

- application `school` -> 6 services
- application `mbolo` -> 17 services actifs

Decision MVP acceptable : le catalogue fonctionne comme activation additive.

Avant onboarding public, il faudra choisir entre :

- mode `add` : ajouter moteurs au tenant ;
- mode `replace` : remplacer l'infrastructure principale et desactiver moteurs non inclus ;
- mode hybride : `infrastructure_type` principale + moteurs additionnels.

## Reserve avant production

Le socle est OK pour onboarding dev/staging.

Avant production commerciale, il faudra :

1. Ajouter E2E catalogue dans CI.
2. Ajouter tests multi-tenant plus larges.
3. Decider la strategie add/replace pour `applyTemplate`.
4. Ajouter quotas/plans quand billing SaaS sera pret.
5. Eventuellement convertir `applyTemplate` en RPC transactionnelle.

## Prochaine etape validee

Passer a l'integration onboarding :

```txt
creation tenant
  -> choix infrastructure
  -> POST /catalog/apply-template
  -> redirection dashboard adapte
```

