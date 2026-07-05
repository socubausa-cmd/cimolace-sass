# Précepteur — Atelier d'analyse & règles d'injection (brique A, déterministe)

> Module : `apps/app/src/lib/precepteur/injectionRules.js` (pur ESM, testé).
> But : rendre **reproductible** le « quand injecter quoi » dans un cours du Précepteur —
> une VRAIE analyse de segment → une recette d'injection, pas le feeling d'un LLM.
> S'inspire de la richesse du **Masterclass Factory** (`masterclassStructuredDocument.js` :
> topics, passages à offsets, dépendances) : on exploite les signaux, on ne devine pas.

## Pourquoi (rappel de la garantie)
Un prompt **oriente** ; un ensemble de règles **garantit**. Ce module transforme
l'analyse en décisions **déterministes** : `même segment → même plan` (prouvé par test).
C'est la pièce qui manquait pour tendre vers « tous les cours à la même hauteur ».

## 1. Classification par SIGNAUX (déterministe)
`classifySegment(text, meta)` détecte des tags par heuristiques FR :

| Tag | Déclencheurs (extraits) |
|---|---|
| `definition` | « est défini/appelé/nommé », « on appelle », « c'est-à-dire », terme entre «…» |
| `formula` | `=` `×` `÷`, `\d [+-*/] \d`, « formule/équation/calcul/ratio/pourcentage » |
| `enumeration` | listes à puces, « d'abord…ensuite…enfin », « plusieurs/types/étapes » (ou `key_points ≥ 2`) |
| `process` | « d'abord/ensuite/donc/ainsi », « ce qui provoque/entraîne », « mécanisme/processus » |
| `relation` | « oppose/contraire/proportionnel/relation/dépend/équilibre/force/attraction » |
| `phenomenon` | « par exemple », « dans la nature/vie », « on observe », « concrètement », « imagine » |
| `takeaway` | « en résumé », « à retenir », « l'essentiel », « en conclusion » |

**Abstraction** = explicite (`meta.abstraction`) OU inférée (relation/formule/process **sans** phénomène concret).

## 2. Recette d'injection (dispositifs ordonnés)
`planInjections(text, opts)` → liste ORDONNÉE de dispositifs. Vocabulaire fermé :
`lecon · surlignage · encadre · resume_encadre · amorce_croquis · croquis · atelier · image_analogie · transition`.

| Classe du segment | Dispositifs injectés (dans l'ordre) |
|---|---|
| *(tous)* | **lecon** (socle) |
| `definition` | **surlignage** (mot-clé, style Sherpas) + **encadre** (l'énoncé figé) |
| `formula` | **encadre** (formule) + **amorce_croquis** + **croquis** *(couleur-codé, résultat VERT, pas-à-pas)* |
| `process`/`relation`/abstrait | **amorce_croquis** + **croquis** *(idéogramme)* |
| abstrait | **atelier** (socratique nominatif + révélation) |
| `phenomenon` / non-abstrait | **image_analogie** (image générée + animée) |
| `enumeration`/`takeaway`/`key_points≥2` | **resume_encadre** (points clés rassemblés) |
| dernier segment du chapitre | **transition** |

**Garde-fou de dosage** : jamais 2 `croquis` dans un même segment (**1 idée = 1 croquis**).

## 3. État & reste-à-faire (honnête)
- ✅ **Fait** : classification + plan d'injection **déterministes**, prouvés (test `injectionRules.test.mjs`, `node --test`).
- 🔨 **Reste pour l'intégration complète** (ce qui transforme le plan en cours rendu) :
  1. **Câbler** `planChapter()` dans `fromMasterclass.js` (ou un builder dédié) : émettre les scènes à partir du plan au lieu du mapping 1:1 actuel — et **déclencher la génération du croquis** (`liri-preceptor-course`) pour chaque segment `croquis` (aujourd'hui le pont DROP les croquis).
  2. **Rendu front des NOUVEAUX dispositifs** : `surlignage`, `encadre`, `resume_encadre` (le renderer ne connaît que `lecon/croquis/atelier/image_analogie/transition`).
  3. **Juge de conformité** (brique C) : vérifier qu'un cours généré respecte le plan, et **régénérer** les scènes non conformes → c'est ce qui donne « tous les cours à la même hauteur ».
  4. **SFX / transitions / zoom** (brique D, §8 du cahier) : la couche « pixel-pret » sonore/visuelle.

Tant que 1-2 ne sont pas câblés, le module **décide** correctement mais n'**émet** pas encore les nouveaux dispositifs dans le rendu.
