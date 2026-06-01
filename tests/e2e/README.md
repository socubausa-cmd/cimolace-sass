# E2E LIRI — parcours self-serve prod

Suite Playwright TypeScript qui valide le parcours LIRI sur Cimolace :
landing produit, onboarding, creation de tenant, login tenant, dashboard et creation d'un live.

## Lancer

```bash
npm install
npx playwright install chromium
npm run test:e2e:liri
```

Mode debug :

```bash
PWDEBUG=1 npm run test:e2e:liri
```

## Variables

Par defaut, la suite tape la production :

```bash
E2E_BASE_URL=https://cimolace.space
E2E_API_URL=https://api.cimolace.space
E2E_APP_URL=https://app.cimolace.space
```

## Sorties

- `tests/e2e/screenshots/` : captures etape par etape.
- `playwright-report/index.html` : rapport HTML.
- `tests/e2e/test-results/results.json` : rapport JSON.
- `tests/e2e/test-results/` : videos et traces en cas d'echec.
