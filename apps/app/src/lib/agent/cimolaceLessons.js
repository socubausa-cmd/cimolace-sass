/**
 * CIMOLACE_LESSONS — cours SUR-MESURE que le Précepteur enseigne DANS l'assistant Cimolace.
 *
 * Un cours par moteur (school = LIRI École, medos = MedOS, shop = Virtuel Mbolo). Le visiteur
 * n'apprend plus la physique de démo mais CIMOLACE lui-même (secteur « formation »/évangéliste).
 *
 * Contrat (cf. precepteurCanonicalCourse.js + CAHIER_DE_CHARGE_PRECEPTEUR) : { title, concepts:[
 *   { title, objectif?, scenes:[ lecon{title,board_text,narration} | atelier{...} | transition{narration} ] } ] }.
 * VOLONTAIREMENT SANS croquis (géométrie) ni image_analogie (image gen auth) → zéro risque de
 * crash ; `conformCourseSync` ajoute ensuite les dispositifs déterministes (surlignage/encadré/
 * résumé). Voix « Sherpas » (tu/on, accroche, énergie, payoff). Atelier nominatif ({{student_name}}).
 */

const school = {
  title: 'Comment marche ton école en direct',
  language: 'fr',
  level: 'initiation',
  concepts: [
    {
      title: 'Le direct, le cœur de LIRI École',
      objectif: 'Comprendre comment on enseigne en direct et pourquoi rien ne se perd.',
      scenes: [
        {
          type: 'lecon',
          title: 'Ta salle de classe, en ligne',
          board_text: "LIRI École = ta classe en direct (live HD) + un tableau intelligent qui dessine pour toi. À ta marque, ton nom, tes couleurs.",
          narration: "Alors, imagine ta salle de classe — mais en ligne. Avec LIRI École, tu fais cours en direct, en vidéo HD, et tu as un tableau intelligent qui dessine pendant que tu parles. Et le plus important : c'est à TA marque. Ton nom, tes couleurs. Tes élèves entrent chez toi, pas chez nous.",
        },
        {
          type: 'lecon',
          title: 'Rien ne se perd',
          board_text: "Chaque live est enregistré : il devient un replay. L'élève absent rattrape, l'élève présent révise. Le cours vit après le cours.",
          narration: "Et là, écoute bien, parce que c'est le truc qui change tout : chaque direct est enregistré. Il devient un replay. Donc l'élève qui était absent ? Il rattrape. Celui qui veut réviser ? Il revoit. Le cours ne meurt pas quand tu raccroches — il continue de travailler pour toi.",
        },
        {
          type: 'atelier',
          address: '{{student_name}}',
          question: "Ton cours en direct est terminé. Un élève était absent ce soir-là — qu'est-ce qui va lui permettre de suivre quand même ?",
          hint: "Pense à ce qui reste APRÈS le direct…",
          expected_answers: ['replay', 'rejouer', 'enregistrement', 'enregistré', 'revoir', 'rattraper', 'la vidéo', 'reprendre'],
          expected_errors: ['rien', 'il rate', 'recommencer le cours', 'refaire le live', 'perdu'],
          ack_variants: {
            ok: ['Exactement.', "C'est ça.", 'Voilà, tu as tout compris.', 'Bien vu.'],
            partial: ['Tu tiens le bon fil…', 'Presque — dis-le autrement.', 'Bonne direction.'],
            wrong: ['Pas tout à fait.', 'Non — souviens-toi : rien ne se perd.', "Regarde : le direct laisse une trace."],
          },
          reveal_narration: "Eh oui : le REPLAY. L'enregistrement du direct. Ton élève absent le regarde quand il veut, autant de fois qu'il veut. Avec LIRI École, tu enseignes UNE fois — et le cours continue de servir, encore et encore. C'est ça, une vraie école en ligne.",
        },
        { type: 'transition', narration: "Voilà l'essentiel de ton école. Prêt à lancer la tienne ?" },
      ],
    },
  ],
};

const medos = {
  title: 'Une téléconsultation, de A à Z',
  language: 'fr',
  level: 'initiation',
  concepts: [
    {
      title: 'MedOS, ton cabinet en ligne',
      objectif: 'Comprendre le déroulé d\'une téléconsultation et le rôle de l\'IA scribe.',
      scenes: [
        {
          type: 'lecon',
          title: 'Le dossier, puis le direct',
          board_text: "MedOS = le dossier de ton patient d'un coup d'œil, puis la téléconsultation vidéo sécurisée (RGPD), à la marque de ta clinique.",
          narration: "On y va. Ton patient prend rendez-vous en ligne. Toi, tu ouvres son dossier — tout son historique, d'un seul coup d'œil. Et tu lances la téléconsultation : une vidéo sécurisée, conforme au RGPD, aux couleurs de ta clinique. Simple, propre, professionnel.",
        },
        {
          type: 'lecon',
          title: "Tu parles, l'IA écrit",
          board_text: "Pendant que tu parles au patient, un scribe IA rédige la note SOAP à ta place. Tu regardes ton patient, pas ton clavier.",
          narration: "Et voici le moment magique : pendant que tu parles à ton patient, tu ne touches pas au clavier. Un scribe — une IA — écrit la note médicale pour toi, en direct. La fameuse note SOAP. Toi, tu regardes ton patient dans les yeux. La paperasse s'écrit toute seule.",
        },
        {
          type: 'atelier',
          address: '{{student_name}}',
          question: "Pendant ta téléconsultation, tu es concentré sur ton patient. Qui rédige la note médicale à ta place ?",
          hint: "Ce n'est plus toi qui tapes…",
          expected_answers: ["l'ia", 'ia', 'le scribe', 'scribe', 'intelligence artificielle', 'assistant', 'medos', "l'assistant"],
          expected_errors: ['moi', 'la secrétaire', 'personne', 'le patient', 'je tape'],
          ack_variants: {
            ok: ['Exactement.', "C'est ça.", 'Parfait.', 'Tu as compris.'],
            partial: ['Presque — qui écrit à ta place ?', 'Tu y es presque.', 'Bonne piste.'],
            wrong: ['Pas tout à fait.', "Non — tu ne touches plus au clavier.", 'Souviens-toi : ça s\'écrit tout seul.'],
          },
          reveal_narration: "Voilà : le scribe IA. Il écoute, il comprend, il rédige la note SOAP pendant que tu soignes. Tu gagnes un temps fou, et surtout — tu redeviens présent pour ton patient. C'est ça, MedOS : la technique disparaît, le soin revient.",
        },
        { type: 'transition', narration: "Voilà ton cabinet en ligne. On met en place ta clinique ?" },
      ],
    },
  ],
};

const shop = {
  title: 'Vendre en ligne, même sans carte bancaire',
  language: 'fr',
  level: 'initiation',
  concepts: [
    {
      title: 'Ta boutique Mbolo, de la vitrine au paiement',
      objectif: 'Comprendre comment on vend en ligne en Afrique, mobile money compris.',
      scenes: [
        {
          type: 'lecon',
          title: 'Ta vitrine, ton lien',
          board_text: "Virtuel Mbolo = ton catalogue à ta marque + un lien à partager. Ajoute un produit (photo, prix, stock) en une minute.",
          narration: "Ta boutique, on la construit ensemble. Tu ajoutes un produit : une photo, un prix, ton stock — en une minute, c'est en ligne. Tu obtiens une vitrine à TA marque, avec un lien tout prêt. Ce lien, tu le partages sur WhatsApp, sur tes réseaux — et tu vends.",
        },
        {
          type: 'lecon',
          title: 'Encaisser partout',
          board_text: "Le client paie par carte OU par mobile money (Airtel, MTN… en XAF/XOF). Zéro commission sur tes ventes.",
          narration: "Et le nerf de la guerre : encaisser. Ton client paie par carte s'il en a une. Mais surtout — surtout — il peut payer par mobile money. Airtel, MTN, en francs CFA. Comme il a l'habitude. Et toi ? Zéro commission sur tes ventes. Ce que tu vends, tu le gardes.",
        },
        {
          type: 'atelier',
          address: '{{student_name}}',
          question: "Un client au Gabon veut t'acheter un produit, mais il n'a pas de carte bancaire. Comment est-ce qu'il te paie ?",
          hint: "Avec quoi paie-t-on tous les jours, sans banque ?",
          expected_answers: ['mobile money', 'mobile', 'airtel', 'mtn', 'momo', 'téléphone', 'orange money', 'moov'],
          expected_errors: ['carte', 'virement', 'espèces', 'il ne peut pas', 'chèque', 'paypal'],
          ack_variants: {
            ok: ['Exactement.', "C'est ça.", 'Parfait.', 'Voilà.'],
            partial: ['Tu y es presque…', 'Presque — dis-le autrement.', 'Bonne direction.'],
            wrong: ['Pas tout à fait.', 'Non — pense à son téléphone.', 'Souviens-toi : sans banque, on paie quand même.'],
          },
          reveal_narration: "Par MOBILE MONEY, bien sûr. Airtel, MTN, depuis son téléphone, en un instant. C'est comme ça que l'Afrique paie — et ta boutique Mbolo l'encaisse directement. Tu ne rates plus une seule vente parce qu'un client n'a pas de carte. Ça, c'est vendre pour de vrai.",
        },
        { type: 'transition', narration: "Voilà ta boutique. On la lance ?" },
      ],
    },
  ],
};

export const CIMOLACE_LESSONS = { school, medos, shop };
