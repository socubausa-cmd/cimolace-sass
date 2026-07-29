# Master Factory — audit canonique et preuve E2E (29 juillet 2026)

## Décision d'architecture

Une source ne doit être comprise qu'une fois. Le chemin officiel est désormais :

`source → pivot comprehension → pivot ecrit → rendus PDF / Masterclass / parcours / Live`

Masterclass Factory ne reconvertit plus le cours en Markdown et ne relance plus une
seconde analyse IA. Le projet éditable est adapté directement depuis `CoursEcritPivot`.

## Preuve réelle ISNA

- Source replay : `8719c02e-34bb-4008-8e94-3a179630bd7a`
- Pivot compréhension : `7ad3c8db-0700-4587-a4e5-1f5d96accf2d`
- Pivot écrit : `b7b09960-b622-4f1c-9269-c9c8d4315864`
- Job de génération : `e8b8edfe-6a97-482c-af6c-2de8cb828975`
- Cours réel : `a746b640-8a67-4659-b457-080de7508492`
- Structure : 6 chapitres Masterclass × 21 segments ; parcours Studio de 1 module,
  2 semaines, 8 jours et 15 contenus.
- Traçabilité source : 15 passages horodatés rattachés aux notions.

Le job historique a été rattaché à son pivot et porte dans `metrics.master_factory`
les identifiants source, compréhension et écrit, plus une empreinte SHA-256.

## Tests exécutés

1. API réelle : `status` renvoie le cours et le pivot ; le rendu Masterclass renvoie
   6 × 21 segments avec `provider=master-factory-pivot` et
   `imported_without_regeneration=true`.
2. Navigateur local réel : Atelier → aperçu extrait → Masterclass Factory → Studio →
   aperçu élève → storyboard image par image, sans erreur console.
3. Publication isolée : un cours E2E publié est visible par un vrai rôle `student`,
   puis invisible en brouillon ; toutes les lignes de test sont nettoyées.
4. Live isolé : publication de 1 blueprint, 6 scènes et 6 sections de Master Script,
   avec provenance replay ; la session est ensuite nettoyée.
5. Fin de live : une entrée réellement `waiting` devient terminale (`left`) et la
   session porte `status=ended` + `ended_at`; aucune attente active ne survit.
6. Compilation API + portail et 132 tests unitaires : tous passent.

Captures locales : `artifacts/master-factory-e2e-20260729/`.

## Ruptures corrigées

- double génération IA Atelier → Masterclass ;
- conversion Markdown tronquée et stockage localStorage concurrent ;
- jobs terminés sans `pivot_id` ;
- publication partielle du parcours sans contrôle des erreurs enfants ;
- Studio ouvrant le bon cours mais affichant `0 module` à cause d'une lecture RLS
  directe sur quatre tables ;
- salle d'attente restant active après la fin de séance ;
- scripts de live orphelins lors d'une suppression de session (migration additive).

## Limites encore honnêtes

Le tunnel certifié ici concerne les sources `replay` et `tiktok` transcrites. Les
adaptateurs `pdf`, `audio`, `video`, `live` et `url` sont déclarés dans les types mais
ne disposent pas encore tous d'un stockage d'ingestion canonique. L'API de génération
de parcours les refuse donc explicitement au lieu de créer un job condamné à échouer.
Ils constituent le lot d'ingestion suivant ; ils ne doivent pas être présentés comme
« verts » avant une preuve équivalente.
