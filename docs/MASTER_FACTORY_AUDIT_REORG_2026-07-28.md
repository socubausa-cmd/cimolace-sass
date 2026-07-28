# Master Factory — audit profond et réorganisation Liri

> Statut : mémoire d'architecture — 2026-07-28.
> Décision fondateur : le Master Factory existe déjà dans le moteur Masterclass / Atelier unifié. On ne crée pas un nouveau moteur ; on réorganise l'existant pour qu'il devienne le cerveau central de Liri.

## 1. Vision corrigée

Le Master Factory n'est pas seulement un générateur de cours. C'est le moteur universel de transformation des connaissances de Liri.

Il doit prendre n'importe quelle source :

- replay ;
- live ;
- vidéo ;
- audio ;
- PDF ;
- document ;
- TikTok ;
- texte ;
- URL ;
- conversation IA ;
- corpus de plusieurs sources.

Puis produire plusieurs sorties :

- cours écrit ;
- cours joué ;
- livre ;
- manuel ;
- précepteur ;
- masterclass ;
- Master Script ;
- SmartBoard ;
- scénario Liri Live ;
- vidéo de la semaine ;
- quiz ;
- FAQ ;
- forum ;
- replay enrichi.

La règle centrale :

```text
Une source ne doit jamais alimenter directement plusieurs moteurs.
Toute source passe d'abord par Master Factory.
```

## 2. Ce qui existe déjà

### 2.1 Noyau de compréhension

Fichier : `apps/api/src/masterclass-factory/comprehension.service.ts`

Le service existe et réalise déjà le travail fondamental :

```text
source normalisée
→ segmentation
→ extraction de notions
→ réduction
→ pivot comprehension
→ stockage dans course_pivots
```

Ce service est le cœur officiel.

### 2.2 Contrats de pivot

Fichier : `apps/api/src/masterclass-factory/pivot.types.ts`

Avant cette réorganisation, les contrats couvraient surtout :

- `comprehension` ;
- `ecrit` ;
- `joue`.

Le fichier a été élargi pour couvrir aussi :

- `master_script` ;
- `smartboard_timeline` ;
- `live_scenario` ;
- `replay_postprod`.

### 2.3 Adaptateurs de sources

Fichier : `apps/api/src/masterclass-factory/source-adapters.service.ts`

Déjà présent :

- `replay` ;
- `tiktok` ;
- `texte` ;
- `document` par URL texte/HTML.

Manquant :

- PDF réel ;
- Word ;
- PowerPoint ;
- fichier audio ;
- fichier vidéo ;
- YouTube ;
- live session comme source native ;
- corpus multi-source.

### 2.4 Cours écrit

Fichier : `apps/worker/src/jobs/course-from-replay.js`

Le moteur sait déjà produire un cours écrit riche depuis un replay. Il crée :

- `courses` ;
- `modules` ;
- `formation_weeks` ;
- `formation_days` ;
- `formation_day_contents`.

Problème : ce worker fait encore trop de choses. Il extrait, planifie, rédige et publie. À terme, il doit devenir un simple consommateur du Master Factory.

### 2.5 Cours joué / Précepteur

Références :

- `tools/precepteur-tiktok/*`
- `docs/PRECEPTEUR_INJECTION_RULES.md`
- `docs/PRECEPTEUR_STYLE_SHERPAS.md`

Le modèle de scènes existe déjà :

- leçon ;
- amorce croquis ;
- croquis ;
- atelier ;
- image/analogie ;
- transition.

Décision conservée : le cours joué se génère depuis la `Comprehension`, mais indépendamment du cours écrit. Il ne doit pas être une reformulation plate du texte écrit.

### 2.6 SmartBoard

Références :

- `docs/CAHIER_DE_CHARGE_TABLEAU_VIVANT.md`
- `docs/SMARTBOARD_LIVE_IMMERSIF.md`
- `apps/app/src/lib/smartboardIAMapper.js`
- `supabase/functions/liri-smartboard-architect-structured/index.ts`
- `supabase/functions/liri-script-ai-improve/index.ts`

Le SmartBoard existe, mais il est encore trop souvent généré depuis une réponse IA ou un texte libre.

Nouvelle règle :

```text
SmartBoard = rendu temporel du Master Script.
```

Il ne doit pas seulement afficher une slide. Il doit rendre un tableau vivant :

- apparition séquentielle ;
- écriture progressive ;
- surlignage ;
- schéma dessiné ;
- synchronisation avec la voix ;
- respect de la zone caméra en live.

### 2.7 Master Script

Références :

- `apps/app/src/lib/smartboardIAMapper.js`
- `apps/app/src/lib/seedLiveScriptFromConfig.js`
- `apps/app/src/hooks/useLiveScript.js`
- tables `live_script_sections`
- champ `master_agent`
- draft `smartboard_master_script_sections`

Le Master Script existe déjà, mais il est fragmenté.

Il peut exister dans :

- le draft du wizard ;
- la config du live ;
- `live_script_sections` ;
- le mapper SmartBoard ;
- le panneau de live.

Nouvelle règle :

```text
Master Script = pivot officiel entre compréhension, SmartBoard et Live.
```

### 2.8 Liri Live

Références :

- `docs/LIVE_HOST_MODELE_OFFICIEL.md`
- `apps/app/src/services/liveProduction/liveBlueprint.js`
- `apps/app/src/services/liveProduction/liveScenes.js`
- `apps/app/src/services/liveProduction/liveContents.js`
- `apps/app/src/features/live/host/*`
- `apps/app/src/pages/LiveHostPage.jsx`

Le live possède déjà :

- blueprint ;
- scènes ;
- contenus ;
- script ;
- salle d'attente ;
- participants ;
- smartboard ;
- replay ;
- workers de notifications ;
- post-production.

Mais le live n'est pas encore une sortie officielle du Master Factory.

Nouvelle règle :

```text
Liri Live = exécution vivante d'un LiveScenarioPivot.
```

## 3. Confusions actuelles

| Confusion | Risque | Correction |
|---|---|---|
| SmartBoard génère son propre contenu depuis un prompt | contenu divergent du cours | SmartBoard doit partir du Master Script |
| Master Script existe dans plusieurs formats | perte de cohérence entre live, deck et replay | créer `MasterScriptPivot` comme contrat unique |
| Live Studio prépare des scènes sans pivot | live beau mais pas toujours pédagogiquement structuré | créer `LiveScenarioPivot` |
| Worker replay produit directement un cours | duplication du noyau IA | worker doit appeler Master Factory |
| Précepteur TikTok fonctionne à côté | cours joué séparé du système principal | précepteur devient sortie `joue` |
| PDF et parcours sont séparés | double génération IA | PDF devient rendu du cours écrit |
| Replay post-prod non gouverné | pas de boucle de capitalisation | replay devient nouvelle source Master Factory |
| Liri et École mélangés | moteur moins vendable horizontalement | Liri reste horizontal, Prorascience n'est qu'un tenant vertical |

## 4. Architecture cible

```text
Source brute
  ↓
Extraction / Normalisation
  ↓
ComprehensionPivot
  ↓
MasterScriptPivot
  ├─ SmartboardTimelinePivot
  ├─ LiveScenarioPivot
  ├─ CoursJoue / Précepteur
  └─ CoursEcrit
       ├─ Parcours élève
       ├─ PDF
       ├─ Livre / Manuel
       ├─ Quiz
       ├─ Forum / FAQ
       └─ Vidéo de la semaine
```

## 5. Contrats ajoutés

### 5.1 `MasterScriptPivot`

Rôle : conducteur oral.

Il porte :

- intention générale ;
- moments pédagogiques ;
- script enseignant ;
- message central ;
- points clés ;
- transition ;
- interaction ;
- durée estimée.

### 5.2 `SmartboardTimelinePivot`

Rôle : tableau vivant.

Il porte :

- scènes visuelles ;
- blocs ;
- ordre d'apparition ;
- actions temporelles ;
- écriture ;
- surlignage ;
- dessin ;
- zoom ;
- pause ;
- synchronisation avec la voix.

### 5.3 `LiveScenarioPivot`

Rôle : transformer un script en séance Liri pilotable.

Il porte :

- titre du live ;
- notes de préparation ;
- message salle d'attente ;
- scènes hôte ;
- instructions ;
- action attendue de l'élève ;
- séquence de clôture ;
- sorties post-live à générer.

### 5.4 `ReplayPostprodPivot`

Rôle : capitaliser après le live.

Il porte :

- résumé ;
- chapitres ;
- points clés ;
- sorties recommandées ;
- lien avec la transcription/replay.

## 6. Pipeline cible pour préparer un live

```text
Sujet ou source
→ Master Factory comprend
→ Master Script
→ SmartBoard Timeline
→ Live Scenario
→ live_blueprints / live_scenes / live_script_sections
→ Liri Live hôte
```

Le Studio Live ne doit plus être seulement un formulaire. Il devient une régie de préparation orchestrée par Master Factory.

## 7. Pipeline cible après un live

```text
Live terminé
→ replay
→ transcription
→ ComprehensionPivot
→ ReplayPostprodPivot
→ sorties proposées
```

Sorties proposées :

- cours ;
- résumé ;
- fiche élève ;
- quiz ;
- forum ;
- vidéo de la semaine ;
- extrait réseaux sociaux ;
- enrichissement précepteur.

## 8. Plan d'implémentation

### Lot 1 — Stabiliser les contrats

Fait :

- élargir `pivot.types.ts` avec `master_script`, `smartboard_timeline`, `live_scenario`, `replay_postprod`.
- créer la façade `MasterFactoryService`.
- exposer les routes officielles `MasterFactoryController`.

À faire :

- ajouter tests TypeScript ;
- vérifier que les anciens services continuent à compiler.

Routes officielles disponibles :

| Méthode | Route | Rôle | Usage |
|---|---|---|---|
| `GET` | `/master-factory/sources/:type` | owner/admin/teacher | Lister les sources disponibles |
| `POST` | `/master-factory/understand` | owner/admin/teacher | Produire/récupérer le pivot `comprehension` |
| `GET` | `/master-factory/status/:type/:id` | owner/admin/teacher | Voir les pivots/rendus disponibles |
| `POST` | `/master-factory/produce/course` | owner/admin/teacher | Demander un cours écrit/parcours |
| `POST` | `/master-factory/produce/master-script` | owner/admin/teacher | Générer le pivot `master_script` depuis `comprehension` |
| `POST` | `/master-factory/produce/smartboard` | owner/admin/teacher | Générer le pivot `smartboard_timeline` depuis le Master Script |
| `POST` | `/master-factory/produce/live-scenario` | owner/admin/teacher | Générer le pivot `live_scenario` depuis Master Script + SmartBoard |
| `POST` | `/master-factory/produce/live-stack` | owner/admin/teacher | Générer la chaîne vivante complète |
| `POST` | `/master-factory/render/pdf` | owner/admin/teacher | Rendre le PDF depuis le pivot écrit |

Routes legacy conservées :

- `/masterclass-factory/atelier/*`
- `/masterclass-factory/from-replay`
- `/masterclass-factory/course-from-replay`
- `/masterclass-factory/chapters-from-replay`

### Lot 2 — Créer `MasterFactoryService`

Créer un service façade :

```ts
understandSource()
buildMasterScript()
buildSmartboardTimeline()
buildLiveScenario()
publishLiveScenario()
buildWrittenCourse()
buildPlayedCourse()
renderOutput()
processReplay()
```

Ce service doit envelopper les services existants, pas les supprimer.

État 2026-07-28 :

- `MasterFactoryService` existe.
- `buildMasterScript()` existe en version déterministe v0.
- `buildSmartboardTimeline()` existe en version déterministe v0.
- `buildLiveScenario()` existe en version déterministe v0.
- `buildLiveStack()` orchestre les trois pivots depuis une `comprehension` existante.
- Test : `apps/api/test/master-factory-pivots.test.js`.
- Preuve visuelle : `artifacts/master-factory-proof/01-pipeline-proof.png`.

### Lot 3 — Brancher SmartBoard sur Master Script

Modifier le flux SmartBoard :

```text
assistantText libre
```

devient :

```text
ComprehensionPivot + MasterScriptPivot
```

Le smartboard peut encore accepter un texte libre en fallback, mais ce n'est plus le chemin officiel.

### Lot 4 — Brancher Live Studio

Dans `/studio/live` :

```text
Créer scénario avec IA
→ génère MasterScriptPivot
→ génère SmartboardTimelinePivot
→ génère LiveScenarioPivot
→ pousse vers live_blueprints/live_scenes/live_script_sections
```

### Lot 5 — Brancher Liri Live

La régie live doit lire :

- `live_scenes` pour le centre ;
- `live_script_sections` pour le Master Script ;
- `live_blueprints` pour le contexte ;
- `live_session_participants` pour la salle d'attente/membres.

Elle ne doit pas contenir de logique pédagogique lourde.

### Lot 6 — Brancher Replay Postprod

Le replay devient automatiquement une nouvelle source :

```text
published_videos / live_recordings
→ transcription
→ Master Factory
→ ReplayPostprodPivot
```

### Lot 7 — Nettoyer les doublons

Seulement après preuve d'équivalence :

- archiver les scripts hors-ligne ;
- réduire les anciens endpoints en wrappers ;
- retirer les chemins IA directs qui contournent le pivot.

## 9. Règles non négociables

1. Le fond est produit une fois.
2. Les rendus ne doivent pas refaire la compréhension.
3. Le Master Script est la source orale officielle.
4. Le SmartBoard suit le script, pas l'inverse.
5. Le Live est une exécution du scénario, pas un écran isolé.
6. Le replay redevient une source.
7. Les enrichissements IA doivent être distingués des appuis de source.
8. Rien ne casse les anciennes routes avant remplacement prouvé.
9. Liri reste horizontal ; l'École est un contexte vertical.
10. Prorascience ne doit pas être codé en dur dans le moteur.

## 10. Critère de réussite

On considère le Master Factory réorganisé quand un utilisateur peut faire :

```text
Je donne une vidéo / un replay / un PDF
→ Liri comprend
→ Liri propose un plan pédagogique
→ Liri écrit le Master Script
→ Liri construit le SmartBoard vivant
→ Liri prépare un live
→ le live est animé
→ le replay enrichit automatiquement l'espace élève
→ le même fond devient cours, livre, quiz, forum, précepteur
```

Le résultat attendu n'est pas un outil de résumé. C'est un professeur augmenté, capable de transformer une connaissance brute en expérience d'apprentissage complète.
