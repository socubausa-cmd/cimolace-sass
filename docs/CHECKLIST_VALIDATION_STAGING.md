# CHECKLIST DE VALIDATION — ISNA V2 Staging

**À exécuter APRÈS chaque déploiement staging.**
**Ne pas toucher à Netlify V1 tant que cette checklist n'est pas 100% verte.**

---

## Phase 1 — Infra (Cloud Run + Vercel)

| # | Test | Commande | Attendu |
|---|------|----------|---------|
| 1 | API health | `curl https://api.staging.cimolace.com/health` | `{"status":"ok"}` |
| 2 | CORS headers | `curl -I https://api.staging.cimolace.com/health` | `access-control-allow-origin: *` |
| 3 | App accessible | Navigateur → `https://app.staging.cimolace.com` | Page blanche ou login |
| 4 | Public site accessible | Navigateur → `https://staging.cimolace.com` | Page d'accueil |
| 5 | API timeout ok | `curl --max-time 10 https://api.staging.cimolace.com/health` | Réponse < 3s |
| 6 | Cloud Run 0 instance | Attendre 5 min sans requête | L'instance s'éteint (scale to 0) |
| 7 | Cold start | Après 5 min, refaire `/health` | Réponse en < 10s |

---

## Phase 2 — Auth + Multi-Tenant

| # | Test | Commande | Attendu |
|---|------|----------|---------|
| 8 | Sans X-Tenant-Slug | `curl https://api.staging.cimolace.com/studio/workspaces` | `400` ou `401` |
| 9 | Tenant invalide | `curl -H "X-Tenant-Slug: fake" https://api.staging.cimolace.com/tenants/current` | `404` |
| 10 | Auth avec JWT valide | `curl -H "Authorization: Bearer <JWT>" -H "X-Tenant-Slug: isna" https://api.staging.cimolace.com/auth/me` | `200` avec user |
| 11 | Tenant A → Tenant B | Token tenant B + `X-Tenant-Slug: isna` → `/studio/workspaces` | `403` Forbidden |
| 12 | Étudiant → route owner | Token étudiant + `X-Tenant-Slug: isna` → `POST /masterclass-factory/generate` | `403` Forbidden |
| 13 | GET /tenants/current | Owner ISNA → `/tenants/current` | `{"slug":"isna","role":"owner"}` |
| 14 | GET /tenants/current | Owner MedOS → `/tenants/current` | `{"slug":"medos","role":"owner"}` |
| 15 | Workspaces isolés A | Owner ISNA → `/studio/workspaces` | Contient "Cours ISNA", PAS "Cours MedOS" |
| 16 | Workspaces isolés B | Owner MedOS → `/studio/workspaces` | Contient "Cours MedOS", PAS "Cours ISNA" |

---

## Phase 3 — Fonctionnalités clés

| # | Test | Commande | Attendu |
|---|------|----------|---------|
| 17 | Masterclass generate | `POST /masterclass-factory/generate` avec `sourceText` | 21 segments par chapitre |
| 18 | SmartBoard decks | `GET /smartboard/decks` | `200` avec liste |
| 19 | Billing checkout Stripe | `POST /billing/subscription` provider=stripe | `checkoutUrl` valide |
| 20 | Billing checkout Chariow | `POST /billing/subscription` provider=chariow | `checkoutUrl` ou erreur si clé absente |
| 21 | Live create session | `POST /lives` avec titre | `200` avec room LiveKit |
| 22 | Course pipeline | `POST /course-builder/pipelines` | `200` avec pipeline créé |
| 23 | NeuroRecall bootstrap | `POST /neuro-recall/bootstrap` | `200` avec flashcards |
| 24 | LIRI Brain chat | `POST /liri/brain/smartboard/chat` | `200` avec réponse IA |
| 25 | Forum categories | `GET /forum/categories` | `200` avec liste |

---

## Phase 4 — Webhooks

| # | Test | Commande | Attendu |
|---|------|----------|---------|
| 26 | Stripe webhook | `stripe trigger checkout.session.completed` | `200` + subscription activée |
| 27 | Chariow webhook | Simuler un POST au endpoint webhook | `200` + idempotence |
| 28 | LiveKit webhook | Simuler `room_started` | `200` |

---

## Phase 5 — Sécurité

| # | Test | Attendu |
|---|------|---------|
| 29 | Rate limiting | 100 requêtes rapides → certaines en `429` |
| 30 | Pas de stack trace | Erreur API → `{error: {code, message}}` sans stack trace |
| 31 | SQL injection | `POST` avec `' OR 1=1--` → pas de données leak |
| 32 | Variables d'env exposées | `GET /` → pas de `SUPABASE_URL` dans la réponse |

---

## Phase 6 — Workers

| # | Test | Attendu |
|---|------|---------|
| 33 | Render job enqueued | `POST /studio/render-jobs` → job créé |
| 34 | Renewal cycle | `POST /ai-worker/renewal-cycle` → `processed` > 0 |
| 35 | DLQ retry | `POST /ai-worker/dlq` → `retried` > 0 |

---

## Phase 7 — Frontend

| # | Test | Attendu |
|---|------|---------|
| 36 | App login | Navigateur → login Supabase → redirigé |
| 37 | Studio LIRI Hub | `/studio/liri` → 5 cartes affichées |
| 38 | Course Builder | `/studio/liri/cours` → 10 étapes visibles |
| 39 | Masterclass | `/studio/liri/masterclass` → génération fonctionne |
| 40 | SmartBoard | `/studio/smartboard` → canvas chargé |
| 41 | Export Center | `/studio/export-center` → 5 formats affichés |
| 42 | Public site | `/` → page d'accueil chargée |

---

## Résultat

```
☐ Phase 1 — Infra       : __/7  OK
☐ Phase 2 — Auth/Tenant : __/9  OK
☐ Phase 3 — Features    : __/9  OK
☐ Phase 4 — Webhooks    : __/3  OK
☐ Phase 5 — Sécurité    : __/4  OK
☐ Phase 6 — Workers     : __/3  OK
☐ Phase 7 — Frontend    : __/7  OK
─────────────────────────────────
   TOTAL                 : __/42 OK
```

### Staging validé si : 42/42 OK

---

## Après validation complète

- [ ] Basculer DNS : `cimolace.com` → Vercel (remplace Netlify V1)
- [ ] Basculer webhooks Stripe/Chariow/CinetPay → API V2
- [ ] Basculer webhooks LiveKit → API V2
- [ ] Mettre en production les workers (remplacer `setTimeout`)
- [ ] **Garder Netlify V1 en backup 30 jours** avant suppression définitive
