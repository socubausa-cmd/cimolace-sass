# Grille de scoring — Roue de transformation (à valider par Coralie)

But : Coralie ajuste **quelle réponse pèse sur quel axe** et **avec quel poids**.
Une fois rempli, on encode tel quel dans `apps/med-app/src/twin/transformation.ts`
(objet `SCORING`). Aucune logique à coder côté Coralie — juste valider/corriger.

## Comment lire / corriger
- **Poids** = score santé de chaque réponse, de **0 (mauvais)** à **100 (optimal)**,
  dans l'ordre des options du questionnaire. Ex. « Sédentaire = 20 … Très actif = 90 ».
- **Axes fonctionnels** (matrice) : assimilation, défense, énergie, biotransformation,
  transport, communication, structural, oxydation, glycation, inflammation, méthylation, détoxification.
- **Axes hygiène de vie** : digestion, sommeil, stress, énergie, inflammation, immunité,
  métabolisme, hormones, activité physique, cognition, environnement, émotions.
- **Signes (« plusieurs choix »)** : score = 100 − part de signes cochés (« Aucun » ≈ 92).

## Questions à échelle (poids par option, dans l'ordre)

| Q | Question | Poids actuels (option1 → optionN) | Axes fonctionnels | Axes hygiène |
|---|---|---|---|---|
| 7 | Activité physique | 20 / 45 / 70 / 90 / 82 | énergie, oxydation | activité phys., énergie |
| 8 | Qualité du sommeil | 25 / 55 / 80 / 95 | communication, énergie | sommeil, hormones, énergie |
| 9 | Stress quotidien | 95 / 80 / 55 / 30 / 12 | communication, inflammation | stress, émotions, cognition |
| 10 | Consommation d'eau | 20 / 45 / 65 / 85 / 95 | transport, détoxification | environnement |
| 11 | Alcool | 95 / 75 / 55 / 32 / 12 | biotransformation, oxydation, détox | environnement |
| 12 | Tabac | 95 / 72 / 42 / 15 | oxydation, inflammation | environnement |
| 13 | Régime alimentaire | 60 / 78 / 72 / 78 / 66 / 60 | méthylation, assimilation | — |
| 14 | Repas / jour | 52 / 72 / 88 / 70 / 25 | — | métabolisme |
| 15 | Sucre raffiné | 95 / 70 / 45 / 22 / 8 | glycation | métabolisme |
| 16 | Aliments transformés | 95 / 80 / 55 / 28 / 10 | glycation, oxydation, inflammation, biotransformation, méthylation | inflammation, environnement |
| 17 | Digestion | 95 / 75 / 50 / 35 / 15 | assimilation | digestion |
| 18 | Fréquence des selles | 85 / 95 / 68 / 40 / 20 | assimilation, détoxification | digestion |
| 19 | Niveau d'énergie | 15 / 35 / 60 / 85 / 95 | énergie | énergie, cognition |
| 21 | État de la peau | 95 / 75 / 55 / 30 / 28 | structural, détoxification | — |
| 24 | Grossesse / allaitement | 72 / 58 / 58 / 66 / 72 | communication | hormones |
| 28 | Transpiration | 85 / 48 / 60 / 32 | détoxification, transport | — |

## Questions « signes » (plusieurs choix → score = 100 − % de signes)

| Q | Question | Axes fonctionnels | Axes hygiène |
|---|---|---|---|
| 20 | Symptômes ressentis | défense, inflammation, structural | inflammation, immunité |
| 22 | Antécédents médicaux | défense | immunité |
| 25 | Signes foie chargé | biotransformation, détoxification | — |
| 26 | Signes reins | transport, détoxification | — |
| 27 | Signes intestin encrassé | assimilation | digestion |
| 29 | Signes lymphe surchargée | transport, défense | immunité |

## Non scorées (programme / contexte) — ignorées par la roue
6 Taille · 23 Médicaments · 30/31 Objectifs · 32/33 Détox passée · 34 Budget ·
35 Durée · 36 Motivation · 37 Freins · 38 Accompagnement · 39 Provenance.

> ✏️ Coralie : barre/ajoute des axes, change les poids. Renvoie cette grille
> annotée → encodage immédiat dans `SCORING`.
