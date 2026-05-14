# Environnements — ISNA V2

## Dev (local)
| Service | URL |
|---------|-----|
| API | `http://localhost:4000` |
| App | `http://localhost:5173` |
| Public Site | `http://localhost:3000` |
| Health | `http://localhost:4000/health` |

## Staging (cible)
| Service | URL |
|---------|-----|
| API | `https://api.staging.cimolace.com` |
| App | `https://app.staging.cimolace.com` |
| Public Site | `https://staging.cimolace.com` |
| Supabase | Projet Staging dédié |

## Production (cible)
| Service | URL |
|---------|-----|
| API | `https://api.cimolace.com` |
| App | `https://app.cimolace.com` |
| Public Site | `https://cimolace.com` |
| Supabase | Projet Production dédié |

## Déploiement

```bash
# Staging
bash scripts/deploy-staging.sh

# Production (via Google Cloud Run)
gcloud run deploy isna-api --source . --region europe-west1
```

## Secrets GitHub requis

- `SUPABASE_URL_STAGING`
- `SUPABASE_SERVICE_ROLE_KEY_STAGING`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_BILLING_WEBHOOK_SECRET`
