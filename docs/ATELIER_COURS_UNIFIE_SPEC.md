# Atelier de cours unifié — spécification

> **Statut : PLAN, à valider avant tout code.** Rédigé le 2026-07-26.
> Objectif : remplacer 5 moteurs qui font le même travail par **un seul**, sans jamais
> laisser le fondateur sans outil fonctionnel pendant la transition.

---

## 1. Constat (mesuré, pas estimé)

| Moteur | Fichier | Source lue | Sortie réelle | Durée |
|---|---|---|---|---|
| Extraire le cours (PDF) | `apps/api/src/masterclass-factory/transcript-course.service.ts` | `published_videos.transcript_text` | **rien en base** — PDF client | ~40 s |
| Construire le cours | `apps/worker/src/jobs/course-from-replay.js` | `published_videos.transcript_text` | `courses` → `modules` → `formation_weeks` → `formation_days` → `formation_day_contents` | **~21 min** |
| Chapitrage | `apps/api/src/masterclass-factory/replay-chapters.service.ts` | idem | `published_videos.chapters` | ~1 min |
| Chaîne hors-ligne | `.replay-to-document.mjs` + `.course-engine.mjs` + `.produce-course.mjs` | idem | MasterScript | manuel |
| Précepteur TikTok | `tools/precepteur-tiktok/01→06` | `precepteur_sources` | `precepteur_courses` | par lots |

**Recouvrement** : les moteurs 1, 2 et 4 lisent la **même colonne**, appellent le **même modèle**
et exécutent les **mêmes étapes** (segmenter → notions → plan → rédiger). Ils ne divergent qu'au
moment d'écrire. Le moteur 5 fait la même chose sur une autre table.

**Débit réel au 2026-07-26 :**

- `published_videos` : **55** replays — **2** jobs lancés depuis toujours (1 `done`, 1 en cours).
- `precepteur_sources` : **645** vidéos — `new` **622**, `generated` 9, `skipped` 7,
  `transcribed` 4, `no_subs` 3. **96 % du corpus n'a jamais été traité.**
- Worker : poll toutes les 30 s, **un seul job à la fois** → 55 replays × 21 min ≈ **19 h en série**.

Le problème n'est pas la qualité des moteurs. C'est qu'ils sont en double et qu'aucun ne tourne en lot.

---

## 2. Le principe directeur : séparer le FOND de la FORME

C'est la découverte structurante de l'audit. Les moteurs ne produisent pas seulement des formats
différents — ils appartiennent à **deux familles de représentation** :

| Famille | Qui la produit | Forme |
|---|---|---|
| **Cours écrit** | `course-from-replay.js` (11 blocs/leçon), moteur PDF (3 blocs, pauvre) | modules → leçons → blocs |
| **Cours joué** | `tools/precepteur-tiktok/05-deep-course.mjs` | séquence de **scènes** narratives (`amorce_croquis`, `croquis_placeholder`, `atelier`, `image_analogie`, `transition`), voix orale |

Un pivot qui n'inclurait qu'une famille condamnerait l'autre. La solution est un **pivot à deux
niveaux** : le coûteux (comprendre la source) est fait **une fois** ; la mise en forme devient un rendu.

```
SOURCE ──► [ADAPTATEUR] ──► SourceNormalisée
                                  │
                                  ▼
                    ╔═════════════════════════════╗
                    ║  NOYAU (une seule fois)     ║
                    ║  segmenter → notions → plan ║
                    ╚═════════════════════════════╝
                                  │
                                  ▼
                       ┌──────────────────────┐
                       │  PIVOT niveau 1      │  ← le FOND, invariant
                       │  (Comprehension)     │     réutilisable à l'infini
                       └──────────────────────┘
                          │                │
                 ┌────────┘                └────────┐
                 ▼                                  ▼
      ┌────────────────────┐            ┌────────────────────┐
      │ PIVOT niveau 2-A   │            │ PIVOT niveau 2-B   │
      │ Cours ÉCRIT        │            │ Cours JOUÉ         │
      │ (blocs)            │            │ (scènes)           │
      └────────────────────┘            └────────────────────┘
             │                                    │
      ┌──────┴───────┬──────────┐          ┌──────┴───────┐
      ▼              ▼          ▼          ▼              ▼
     PDF     parcours élève  Masterclass  Précepteur   SmartBoard
```

**Gain immédiat** : aujourd'hui 5 moteurs × 4 formats. Demain 4 sources + 1 noyau + 5 rendus,
et **le même cours sort dans plusieurs formats sans être régénéré** (donc sans repayer l'IA).

---

## 3. Le pivot

### 3.1 Niveau 1 — `Comprehension` (le fond, invariant)

Extrait une seule fois de la source. Ne contient **aucune** décision de mise en forme.

```jsonc
{
  "schema_version": 1,
  "titre": "…",
  "promesse": "ce que l'élève saura FAIRE, une phrase concrète",
  "public": "…",
  "prerequis": ["…"],
  "notions": [
    {
      "id": "n1",
      "titre": "…",
      "idee_centrale": "…",
      "pourquoi": "…",
      "prerequis": ["n0"],
      "appuis": ["citation ou fait TIRÉ de la source"],   // ⛔ garde anti-invention
      "source_spans": [{ "start_sec": 124, "end_sec": 260 }]  // traçabilité vers la vidéo
    }
  ],
  "glossaire": [{ "terme": "…", "simple": "…" }],
  "meta": {
    "source_type": "replay|tiktok|document|texte",
    "source_id": "uuid",
    "source_title": "…",
    "duration_min": 20,
    "transcript_chars": 10446,
    "segments": 2,
    "model": "deepseek-v4-flash",
    "generated_at": "…"
  }
}
```

`appuis` et `source_spans` sont **obligatoires** : ce sont les garde-fous anti-invention déjà
éprouvés (`transcript-course.service.ts` écarte toute leçon dont les `sources` ne pointent
aucune notion réelle) et le lien vers l'horodatage du replay.

### 3.2 Niveau 2-A — `CoursEcrit`

Reprend **tel quel** le schéma leçon déjà validé dans `course-from-replay.js` (11 blocs, contrôle
anti-copie, quiz obligatoirement expliqué) :

```jsonc
{
  "schema_version": 1, "kind": "ecrit",
  "lecons": [{
    "notion_id": "n1", "titre": "…",
    "amorce": { "situation": "…", "question": "…" },
    "intuition": "3-5 phrases sans jargon",
    "definition": "…",
    "schema": { "gabarit": "triangle|chaine|comparaison|couches", "…": "…" },
    "exemple": { "titre": "…", "deroule": "4-6 phrases" },
    "contre_exemple": { "titre": "…", "pourquoi_faux": "…" },
    "erreur_frequente": "…",
    "experience_pensee": "…",
    "mise_en_situation": "…",
    "je_retiens": { "phrases": ["3 phrases"], "mots_cles": ["5 mots"] },
    "quiz": [{ "question": "…", "options": ["A","B","C","D"], "correctAnswer": 0, "explication": "…" }]
  }]
}
```

**Décision** : ce schéma **ne change pas**. Il est déjà en production et validé
(11 champs obligatoires, quiz ≥ 3 questions chacune expliquée). Le moteur PDF, dont la sortie
(`ExtractedCourse` : titre/content/key_points) est un sous-ensemble pauvre, devient un **rendu
dégradé** de celui-ci — pas l'inverse.

### 3.3 Niveau 2-B — `CoursJoue`

Reprend le format scènes de `05-deep-course.mjs` (modèle canonique Précepteur) :

```jsonc
{
  "schema_version": 1, "kind": "joue",
  "scenes": [
    { "type": "lecon", "narration": "…" },
    { "type": "amorce_croquis", "narration": "…" },
    { "type": "croquis_placeholder", "sketch": { "…": "…" } },
    { "type": "atelier", "question": "…", "hint": "…", "expected_answers": ["…"],
      "expected_errors": ["…"], "reveal_narration": "…", "reveal_sketch_placeholder": true },
    { "type": "image_analogie", "analogie": "…", "image_prompt": "…", "narration": "…" },
    { "type": "transition", "narration": "…" }
  ]
}
```

---

## 4. Contrats des adaptateurs

### 4.1 Source (entrée)

```ts
interface SourceAdapter {
  kind: 'replay' | 'tiktok' | 'document' | 'texte';
  list(tenantId: string, filter?): Promise<SourceRef[]>;   // pour l'écran unique
  load(id: string): Promise<NormalizedSource>;
}
interface NormalizedSource {
  id: string; title: string;
  transcript: string;                 // texte brut, non nettoyé
  cues?: { t: number; text: string }[];
  durationSec?: number;
  tenantId: string;
}
```

Implémentations : `ReplaySource` (lit `published_videos`), `TiktokSource` (lit
`precepteur_sources`), `DocumentSource` (réutilise `analyzeDocument`), `TexteSource`.

### 4.2 Rendu (sortie)

```ts
interface RenderAdapter {
  key: 'pdf' | 'parcours' | 'masterclass' | 'precepteur' | 'smartboard';
  accepts: 'ecrit' | 'joue';
  render(pivot, ctx): Promise<{ ref?: string; url?: string }>;
}
```

| Rendu | Écrit dans | Repris de |
|---|---|---|
| `pdf` | rien (fichier client) | `apps/app/src/lib/exportCoursePdf.js` |
| `parcours` | `courses`/`modules`/`formation_weeks`/`formation_days`/`formation_day_contents` | `course-from-replay.js` lignes 195-215 |
| `masterclass` | `masterclasses`/`masterclass_modules`/`masterclass_lessons` | `masterclass-factory.service.ts` |
| `precepteur` | `precepteur_courses` | `05-deep-course.mjs` |
| `smartboard` | deck existant | `generate-slide-content` |

**⛔ Contrainte dure** : le schéma élève (`courses`/`weeks`/`days`) **ne bouge pas**. Le rendu
`parcours` doit produire exactement la même chose qu'aujourd'hui — c'est le critère de recette du lot 3.

---

## 5. Données

### 5.1 Nouvelle table (additive)

```sql
-- Le FOND réutilisable : extrait une fois, rendu N fois.
create table if not exists course_pivots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  source_type text not null,            -- replay | tiktok | document | texte
  source_id   text not null,
  kind        text not null,            -- comprehension | ecrit | joue
  parent_id   uuid references course_pivots(id) on delete cascade,  -- 2-A/2-B → niveau 1
  payload     jsonb not null,
  model       text,
  created_at  timestamptz not null default now(),
  unique (tenant_id, source_type, source_id, kind, parent_id)
);
create index on course_pivots (tenant_id, source_type, source_id);
```

RLS : lecture membre du tenant, écriture `service_role` uniquement (le worker).

### 5.2 File de travaux unifiée

`course_generation_jobs` existe déjà et convient. **Migration additive** :

```sql
alter table course_generation_jobs
  add column if not exists source_type text not null default 'replay',
  add column if not exists source_id   text,
  add column if not exists targets     text[] not null default '{parcours}',  -- rendus demandés
  add column if not exists pivot_id    uuid references course_pivots(id);
-- video_id devient nullable (les sources TikTok n'en ont pas)
alter table course_generation_jobs alter column video_id drop not null;
```

Aucune colonne supprimée, aucun défaut cassé → les jobs en vol continuent.

### 5.3 Concurrence

`apps/worker/src/index.live.ts` ligne 167-173 : boucle `limit(1)` toutes les 30 s.
→ `COURSE_WORKER_CONCURRENCY` (défaut **2**, jamais illimité) + verrou par ligne
(`update … set status='extracting' where id = … and status='pending'` pour éviter le double-prise).

---

## 6. Interface : « Atelier de cours »

Un seul écran, `/liri/atelier`, réservé owner/admin/enseignant :

- **Colonne gauche — sources** : onglets Replays (55) · TikTok (645) · Documents · Texte.
  Filtres par statut (jamais traité / pivot prêt / rendu publié). Case à cocher → **sélection multiple**.
- **Barre d'action** : « Comprendre » (niveau 1 seul, rapide/bon marché) puis « Produire → [PDF]
  [Parcours] [Masterclass] [Précepteur] ». Si un pivot existe déjà, **on ne régénère pas** — on rend.
- **Colonne droite — file** : jobs en cours avec progression réelle (les statuts existent déjà :
  `extracting`/`planning`/`writing`/`publishing`), erreurs, reprise.

Remplace : les 2 boutons du lecteur Vidéothèque (`VideothequePage.jsx`) et les lancements manuels
de `tools/precepteur-tiktok/04-batch.mjs`.

---

## 7. Lots de livraison

Chaque lot est vérifiable seul et **ne casse rien** : l'ancien chemin reste en place jusqu'au lot 6.

| Lot | Contenu | Critère de recette |
|---|---|---|
| **1 — Socle** | table `course_pivots` + migration additive de la file + types partagés | migrations appliquées en prod, aucun job existant cassé |
| **2 — Noyau** | extraction `Comprehension` depuis n'importe quelle source (4 adaptateurs) | un replay ET une vidéo TikTok produisent un pivot niveau 1 valide |
| **3 — Rendu parcours** | `CoursEcrit` → tables élève, **repris de** `course-from-replay.js` | sortie **identique** à l'actuelle sur le même replay (diff des tables) |
| **4 — Autres rendus** | PDF, masterclass, précepteur depuis le pivot | le PDF produit est identique à celui d'aujourd'hui |
| **5 — Débit** | concurrence + verrou + reprise ; passage des 622 TikTok | ≥ 50 sources traitées sans intervention, coût mesuré |
| **6 — Interface + retrait** | écran Atelier ; suppression des doublons | les 2 boutons du lecteur remplacés ; scripts racine archivés |

---

## 8. Risques et garde-fous

| Risque | Parade |
|---|---|
| Casser le parcours élève | Le lot 3 exige une sortie **identique** avant de continuer. Le schéma élève ne bouge pas. |
| Facture IA en lot (622 vidéos) | Le niveau 1 seul est bon marché ; les rendus ne rappellent **pas** le modèle. Batch plafonné + coût mesuré au lot 5 avant d'ouvrir en grand. |
| Invention de contenu | `appuis` + `source_spans` obligatoires ; garde-fou existant conservé (leçon orpheline écartée). |
| Modèle à raisonnement muet | `deepseek-v4-pro` peut répondre 200 avec un `content` vide → retry + élargissement du budget + repli `v4-flash`, déjà implémenté, remonté dans le noyau. Cf. `docs`/mémoire. |
| Sessions concurrentes sur le repo | Commits scopés (`git commit -- <chemins>`), jamais `git add -A`. |
| Régression multi-tenant | Aucun nom d'école en dur dans les rendus (`schoolName` vient du tenant). |

---

## 9. Ce qui disparaît à la fin (et seulement à la fin)

- `transcript-course.service.ts` → devient le **rendu PDF** du pivot.
- `course-from-replay.js` → son schéma leçon **devient** le pivot 2-A ; le job devient un rendu.
- `.replay-to-document.mjs`, `.course-engine.mjs`, `.produce-course.mjs`, `.course-publish2.mjs`
  → archivés, leurs compétences absorbées.
- `03-generate.mjs` / `05-deep-course.mjs` → deviennent le rendu `precepteur` du pivot 2-B.
- Les 2 boutons concurrents du lecteur Vidéothèque → un seul point d'entrée.

**Rien n'est jeté avant que son remplaçant soit prouvé équivalent.**

---

## 10. Décisions du fondateur (2026-07-26)

1. ✅ **Le cours JOUÉ (2-B) se génère INDÉPENDAMMENT du niveau 1**, pas dérivé de l'écrit.
   → Conséquence : deux générateurs distincts branchés sur la même `Comprehension`.
   La voix orale du Précepteur n'est pas une reformulation d'un texte écrit.
2. ✅ **Les 9 `precepteur_courses` existants restent tels quels.** Aucune rétro-migration.
   Le pivot ne concerne que les nouvelles productions. `course_pivots.source_id` permettra
   de les rattacher plus tard si besoin.
3. ⏳ **Budget du lot 5 : à établir par MESURE, pas par estimation** — cf. §11.

---

## 11. 🔴 PRÉALABLE BLOQUANT — la facturation IA est aveugle depuis la migration DeepSeek

**Constat (2026-07-26).** `supabase/functions/_shared/aiBilling.ts` ligne 144 :

```ts
const value = data ? parseFloat((data as any).credits_per_unit) : 0;
```

Un modèle absent de `ai_pricing` coûte **0 crédit**. Or la table ne contient que
`deepseek-chat` (mort) et `deepseek-coder` — **aucune entrée `deepseek-v4-pro` /
`deepseek-v4-flash`**. Depuis le commit `1c5c5fb7`, toute la consommation DeepSeek est donc
**comptée à zéro** : le compteur ne bouge plus et le préflight de solde laisse tout passer.

C'est exactement le garde-fou nécessaire pour lancer 622 vidéos. **À corriger avant le lot 5.**

Correctif (additif) :

```sql
insert into ai_pricing (provider, model, unit_type, credits_per_unit, unit_label, is_active) values
  ('deepseek','deepseek-v4-flash','tokens_in',  0.001, '1 token entrée', true),
  ('deepseek','deepseek-v4-flash','tokens_out', 0.004, '1 token sortie', true),
  ('deepseek','deepseek-v4-pro',  'tokens_in',  0.002, '1 token entrée', true),
  ('deepseek','deepseek-v4-pro',  'tokens_out', 0.008, '1 token sortie', true);
-- `deepseek-coder` n'a pas de ligne tokens_out → sa sortie est déjà facturée 0. À compléter.
```

*(Valeurs alignées sur l'ancienne grille `deepseek-chat` pour `flash`, ×2 pour `pro` — modèle à
raisonnement qui produit plus de jetons. **À valider par le fondateur : c'est un choix de
tarification, pas une constante technique.**)*

### Volume mesuré du corpus TikTok

| Mesure | Valeur |
|---|---|
| Transcriptions déjà en base (échantillon) | 20 |
| Taille moyenne | **3 748 caractères** (min 157 · max 14 914) |
| `duration_sec` renseignée | **0 / 645** → durée inexploitable comme proxy |
| Vidéos restantes à traiter | **622** |

Estimation par vidéo (transcription ≈ 940 tokens, + prompts système, plan, leçons, scènes) :
**≈ 5 k tokens entrée + 12 k tokens sortie**. Sur 622 vidéos : **≈ 3,1 M in + 7,5 M out**,
soit **≈ 33 000 crédits** à la grille ci-dessus.

Repère de conversion (packs `ai_topup_packages`) : 1 000 crédits = 15 € · 130 000 crédits = 1 000 €.
⚠️ Ce sont les **prix de revente** aux tenants, **pas** le coût d'achat DeepSeek — qui n'est pas
connu de façon certaine ici et ne doit pas être inventé.

### Méthode retenue pour fixer le budget

Plutôt qu'un plafond arbitraire : **lot pilote de 20 vidéos**, mesure du coût réel
(tokens consommés × facture DeepSeek constatée), puis extrapolation à 622. Le lot 5 n'ouvre
en grand qu'après cette mesure.

Garde-fous techniques à implémenter avec le batch (indépendants du budget) :

- arrêt automatique si le solde de crédits passe sous un seuil ;
- plafond `--max` de vidéos par exécution (existe déjà dans `04-batch.mjs`) ;
- journal du coût cumulé par exécution, visible dans l'Atelier ;
- reprise idempotente : une vidéo déjà `generated` n'est jamais retraitée.
