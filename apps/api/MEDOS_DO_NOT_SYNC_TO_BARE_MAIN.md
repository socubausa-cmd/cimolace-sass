# ⚠️ apps/api — NE PAS « sync sur main » sans le backend MEDOS

**Lis ça avant tout `git checkout main -- apps/api`, `git reset`, ou `railway up`.**

## Le problème (vécu 2× : commits `8ba50096`, `2d79e518`)
`apps/api` contient **deux familles de features qui ont divergé** :

| Famille | Fichiers | Vient de |
|---|---|---|
| **Plateforme** (billing, booking, chat-engine, checkout, paiements, invoice.paid) | `billing/`, `booking/`, `chat-engine/`, `checkout/`, `courses/` | `origin/main` |
| **MEDOS / Nganga** (santé) | `medos/`, `notifications/`, `email-engine/` (méthodes tenant) | branche `feat/medos-twin-3d-body` |

« Synchroniser apps/api **sur main brut** » réinstalle la famille Plateforme **mais supprime tout le backend MEDOS**. L'API `isna-api` en service perd alors :
- `/med/twin/:id/wheel/notify`, `/med/twin/*` (projection, jumeau, IA multi-provider)
- les notifications in-app + emails par tenant (invitation, bilan)
- le garde anti-rétrogradation owner→patient

→ symptômes : `404` sur les routes MEDOS, plus aucun email, SSO praticien cassé.

## L'état correct = ce commit (branche `medos-consolidated`)
`origin/main` **+** le backend MEDOS complet, **mergé proprement** (1 seul conflit trivial résolu, `tsc` + `nest build` verts sur api + med-app + patient-portal). Contient :

**Plateforme** : tout `origin/main` (billing/booking/checkout/paiements…).
**MEDOS** :
- `medos/twin/*` — jumeau bio, projection temporelle, IA **multi-provider** (Mistral→Groq→DeepSeek→Anthropic, cf. `twin-ai.service.ts`), assistant patient, roue/bilan, endpoint `wheel/notify` (« bilan prêt »)
- `notifications/*` — notifications in-app (cloche) câblées aux events (message, formulaire assigné, note partagée) + **emails par tenant** optionnels
- `email-engine.service.ts` — `resolveFrom(tenantId)` (expéditeur = domaine vérifié du tenant via `tenants.metadata.email.from`), `sendRaw()`, `brandedHtml()`
- `medos/invitations/*` — email d'invitation patient auto depuis le domaine tenant (create + resend avec rotation token) ; accept_url = `{slug}.patient.cimolace.space/invite/accept`
- `medos/medos.service.ts` — **garde anti-rétrogradation** : `ensurePatientUser` refuse de transformer un membre staff (owner/practitioner/clinic_admin/receptionist) en patient si son email est saisi comme email patient (sinon il perd l'accès back-office → 403 partout)

## Déploiement
`isna-api` se déploie via **`railway up`** (PAS GitHub — `RAILWAY_GIT_*` = none). Donc :
```bash
git checkout medos-consolidated        # (ou la branche qui contient CE fichier)
cd ~/cimolace-liri-fix && railway up --ci   # projet isna-api / production
```
Un `railway up` depuis un arbre **sans** ce fichier = rétrogradation garantie.

## Activations / data en prod (déjà faites, à garder)
- `RESEND_API_KEY` posée sur Railway (compte Resend où `zahirwellness.com` est vérifié). ⚠️ **À régénérer** (la clé a transité en clair dans un chat).
- `tenants.metadata.email.from = "Zahir Wellness <hello@zahirwellness.com>"` (tenant `zahirwellness`).
- `jkalonji06@gmail.com` + `socubausa@gmail.com` doivent rester `role=owner` dans `tenant_memberships` (ce sont les owners + le praticien SSO Judith). Ne jamais les saisir comme email d'un patient.

## Frontends associés (déploiement Vercel séparé)
- `apps/med-app` → `med.cimolace.space` (`vercel build/deploy --prebuilt` + `vercel alias`).
- `apps/patient-portal` → portail patient.
Ils attendent les routes MEDOS de cette API. Med-app build `main`-only ↔ API MEDOS (ou l'inverse) = crashes (`a.slice is not a function`, 404 `/med/health`). **Garder med-app et apps/api sur la même version.**
