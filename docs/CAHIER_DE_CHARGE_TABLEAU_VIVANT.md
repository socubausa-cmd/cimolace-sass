# Cahier de charge — Le Tableau Vivant (École numérique)

> Statut : v1 — 2026-06-23. Objectif terminal du moteur de cours LIRI/École.
> Reformulation documentée de la vision « générateur de cours vidéo façon NotebookLM ».

---

## 1. Objectif terminal

**Remplacer l'école en classe physique par une école numérique** dont la qualité
d'enseignement **égale ou dépasse** celle d'un professeur en présentiel.

Le cœur de cette promesse n'est PAS « afficher du contenu » : c'est **reproduire le geste
d'un professeur qui enseigne au tableau** — qui parle, écrit, dessine et révèle son propos
**au rythme de sa parole**, pas d'un coup.

Une vidéo + des slides plaqués ne suffisent pas. On veut un **professeur virtuel** :
voix + tableau **vivant** qui se construit sous les yeux de l'élève, séquentiellement,
en synchronisation avec la narration.

---

## 2. Principe pédagogique fondateur — « le tableau vivant »

> Un bon prof ne vide pas tout le tableau d'un coup. Il pose une idée, l'écrit, l'entoure,
> dessine un schéma pendant qu'il explique, surligne le mot important, puis passe à la suite.
> **L'attention suit la main et la voix.**

Le moteur doit reproduire exactement ça. Le tableau est **lent, méthodique, organisé,
séquentiel** — jamais une avalanche d'informations.

### Les 6 lois d'affichage (non négociables)

1. **Séquentiel, jamais tout-en-même-temps.** Les blocs (titre, idée, schéma, à-retenir)
   apparaissent **un par un**, dans l'ordre du discours. Aucun affichage instantané d'une
   slide complète.
2. **Synchronisé à la voix.** Chaque bloc apparaît **quand la voix off l'aborde**.
   La narration pilote le tableau (timeline mot/segment → révélation).
3. **Écriture « à la main ».** Le texte ne « pop » pas : il **s'écrit** comme tracé par une
   main (effet plume/stylo qui avance lettre par lettre ou trait par trait).
4. **Surlignage du texte lu.** Le passage **en cours de lecture** est **surligné/mis en
   évidence** (effet karaoké) pour ancrer l'attention exactement là où la voix se trouve.
5. **Schémas, diagrammes et idéogrammes dessinés à la main.** Les illustrations se
   **construisent par tracé** (path drawing animé), comme un prof qui dessine au tableau
   pour expliquer — pas une image qui apparaît finie.
6. **Mise en avant des essentiels.** Les « À RETENIR » et idées-clés s'affichent en
   **gros plan**, isolés, avec emphase, pour qu'ils restent en mémoire.

### Rythme
- Lent et respirant. On privilégie **une idée = un temps**.
- Le tableau **accompagne** la vidéo pendant la lecture, puis prend le **premier plan** aux
  moments de reformulation (voir §3).

---

## 3. Parcours élève cible

### 3.1 Pendant un chapitre (lecture)
- La vidéo joue. Le tableau (smartboard) **accompagne** : les slides/cartes du chapitre se
  révèlent **progressivement et en synchronisation** avec ce qui est dit (pas en bloc).

### 3.2 À la fin de chaque chapitre — l'**interlude de reformulation** (le moment-clé)
Avant de passer au chapitre suivant :
1. La vidéo **se met en pause automatiquement** (fin de chapitre détectée).
2. Le tableau passe en **plein écran** (premier plan, immersif).
3. Une **voix off** (TTS) **reformule le chapitre** — comme un prof qui récapitule.
4. Pendant la narration, le tableau **se construit en direct, synchronisé à la voix** :
   - le texte **s'écrit à la main**, le passage lu est **surligné** ;
   - le **schéma/idéogramme se dessine** à la main ;
   - les **« à retenir »** s'affichent en gros plan au bon moment.
5. À la fin de la reformulation → la vidéo **reprend** au chapitre suivant.

### 3.3 Option « Générer un cours vidéo »
Exporter l'ensemble (vidéo + interludes reformulés narrés) en **une vidéo de cours
autonome** — façon Google NotebookLM « générer un cours vidéo ».

---

## 4. Architecture technique — existant vs à construire

> Synthèse de l'audit du 2026-06-23. ~80 % des briques existent ; il manque
> l'**orchestration** (le scénario d'interlude) et les **animations « vivantes »**.

### 4.1 Déjà en place (✅)
| Brique | Où |
|---|---|
| Génération post-prod : transcript → mindmap → slides → images | edge fns `generate-mindmap`, `generate-slide-content`, `generate-visual-image` |
| Slides riches (idée/objectif/carte mentale/à-retenir/image) | `SmartboardRichSlide.jsx` |
| Slides synchronisées au temps vidéo | `StudentSmartboardDeck.jsx` (`syncToVideo`, `timeSeconds`) |
| Champ `reformulation_text` + `mode='reformulation'` | `generate-slide-content`, `SmartboardSegmentRenderer.jsx` |
| Plein écran + navigation animée du deck | `StudentSmartboardDeck.jsx` (2026-06-23) |
| TTS / voix off (capacité) | edge fn `liri-tts` + `liriMultilangTtsEdge.js` |
| Rendu vidéo (worker FFmpeg) — **split-screen** | `apps/worker/src/jobs/courseRender.js` |
| Chapitres dans le lecteur | `VideoPlayer.jsx` (`video.chapters`/`timestamps`) |

### 4.2 À construire (❌ — le chaînon manquant + le « vivant »)
1. **Détection de fin de chapitre + pause auto** de la vidéo (lecteur).
2. **Interlude plein écran** déclenché à la pause : `StudentSmartboardDeck` plein écran sur
   la slide `reformulation` du chapitre.
3. **Voix off de la reformulation** : jouer `liri-tts(reformulation_text)` (ou audio
   pré-généré en post-prod) pendant l'interlude.
4. **Reprise** au chapitre suivant à la fin de la narration.
5. **Affichage « tableau vivant »** (les 6 lois) :
   - reveal **séquentiel bloc-par-bloc** piloté par la timeline de la voix ;
   - **handwriting** du texte (effet main qui écrit) ;
   - **surlignage karaoké** du passage lu ;
   - **path-drawing** animé des schémas/idéogrammes (tracé à la main) ;
   - **gros plan** sur les « à retenir ».
6. **Timeline narration↔tableau** : associer chaque bloc à un repère temporel de l'audio
   (segmentation TTS par phrase / word-timestamps si dispo) pour synchroniser reveal+voix.
7. **Export NotebookLM** : étendre `courseRender.js` pour insérer les **interludes
   reformulés narrés** entre les chapitres (au lieu du split-screen seul).

---

## 5. Roadmap — lots de livraison

### Lot 1 — Interlude narré (le plus visible) — *lecteur*
Pause fin de chapitre → reformulation plein écran + voix off (`liri-tts`) → reprise.
*(Briques 1–4. Reveal d'abord simple : bloc-par-bloc cadencé sur l'audio.)*

### Lot 2 — Le « tableau vivant » (animations) — *rendu des slides*
Handwriting du texte, surlignage karaoké, path-drawing des schémas, gros plan à-retenir.
*(Brique 5. Appliqué d'abord à l'interlude, puis à l'accompagnement en lecture.)*

### Lot 3 — Synchronisation fine voix↔tableau
Timeline par phrase/mot (segmentation TTS) pilotant le reveal exact.
*(Brique 6.)*

### Lot 4 — Génération post-prod de la narration
Étape TTS dans le pipeline : produire l'`audioUrl` narré de chaque `reformulation_text`.

### Lot 5 — Export « cours vidéo NotebookLM »
`courseRender.js` v2 : vidéo → interlude narré animé → chapitre suivant → … → MP4 autonome.

---

## 6. Critères d'acceptation (definition of done)

- À la fin d'un chapitre, la vidéo **s'arrête seule** et l'élève voit/entend une
  **reformulation narrée** avant de continuer.
- Le tableau **ne montre jamais tout d'un coup** : chaque élément apparaît **au moment où
  la voix le dit**.
- Le texte **s'écrit** (pas de pop), le passage lu est **surligné**, les schémas se
  **dessinent**.
- Un élève peut **mettre en plein écran** et naviguer ◀ ▶ / clavier.
- Option **« Générer un cours vidéo »** : produit une vidéo autonome intégrant les interludes.
- Ressenti final : **« on dirait un prof qui enseigne »**, pas un diaporama.

---

## 7. Garde-fous

- **Pédagogie d'abord** : lenteur assumée, une idée à la fois. Ne jamais sacrifier la
  clarté à la densité.
- **Accessibilité** : `prefers-reduced-motion` → les animations « écriture/dessin » se
  réduisent à un fondu progressif (pas de blocage du contenu).
- **Performance** : les animations de tracé (handwriting/path-drawing) doivent rester
  fluides (transform/opacity, SVG stroke-dashoffset) — pas de reflow.
- **Coût** : la narration TTS et les images sont **mises en cache** (générées une fois en
  post-prod, rejouées sans regénérer).
