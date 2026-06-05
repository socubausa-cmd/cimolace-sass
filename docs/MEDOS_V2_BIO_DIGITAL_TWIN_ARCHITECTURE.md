# MEDOS v2 — Bio Digital Twin AI · Architecture technique & specs

> **Document d'architecture maître.** Tient lieu de référence pour tout agent / dev qui code la v2.
> Statut : **draft v1** — Décisions structurantes actées (voir §2). Reste à valider : modélisation clinique du knowledge graph, choix asset 3D.

| | |
|---|---|
| **Produit** | BIO DIGITAL TWIN AI — copilote clinique + jumeau numérique du corps humain |
| **Date** | 2026-06-05 |
| **Périmètre** | 35 modules (cahier des charges fourni par le founder) |
| **Placement produit (acté)** | **Évolution de `apps/med-app`** — chaque thérapeute tenant y accède via le SSO embed existant |
| **Cible utilisateur** | Thérapeutes : nutrition fonctionnelle, naturopathie, médecine fonctionnelle/intégrative, coach santé avancé |
| **Repo** | `~/Downloads/isna_platform_v2` (monorepo Cimolace) |

---

## 1. Principes directeurs (non négociables)

Ces principes sont **architecturaux**, pas décoratifs. Ils contraignent chaque endpoint et chaque écran.

1. **Copilote, jamais oracle.** L'IA ne parle **jamais** au patient. Elle ne produit **jamais** de diagnostic définitif. Elle produit : hypothèses, corrélations, alertes, scénarios probabilistes. → toute sortie IA est typée `suggestion` et estampillée « à valider par le thérapeute ».
2. **Thérapeute 100 % décisionnaire.** Toute hypothèse/score/protocole a un état `pending` → `validated`/`rejected` par un humain. Rien ne devient « vérité du dossier » sans validation.
3. **Explicabilité obligatoire (XAI — M19).** Chaque conclusion IA porte : les biomarqueurs/symptômes invoqués, le raisonnement, les sources scientifiques, et un **score de confiance** (M32). Pas de boîte noire.
4. **Traçabilité totale (M20).** Chaque run IA est journalisé : version du modèle, prompt/version du graphe, données d'entrée (hash), sortie, validateur, horodatage. C'est exigé médico-légalement.
5. **Souveraineté & RGPD.** Données de santé = catégorie spéciale RGPD. Isolation tenant stricte (RLS), consentement explicite, export/anonymisation (déjà en place côté MEDOS v1). Aucune donnée patient ne sort vers un LLM sans pseudonymisation des identités directes.
6. **Dégradation gracieuse.** Si un agent IA échoue, l'écran reste utilisable (cf. le fix Dashboard récent : jamais d'écran blanc). Chaque couche tolère l'absence des couches supérieures.

---

## 2. Décisions d'architecture actées

| # | Décision | Justification |
|---|---|---|
| **D1** | v2 = **évolution de `apps/med-app`**, pas une app séparée | Réutilise tout l'acquis : auth/SSO embed, branding white-label, dossier patient, attachments, audit, RGPD, Liri. Time-to-value maximal. |
| **D2** | Gating par **flag tenant** `features.bio_twin` (premium) | Permet d'activer la v2 par tenant sans forcer tous les tenants. Le thérapeute « basique » garde MEDOS v1. |
| **D3** | Le **moteur biologique** (couche 1) est le produit, pas la 3D | La 3D est la vitrine ; le knowledge graph biomarqueur↔organe↔symptôme est la valeur. On le construit en premier, testable sans pixels. |
| **D4** | IA = **orchestration serveur (NestJS)**, multi-agents séquencés + parallélisés | Les clés API restent serveur (jamais dans le navigateur). Pattern déjà éprouvé avec `med-charting.service.ts`. |
| **D5** | Tables nouvelles préfixées **`med_*`**, multi-tenant `tenant_id` + **RLS** | Cohérent avec `med_patients`, `med_attachments`, `med_audit_log`. |
| **D6** | Le contenu clinique (graphe, refs biomarqueurs) est **versionné et seedé**, pas codé en dur | Permet l'évolution du savoir sans redeploy ; chaque analyse référence la **version du graphe** utilisée. |

---

## 3. Stack technique

### 3.1 Existant réutilisé (ne pas réinventer)
| Brique | Techno | Réutilisé pour |
|---|---|---|
| Front praticien | **React 18 + Vite + TS** (`apps/med-app`) | Toute l'UI v2 |
| API | **NestJS** (`apps/api`, Railway, `api.cimolace.space`) | Tous les endpoints v2 |
| Data | **Supabase Postgres + RLS** | Toutes les tables `med_*` |
| Auth | Supabase JWT + `JwtAuthGuard` + header `X-Tenant-Slug` | Inchangé |
| SSO embed | `auth_handoff_codes` + `/handoff` | Accès depuis le site tenant |
| Branding | `BrandingProvider` + `var(--brand-*)` | White-label v2 |
| Wrapper réponses | `ResponseInterceptor` → `{ data }` (`@SkipResponseWrapper` si besoin) | ⚠️ attention au double-wrap (cf. bug Liri conso) |
| IA raisonnement | **Anthropic Claude `claude-sonnet-4-6`** (déjà câblé) | Agents cliniques, hypothèses, synthèse |
| IA vision/OCR | **OpenAI `gpt-4o-mini`** (`OPENAI_VISION_MODEL`) + Claude vision en secours | Extraction documents (M3) |
| Transcription | **Deepgram** | Copilote consultation audio (M30) |
| Stockage fichiers | Supabase Storage (via `med_attachments`) | Documents labos importés |

### 3.2 Nouvelles dépendances à ajouter
| Besoin | Lib retenue | Notes |
|---|---|---|
| Rendu 3D corps humain | **`three` + `@react-three/fiber` + `@react-three/drei`** | Standard React 3D. `drei` pour OrbitControls/loaders. |
| Modèle anatomique | Asset **`.glb`** d'organes séparés (1 mesh nommé / organe) | Voir §7.2 — sourcing à acter. Fallback : organes primitifs stylisés. |
| Mindmap / graphes (M8, M17, M22) | **`@xyflow/react`** (React Flow) | Graphes nœuds-arêtes interactifs, layout dagre. |
| Courbes (longitudinal M26, roue M2) | **`recharts`** (déjà léger) ou SVG maison | Roue = radar chart. |
| PubMed (M15) | API **E-utilities NCBI** (REST, clé gratuite) | Côté serveur, cache agressif. |

> ⚠️ Le bundle med-app passe déjà 600 kB. La 3D et React Flow doivent être **code-splittées** (`React.lazy` par route `/twin`) pour ne pas alourdir les écrans v1.

---

## 4. Cartographie des 35 modules → couches → phases

| Couche | Modules | Phase | État actuel |
|---|---|---|---|
| **0 · Données & ingestion** | M1 dossier, M3 lecture docs, M24 biblio biomarqueurs, M25 labo virtuel, M21 timeline 360 | A | M1 ✅ / M3 ⚠️ moitié (attachments) / reste ❌ |
| **1 · Moteur biologique & scores** | M2 roue, M4 moteur, M6 score organe, M14 alertes, M32 confiance | A→B | ❌ (le cœur à bâtir) |
| **2 · Visualisation** | M5 corps 3D, M7 twin, M34 twin 4D, M8 mindmap, M12 propagation, M22 réseau | B→C | ❌ |
| **3 · Intelligence clinique** | M9/M16/M17 corrélations & causalité & root-cause, M18 hypothèses diff., M11 assistant organe, M19 XAI, M10 IA clinique, M15 PubMed, M30 copilote, M33 conseil multi-agents | B→C | M10 ⚠️ embryon (charting) |
| **4 · Temporel & simulation** | M13 projection, M23 simulateur, M26 longitudinal, M29 priorisation | D | ❌ |
| **5 · Avancé / collectif** | M27 microbiote, M28 génomique, M31 intelligence collective, M35 centre de commande | C→E | M35 = assemblage final |
| **Transverse** | M20 audit, M32 confiance, M19 XAI | toutes | M20 ✅ socle |

---

## 5. Modèle de données v2 (nouvelles tables `med_*`)

Toutes : `id uuid pk`, `tenant_id uuid not null references tenants(id)`, `created_at`/`updated_at`, **RLS par tenant**. Schémas indicatifs (colonnes clés).

### 5.1 Ingestion & biomarqueurs (couche 0)
```
med_lab_documents          -- un document importé (PDF/image)
  patient_id, attachment_id (→ med_attachments), source_type ('blood'|'imaging'|'prescription'|'specialist'|'microbiome'|'dna'|'other'),
  lab_name, sampled_at, status ('uploaded'|'extracting'|'extracted'|'failed'|'reviewed'),
  extraction_model, extraction_confidence numeric, raw_text text, reviewed_by, reviewed_at

med_biomarker_refs         -- BASE DE CONNAISSANCES (seedée, partagée, tenant_id NULL = global)
  code (ex 'CRP','TSH','HOMA_IR'), name_fr, category ('inflammation'|'hormone'|'metabolic'|...),
  unit_canonical, optimal_low, optimal_high, lab_low, lab_high, organs uuid[] (→ med_organs),
  function_fr text, associated_symptoms text[], graph_version

med_patient_biomarkers     -- une valeur mesurée pour un patient
  patient_id, lab_document_id, biomarker_code, value numeric, unit_raw, value_canonical numeric,
  flag ('low'|'normal'|'high'|'critical'), measured_at, confidence numeric
```

### 5.2 Organes, scores, roue (couche 1)
```
med_organs                 -- référentiel anatomique (seedé, global)
  code ('liver','gut','thyroid','brain','heart',...), name_fr, system ('digestive'|'endocrine'|...),
  mesh_name (nom du mesh dans le .glb 3D)

med_organ_scores           -- score calculé d'un organe pour un patient à un instant
  patient_id, organ_code, score int (0-100), color ('green'|'yellow'|'orange'|'red'),
  dimensions jsonb {inflammation,oxidative_stress,metabolism,hormones,toxicity,cellular_energy},
  computed_at, graph_version, engine_version, confidence numeric,
  contributing_biomarkers jsonb[]   -- traçabilité du score

med_transformation_wheel   -- M2 : 12 domaines fonctionnels
  patient_id, domain ('digestion'|'sleep'|'stress'|...), score int, measured_at, source ('questionnaire'|'derived')

med_health_events          -- M21 timeline 360
  patient_id, event_type ('illness'|'surgery'|'vaccination'|'pregnancy'|'stress'|'diet_change'|'medication'),
  title, occurred_at, payload jsonb

med_alerts                 -- M14
  patient_id, kind ('metabolic_risk'|'chronic_inflammation'|'metabolic_syndrome'|'deficiency'|'drug_interaction'),
  severity, message_fr, evidence jsonb, status ('open'|'ack'|'dismissed'), graph_version
```

### 5.3 Knowledge graph biologique (le cœur — M4/M9/M16/M17/M22)
```
med_bio_nodes              -- seedé, global (tenant_id NULL)
  node_type ('organ'|'biomarker'|'symptom'|'hormone'|'system'|'condition'), ref_code, label_fr, graph_version

med_bio_edges              -- arêtes typées et pondérées (le savoir clinique)
  from_node, to_node, relation ('causes'|'modulates'|'inflames'|'depletes'|'correlates'|'regulates'),
  weight numeric (0-1), direction ('forward'|'bidirectional'), evidence_level ('A'|'B'|'C'|'expert'),
  sources jsonb[] (PMIDs/guidelines), graph_version
```
> **Le graphe est seedé par du contenu clinique versionné** (`graph_version`), pas généré par l'IA. L'IA *parcourt* le graphe ; elle ne l'invente pas. C'est ce qui rend le système crédible et auditable.

### 5.4 Intelligence clinique (couche 3)
```
med_ai_analyses            -- une analyse globale (snapshot) d'un patient
  patient_id, kind ('root_cause'|'differential'|'organ_assistant'|'consultation_synthesis'|'council'),
  status ('generating'|'ready'|'validated'|'rejected'), graph_version, models jsonb,
  output jsonb, confidence numeric, validated_by, validated_at

med_ai_agent_runs          -- un run d'un agent (traçabilité fine M20)
  analysis_id, agent ('exams'|'symptoms'|'wheel'|'organs'|'correlations'|'science'|'hypotheses'|'audit'|'projection'|'viz'),
  input_hash, prompt_version, model, output jsonb, tokens, latency_ms, started_at, finished_at, error

med_hypotheses             -- M16/M18 : hypothèses différentielles
  patient_id, analysis_id, label_fr, probability numeric, confidence numeric,
  reasoning_fr, args_for jsonb[], args_against jsonb[], supporting_data jsonb[],
  status ('suggested'|'validated'|'rejected'), graph_version

med_protocols              -- M (workflow étape 11) : protocole construit par le thérapeute
  patient_id, title, hypotheses uuid[], interventions jsonb[], created_by, status
```

### 5.5 Avancé (couche 5, phase E)
```
med_microbiome_reports     -- M27 (GI-MAP, Biomesight…) : diversité, dysbiose, corrélations
med_genomic_profiles       -- M28 : SNP méthylation/détox/inflammation (RAW ADN)
```

---

## 6. Pipeline IA multi-agents (couche 3)

### 6.1 Orchestration
Côté **NestJS** (`apps/api/src/medos/twin/`), un orchestrateur séquence les agents. Pattern : chaque agent = fonction pure `(input, graph) → { output, confidence, sources }`, journalisée dans `med_ai_agent_runs`. Parallélisation des agents indépendants (1,2,3,4), barrière avant corrélations (5), puis hypothèses (7), audit (8), synthèse.

```
M3 Extraction ──┐
 (vision OCR)    │
                 ▼
   Normalisation unités/réf ──► med_patient_biomarkers
                 │
   ┌─────────────┼───────────────┬──────────────┐
   ▼             ▼               ▼              ▼
 Agent1        Agent2          Agent3         Agent4      (parallèle)
 exams        symptoms         roue           organes
   └─────────────┴───────────────┴──────────────┘
                 ▼
         Agent5 corrélations (parcourt med_bio_edges) ──► med_organ_scores + med_alerts
                 ▼
   Agent6 science (PubMed) ──► sources
                 ▼
   Agent7 hypothèses (root-cause + différentielles) ──► med_hypotheses
                 ▼
   Agent8 audit clinique (cohérence, angles morts) 
                 ▼
   Agent9 projection temporelle (optionnel)
                 ▼
   Synthèse ──► med_ai_analyses (status='ready', NON validé)
                 ▼
        ⟶ Validation thérapeute (humain) ⟶ status='validated'
```

### 6.2 Conseil multi-agents (M33)
Variante : 5 « experts » (endocrino, gastro, nutritionniste fonctionnel, immuno, cardio) = 5 runs Claude avec system prompts spécialisés, chacun parcourt le graphe avec sa lentille, puis un agent **consensus** synthétise (pondération par confiance). Implémenté comme un `kind='council'` dans `med_ai_analyses`.

### 6.3 Garde-fous IA (rappel des principes)
- Pseudonymisation des identités directes avant envoi au LLM (nom/prénom/contacts retirés ; on envoie âge, sexe, biomarqueurs, symptômes).
- Sortie **toujours structurée** (JSON schema imposé via tool-use), jamais du texte libre interprété comme vérité.
- `confidence` + `evidence_level` propagés du graphe jusqu'à l'écran.
- Aucune action irréversible déclenchée par l'IA.

---

## 7. Couche visualisation (couche 2)

### 7.1 Corps humain 3D (M5/M6/M7/M34)
- Route lazy `/twin/:patientId` dans med-app, `react-three-fiber` + `drei`.
- Un `.glb` avec **un mesh nommé par organe** (`mesh_name` dans `med_organs`).
- Colorisation : material override par organe selon `med_organ_scores.color` (vert/jaune/orange/rouge). Émissif léger pour les zones critiques.
- Interactions : rotation/zoom (OrbitControls), **clic organe → ouvre l'Assistant Organe (M11)**.
- « 4D » (M34) = curseur temporel qui rejoue les snapshots `med_organ_scores` dans le temps ; propagation animée (M12) = arêtes du graphe surlignées en séquence.

### 7.2 Sourcing du modèle 3D — **décision à acter**
Options : (a) modèle anatomique licencié (BodyParts3D/licence, ou achat marketplace), (b) modèle généré/stylisé low-poly, (c) **fallback v1 : organes en formes primitives stylisées positionnées** (pas de réalisme, mais fonctionnel + démontrable immédiatement). Reco : démarrer en (c) pour ne pas bloquer, viser (a) ensuite.

### 7.3 Mindmap & réseau (M8/M17/M22)
React Flow : nœuds = organes/biomarqueurs/symptômes, arêtes = `med_bio_edges` filtrées sur le patient. Layout auto (dagre). Clic arête → explication XAI.

---

## 8. Le « Centre de commande clinique » (M35)

Écran d'assemblage final — `/twin/:patientId` en vue unifiée, grille responsive de panneaux :
1. Corps 3D · 2. Roue de transformation · 3. IA clinique (hypothèses) · 4. Timeline santé · 5. Labo virtuel · 6. Carte métabolique · 7. Mindmap · 8. Alertes · 9. Hypothèses · 10. Protocoles.

Réutilise les composants des couches 0-4. C'est la **dernière** brique (phase C/D), pas la première.

---

## 9. Phasage / roadmap

> Honnêteté : c'est un produit **multi-mois**. Découpage en jalons **démontrables** (chacun apporte un « wow » montrable à un thérapeute).

| Phase | Contenu | Jalon démontrable | Modules |
|---|---|---|---|
| **A — Épine dorsale** | Ingestion doc + extraction IA + biomarqueurs + refs + scores organes + corps 3D colorisé + assistant organe + audit | « J'importe un PDF de bilan → le corps se colore → je clique le foie → explication sourcée » | M1,M3,M24,M6,M5,M11,M19,M20,M32 |
| **B — Intelligence** | Knowledge graph seedé + corrélations + root-cause + hypothèses différentielles + roue + alertes + mindmap | « L'IA propose 3 causes racines classées, je valide » | M2,M4,M9,M14,M16,M17,M18,M8 |
| **C — Visualisation avancée + science** | Twin 4D + propagation animée + réseau biologique + PubMed + conseil multi-agents + centre de commande | « Vue unifiée + propagation des dysfonctions + consensus d'experts IA » | M7,M12,M22,M15,M30,M33,M34,M35 |
| **D — Temporel** | Projection temporelle + simulateur d'intervention + longitudinal + priorisation | « Scénario 6 mois avec/sans protocole + intervention la plus rentable » | M13,M23,M26,M29 |
| **E — Avancé/collectif** | Microbiote + génomique + intelligence collective anonymisée | Imports GI-MAP / ADN + tendances inter-dossiers | M27,M28,M31 |

### Spec détaillée du **premier jalon codable** (Phase A, slice vertical)
1. **DB** : migration `med_lab_documents`, `med_biomarker_refs` (+ seed ~40 biomarqueurs clés), `med_patient_biomarkers`, `med_organs` (+ seed ~12 organes), `med_organ_scores` (+ RLS).
2. **API** : `POST /med/twin/documents` (upload→`med_attachments`), worker extraction (`gpt-4o-mini` vision → texte → Claude structured biomarker extraction → normalisation → `med_patient_biomarkers`), `POST /med/twin/:patientId/compute-scores` (règle simple v1 : score organe = f(biomarqueurs liés + flags)), `GET /med/twin/:patientId/state` (organes+scores+biomarqueurs), `POST /med/twin/organ-assistant` (Claude + sous-graphe organe → explication XAI). Tout journalisé `med_ai_agent_runs`.
3. **Front** : route lazy `/twin/:patientId`, viewer 3D (fallback primitives §7.2), colorisation par score, panneau latéral « Assistant Organe », bandeau « hypothèses non validées — à confirmer ».
4. **Garde-fous** : pseudonymisation avant LLM, `confidence` affiché, audit complet, flag tenant `bio_twin`.

---

## 10. Sécurité, RGPD & médico-légal

- **Données de santé = catégorie spéciale (RGPD art. 9).** Base légale = consentement explicite (déjà : `med_patients.consent_given`). Étendre le consentement à « analyse IA augmentée ».
- **Isolation tenant** : RLS sur toutes les tables `med_*` (les refs/graphe globaux sont `tenant_id IS NULL`, lecture seule).
- **Pseudonymisation LLM** : jamais de nom/prénom/contact envoyé à un LLM tiers. Journaliser quelles données ont quitté le périmètre.
- **Traçabilité (M20)** : `med_ai_agent_runs` = preuve de chaque décision IA (modèle, version graphe, entrée, sortie, validateur).
- **Mention légale UI** : bandeau permanent « Aide à la décision — ne remplace pas le jugement clinique ; aucune valeur de diagnostic ».
- **Hébergement données santé** : à terme, vérifier l'exigence HDS (France) / équivalent selon les juridictions des tenants. Supabase région UE à confirmer.
- **Réutilisation v1** : export RGPD + anonymisation patient déjà implémentés → étendre aux nouvelles tables.

---

## 11. Risques & dé-risquage

| Risque | Impact | Mitigation |
|---|---|---|
| **Knowledge graph creux** (peu de contenu clinique) | Le produit paraît « vide »/faux | Seed progressif validé par un thérapeute réel ; `evidence_level` honnête ; commencer par 12 organes × 40 biomarqueurs bien modélisés plutôt que 400 mal faits |
| **Extraction PDF labos peu fiable** (formats hétérogènes) | Carburant erroné → scores faux | Revue humaine obligatoire post-extraction (`status='reviewed'`) avant calcul des scores ; normalisation d'unités robuste ; confidence par valeur |
| **Hallucination IA** présentée comme fait | Médico-légal + perte de confiance | Sortie structurée + `confidence` + validation humaine + XAI sourcé ; l'IA parcourt le graphe, n'invente pas |
| **Asset 3D bloquant** | Phase A retardée | Fallback primitives stylisées (§7.2) → découple la 3D du moteur |
| **Bundle med-app obèse** | Lenteur pour tous les tenants | Code-split `/twin` en lazy ; 3D/React Flow chargés à la demande |
| **Coût LLM** (multi-agents × dossiers) | Marge | Cache des refs/graphe ; n'invoquer les agents qu'à la demande/validation ; modèles économes pour l'OCR |
| **Périmètre 35 modules** | Jamais fini | Jalons démontrables ; chaque phase a une valeur autonome ; ne pas viser M34 « 4D » avant que A/B soient solides |

---

## 12. Estimation d'effort (ordre de grandeur, honnête)

| Phase | Effort indicatif | Dépendances dures |
|---|---|---|
| A — Épine dorsale | le plus gros « unitaire » (DB + pipeline extraction + 1ère 3D) | seed refs/organes, asset 3D fallback |
| B — Intelligence | dépend surtout du **contenu** du graphe (clinique, pas code) | thérapeute pour valider le graphe |
| C — Viz avancée + science | technique (3D 4D, PubMed, multi-agents) | A+B solides |
| D — Temporel | modélisation probabiliste (le plus « recherche ») | longitudinal nécessite ≥2 snapshots/patient |
| E — Avancé | parsers microbiome/ADN | partenariats labos |

> L'estimation en jours dépend du staffing ; la séquence et les dépendances ci-dessus sont, elles, fermes.

---

## 13. Prochaines étapes (proposées)

1. **Acter le sourcing 3D** (§7.2) — reco : démarrer fallback primitives.
2. **Valider la liste des ~12 organes + ~40 biomarqueurs** du seed Phase A avec un thérapeute (idéalement Zahir).
3. **Lancer Phase A, jalon 1** : migration DB + seed + endpoint extraction (réutilise le pipeline vision existant de `med-charting.service.ts`).
4. Brancher le flag tenant `bio_twin` + route lazy `/twin`.

---

### Annexe — fichiers/répertoires cibles
```
apps/api/src/medos/twin/            (nouveau module NestJS : controller, orchestrateur, agents, dto)
apps/med-app/src/pages/Twin*.tsx    (route lazy /twin/:patientId)
apps/med-app/src/twin/              (composants 3D, mindmap, panneaux)
supabase/migrations/2026XXXX_medos_twin_*.sql  (tables + RLS + seeds refs/organes/graphe)
docs/MEDOS_V2_BIO_DIGITAL_TWIN_ARCHITECTURE.md  (ce document)
```

*Fin du document d'architecture v1.*
