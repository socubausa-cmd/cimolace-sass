# Le Précepteur — Juge de conformité de cours (brique C)

**But :** garantir que **tous** les cours du Précepteur atteignent le **même niveau** — mêmes
dispositifs pédagogiques, même structure. C'est la brique d'**uniformité**.

Fichier : `conformCourse.js` (PURE ESM, testable sous `node` nu). Tests : `conformCourse.test.mjs`
(`node --test`, 31 cas). Complète les briques **A** (`injectionRules.js` — l'atelier d'analyse
déterministe) et **A2** (`enrichCourseWithDevices.js` — l'émission des dispositifs texte) et
`enrichCroquis.js` (croquis vectoriel via edge).

## Deux fonctions

- **`auditCourse(course, opts?)`** → rapport **PUR**, jamais throw, **déterministe**.
  Pour chaque concept, compare la **recette idéale** (`classifySegment` / `planInjections`)
  aux **scènes réelles** et signale chaque écart (`finding`).
- **`conformCourse(course, opts?)`** (async) / **`conformCourseSync(course, opts?)`** (sync, sans edge)
  → **répare** ce qui est déterministe, **flagge** ce qui exige un LLM. Non destructif, idempotent, fail-safe.

## Règle d'or

> **Le déterministe RÉPARE, le LLM FLAGGE (jamais fabriqué).**

- Aucun check n'exige un type de scène **hors `RENDERABLE_TYPES`** (sinon on garantirait de l'invisible).
- **Invariant sacré :** une scène `croquis` n'existe **jamais** sans `sketch.elements` valides
  (`SketchRenderer` lit `el.from[0]`/`el.center[0]` sans garde → crash). `coerceCroquis` filtre / retire.

## Contrat pédagogique (par concept), vérifiable

Ordre canonique = ordre de `planInjections` (`CANONICAL_ORDER`) :

```
lecon → surlignage → encadre → amorce_croquis → croquis → atelier → image_analogie → resume_encadre → transition
```

Un concept peut enchaîner **plusieurs leçons** : chaque leçon + ses dispositifs = un **« beat »**.
L'ordre et le réordonnancement sont **beat-aware** — on ne trie **qu'à l'intérieur** d'un beat,
jamais entre leçons (sinon on détacherait un surlignage/encadré de **sa** leçon).

## Catalogue des checks

| code | sévérité | portée | réparation |
|---|---|---|---|
| `COURSE_VIDE` | error | course | none (régénérer) |
| `CONCEPT_SANS_SCENE` | error | concept | none |
| `CONCEPT_NO_LECON` | error | concept | none (contenu = LLM) |
| `LECON_TEXTE_VIDE` | error | concept | none |
| `DEFINITION_SANS_ENCADRE` | warn | concept | **deterministic** (enrichDevices) |
| `DEFINITION_SANS_SURLIGNAGE` | info | concept | **deterministic** |
| `FORMULE_SANS_ENCADRE` | warn | concept | **deterministic** |
| `RESUME_MANQUANT` | warn | concept | **deterministic** |
| `CROQUIS_MANQUANT` | warn | concept | **llm** (edge `liri-preceptor-course`) |
| `CROQUIS_INVALIDE` | error | scene | **deterministic** (filtre / retire — anti-crash) |
| `AMORCE_ORPHELINE` | info | concept | llm |
| `ATELIER_MANQUANT` | warn | concept | llm |
| `ATELIER_INCOMPLET` | warn | scene | **deterministic** (ack_variants=DEFAULT_ACK, expected_*=[]) |
| `IMAGE_MANQUANTE` | info | concept | llm |
| `IMAGE_VIDE` | warn | scene | llm |
| `ORDRE_INVALIDE` | warn | concept | **deterministic** (réordonnancement beat-aware) |
| `SCENE_TYPE_NON_RENDU` | warn | scene | none (corriger en amont) |
| `NARRATION_ABSENTE_FALLTHROUGH` | warn | scene | deterministic |

## Sortie de `auditCourse`

```js
{
  ok,            // true ssi counts.error === 0 (warn/info n'invalident pas)
  score,         // 0..100 (pénalité pondérée error=20 / warn=6 / info=2)
  counts: { error, warn, info },
  conceptsTotal, conceptsConform,
  findings: [ { id, code, severity, scope, conceptIndex, conceptTitle, sceneIndex, sceneType,
                message, repair, repairAction, expected, actual } ],
  repairable: { deterministic:[ids], llm:[ids], none:[ids] },
  meta: { version:'C-1', checkedAt } // checkedAt = opts.now ?? null (pur par défaut)
}
```

`finding.id` = `` `${code}:${conceptIndex}:${sceneIndex}` `` — **stable** (permet dédup / idempotence).

## Stratégie de `conformCourse`

1. **audit0** = `auditCourse(course)`.
2. **Réparation déterministe** (clone profond, jamais de mutation de l'entrée) :
   `enrichCourseWithDevices` → **dédup** (idempotence) → **coerceCroquis** (anti-crash) →
   défauts atelier → **réordonnancement beat-aware**.
3. **Réparation LLM** (opt-in seulement, `enrichCroquis:true` + `project` + `invokeEdge`) :
   `buildCroquisSeeds(project)` + `enrichCourseWithCroquis` (fail-safe : un échec edge laisse
   le cours tel quel et conserve le flag). **Jamais** de sketch fabriqué localement.
4. **auditN** = `auditCourse(work)` ; `report = { scoreBefore, scoreAfter, before, after,
   repaired[], flagged[], remaining[], unchanged }`.

**Garanties (prouvées par test) :** l'entrée n'est jamais mutée ; `conformCourse(conformCourse(x))`
= `conformCourse(x)` (idempotence) ; un `enrich*` qui throw est catch (fail-safe).

## Branchement (pipeline)

`conformCourseSync(course).course` remplace `enrichCourseWithDevices(course)` **au rendu** :

- `pages/dev/PrecepteurDemoPage.jsx` (démo `/precepteur`, cours canonique).
- `pages/precepteur/PrecepteurCoursePage.jsx` (cours exportés / masterclass).

Le chemin **LLM** (`conformCourse` async, `enrichCroquis:true`) s'appelle **à la création** du cours
(après `masterclassProjectToPrecepteurCourse`, avec le `project` source non modifié pour aligner les
seeds), pas au runtime.

## Preuve — cours canonique

`auditCourse` : score **92** (1 warn `DEFINITION_SANS_ENCADRE` + 1 info `DEFINITION_SANS_SURLIGNAGE`).
`conformCourse` : **92 → 100**, réparés déterministiquement, **idempotent**, dispositifs restés
**dans le beat de leur leçon** (`lecon → surlignage → encadre → lecon → amorce_croquis → croquis → …`).
