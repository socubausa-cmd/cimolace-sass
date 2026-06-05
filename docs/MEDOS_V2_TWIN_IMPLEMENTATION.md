# MEDOS v2 — Bio Digital Twin · Implémentation Phase A (livrée)

> Compagnon de `MEDOS_V2_BIO_DIGITAL_TWIN_ARCHITECTURE.md`. Documente ce qui est
> **réellement codé, testé et buildé** dans ce cycle (l'épine dorsale Phase A),
> son API, son schéma, ses tests, et la procédure de déploiement.

| | |
|---|---|
| Date | 2026-06-05 |
| Statut | Code complet · build vert (API + med-app) · tests unitaires verts · **migration DB à appliquer (1 étape ops)** |
| Périmètre livré | Couches 0 (ingestion/biomarqueurs), 1 (moteur scores + alertes), 2 (corps 3D), 3 (assistant organe + hypothèses), transverse (audit, XAI, confiance) |

---

## 1. Ce qui est livré (mapping modules)

| Module(s) | Livré | Où |
|---|---|---|
| M1 Dossier patient | réutilisé (existant) | `med_patients` |
| M3 Lecture documents / extraction | ✅ endpoint + agent IA vision | `twin.service.extractDocument` |
| M6 Score organe (0-100, couleur, dimensions) | ✅ **déterministe + testé** | `twin-scoring.service.ts` |
| M5/M7 Corps 3D + jumeau | ✅ react-three-fiber (organes primitifs) | `twin/BodyViewer.tsx` |
| M11 Assistant organe + M19 XAI | ✅ Claude + sous-graphe + confiance | `twin.service.organAssistant` |
| M14 Alertes cliniques | ✅ rule-based (4 patterns) | `twin-scoring.detectAlerts` |
| M16/M18 Hypothèses différentielles | ✅ Claude, validables par le thérapeute | `twin.service.analyze` |
| M15 Bibliothèque biomarqueurs / M25 labo virtuel | ✅ référentiel + saisie + liste | `GET /referential`, `TwinPage` |
| M2/M8/M22 roue, mindmap, réseau | tables + graphe seedés (UI à venir Phase B) | `med_bio_nodes/edges` |
| M20 Audit / M32 confiance | ✅ `med_ai_agent_runs` + confidence partout | transverse |
| M35 Centre de commande | ✅ page unifiée | `twin/TwinPage.tsx` |

### Vague 2 — couverture étendue (livrée le même jour)
| Module(s) | Livré | Où |
|---|---|---|
| M2 Roue de transformation | ✅ radar éditable + persistance | `panels.WheelPanel`, `GET/POST /wheel` |
| M3 Lecteur bilan/ordonnance | ✅ coller texte → extraction IA → biomarqueurs | `panels.LabReaderPanel` |
| M8 Carte métabolique | ✅ regroupement par système | `panels.MetabolicMapPanel` |
| M8/M17/M22 Mindmap & réseau | ✅ graphe SVG nœuds-arêtes | `panels.MindmapPanel`, `GET /graph` |
| M9/M17 Moteur de corrélations | ✅ **déterministe** (graphe + données) | `GET /:id/correlations` |
| M16 Root Cause Explorer | ✅ causes racines classées (IA) | `POST /:id/root-cause` |
| M21 Timeline santé 360 | ✅ événements + ajout | `panels.TimelinePanel`, `GET/POST /events` |
| M23 Simulateur d'intervention | ✅ **déterministe + 4 tests** | `TwinSimulationService`, `POST /:id/simulate` |
| M26 Analyse longitudinale | ✅ sparklines historisées | `panels.LongitudinalPanel`, `GET /:id/history` |
| M33 Conseil multi-agents | ✅ 5 experts + consensus (IA) | `POST /:id/council` |
| M15 Moteur scientifique | ✅ PubMed E-utilities | `POST /scientific` |
| M35 Centre de commande | ✅ **8 onglets** | `TwinPage` |

**Agents IA livrés** : extraction (biomarqueurs), assistant organe (organes), corrélations
(déterministe), hypothèses différentielles, root cause, recherche scientifique (PubMed),
détection de risque (alertes), simulation (déterministe), consensus (conseil multi-agents).

Modules restants (Phase E) : microbiote M27, génomique M28, intelligence collective M31 —
fondations DB en place, parsers dédiés à construire.

---

## 2. Schéma de données (migration `20260605000001_medos_twin_foundation.sql`)

13 tables, toutes additives, `med_*`, multi-tenant + RLS.

**Référentiels globaux** (`tenant_id NULL`, lecture authentifiée) :
`med_organs` (12 seedés), `med_biomarker_refs` (40 seedés), `med_bio_nodes`, `med_bio_edges` (graphe seedé).

**Données patient** (RLS staff + service_role) :
`med_lab_documents`, `med_patient_biomarkers`, `med_organ_scores`, `med_transformation_wheel`,
`med_health_events`, `med_alerts`, `med_ai_analyses`, `med_ai_agent_runs`, `med_hypotheses`.

Index sur tous les accès patient. Triggers `update_updated_at` sur les tables mutables.

---

## 3. API REST (`/med/twin`, gardes `JwtAuthGuard + TenantGuard + MedosEnabledGuard + RolesGuard`)

| Méthode | Route | Rôle | Description |
|---|---|---|---|
| GET | `/med/twin/referential` | staff | Organes + bibliothèque biomarqueurs |
| GET | `/med/twin/graph` | staff | Knowledge graph (nœuds + arêtes) |
| GET | `/med/twin/:patientId/state` | staff | État complet (organes+scores, biomarqueurs, alertes, hypothèses, roue) |
| GET | `/med/twin/:patientId/biomarkers` | staff | Dernières valeurs par code |
| POST | `/med/twin/:patientId/biomarkers` | staff | Saisie de valeurs → **recalcul auto des scores** |
| POST | `/med/twin/:patientId/compute` | staff | Recalcul scores + alertes (déterministe) |
| POST | `/med/twin/:patientId/documents` | staff | Créer un document labo |
| POST | `/med/twin/:patientId/documents/:docId/extract` | staff | Extraction IA → biomarqueurs |
| POST | `/med/twin/:patientId/organ-assistant` | staff | Assistant organe (IA explicable) |
| POST | `/med/twin/:patientId/analyze` | staff | Hypothèses différentielles (IA) |
| PATCH | `/med/twin/hypotheses/:id` | staff | Valider/rejeter une hypothèse (contrôle humain) |

Réponses enveloppées `{ data }` par le `ResponseInterceptor` global. Toutes les
actions IA sont tracées dans `med_ai_agent_runs` (modèle, tokens, latence, hash d'entrée).

`staff` = `owner | practitioner | clinic_admin`.

---

## 4. Couche IA

- **Modèle** : Anthropic `claude-3-5-sonnet-20241022` (override `TWIN_AI_MODEL`). Extraction vision réutilisable via le pipeline existant `gpt-4o-mini`.
- **Pseudonymisation** : le contexte envoyé au LLM contient âge, sexe, biomarqueurs, symptômes dérivés — **jamais** nom/prénom/contact.
- **Sorties structurées** : JSON strict imposé par le system prompt, parsé et validé.
- **Sécurité** : si `ANTHROPIC_API_KEY` absent → 503 propre ; le cœur déterministe (scores/alertes) reste opérationnel.
- **XAI** : chaque sortie porte `confidence` + explication + (assistant) examens recommandés.

---

## 5. Moteur de scoring (déterministe, testé)

`TwinScoringService` — fonctions pures :
- `computeFlag(ref, value)` → `low|normal|high|critical` (plages optimale vs labo)
- `computeOrganScore(organ, refs, values)` → score 0-100, couleur, sous-scores dimensionnels, biomarqueurs contributifs, confiance
- `detectAlerts(refs, values)` → syndrome métabolique, inflammation chronique, carences, risque métabolique

**Tests** : `apps/api/test/twin-scoring.test.js` (runner `node:test`) — **15 tests, tous verts**.
```
cd apps/api && npm run build && node --test test/twin-scoring.test.js
```

---

## 6. Frontend

- Route **lazy** `/twin/:patientId` (code-split : three.js isolé dans son chunk, chargé à l'ouverture du 3D — bundle principal inchangé).
- `twin/BodyViewer.tsx` : corps 3D react-three-fiber, organes colorés par score (vert/jaune/orange/rouge), cliquables, rotation/zoom (OrbitControls).
- `twin/TwinPage.tsx` : centre de commande (3D + assistant organe + alertes + hypothèses + laboratoire + saisie).
- Bouton **« Jumeau numérique »** sur la fiche patient (`PatientDetail`).
- Bandeau de sécurité clinique permanent ; bouton **« Charger un profil démo »** pour démonstration instantanée.
- White-label : `var(--brand-primary)` ; cohérent avec le reste de med-app.

---

## 7. Déploiement

### 7.1 Build (vérifié)
```
cd apps/api && npx nest build            # ✅
cd apps/med-app && npx tsc --noEmit && npx vite build   # ✅ (TwinPage + BodyViewer code-splittés)
```

### 7.2 Étape ops unique restante — **appliquer la migration DB**
La migration est additive (aucune table existante modifiée). À appliquer par une
personne disposant d'un accès DB (non disponible dans l'environnement de build) :

- **Option A — Dashboard Supabase** : SQL Editor → coller le contenu de
  `supabase/migrations/20260605000001_medos_twin_foundation.sql` → Run.
- **Option B — Management API** (token `sbp_…`) :
  `POST https://api.supabase.com/v1/projects/<ref>/database/query` avec `{ "query": "<contenu SQL>" }`.
- **Option C — `supabase db push`** après `supabase link` (réservé environnements non-prod).

Tant que la migration n'est pas appliquée, les endpoints `/med/twin/*` renvoient une
erreur (tables absentes) — **l'API démarre normalement** (requêtes paresseuses), et
l'UI affiche un bandeau d'erreur sans planter.

### 7.3 Déploiement code — **FAIT (2026-06-05)**
- **med-app** (Vercel) : ✅ déployé → `med.cimolace.space` (route `/twin/:patientId` + chunk 3D code-splitté en ligne).
- **API** (Railway) : ✅ déployé → `api.cimolace.space` (routes `/med/twin/*` actives — `401` sans auth). NB : le CLI `railway up` perd la connexion en streamant les logs (instable), mais le build aboutit server-side ; vérifier via `curl -o /dev/null -w "%{http_code}" https://api.cimolace.space/med/twin/referential` (401 = déployé).
- **Reste** : appliquer la migration DB (§7.2) — sans elle, les endpoints renvoient une erreur (tables absentes) ; l'API démarre normalement et l'UI ne plante pas.

### 7.4 Variables d'environnement
- `ANTHROPIC_API_KEY` (déjà configuré) — analyses IA.
- `TWIN_AI_MODEL` (optionnel) — override du modèle.
- Aucune nouvelle variable obligatoire pour le cœur déterministe.

---

## 8. Hypothèses & décisions autonomes (documentées)

1. **Schéma code-centric** (codes texte stables au lieu d'UUID croisés) — seeds simples, liaisons lisibles.
2. **Client Supabase non typé** pour les tables twin — évite d'alourdir le type `Database` partagé.
3. **Scoring déterministe d'abord** (testable, sans IA) — l'IA s'ajoute par-dessus, jamais en dépendance du cœur.
4. **3D = organes primitifs stylisés** (fallback architecture §7.2) — découple la 3D de la disponibilité d'un asset anatomique licencié.
5. **Saisie manuelle + profil démo** en plus de l'extraction IA — garantit un parcours fonctionnel et démontrable sans OCR.
6. **Contenu clinique seedé** (plages, graphe) = v1 indicative, **à valider cliniquement** ; jamais présenté comme diagnostic.
7. **Pas d'application DB automatique** — respect des contraintes de sécurité (pas de `db push` prod, pas de saisie de secrets) ; migration livrée + documentée.

---

## 9. Sécurité clinique (rappel appliqué dans le code)

- Aucun diagnostic : hypothèses/corrélations/alertes/probabilités uniquement.
- Validation humaine obligatoire des hypothèses (`status: suggested → validated/rejected`).
- Bandeau permanent « copilote, jamais diagnostic » dans l'UI.
- Traçabilité complète des runs IA (`med_ai_agent_runs`).
- Isolation tenant (filtre `tenant_id` systématique + RLS) ; pseudonymisation avant LLM.
