# Master Factory — preuve workflow replay ISNA

Date: 2026-07-28

## Source testée

- Tenant: `isna` / Prorascience
- Source officielle vidéothèque: `replay/8719c02e-34bb-4008-8e94-3a179630bd7a`
- Titre: `L'arbre du Manikongo — 31 mai 2026`

## Chaîne validée

1. `POST /master-factory/understand`
   - Pivot `comprehension` créé.
   - 6 notions extraites.

2. `POST /master-factory/produce/master-script`
   - Pivot `master_script` créé.
   - 6 moments de conducteur.

3. `POST /master-factory/produce/smartboard`
   - Pivot `smartboard_timeline` créé.
   - 6 scènes de tableau vivant.

4. `POST /master-factory/produce/live-scenario`
   - Pivot `live_scenario` créé.
   - 6 scènes live.

5. `POST /master-factory/produce/course`
   - Job worker traité.
   - Pivot `ecrit` créé.
   - Cours brouillon créé au poste production.

6. `POST /master-factory/render/pdf`
   - Rendu PDF logique réussi depuis le pivot `ecrit`.

## Résultat base

- Job: `e8b8edfe-6a97-482c-af6c-2de8cb828975`
- Statut final: `done`
- Course ID: `442cc9c5-9c8b-41ef-9ba4-96ab86192ea1`
- Structure cours: 1 module, 2 semaines, 8 jours, 15 contenus.
- Types contenus: `powerpoint`, `quiz`.

## Distinction validée

Une même source replay est comprise une fois, puis donne plusieurs sorties:

- `live` via `master_script`, `smartboard_timeline`, `live_scenario`
- `programme de formation` via le worker `course-from-replay`
- `pdf`, `parcours`, `masterclass`, `manuel`, `quiz`, `forum`, `faq` depuis les pivots

## Point à améliorer

Pendant l’essai, un ID de `zoom_recordings` a échoué sur `/master-factory/understand`
avec `Replay introuvable pour cette école`, alors que la source existe en vidéothèque brute.
Le workflow officiel actuel part de `published_videos`. Il faut donc soit:

- exposer seulement les IDs `published_videos` dans le parcours Master Factory,
- soit ajouter un adaptateur explicite pour `zoom_recordings` avant promotion en `published_videos`.

