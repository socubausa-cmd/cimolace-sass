/**
 * COURS CANONIQUE — « Le temps est une flèche courbée par l'espace »
 * cf. docs/CAHIER_DE_CHARGE_PRECEPTEUR.md (§3, §6).
 *
 * Partition AUTHORÉE À LA MAIN qui sert de preuve vivante : c'est exactement la
 * sortie que l'agent « Le Précepteur » devra produire. Coordonnées de croquis en
 * % (0–100) du cadre 16:9.
 */
export const CANONICAL_COURSE = {
  title: 'Le temps courbé par l’espace',
  language: 'fr',
  level: 'initiation',
  concepts: [
    {
      id: 'c1',
      title: 'Le temps, l’espace, et la spirale',
      objectif: 'Comprendre pourquoi le temps se courbe et donne naissance à la spirale.',
      abstraction: 'high',
      scenes: [
        // 1) LEÇON
        {
          type: 'lecon',
          title: 'Le temps est une information',
          board_text: 'Le temps est l’information potentielle qui tend vers la différenciation : sa tendance est de continuer. Une information quantique est un minimum d’état d’action — le temps ne porte donc qu’un seul bit : « continuer ».',
          narration: 'Bon… commençons par le temps. Le temps, en vrai, c’est quoi ? C’est de l’information. Une information qui veut avancer, qui tend vers la différence. Sa seule envie, au fond, c’est de continuer. Et là, écoute bien : une information quantique, c’est un minimum d’action. Donc le temps, il ne peut transporter qu’un seul bit. Un seul, tu vois ? Et ce bit, c’est : continuer.',
        },
        {
          type: 'lecon',
          title: 'Mais le temps n’est pas seul',
          board_text: 'Être, c’est le potentiel d’être différent de ce que l’on n’est pas. Le temps ne peut donc exister seul : il existe une information contraire — l’espace — dont la tendance unique est d’unifier, de revenir. Deux volontés opposées : il en naît une troisième, l’énergie, le différentiel accordé.',
          narration: 'Mais attends… le temps n’est pas tout seul. Réfléchis avec moi : être, c’est pouvoir être différent de ce qu’on n’est pas. Donc forcément, il existe une information contraire. Et cette information-là, c’est l’espace. L’espace, lui, il veut l’inverse : unifier, revenir en arrière. Tu as donc deux volontés qui s’opposent, face à face. Et de ce choc… il naît une troisième chose : l’énergie. Ce qu’on appelle le différentiel accordé.',
        },
        // 2) AMORCE → CROQUIS
        {
          type: 'amorce_croquis',
          narration: 'Bon… pour bien voir ce qui se passe, on va faire un petit croquis ensemble.',
        },
        // 3) CROQUIS 1 — la flèche du temps et la contrainte
        {
          type: 'croquis',
          narration: 'Regarde bien. Voilà la flèche du temps — ce vecteur bleu, là, qui veut continuer, filer tout droit vers l’extérieur. Mais juste derrière, il y a une force qui le retient… qui lui impose de revenir. Et ça, cette force, c’est l’espace.',
          sketch: {
            caption: 'La flèche du temps et la contrainte de l’espace',
            elements: [
              { kind: 'vector', from: [26, 64], to: [80, 30], color: 'blue', label: 'flèche du temps', labelSide: 'above', order: 1 },
              { kind: 'arrow', from: [80, 72], to: [40, 52], color: 'amber', label: 'contrainte — l’espace', labelSide: 'below', order: 2 },
            ],
          },
        },
        // 4) ATELIER (nominatif + saisie + révélation + 2e croquis)
        {
          type: 'atelier',
          address: '{{student_name}}',
          question: 'Si on impose une force opposée à ce qui tend, mais qui ne peut pas reculer — qu’est-ce qui va se passer ?',
          hint: 'Le temps ne peut plus continuer librement… mais il ne peut pas reculer non plus.',
          expected_answers: ['se courber', 'courbe', 'tourner', 'spirale', 'spiraler', 'dévier', 'cercle'],
          expected_errors: ['s’arrête', 'arrete', 'recule', 'disparait', 'explose'],
          ack_variants: {
            ok: ['Exactement.', 'Tu y es.', 'C’est ça même.', 'Voilà.'],
            partial: ['Tu tiens un bout du fil…', 'Presque — pousse d’un cran.', 'Bonne direction.'],
            wrong: ['Pas tout à fait.', 'Regarde mieux le croquis.', 'Non — mais l’erreur est instructive.'],
          },
          reveal_narration: 'Eh bien voilà : la flèche, elle est obligée de se courber. C’est de la physique de contrainte, tout simplement. Au lieu d’aller tout droit, elle se met à spiraler… à tourner autour du point qui la retient. Et ce point, écoute bien, on l’appelle le point de gravité. Parce que la gravité, en fait, c’est juste l’action de l’espace qui réclame le retour à l’unité. Du coup le temps, il se transforme : de flèche, il devient spirale. Et c’est pour ça — retiens bien ça — que le mouvement en ligne droite, ça n’existe pas. Tout ce qui bouge spirale autour d’un point.',
          reveal_sketch: {
            caption: 'Le temps spirale autour du point de gravité',
            elements: [
              { kind: 'spiral', center: [50, 50], turns: 2.8, radius: 40, color: 'blue', label: 'mouvement du temps', order: 1 },
              { kind: 'point', center: [50, 50], color: 'amber', label: 'point de gravité (espace)', order: 2 },
            ],
          },
        },
        // 5) IMAGE / ANALOGIE ANIMÉE
        {
          type: 'image_analogie',
          analogie: 'Imagine un oiseau qui s’envole, mais un animal lui tient la patte : il ne peut pas filer droit. C’est la course du temps, ralentie par l’espace.',
          // Image RÉELLE générée par Le Précepteur (Imagen) — doit montrer EXPLICITEMENT l'analogie.
          image_prompt: 'Photo cinématographique dramatique : un grand oiseau bat puissamment des ailes et TIRE DE TOUTES SES FORCES vers le ciel, le corps tendu par l’EFFORT, les plumes ébouriffées par la lutte. Mais une CORDE nouée à sa patte le RETIENT violemment vers le bas — la corde, tendue à se rompre, est tirée AGRESSIVEMENT par un animal au sol (renard) crocs serrés, pattes arc-boutées, qui résiste de tout son poids. Tension extrême, sensation de force bloquée, mouvement empêché. Lumière chaude rasante de fin de journée, poussière soulevée. Sujet clair et lisible, pas de texte.',
          analogy_anim: 'bird_tethered',
          animated_example: {
            subject: 'earth_orbit',
            caption: 'La Terre tourne autour du Soleil et sur elle-même — comme tout ce qui est en action. C’est la même spirale qui explique les galaxies.',
          },
          narration: 'Et pour que ça rentre vraiment, imagine un truc tout simple. Un oiseau qui s’envole… mais un animal lui tient la patte. Il a beau battre des ailes, il ne peut pas filer droit, tu vois ? Eh bien c’est exactement ça : la course du temps, ralentie par l’espace. Et le plus fou, c’est que cette spirale, elle explique pourquoi tout tourne. La Terre autour du Soleil, et sur elle-même. Pareil pour les galaxies. Le temps est courbé par l’espace… et c’est de là que naît la spirale.',
        },
        // 6) TRANSITION
        {
          type: 'transition',
          narration: 'Maintenant qu’on tient la spirale, on peut comprendre la gravité autrement…',
        },
      ],
      transition_next: 'Maintenant qu’on tient la spirale, on peut comprendre la gravité autrement…',
    },
  ],
};
