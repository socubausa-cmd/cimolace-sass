# Style « Sherpas » — référence d'entraînement du Précepteur

> Guide de style extrait de la chaîne **Les Sherpas - Étudiants**
> (`youtube.com/channel/UCaki-fxlvKI7Yc--vv-b2Yw`), analysé image par image via le
> skill `/watch`. Sert de **référence de rendu** pour Le Précepteur
> ([[CAHIER_DE_CHARGE_PRECEPTEUR]]) : math & physique expliquées de façon
> accessible, punchy, visuelle. But : que les cours générés « ressemblent » à ces
> shorts, transposés au format tableau-vivant du Précepteur.

## Vidéos de référence (4, analysées 2026-07)
| Sujet | Type | ID short | Ce qu'on en retient |
|---|---|---|---|
| L'électricité statique, c'est quoi ?! ⚡ | physique | `h75bOHjdd5s` | accroche-question, analogies concrètes (ballon/cheveux, pull), payoff « réel danger et surprenant » |
| Le nombre d'or & la suite de Fibonacci 🌀 | math | `bfURXsbgQDw` | **suite écrite à la main, chiffres couleur-codés + cercles reliant les termes** ; b-roll nature/pyramides |
| Comment faire une dissertation de philo ✍ | méthode | `QSCxsG8axgk` | même format, méthode pas-à-pas |
| Deviens un génie en maths 💪 | math | `iN6nT0gNm_0` | **astuce de calcul mental posée sur papier quadrillé, chiffres couleur-codés étape par étape** |

## A. Le format (ce qu'on VOIT)
- **Vertical 9:16, ~55–70 s.** Dense, aucun temps mort.
- **Présentateur·rice en talking-head** : jeune, énergique, complice — le grand frère / la grande sœur qui explique, pas le prof magistral. Studio chaleureux (plantes, étagères, néon circulaire, micro Shure), **logo « S » vert** en coin.
- **Sous-titres karaoké** : gros texte **MAJUSCULE**, mot par mot, **mot-clé surligné en VERT** (couleur de marque). Émojis en ponctuation (🤔 ⚡ 😮).
- **B-roll d'illustration** intercalé : relie l'abstrait au concret/culturel (enfant électrisé au ballon, spirale dans la nature, extrait de film).

## B. La pédagogie visuelle (LE cœur, transposable au croquis)
Les démonstrations math sont posées **à la main sur papier / quadrillage** (flat-lay bureau : marqueurs, mug), avec :
- **Couleur-codage RÉVÉLATEUR, pas décoratif.** Chaque nombre/terme reçoit une couleur ; les termes qui se **combinent** partagent/opposent une couleur, et des **cercles/surlignages colorés relient** les éléments liés. On VOIT la structure du calcul (quels chiffres se multiplient, comment chaque terme de Fibonacci est la somme des deux précédents).
- **Le vert = le résultat / le mot-clé à retenir.** Convention constante.
- **Révélation progressive, étape par étape.** Chaque ligne découle de la précédente ; le calcul se **construit** sous les yeux (idéal pour le champ `order` du croquis = ordre de tracé).
- **Esthétique cahier** : tracé main, bulle/contour, lisible, jamais surchargé.

## C. Le discours (ce qu'on ENTEND)
1. **Accroche** : question ou promesse intrigante — « X, c'est quoi ?! », « Deviens un génie en… », « Mais pourquoi est-ce qu'on… ».
2. **Ton** : conversationnel, tu/on, phrases courtes et incarnées, énergie constante.
3. **Un terme clé, puis un exemple concret / analogie du quotidien** (contact entre 2 corps ; Fibonacci dans la nature et les pyramides ; astuce de calcul mental).
4. **Payoff** : une révélation / un « waouh » en fin (le calcul complet dévoilé, le danger surprenant).

## D. Mapping vers le contrat du Précepteur
| Sherpas | Où, dans Le Précepteur |
|---|---|
| Mot-clé en vert | `color:"green"` sur l'élément-clé / le résultat du croquis ; caption qui nomme le mot-clé |
| Chiffres/termes couleur-codés reliés | plusieurs `label`s colorés (`blue`, `amber`, `purple`, `red`) sur les termes qui se combinent ; `green` réservé au résultat |
| Construction étape par étape | `order` croissant = le prof trace dans l'ordre du raisonnement |
| Étiquettes MAJUSCULE punchy | `label` courts (2–4 mots), majuscules |
| Accroche + ton complice | `board_text` / `narration` de la scène `lecon` ; amorces (§4) |
| Analogie concrète illustrée | scène `image_analogie` (déjà au contrat) ; le b-roll Sherpas = notre image générée+animée |
| Payoff | `reveal_narration` + `reveal_sketch` de l'`atelier` |

Palette croquis disponible (fermée) : `blue` (sujet principal) · `amber` (terme apparié/opposé) · `green` (**résultat / mot-clé**) · `purple` (nuance) · `red` (piège/danger) · `slate` (neutre).

## E. À NE PAS faire (rester fidèle au Précepteur)
- Ne pas transformer le cours en pur talking-head : le Précepteur garde sa **main qui écrit** + son **atelier nominatif**. Le style Sherpas apporte l'**énergie, le couleur-codage et l'accroche**, pas le remplacement du tableau vivant.
- Le couleur-codage doit toujours porter du SENS (montrer une relation), jamais colorer pour décorer.
