# Cahier de charge — LE PRÉCEPTEUR

> Agent de **génération de cours en post-production** : il transforme un **texte** ou la **transcription d'une vidéo** en un **cours enseigné**, joué sur un tableau vivant plein écran où une main écrit, dessine des croquis, interpelle l'élève par son prénom et illustre par des images/analogies animées.
>
> **Statut : SPEC — à valider avant implémentation.** Complète `docs/CAHIER_DE_CHARGE_TABLEAU_VIVANT.md`.

---

## 1. Nom & position dans l'écosystème

**Nom retenu : « LE PRÉCEPTEUR »** (codename `preceptor`, edge function `liri-preceptor-course`).
Rationale : un précepteur est le maître particulier qui enseigne **un élève, par son nom**, pas à pile-poil — exactement le mode « atelier nominatif » demandé.

| Couche | Live (existant) | Post-production (nouveau) |
|---|---|---|
| Cerveau | **Longia** / LIRI Brain (temps réel) | **LE PRÉCEPTEUR** |
| But | piloter un smartboard pendant un live | **composer un cours qui s'enseigne tout seul** |
| Entrée | sujet + gestes de l'animateur en direct | **texte / transcription vidéo** (asynchrone) |
| Sortie | suggestions live (coach→architect) | **partition de cours** jouable (scènes typées) |

**Ce qu'il RÉUTILISE (ne pas réinventer) :**
- le **master script** (`Segment.masterScript = {intro, keyPoints[], transitions[], conclusion}`) et le modèle riche **`MasterclassChapter`** (`apps/app/src/lib/liri-masterclass/types.ts`) qui porte déjà `thought_experiment`, `workshop{questions, expected_answers, expected_errors}`, `analogies[]`, `examples[]`, `reformulation`, `je_retiens[]`, `understanding_test[]`, `real_application`, `transition_to_next` ;
- `generate-mindmap` (transcript → carte de concepts) pour le **découpage** ;
- `generate-visual-image` (Gemini Imagen, scène réelle) pour les **images/analogies** ;
- `liri-tts` (ElevenLabs fr-FR) pour la **voix off** ;
- le routeur modèles `aiClaudeDeepSeekGrok.ts` (economy: DeepSeek→Mistral→Grok ; premium: Claude d'abord).

**Ce qu'il AJOUTE (le manque) :**
1. la bascule **live → post-prod** (un cours pré-généré à partir d'un matériau, pas d'un direct) ;
2. le **croquis dessiné à la main** (idéogramme : vecteurs/flèches/points/courbes/spirales étiquetés) — pas une photo, pas un slide Konva figé ;
3. le **balayage latéral** (l'écran « se pousse » pour faire de la place au dessin, comme un vrai tableau) ;
4. l'**atelier socratique nominatif** (interpelle l'élève connecté par son prénom, attend sa réponse, répond en variant les formulations, révèle) ;
5. l'**analogie animée** (image concrète du quotidien + exemple animé réel : la Terre qui tourne, une galaxie…).

---

## 2. Objectif terminal & expérience cible

Remplacer l'école physique par une école numérique où **le tableau enseigne comme un professeur**. Le Précepteur produit la *partition* ; le **Tableau Vivant immersif plein écran** la *joue* :

1. **Plein écran immersif** — tout l'écran est le tableau (pas une carte au milieu d'une page).
2. **La main écrit** la leçon (déjà livré : `WritingHand` dans `TableauVivant.jsx`), au rythme de la **voix off**.
3. **Balayage latéral → mode croquis** — pour dessiner, le bloc de texte **glisse sur le côté** (sweep) et une **surface de dessin** s'ouvre ; la main **trace l'idéogramme** trait par trait.
4. **Atelier nominatif** — la lecture se met en pause, le tableau écrit/dit *« {prénom}, donne-moi ta lecture… »*, attend la réponse tapée, **réagit** (formulation variée), puis **révèle** (souvent un 2ᵉ croquis).
5. **Image / analogie animée** — une scène concrète (image réelle) + un exemple **animé** (Terre en orbite…) fait *asseoir* l'idée.
6. **Continuité d'école** — jamais de saut sec : chaque passage est amené par une **phrase d'amorce**.

---

## 3. Exemple canonique (fil rouge de la spec)

Concept : **« Le temps est une flèche courbée par l'espace → naissance de la spirale »** (matériau fourni par le fondateur).

| Phase | Contenu joué au tableau |
|---|---|
| **Leçon** | Le temps = information potentielle qui tend vers la différenciation (continuer). Une information quantique = un minimum d'état d'action ⇒ le temps ne porte qu'**un bit** : « continuer ». Mais le temps n'est pas seul (être = potentiel d'être différent) ⇒ il existe une information contraire : **l'espace**, dont la tendance unique est d'**unifier / revenir**. Deux volontés opposées ⇒ en naît une 3ᵉ : **l'énergie** (le différentiel accordé). |
| **Amorce** | *« Pour bien voir ça, faisons un croquis. »* |
| **Croquis 1** | (balayage) On trace un **vecteur bleu** vers l'extérieur = la flèche du temps (continuer). Derrière, une **flèche de contrainte** qui impose le retour (l'espace). |
| **Atelier** | *« {prénom}, si on impose une force opposée à ce qui tend mais qui ne peut pas reculer — qu'est-ce qui se passe ? Donne-moi ton point de vue. »* → attend → réagit (variations) → **révélation** : la flèche **se courbe** (physique de contrainte) : au lieu d'une trajectoire rectiligne, une **géodésique** qui **spirale** autour du point de contrainte = le **point de gravité** (action de l'espace qui exige le retour à l'unité). Le mouvement rectiligne n'existe pas : tout **spirale** autour d'un point. |
| **Croquis 2** | (balayage) La flèche du temps qui **spirale** autour d'un **point central** (le point de gravité, issu de l'espace). |
| **Image / analogie animée** | Analogie : *un oiseau qui s'envole, un animal lui tient la patte* → il ne peut pas filer droit (le temps est ralenti par l'espace). Puis **exemple animé** : la **Terre** qui tourne autour du Soleil et sur elle-même ; même chose pour les **galaxies**. ⇒ Le temps est courbé par l'espace ; la spirale en naît. |

C'est ce gabarit (leçon → amorce → croquis → atelier → image/analogie) que l'agent doit produire **pour chaque concept abstrait**.

---

## 4. La séquence pédagogique (le contrat)

Pour chaque **concept**, Le Précepteur émet une suite ordonnée de **scènes typées** :

| Scène | Rôle | Obligatoire ? |
|---|---|---|
| `lecon` | l'explication conceptuelle, écrite + narrée | oui |
| `amorce_croquis` | phrase de transition « faisons un croquis » | si croquis |
| `croquis` | idéogramme à tracer (spec de dessin) + narration | si concept abstrait |
| `atelier` | interpellation nominative + question + réponses attendues/erreurs + **banque de formulations variées** + révélation (souvent + croquis) | si concept abstrait |
| `image_analogie` | analogie concrète (texte) + image réelle + **exemple animé** | oui pour un concept abstrait |
| `transition` | amorce vers le concept suivant | oui |

Règle de dosage : un concept **simple** peut se limiter à `lecon` + `image_analogie`. Un concept **abstrait** DOIT avoir `croquis` + `atelier` + `image_analogie`. Jamais deux idées dans un même croquis (**1 idée = 1 croquis**).

---

## 5. Mode de génération (pipeline post-production)

```
Matériau source (texte OU vidéo)
   │
   ├─[0] (si vidéo) Transcription  → transcript horodaté
   │
   ├─[1] DÉCOUPAGE          (réutilise generate-mindmap + modèle MasterclassChapter)
   │        transcript/texte → liste ordonnée de CONCEPTS (1 concept = 1 idée à enseigner)
   │
   ├─[2] SCÉNARISATION      (LE PRÉCEPTEUR — cœur)  ← le prompt §7
   │        pour chaque concept → séquence de SCÈNES typées (§4) avec amorces de continuité
   │
   ├─[3] ASSETS (en parallèle, par scène)
   │        • croquis  → sketch-spec normalisée (rendue à la main par le front, PAS d'image)
   │        • image_analogie → generate-visual-image (scène réelle) + ref d'exemple animé
   │        • narration → liri-tts (fr-FR) — audio mis en cache (pré-généré)
   │
   ├─[4] ATELIER = template + moteur runtime
   │        génération : {question, expected_answers, expected_errors, ack_variants, reveal}
   │        runtime    : à la lecture, on injecte le PRÉNOM réel, on capte la réponse tapée,
   │                     un juge léger (liri-preceptor-atelier-judge) la classe
   │                     (attendu / partiel / erreur typique / hors-sujet) et choisit une
   │                     formulation variée, puis déclenche la révélation.
   │
   └─[5] ASSEMBLAGE → cours JSON jouable (§6) stocké (course_render_jobs / formation_*),
            joué par le Tableau Vivant immersif (§8).
```

**Modèles** : scénarisation = tier **premium** (Claude d'abord) car c'est de la pédagogie fine ; découpage/judge = **economy** (DeepSeek). Images = Gemini Imagen. Voix = ElevenLabs fr-FR.

**Pré-génération (Lot 4 du Tableau Vivant)** : la narration et les images sont **calculées en post-prod** et mises en cache → à la lecture, tout est instantané et **synchronisé** (la voix premium pilote la cadence, pas la synthèse navigateur).

---

## 6. Schéma de sortie (course JSON)

```jsonc
{
  "course": {
    "title": "…", "language": "fr", "level": "…",
    "source": { "kind": "text|video", "ref": "…" },
    "concepts": [
      {
        "id": "c1", "title": "Le temps courbé par l'espace", "objectif": "…",
        "abstraction": "high",                 // high → croquis+atelier+image obligatoires
        "scenes": [
          { "type": "lecon", "board_text": "…", "narration": "…" },
          { "type": "amorce_croquis", "narration": "Pour bien voir ça, faisons un croquis." },
          { "type": "croquis", "narration": "…",
            "sketch": {
              "caption": "La flèche du temps et la contrainte",
              "elements": [
                { "kind": "vector", "from": [40,60], "to": [78,40], "color": "blue",  "label": "flèche du temps", "order": 1 },
                { "kind": "arrow",  "from": [70,72], "to": [46,58], "color": "amber", "label": "contrainte (espace)", "order": 2 }
              ]
            }
          },
          { "type": "atelier",
            "address": "{{student_name}}",
            "question": "Si on impose une force opposée à ce qui tend mais qui ne peut pas reculer, que se passe-t-il ?",
            "expected_answers": ["elle se courbe", "elle tourne", "elle spirale"],
            "expected_errors": ["elle s'arrête", "elle recule"],
            "ack_variants": {
              "ok":      ["Exactement.", "Tu y es.", "C'est ça même."],
              "partial": ["Tu tiens un bout du fil…", "Presque — pousse un cran plus loin."],
              "wrong":   ["Pas tout à fait.", "Regarde mieux le croquis.", "Non — mais l'erreur est instructive."]
            },
            "reveal_narration": "En vérité la flèche doit se courber : géodésique, elle spirale autour du point de contrainte — le point de gravité…",
            "reveal_sketch": { "caption": "La spirale autour du point de gravité",
              "elements": [ { "kind": "spiral", "center": [55,55], "color": "blue", "label": "temps", "order": 1 },
                            { "kind": "point",  "center": [55,55], "color": "amber", "label": "point de gravité (espace)", "order": 2 } ] }
          },
          { "type": "image_analogie",
            "analogie": "Un oiseau s'envole, un animal lui tient la patte : il ne file pas droit — le temps est ralenti par l'espace.",
            "image_prompt": "a bird taking flight while an animal holds its leg, cinematic real scene, …",
            "animated_example": { "subject": "earth_orbit", "caption": "La Terre tourne autour du Soleil et sur elle-même — comme tout ce qui est en action." },
            "narration": "…"
          }
        ],
        "transition_next": "Maintenant qu'on tient la spirale, voyons…"
      }
    ]
  }
}
```

**`sketch.elements[].kind`** (vocabulaire de croquis fermé, rendu à la main par le front) : `vector` · `arrow` · `point` · `line` · `curve` · `spiral` · `circle` · `axis` · `label` · `bracket`. Coordonnées en **% du cadre** (0–100), `order` = ordre de tracé.

**`animated_example.subject`** (banque d'animations réutilisables, fermée au départ) : `earth_orbit` · `galaxy_spin` · `pendulum` · `wave` · `orbit_generic` · (extensible). Sinon `image_prompt` + `loop:true`.

---

## 7. Prompt de l'agent — LE PRÉCEPTEUR (à valider)

```text
# RÔLE
Tu es LE PRÉCEPTEUR, maître-pédagogue qui transforme un texte ou la transcription d'une
vidéo en un COURS ENSEIGNÉ, joué sur un tableau vivant plein écran où une main écrit,
dessine des croquis et s'adresse à l'élève par son prénom. Tu n'es ni un générateur de
slides ni un smartboard live : tu écris la PARTITION d'un cours de post-production,
destinée à être jouée comme si un vrai professeur enseignait au tableau.

# MISSION
À partir du MATÉRIAU SOURCE fourni, produis une SÉQUENCE D'ENSEIGNEMENT continue,
concept par concept, qui FAIT ASSEOIR chaque idée par :
leçon narrée → amorce → croquis dessiné à la main → atelier interactif nominatif →
image/analogie concrète et animée.

# PRINCIPES (pédagogie ISNA / prorascience)
1. CONTINUITÉ comme à l'école : jamais de rupture sèche. Chaque passage est introduit
   par une PHRASE D'AMORCE courte et naturelle (« Pour bien voir ça, faisons un croquis… »,
   « Maintenant, {prénom}, à toi… »).
2. UNE idée = UN croquis. Le croquis est un IDÉOGRAMME explicite (vecteurs, flèches,
   points, courbes, spirales, étiquettes) tracé à la main — JAMAIS une photo — qui rend
   l'abstraction visible.
3. FAIRE ASSEOIR l'idée : après l'abstraction, TOUJOURS une IMAGE CONCRÈTE du quotidien
   (analogie) + un EXEMPLE ANIMÉ réel (ex. la Terre qui tourne) — montré, pas seulement dit.
4. ATELIER SOCRATIQUE NOMINATIF : interpelle l'élève connecté par {{student_name}}, pose
   UNE question de compréhension, prévois ses réponses attendues ET ses erreurs typiques,
   et fournis une BANQUE DE FORMULATIONS VARIÉES (accord / nuance / désaccord) pour ne
   JAMAIS répéter le même mot ; puis prévois la RÉVÉLATION (la vraie réponse, souvent
   suivie d'un 2ᵉ croquis).
5. RYTHME PROFESSORAL : le texte se construit au rythme de la voix ; concision, ton incarné.

# DOSAGE
- Concept SIMPLE : lecon + image_analogie suffisent.
- Concept ABSTRAIT : croquis + atelier + image_analogie OBLIGATOIRES.
- Jamais deux idées dans un même croquis.

# FIDÉLITÉ
Tu n'inventes AUCUN fait hors du matériau source. Tu ajoutes librement des amorces, des
croquis, des analogies et des questions d'atelier POUR EXPLIQUER — jamais de nouveaux
contenus factuels.

# SORTIE
Réponds UNIQUEMENT par le JSON du schéma `course` (voir contrat). Coordonnées de croquis
en % (0–100), `order` = ordre de tracé. Langue : français. Aucune prose hors JSON.
```

(Le prompt final embarquera le contrat JSON complet du §6 en annexe `# CONTRAT DE SORTIE`.)

---

## 8. Rendu immersif (front) — à construire (pas maintenant)

Nouveaux éléments du **Tableau Vivant** (au-dessus de l'existant) :
- **Mode plein écran immersif** (toute la vue = tableau).
- **`BoardSweep`** — transition de **balayage latéral** : le panneau texte glisse, une **surface de croquis** s'ouvre (et se referme).
- **`SketchRenderer`** — interprète `sketch.elements[]` et les **trace à la main** (réutilise `motion.path pathLength` de `HandDrawnDiagram`, étendu : vecteurs/spirales/points/étiquettes, ordre de tracé).
- **`AtelierPrompt`** — encart d'interaction : interpelle `{{student_name}}`, champ de réponse, appel au **juge** `liri-preceptor-atelier-judge`, réponse variée, puis révélation.
- **`AnimatedExample`** — petite scène animée par `subject` (orbite Terre, spirale galaxie…).
- Tout pilotable par la **voix off pré-générée** (cadence synchronisée).

---

## 9. Garde-fous & critères d'acceptation

**Garde-fous**
- Croquis = idéogramme tracé main, JAMAIS une photo ; `image_analogie` = scène RÉELLE.
- L'atelier interpelle TOUJOURS par prénom et VARIE ses formulations (jamais 2× le même mot).
- Continuité : chaque scène amenée par une amorce, zéro saut sec.
- Fidélité au matériau (pas de faits inventés).
- Français, ton incarné, concision.

**Acceptation (sur l'exemple canonique §3)**
1. La leçon temps/espace/énergie est restituée fidèlement.
2. Croquis 1 (vecteur temps + contrainte) puis Croquis 2 (spirale + point de gravité) sont tracés à la main, après balayage.
3. L'atelier appelle l'élève par son prénom, accepte une réponse, réagit en variant, révèle.
4. L'analogie (oiseau tenu) + l'exemple animé (Terre) jouent.
5. Tout s'enchaîne sans rupture, voix synchronisée.

---

## 10. Décisions à valider (avant de coder)

1. **Nom** : « Le Précepteur » — OK, ou autre ? (alternatives : *Magister*, *Le Pédagogue*, *Socrate*.)
2. **Croquis** : 100 % vectoriel tracé-main (vocabulaire fermé §6) — OK ? ou autoriser un repli image générée pour les schémas complexes ?
3. **Atelier hors-live** : pour un élève SEUL en lecture (pas en direct), on garde l'interaction tapée + juge LLM — OK ? (sinon : atelier « à réponse révélée » sans saisie.)
4. **Exemples animés** : banque fermée au départ (`earth_orbit`, `galaxy_spin`, …) puis extensible — OK ?
5. **Entrée** : on démarre par **texte collé** (le plus simple) puis on branche la **vidéo/transcription** — OK ?
6. **Périmètre du 1er jet** : générer l'exemple canonique (temps→spirale) de bout en bout comme preuve, avant d'industrialiser ?
```
