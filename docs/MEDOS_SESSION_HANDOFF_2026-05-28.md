# MEDOS / Cimolace — Session Handoff
**Date :** 2026-05-28 (mise à jour : Liri Sessions + Mbolo Live)
**Branche :** `main` (à jour avec `origin/main`)
**Dernier commit :** `e4d82cbc` (P5.1 + P5.3 + P5.4 — Liri unification complète)

Ce document est destiné à **l'agent qui reprend le projet**. Lis-le entièrement avant de toucher au code. Il décrit (a) ce qui a été livré, (b) ce qui marche et ce qui ne marche pas, (c) les décisions architecturales prises, (d) les pièges connus, (e) la roadmap suivante.

---

## 0. TL;DR — État du repo

- ✅ **Frontend MEDOS complet** : 9 nouvelles pages + 12 pages refondues, 3 apps Vite (med-app, patient-portal, public-site)
- ✅ **Backend NestJS** : tous les endpoints P0→P4 + Liri unifié (P5)
- ✅ **API en prod** : `https://api.cimolace.space` — Cloud Run service `cimolace-api`, projet GCP `cimolace-staging` (déployé via `scripts/deploy-api-cloudrun.sh --prod`)
- ✅ **Public site en prod** : `https://cimolace.space` (Vercel)
- ⚠️ **med-app et patient-portal** : **pas encore déployés Vercel** — leurs dossiers contiennent un `vercel.json` mais aucun projet Vercel n'est encore créé pour eux. Voir §6.
- ✅ **Database** : Supabase prod `fwfupxvmwtxbtbjdeqvu`, toutes migrations appliquées, bucket Storage `medos` créé
- ✅ **Smoke test E2E** : 15/16 endpoints validés en prod, voir §4

---

## 1. Architecture en une phrase

**Cimolace = la plateforme SaaS multi-tenant**. Elle expose des **moteurs métier** (MEDOS médical, Mbolo e-commerce, ISNA école…) que ses **tenants** activent au choix. **Liri est l'unique autorité vidéo** : tout appel vidéo (téléconsult, live shopping, classe live) passe par lui.

```
TENANT (Zahir, ISNA, …)
  └─ active : MEDOS + Mbolo + … + Liri (auto)
                │       │           │
                ▼       ▼           ▼
        ┌────────────────────────────────┐
        │       LIRI (LiveService)       │ ← single video authority
        │  recording · replay · billing  │
        └───────────────┬────────────────┘
                        │
                        ▼
              ┌──────────────────┐
              │  LiveKitService  │ ← driver SDK (could be swapped)
              └──────────────────┘
```

**Règle d'or** : aucun moteur métier ne doit importer `LiveKitService` directement pour issuer un token. Tout passe par `LiveService.issueTokenForSession(...)`.

---

## 2. Le repo en 10 lignes

```
isna_platform_v2/
├─ apps/
│  ├─ api/                 # NestJS — l'API monolithique (un module par moteur)
│  ├─ med-app/             # React+Vite — espace docteur MEDOS
│  ├─ patient-portal/      # React+Vite — espace patient MEDOS
│  ├─ public-site/         # Next.js — cimolace.space (vitrine + docs MEDOS)
│  └─ app/                 # React+Vite — espace admin Cimolace (cimolace.space/app)
├─ supabase/migrations/    # toutes les migrations DB (chronologiques)
├─ docs/                   # docs d'architecture (ce fichier inclus)
└─ scripts/                # deploy + utilitaires
```

---

## 3. Ce qui a été livré dans cette session (les 20 tâches)

### Sprint P0 — Foundation (démo Zahir vendable)
| # | Tâche | Commit | Notes |
|---|---|---|---|
| 49 | Création patient (med-app) | `5d17d96a` | Migration `20260528180001_patient_records_add_name_columns.sql` ajoute first_name/last_name/email/phone et relâche patient_user_id NOT NULL |
| 50 | Saisie KPI santé patient | `2f542475` | Nouveau endpoint `POST /med/me/health` |
| 51 | Éditeur formulaire patient dynamique | `c46fe67f` | Renderer JSON-Schema, supporte text/textarea/select/checkbox/signature/number/date |

### Sprint P1 — Relationnel
| # | Tâche | Commit | Notes |
|---|---|---|---|
| 52 | Messagerie patient (fetch + send + polling 6s) | `9662ea69` | |
| 53 | Messagerie docteur (master/detail + create thread) | `9662ea69` | |
| 54 | Programmes builder (create + steps + assign) | `d2172c01` | |
| 55 | Patient coche étapes (progress %) | `d2172c01` | |

### Sprint P2 — Médico-légal
| # | Tâche | Commit | Notes |
|---|---|---|---|
| 56 | Ordonnance builder + signature | `55d474a7` | |
| 57 | PDF ordonnance (HTML imprimable) | `55d474a7` | JwtStrategy modifiée pour accepter `?token=` en query — voir §7 |
| 58 | Agenda docteur (timeline + disponibilités) | `85739080` | |
| 59 | Réservation RDV patient | `85739080` | Nouveau endpoint `GET /med/me/appointments` |

### Sprint P3 — Différenciation
| # | Tâche | Commit | Notes |
|---|---|---|---|
| 60 | Téléconsult (boutons Démarrer/Rejoindre) | `429c5362` | Nouveau endpoint `POST /med/teleconsult/appointment/:id/join` |
| 61 | Builder formulaire docteur | `429c5362` | |
| 62 | Pièces jointes (upload + download) | `70ca42c6` | Composant `AttachmentsPanel` dupliqué entre med-app et patient-portal — voir §8 |
| 63 | Listes cliniques tabbed (5 modules) | `70ca42c6` | Allergies, médicaments, problèmes, vaccins, labos |
| 64 | Invitations patient (lien magique) | `70ca42c6` | |

### Sprint P4 — Conformité + polish
| # | Tâche | Commit | Notes |
|---|---|---|---|
| 65 | RGPD patient (8 consentements + export + droit à l'oubli) | `8c0105e9` | |
| 66 | RGPD docteur + audit log viewer | `8c0105e9` | Nouveau endpoint `GET /med/gdpr/audit-log` |
| 67 | Polish (edit patient modal + graph santé Recharts) | `8c0105e9` | |

### Sprint P5 — Architecture (Liri unification)
| # | Tâche | Commit | Notes |
|---|---|---|---|
| 68 | Refactor MEDOS teleconsult → Liri | `79c6e767` | Premier pas. MEDOS injecte LiveService au lieu d'appeler LiveKit |
| 70 | Persister `liri_sessions` (billing minutes) | `e4d82cbc` | Migration prod + endpoint `GET /liri/admin/consumption` |
| 71 | Mbolo Live demo via Liri (preuve du pattern) | `e4d82cbc` | `POST /mbolo/products/:id/live/join?role=seller|viewer` |
| 72 | Zero-LiveKit MEDOS (sortir scopedRoomName) | `e4d82cbc` | `LiveService.roomNameFor()` — MEDOS n'importe plus LiveKit |

### Hors sprints — Bug fix critique pré-existant
| Sujet | Commit |
|---|---|
| TenantService retournait `role` mais TenantContext attendait `userRole` → 403 sur tous les endpoints protégés par RolesGuard | `f439d4fb` |

---

## 4. État E2E prod (test du 28/05 à 22:00)

Script de test : `/tmp/medos-migrate/e2e-p0-p4.mjs`

```
✓ Login OK
✓ GET  /med/patients
✓ POST /med/patients
✓ GET  /med/me/health
✓ GET  /med/me/forms
✓ GET  /med/me/appointments
✓ GET  /med/threads
✓ GET  /med/programs
✓ POST /med/programs
✓ GET  /med/prescriptions
✓ GET  /med/appointments
✓ GET  /med/availability
✓ POST /med/attachments/upload-url
✓ GET  /med/invitations
✗ GET  /med/gdpr/anonymizations   [403] — comportement correct, demo doctor = practitioner
✓ GET  /med/gdpr/audit-log
✓ GET  /med/gdpr/audit-log?resource=patient
```

**15/16 fonctionnels.** Le 16ᵉ est une mauvaise attente de test (le doctor est `practitioner` mais l'endpoint nécessite `owner|clinic_admin`).

---

## 5. Liri — le pattern à respecter

### Quand ajouter une nouvelle source vidéo

Si **Mbolo** veut du live shopping, ou un nouveau moteur veut faire un call vidéo, il NE doit PAS importer `LiveKitModule` ni `LiveKitService` pour issuer des tokens.

**Le pattern correct :**

```typescript
// dans mbolo.module.ts
@Module({
  imports: [LiveModule, ...],
  ...
})
```

```typescript
// dans mbolo/live-sale.service.ts
constructor(
  private readonly supabase: SupabaseService,
  private readonly liri: LiveService,
) {}

async issueShoppingToken(tenant, userId, role, saleId) {
  // 1. ton access control métier (vendeur autorisé, etc.)
  ...
  // 2. délègue à Liri
  return this.liri.issueTokenForSession({
    tenantSlug: tenant.slug,
    externalRef: saleId,
    purpose: 'live_shopping',
    userId,
    role: role === 'seller' ? 'host' : 'guest',
  });
}
```

### Ce qui est fait dans Liri (P5 complet)

- ✅ **Persistance** : table `liri_sessions` (tenant_id, purpose, external_ref, room_name, host_user_id, started_at, ended_at, duration_seconds, metadata). `LiveService.issueTokenForSession` upserte une ligne, `endLiriSession` calcule la durée.
- ✅ **Billing endpoint** : `GET /liri/admin/consumption?from=&to=` retourne `{ total_minutes, breakdown:[{purpose, session_count, total_minutes}] }`. Défaut = mois en cours.
- ✅ **Room name helper** : `LiveService.roomNameFor(tenantSlug, externalRef)` — MEDOS n'importe plus LiveKitService.
- ✅ **Pattern prouvé sur 2 moteurs** : MEDOS teleconsult + Mbolo Live shopping. Les deux passent par `issueTokenForSession({ purpose, externalRef, ... })` avec leurs propres purposes.

### Ce qui reste à faire dans Liri (P5.5+)

- **Recording + replay** : `issueTokenForSession` accepte aujourd'hui `purpose`, `role`, `metadata`. Ajouter `recordingConsent: boolean` qui, si vrai, déclenche `ensureRoom` avec recording activé + crée une ligne `liri_replays` quand la session se ferme.
- **UI consumption** : pas encore exposée dans `apps/app` admin. Cibler une carte "Consommation vidéo ce mois" dans le tenant dashboard, qui appelle `/liri/admin/consumption` et affiche le breakdown par moteur (MEDOS / Mbolo / ISNA).
- **Webhook LiveKit → ferme la session Liri** : aujourd'hui c'est MEDOS qui appelle `endLiriSession` quand le médecin ferme. Si quelqu'un quitte sans cliquer "Terminer", la session reste ouverte. Le `livekit-webhook.controller.ts` doit écouter `room_finished` et appeler `endLiriSession` automatiquement.

---

## 6. Déploiement — ce qui marche, ce qui manque

### Ce qui est déployé
- ✅ **API** : `https://api.cimolace.space` (Cloud Run, GCP project `cimolace-staging`, service `cimolace-api`, region `europe-west1`)
- ✅ **Public site** : `https://cimolace.space` (Vercel, projet `public-site`)

### Ce qui n'est PAS encore déployé
- ⚠️ **med-app** : tourne en local sur `localhost:5174`. Pas de projet Vercel créé. Pour déployer :
  ```bash
  cd apps/med-app && vercel --prod
  ```
  Puis associer un domaine (proposition : `app.cimolace.space/medos` via Vercel rewrites, ou un sous-domaine dédié `medos.cimolace.space`).
- ⚠️ **patient-portal** : pareil, `localhost:5175`. Proposition : `patient.cimolace.space`.

### Variables d'env à fournir aux frontends
```bash
VITE_API_URL=https://api.cimolace.space
VITE_SUPABASE_URL=https://fwfupxvmwtxbtbjdeqvu.supabase.co
VITE_SUPABASE_ANON_KEY=... # voir .env.production
```

### Commandes de déploiement
```bash
# API → Cloud Run
bash scripts/deploy-api-cloudrun.sh --prod

# Public site → Vercel (auto via push main)
git push origin main

# med-app / patient-portal → à configurer
```

---

## 7. Décisions techniques à connaître

### JwtStrategy accepte `?token=` en query
Modifié dans `apps/api/src/auth/jwt.strategy.ts` pour permettre `window.open(url?token=…)` sur le PDF ordonnance. Tous les écritures restent POST/PATCH/DELETE donc le risque CSRF reste contenu. Si tu ajoutes un endpoint sensible en GET, vérifie qu'il ne peut pas être appelé via `<a href=…>`.

### MEDOS apps tracked dans git pour la première fois ce sprint
`apps/med-app` et `apps/patient-portal` étaient présents sur disque mais **jamais commités** avant cette session. Le commit `5d17d96a` a ajouté ~45 fichiers d'un coup. Si tu vois des fichiers "étranges", c'est probablement du code legacy local.

### Bucket Supabase Storage `medos`
Limite 50 MB par fichier (cap Supabase free tier), privé, accès uniquement via signed URLs. Le code API gère ça automatiquement via `POST /med/attachments/upload-url` et `GET /:id/download-url`.

### Bug pré-existant trouvé : `userRole` vs `role`
`TenantService.resolveTenant` retournait `role: ...` mais `TenantContext` attend `userRole: ...`. Causait des 403 sur tous les endpoints protégés par RolesGuard. **Fixé** en retournant les deux pour compat ascendante. Si tu changes `tenant.service.ts`, GARDE les deux champs.

---

## 8. Pièges connus / dette technique

1. **`AttachmentsPanel` est dupliqué** entre `apps/med-app/src/components/` et `apps/patient-portal/src/components/`. Idem `useAuth`, certaines styles. Quand on aura le temps : créer `packages/ui-medos/` pour partager.

2. **TeleconsultService.create()** importe encore `LiveKitService` juste pour `scopedRoomName`. Voir §5 pour le clean.

3. **Le client Vercel domain** : `cimolace.space` pointe vers `public-site`, mais le projet `apps/app` (admin) n'a plus de domaine direct. Si quelqu'un cherche l'admin dashboard, il n'y a pas d'URL publique pour ça.

4. **Tests** : les e2e (`apps/api/test/*.e2e-spec.ts`) ont des erreurs TS pré-existantes liées au conflit Nest v10 root vs apps/api/node_modules. Non bloquant pour le runtime mais TS strict ne passe pas.

5. **Cloud Run project** : `--prod` déploie sur `cimolace-staging` (override via `.env.production`). Pas idéal, à clarifier avec ngowazulu.

6. **Liri billing minutes** : pas encore persisté. Voir §5.

---

## 9. Comptes / secrets utiles

| Quoi | Où |
|---|---|
| Demo doctor MEDOS | `demo-medos-1779970333@cimolace.space` / `DemoMedos2026!` |
| Demo patient MEDOS | `demo-patient-zahir@cimolace.space` / `DemoPatient2026!` |
| Tenant slug demo | `zahirwellness` |
| Supabase URL prod | `https://fwfupxvmwtxbtbjdeqvu.supabase.co` |
| Supabase pooler DB URL | dans `.env.production` (DATABASE_URL) |
| GitHub repo | `https://github.com/socubausa-cmd/cimolace-sass` |

**Ne JAMAIS commit `.env.production`** — il contient `SUPABASE_SERVICE_ROLE_KEY`. Le `.gitignore` racine bloque déjà `.env*` mais reste vigilant.

---

## 10. Comment continuer maintenant — backlog suggéré

### Immédiat (1-2 jours)
- **Déployer med-app + patient-portal sur Vercel** (cf. §6)
- **Persister les sessions Liri** (P5.1) — ~3h, débloque le billing
- **Provisionner des comptes patient supplémentaires** pour la démo Zahir (le compte demo-patient-zahir est seul aujourd'hui)

### Court terme (1 semaine)
- Faire la **démo Zahir** suivant `docs/MEDOS_DEMO_ZAHIR_SCRIPT.md`
- **Activer Mbolo Live** : créer `apps/api/src/mbolo/live-sale.service.ts` qui suit le pattern §5
- **Notifications** : aucune notif push/email aujourd'hui, le pattern d'audit-interceptor pourrait facilement émettre un événement

### Moyen terme (1 mois)
- Migrer le client Vercel pour mettre **med-app sous app.cimolace.space/medos** (Vercel rewrites)
- **Tarification + facturation** : on a la table `med_audit_log` qui contient toutes les opérations. Liri devra avoir la sienne pour les minutes vidéo. Ensuite agréger pour un dashboard "Consommation Zahir = X € ce mois"
- **Mobile app** patient (React Native) — l'API est déjà prête, seule l'UI manque

### Long terme (3+ mois)
- **Marketplace de moteurs** : aujourd'hui Cimolace contient MEDOS, Mbolo, ISNA. À terme, les tenants devraient pouvoir activer / désactiver / installer des moteurs comme on installe des apps. Le pattern `module.imports[]` de NestJS + le système de tenant features (`tenant_features.medos_enabled`) le permet déjà au niveau backend.

---

## 11. Si tu veux relancer un test E2E prod

```bash
cd /tmp/medos-migrate && node e2e-p0-p4.mjs
```

Si le bucket `medos` n'existe plus (oui ça arrive si quelqu'un fait un cleanup) :
```bash
cd /tmp/medos-migrate && node create-medos-bucket.mjs
```

Si tu veux re-prendre les screenshots :
```bash
# Démarrer les dev servers
cd apps/med-app && npm run dev &      # port 5174
cd apps/patient-portal && npm run dev & # port 5175

cd /tmp/medos-shots && node capture-p3.mjs
```

---

## 12. Contact

L'utilisateur de cette session était **Ngowazulu** (fondateur Cimolace, `cimolace@gmail.com`). Il préfère le français, parle de manière directe, valide souvent par "oui" pour avancer. Il a beaucoup d'idées d'architecture — écoute attentivement quand il parle de Liri, des moteurs et des tenants : ce sont les abstractions centrales du projet.

**Bon courage, et garde Liri comme la seule autorité vidéo.** 🎬

---

*Fin du handoff — généré par Claude Opus 4.7 le 2026-05-28.*
