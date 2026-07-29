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
6. Compilation API + portail, 142 tests unitaires API et 33 tests Précepteur : tous passent.

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

## Registre canonique des autres sources

Le tunnel couvre désormais `replay`, `tiktok`, `live`, `texte`, `document`, `pdf`,
`audio`, `video` et `url`. Les médias bruts passent toujours par le pipeline Studio
de transcription ; leur texte, les sous-titres, PDF, Word et textes collés convergent
ensuite dans `master_factory_sources`.

Garanties vérifiées sur la base distante :

- isolation par `tenant_id`, RLS fail-closed et accès API service-role ;
- empreinte SHA-256 et index unique par école/type/contenu : second import identique
  réutilisé au lieu de créer un doublon ;
- 1 000 000 caractères maximum par source ;
- extraction PDF/DOCX locale dans le navigateur ;
- extraction URL serveur limitée à 5 Mo, redirections contrôlées, protocoles
  HTTP(S) seulement, réseaux locaux/privés/loopback bloqués après résolution DNS ;
- le worker `course-from-replay` lit maintenant ce registre pour tous ces types.

Preuve texte : HTTP `201`, réimport idempotent, inventaire et lecture `200`, lecture
depuis un autre tenant `404`. Preuve URL : page publique de 88 208 caractères
extraite en `201`, tentative `127.0.0.1` refusée en `400`. Fichiers machine :
`registered-source-e2e-proof.json`, `url-source-e2e-proof.json`. Captures :
`36-registered-text-source-real.png`, `37-registered-text-source-mobile.png` et
`38-url-extraction-real.png`.

## Revue métier du rendu Masterclass

Le rendu éditable conserve désormais les 21 intentions pédagogiques de chaque
chapitre. Elles ne sont plus écrasées dans une seule carte : chaque segment rempli
devient une scène SmartBoard ordonnée avec son type, son contenu, ses notes orales,
son interaction, sa durée et sa provenance.

Sur le replay réel :

- 6 chapitres et 126 emplacements pédagogiques ;
- 125 scènes SmartBoard exploitables ;
- 1 emplacement volontairement laissé vide : `Chapitre 1 · Lien conceptuel`, car
  aucun prérequis antérieur n'existe dans le pivot source ;
- 6 analogies pédagogiques dérivées, explicitement marquées
  `master-factory-derived` afin de ne jamais les confondre avec une citation ;
- 125 sections de script oral, alignées sur les scènes ;
- 18 tests, 6 ateliers et 150 minutes de cours.

La preuve navigateur couvre les huit étapes, les sélecteurs de chapitre, une scène
d'analogie, le script enrichi et l'export final. Aucun compte de test n'est conservé.
Captures : `artifacts/master-factory-course-review-20260729/`.

## Direction de pédagogie visuelle

Le storyboard possède désormais un étage distinct de direction visuelle. Il ne
demande pas au modèle de « faire une belle image » : il lui impose d'abord un
diagnostic cognitif, une reformulation, une situation observable et une analogie
avec mécanisme commun, correspondances explicites et limite de validité.

Chaque chapitre reçoit exactement quatre ancrages forts (`situation`, `concept`,
`analogy`, `synthesis`). Les autres scènes restent textuelles : aucune inflation en
125 images décoratives. Chaque brief contient le langage visuel, la composition,
les pictogrammes porteurs de sens, le texte écran, l'alt text, le prompt image et
un contrat de contrôle `must_show` / `reject_if`. Une action annoncée mais invisible,
un schéma illisible ou un raccourci culturel stéréotypé doit donc être refusé même
si l'image paraît séduisante.

Preuve réelle sur le même replay ISNA :

- 6 chapitres, 24 ancrages et exactement 24 scènes enrichies ;
- 2 correspondances vérifiables et une limite pour chacune des 6 analogies ;
- 24/24 contrats visuels complets ;
- génération structurée par `mistral-large-latest` ;
- rendu Studio de l'analogie sous forme de graphe déterministe : domaine familier
  → mécanisme commun → domaine cible, avec limite visible ;
- contrôle navigateur sans erreur JavaScript.

Captures de référence : `19-studio-analogie-complet.png` et
`20-analogie-graphe-detail.png`. Le fichier de preuve machine est
`visual-pedagogy-proof-v2.json`.

La migration `20260729113000_master_factory_visual_pedagogy_pivot.sql` a été appliquée
de manière ciblée sur la base distante. Le moteur exige désormais la persistance :
une erreur de sauvegarde rend un `503`, jamais un faux succès temporaire.

### Durcissement après E2E réel

- cache lié au SHA-256 du cours et à la version du prompt, puis ré-audité à la lecture ;
- verrou en mémoire contre les doubles clics simultanés ;
- checkpoints par lots de chapitres : une panne fournisseur reprend les chapitres
  valides au lieu de tout repayer ;
- facturation enregistrée après chaque appel fournisseur réussi ;
- noms de segments autorisés transmis explicitement au modèle ;
- surcharge visuelle bornée déterministiquement à 3 pictogrammes, 5 nœuds et
  3 textes écran ;
- image générée persistée en `pending_review`, avec actions Approuver / Refuser ;
- aucune image `pending_review` ou `rejected` n'est transmise au Précepteur ni
  affichée à l'élève ; l'alt text pédagogique est conservé ;
- prompt de réparation confiné contre les instructions injectées dans la source.

Le dernier passage fournisseur complet est actuellement empêché par l'état externe
des comptes IA : crédit Anthropic insuffisant, quota quotidien Groq atteint, délais
Mistral/DeepSeek et quota OpenAI dépassé. Le fichier
`visual-pedagogy-persistence-proof.json` conserve le diagnostic exact. Il faut
réalimenter au moins un fournisseur puis relancer
`node scripts/master-factory-visual-e2e.mjs` ; grâce aux checkpoints, le travail
validé est repris au lieu d'être perdu.

## Source LIVE unifiée

L'Atelier expose désormais l'onglet `Lives`. L'adaptateur lit en priorité
`live_neuro_recall_state.transcript_text`, puis les captions originales, normalise
les repères `[m:ss]` / `[h:mm:ss]`, agrège les micro-captions en fenêtres pédagogiques
et calcule la durée depuis l'enregistrement ou les dates de séance. Les
téléconsultations sont explicitement exclues.

Le worker de parcours accepte aussi `source_type=live` : un LIVE transcrit peut donc
suivre `compréhension → cours écrit → parcours/formation`, et plus seulement produire
un scénario pour un futur direct. Le bug `live_recordings.session_id` a été corrigé
en `live_session_id`.

Preuve isolée : `node scripts/master-factory-live-source-e2e.mjs` crée un LIVE de
classe temporaire, l'inscrit avec une transcription horodatée, vérifie les routes
réelles `/source/live` et `/sources/live`, capture l'Atelier, puis supprime session et
utilisateur. Résultat : HTTP 200, `ready=true`, 216 caractères, durée 1 800 secondes,
zéro donnée temporaire restante. Preuve machine : `live-source-e2e-proof.json` ;
capture : `35-live-source-atelier-real.png`.

## Sorties Précepteur et manuel

Le type `joue` n'est plus une déclaration vide. L'adaptateur officiel transforme le
projet Masterclass issu du pivot écrit en concepts et scènes Précepteur (`lecon`,
`amorce_croquis`, `atelier`, `image_analogie`, `transition`), puis persiste le résultat
comme pivot enfant `joue`. Un second rendu renvoie le même pivot en cache et ne
consomme aucun jeton. Une image en attente de revue ne transmet jamais son URL.

Le manuel Markdown est également un rendu déterministe du pivot écrit. Il réutilise
les objectifs, leçons riches, « Je retiens » et glossaire du rendu PDF sans nouvelle
intelligence.

Preuve isolée : premier Précepteur `201/cached=false`, second
`201/cached=true`, même `pivotId`, 1 concept et 6 scènes ; manuel `201`, 935
caractères ; statut `joue=true` et rendu gratuit `precepteur`. Preuve machine :
`precepteur-e2e-proof.json` ; capture : `39-precepteur-output-real.png`.

## Limites externes restantes

Le code, la persistance, les adaptateurs et les rendus déterministes sont verts. La
génération IA complète de nouveaux pivots de compréhension et de pédagogie visuelle
reste dépendante des crédits/quota fournisseurs détaillés plus haut. Les fichiers
audio/vidéo bruts doivent finir leur transcription asynchrone avant de devenir
`ready` ; l'Atelier refuse honnêtement de les présenter comme matière exploitable
avant cette étape.

## Génération d’image Codex en priorité

Pour le travail orchestré dans Codex, le générateur d’images intégré est utilisé en
premier. Un set 16:9 complet de transfert pédagogique a été généré : situation,
concept, analogie et synthèse. Les quatre assets sont copiés dans
`apps/app/public/master-factory/generated/`, versionnés par nom et laissés en
`pending_review`.

Le manifeste `manifest-v1.json` consigne pour chaque image son rôle, son contrat
pédagogique, son alt text, ses dimensions, son prompt et son empreinte SHA-256. La
preuve individuelle initiale reste dans `codex-imagegen-proof.json`. L'écran de revue
du set est `44-codex-visual-set-review.html` et sa capture de référence
`44-codex-visual-set-review.png` ; les sources visuelles sont numérotées 40 à 43.

Le contrôle de non-publication est couvert par deux chaînes indépendantes :

- l'adaptateur Précepteur ne copie l'URL que lorsque `image_status=approved` ;
- le lecteur immersif exige simultanément `image_status=approved` et une URL.

Validation du cycle : 142 tests API, 33 tests Précepteur et build Vite de production
réussis. Une image en attente reste donc examinable dans le Studio sans pouvoir être
rendue côté élève.

Cette priorité s’applique à l’orchestration Codex. Le portail déployé ne peut pas
appeler l’outil intégré au poste de développement : son automatisation serveur exige
un fournisseur API configuré. Le workflow reste identique dans les deux cas :
génération → `pending_review` → approbation humaine → exposition élève.

## Replay réel Prorascience vers Liri Live

Le tunnel officiel a été exécuté avec une source réellement présente dans la
vidéothèque du tenant `isna` : `La physique quantique décodée par l'Égypte antique`
(`b11a419e-8508-4058-a42c-eda9cb3a5f2d`, transcription de 23 537 caractères).
Il passe par les routes HTTP protégées, avec un vrai compte enseignant rattaché au
tenant, et non par des objets injectés dans le navigateur.

Chaîne vérifiée : vidéothèque → pivot compréhension → cours écrit → Master Script →
mindmap officielle → timeline SmartBoard → scénario LIVE → session Liri. Le résultat
persisté comprend 12 chapitres, 12 moments de script, 12 branches de mindmap,
12 scènes SmartBoard, 12 scènes de scénario, 12 lignes `live_scenes` et 12 sections
de prompteur. Les cinq pivots persistants sont `comprehension`, `ecrit`,
`master_script`, `smartboard_timeline` et `live_scenario`.

Session de preuve : `368fddd0-46cb-409e-9811-ff3f12c30a18`. Elle reste au statut
`scheduled` pour permettre l'inspection sans déclencher un vrai direct. Les liens
locaux sont `/studio/live-preparation/368fddd0-46cb-409e-9811-ff3f12c30a18` et
`/studio/live-arena/368fddd0-46cb-409e-9811-ff3f12c30a18`.

Les essais ont mis au jour puis corrigé quatre défauts de raccordement : date de
planification absente malgré la contrainte DB, identité hôte non recopiée dans
`teacher_id` pour les politiques RLS, autosave initial qui pouvait écraser la
mindmap enrichie, et canevas `cover` qui rognait le contenu SmartBoard dans l'arène
16:9. La mindmap reste à 12 branches après plusieurs ouvertures du Studio et la
première scène est maintenant visible dans l'arène avec le compteur `01/12`.

Preuves reproductibles :

- `node scripts/master-factory-replay-to-live-e2e.mjs` vérifie les API, les pivots et
  les lignes persistées ;
- `node scripts/master-factory-live-ui-proof.mjs` vérifie les écrans authentifiés et
  l'absence d'erreur navigateur ;
- `artifacts/master-factory-course-review-20260729/replay-to-live-real-e2e-proof.json`
  contient les 13 assertions de données ;
- `artifacts/master-factory-course-review-20260729/live-ui-proof.json` contient la
  preuve UI ;
- les captures 45, 47, 48, 49 et 50 montrent respectivement la sortie du Factory,
  les scènes, la mindmap, le prompteur et l'arène.
