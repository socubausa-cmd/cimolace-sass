# Cimolace onboarding catalogue — status

Date : 2026-05-10

## Résumé

L'onboarding de `apps/app` intègre maintenant le choix d'infrastructure Cimolace.

Flux implémenté :

```txt
nom + slug + infrastructure
  -> POST /tenants
  -> stockage X-Tenant-Slug local
  -> POST /catalog/apply-template
  -> redirection /dashboard
```

## Fichiers modifiés

- `apps/app/src/lib/api.ts`
- `apps/app/src/pages/Onboarding.tsx`
- `apps/app/src/pages/DashboardHome.tsx`
- `apps/app/src/pages/DashboardInfrastructure.tsx`
- `apps/app/src/pages/DashboardProduct.tsx`
- `apps/app/src/lib/infrastructures.ts`
- `apps/app/src/App.tsx`
- `apps/api/src/tenant/tenant.service.ts`
- `apps/api/src/tenant/tenant.types.ts`

## Détails

- Ajout de `catalogApi.applyTemplate`.
- Ajout des types `InfrastructureType` et `TenantService`.
- Ajout des options d'infrastructure dans l'onboarding :
  - school
  - medos
  - mbolo
  - wellness
  - creator
  - temple
  - community
- Chaque carte affiche maintenant les moteurs inclus sous le capot.
- Le choix par défaut est `school`.
- Si le tenant est créé mais que l'application du template échoue, l'écran permet de réessayer l'activation sans recréer le tenant.
- En mode dev, l'écran expose un champ `Access token Supabase` pour éviter une erreur `Unauthorized` opaque.
- `/dashboard` affiche maintenant une overview Cimolace avec infrastructure active et moteurs activés.
- `/dashboard/infrastructure` permet d'appliquer un autre template au tenant courant.
- Dashboards placeholders ajoutés pour `school`, `medos`, `mbolo`, `wellness`, `creator`, `temple`, `community`.
- `GET /tenants/current` renvoie `infrastructure_type`.

## Limites connues

- Les options d'infrastructure sont dupliquées côté frontend, car `GET /catalog/templates` nécessite déjà un tenant courant.
- Il n'y a pas encore de redirection dashboard spécifique par infrastructure.
- `applyTemplate` reste cumulatif côté API.

## Prochaine étape

Tester manuellement dans le navigateur :

1. Coller un token owner dans le debug store si nécessaire.
2. Aller sur `/onboarding`.
3. Créer un tenant avec `school`, puis vérifier `tenant_services`.
4. Refaire avec `mbolo` ou `medos` sur un autre slug.
5. Vérifier que `/dashboard` continue de charger.
