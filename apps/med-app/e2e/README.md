# MedOS — Tests E2E Playwright (`@isna/med-app`)

Smoke tests Playwright qui valident les parcours critiques de la PWA MedOS
(`https://med.cimolace.space` par défaut).

Specs couvertes :

| Spec | Parcours |
| --- | --- |
| `smoke.spec.ts` | Healthcheck — l'app se charge, le shell se rend |
| `wizard.spec.ts` | Onboarding wizard (collecte demographics → handoff) |
| `twin-tabs.spec.ts` | Navigation entre onglets du Digital Twin |
| `lab-upload.spec.ts` | Upload d'un résultat de labo + parsing |
| `auth.setup.ts` | Setup d'authentification via URL de handoff Supabase |

## Variables d'environnement requises

Deux variables pilotent les tests :

| Variable | Type | Description | Défaut |
| --- | --- | --- | --- |
| `E2E_BASE_URL` | URL | Cible des tests (prod, preview Vercel, ou `http://localhost:5174`) | `https://med.cimolace.space` |
| `E2E_HANDOFF_URL` | URL signée | Lien Supabase de handoff utilisé par `auth.setup.ts` pour authentifier la session de test | _(aucun — requis)_ |

> `E2E_HANDOFF_URL` est un secret. Ne jamais le commit ni le logger.

## Lancer en local

Depuis `apps/med-app/` :

```bash
# 1. Installer les deps (lockfile pnpm)
pnpm install --frozen-lockfile

# 2. Installer le binaire Chromium Playwright (une fois)
pnpm exec playwright install chromium

# 3. Exporter les variables d'env (voir 1Password / vault interne)
export E2E_BASE_URL="http://localhost:5174"     # ou un preview Vercel
export E2E_HANDOFF_URL="https://...supabase.co/auth/v1/verify?token=..."

# 4. Lancer la suite complète
pnpm test:e2e

# Variante interactive (UI mode)
pnpm test:e2e:ui

# Ne lancer qu'un fichier
pnpm exec playwright test e2e/smoke.spec.ts
```

Les artefacts (traces, screenshots, vidéos) sont écrits dans
`apps/med-app/e2e-results/` et conservés uniquement sur échec
(`trace: 'retain-on-failure'`, `screenshot: 'only-on-failure'`).

## CI GitHub Actions

Le workflow [`.github/workflows/e2e-med-app.yml`](../../../.github/workflows/e2e-med-app.yml)
exécute ces tests :

- À chaque pull request sur `main` modifiant `apps/med-app/**`
- À la demande via **Actions → E2E — MedOS → Run workflow** (avec override
  optionnel de `E2E_BASE_URL`, utile pour viser un preview deploy)

### Configurer les secrets/variables côté repo

Dans **Settings → Secrets and variables → Actions** :

- **Secrets** : ajouter `E2E_HANDOFF_URL`
- **Variables** : ajouter `E2E_BASE_URL` (optionnel — fallback
  `https://med.cimolace.space` si absent)

### Voir les rapports

- Onglet **Actions** → run → job `Playwright smoke (chromium)` : logs `list` reporter
- En cas d'échec, télécharger l'artifact `e2e-results-<run_id>` qui contient
  `e2e-results/` (traces `.zip` ouvrables via `pnpm exec playwright show-trace`)
  et `playwright-report/` si présent.

## Dépannage

| Symptôme | Cause probable |
| --- | --- |
| `auth.setup.ts` échoue avec 401 | `E2E_HANDOFF_URL` expiré → régénérer un lien signé Supabase |
| Tests lents (> 30 s) | `E2E_BASE_URL` pointe sur un cold start Vercel — relancer ou warmer |
| `browser not found` | Oubli de `playwright install chromium` |
| Tests passent en local, échouent en CI | Comparer `E2E_BASE_URL` ; vérifier que le déploiement ciblé est à jour |
