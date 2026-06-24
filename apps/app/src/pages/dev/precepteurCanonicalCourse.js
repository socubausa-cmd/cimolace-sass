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
          narration: 'Le temps est l’information potentielle qui tend vers la différenciation. Sa seule tendance, c’est de continuer. Or une information quantique est un minimum d’état d’action : le temps ne peut donc porter qu’un seul bit, « continuer ».',
        },
        {
          type: 'lecon',
          title: 'Mais le temps n’est pas seul',
          board_text: 'Être, c’est le potentiel d’être différent de ce que l’on n’est pas. Le temps ne peut donc exister seul : il existe une information contraire — l’espace — dont la tendance unique est d’unifier, de revenir. Deux volontés opposées : il en naît une troisième, l’énergie, le différentiel accordé.',
          narration: 'Mais le temps n’est pas seul. Être, c’est le potentiel d’être différent de ce que l’on n’est pas. Il existe donc une information contraire : l’espace, dont la tendance est d’unifier, de revenir. Deux volontés opposées — et il en naît une troisième : l’énergie, le différentiel accordé.',
        },
        // 2) AMORCE → CROQUIS
        {
          type: 'amorce_croquis',
          narration: 'Pour bien voir ça, faisons un croquis.',
        },
        // 3) CROQUIS 1 — la flèche du temps et la contrainte
        {
          type: 'croquis',
          narration: 'Voici la flèche du temps : ce vecteur bleu qui veut continuer, filer vers l’extérieur. Mais derrière, une force de contrainte lui impose le retour : c’est l’espace.',
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
          reveal_narration: 'En vérité, la flèche doit se courber. C’est de la physique de contrainte : au lieu d’une trajectoire rectiligne, elle suit une géodésique — elle spirale autour du point qui lui impose la contrainte. Ce point, on l’appelle le point de gravité : la gravité est l’action de l’espace qui exige le retour à l’unité. Le temps se transforme alors de flèche en spirale. Voilà pourquoi le mouvement rectiligne n’existe pas : tout ce qui est en action spirale autour d’un point.',
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
          narration: 'Pour faire asseoir l’idée : imagine un oiseau qui s’envole, mais un animal lui tient la patte. Il ne peut pas filer droit. C’est la course du temps, ralentie par l’espace. Et cette spirale explique même pourquoi tout tourne : la Terre autour du Soleil et sur elle-même, et c’est la même chose pour les galaxies. Le temps est courbé par l’espace, et la spirale en naît.',
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
