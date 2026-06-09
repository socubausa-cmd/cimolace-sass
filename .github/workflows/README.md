# GitHub Actions — ISNA Platform V2

Inventaire des workflows CI/CD du monorepo.

## Workflows actifs

| Fichier | Déclencheurs | Rôle |
| --- | --- | --- |
| [`ci.yml`](./ci.yml) | `push` + `pull_request` sur `main` / `staging` | Build, lint, tests unitaires (API NestJS et autres apps du monorepo) |
| [`e2e-med-app.yml`](./e2e-med-app.yml) | `pull_request` sur `main` (paths `apps/med-app/**`) + `workflow_dispatch` | Smoke E2E Playwright (chromium) contre le déploiement MedOS — voir [doc complète](../../apps/med-app/e2e/README.md) |

## Badges

À insérer dans un README racine quand il sera créé :

```markdown
![CI](https://github.com/socubausa-cmd/cimolace-sass/actions/workflows/ci.yml/badge.svg)
![E2E MedOS](https://github.com/socubausa-cmd/cimolace-sass/actions/workflows/e2e-med-app.yml/badge.svg)
```

## Conventions

- **Concurrency** : tous les nouveaux workflows doivent inclure un groupe
  `concurrency.group` indexé sur `github.ref` avec `cancel-in-progress: true`
  pour éviter d'empiler des runs sur la même branche.
- **Timeouts** : `timeout-minutes` obligatoire sur chaque job (10 min max pour
  les jobs « rapides » comme l'E2E smoke).
- **Secrets** : référencés via `${{ secrets.NAME }}`, jamais inlinés. Les
  variables non sensibles passent par `vars.NAME`.
- **Artifacts** : uploadés uniquement `if: failure()` pour limiter la taille
  et la durée des runs, avec `retention-days` borné (≤ 7 j).

## Secrets / Variables attendus

| Nom | Type | Workflow(s) | Notes |
| --- | --- | --- | --- |
| `E2E_HANDOFF_URL` | secret | `e2e-med-app.yml` | URL signée Supabase pour l'auth des tests |
| `E2E_BASE_URL` | variable | `e2e-med-app.yml` | Optionnel, défaut `https://med.cimolace.space` |

À configurer dans **Settings → Secrets and variables → Actions**.
