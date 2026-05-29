/**
 * Source unique (web + mobile LIRI) : textes alignés sur les pages publiques.
 * Importée par `AboutProrascience`, `TeamPage`, `IsnaProPage`, `ContactPage`, `CoachingPage`, etc.
 * et par la vitrine immersive mobile.
 */

import { resolveVitrineContactEmailSync } from '@/lib/vitrineContactEmail';
import { isnaTenantConfig } from '@/tenants/isna/tenant.config';

const SCHOOL = isnaTenantConfig.branding.name;
const SITE_KICKER = `${SCHOOL} · LIRI`;

/** @see AboutProrascience.jsx (const + hero) */
export const WEB_ABOUT = {
  hero: {
    badge: 'Institutionnel',
    titleLine1: 'ISNA',
    titleGold: 'LIRI',
    subtitle: 'Initiation aux Sciences Nocturnes Africaines',
    quote: "Intégrer la Science et la Spiritualité pour une Transformation Authentique.",
  },
  stats: [
    { label: 'Étudiants formés', value: '2500+' },
    { label: 'Modules créés', value: '100+' },
    { label: 'Transmetteurs', value: '50+' },
    { label: 'Pays représentés', value: '30+' },
    { label: 'Satisfaction', value: '95%' },
  ],
  sectionComprendre: {
    kicker: SITE_KICKER,
    title: 'Comprenez enfin ce que vous pratiquez',
    lead: "Vous n'etes pas ici pour reproduire des gestes. Vous etes ici pour comprendre, maitriser, puis evoluer.",
  },
  practiceItems: [
    "fait une libation",
    "utilise un talisman",
    "pratique un rituel",
    "prononce une priere",
  ],
  rootQuestions: ['pourquoi cela fonctionne ?', "pourquoi l'eau est utilisee ?", 'quelle est la logique invisible ?'],
  realityItems: ['les pratiques sont reproduites', 'les traditions sont repetees', 'mais la comprehension manque'],
  consequences: ['mecanique', 'limitee', 'aveugle'],
  problem: {
    title: 'Le probleme',
    text: "On vous a appris quoi faire, mais jamais pourquoi le faire.",
    highlight: `${SITE_KICKER} vous redonne la comprehension.`,
  },
  methodPath: ['Comprendre', 'Pratiquer', 'Exercer', 'Evoluer'],
  methodColumns: [
    { title: 'Comprendre (Cursus)', items: ['lois invisibles', 'metaphysique', 'energie', 'structure des rituels'], foot: 'Formation continue' },
    { title: 'Pratiquer (Modules)', items: ['libation', 'talisman', 'protection', 'guerison'], foot: 'Formation a la carte' },
    { title: 'Exercer (Coaching)', items: ['apprendre le metier', 'accompagner', 'diagnostiquer'], foot: 'Reserve aux futurs praticiens' },
    { title: 'Evoluer (Special)', items: ['techniques avancees', 'secrets spirituels', 'cas complexes'], foot: 'Acces libre / evenements' },
  ],
  targetAudience: [
    "vous cherchez a comprendre",
    'vous voulez evoluer',
    'vous voulez maitriser',
    "vous voulez pratiquer intelligemment",
  ],
  gains: ['clarte mentale', 'maitrise reelle', 'puissance pratique', 'comprehension profonde'],
  closing: {
    quote: "La pratique sans comprehension est aveugle. La comprehension sans pratique est inutile.",
    title: "Ce n'est pas une formation. C'est une transformation.",
  },
  mission: {
    title: 'Notre Mission & Vision',
    lead: "L'ISNA s'engage a restaurer la dignite intellectuelle et spirituelle de l'Homme par la connaissance.",
    values: [
      {
        title: 'Integrite Scientifique',
        desc: "Une approche rigoureuse qui ne sacrifie jamais la verite sur l'autel du dogme ou de la facilite.",
      },
      { title: 'Authenticite Spirituelle', desc: "Un retour aux sources de la tradition primordiale, vecu dans le cœur et non seulement dans l'intellect." },
      { title: 'Responsabilite Ethique', desc: "La connaissance n'est rien sans la conscience de ses consequences sur soi et sur le monde." },
      { title: 'Transformation Consciente', desc: "Le but ultime n'est pas l'accumulation de savoir, mais l'elevation vibratoire de l'etre." },
    ],
  },
  whatIs: {
    kicker: 'Fondamentaux',
    title: "Qu'est-ce que la PRORASCIENCE ?",
    lead: 'Une plongee au cœur de la science des sciences, la ou la sagesse ancestrale rencontre la rigueur moderne.',
  },
  definitionSynthese:
    "La PRORASCIENCE est l'etude systematique, rationnelle et verifiable des realites visibles et invisibles. C'est la science qui unifie la physique (le monde materiel) et la metaphysique (le monde spirituel) en une seule structure coherente de connaissance.",
  pillars: [
    {
      title: 'La Raison',
      points: [
        "Logique deductive et inductive",
        'Pensee critique sans tabou',
        "Rejet du dogmatisme aveugle",
        "Structuration mentale rigoureuse",
      ],
    },
    {
      title: 'La Science',
      points: [
        "Methode experimentale",
        'Observation des lois universelles',
        'Repetabilite des resultats',
        'Modelisation mathematique et geometrique',
      ],
    },
    {
      title: 'Savoirs Africains',
      points: [
        'Sagesse ancestrale (Maat)',
        'Cosmogonie totemique',
        'Technologies spirituelles eprouvees',
        "Vision holistique de l'Univers",
      ],
    },
  ],
  notProrascience: [
    'Une Religion',
    'Une Secte',
    'De la Magie Noire',
    'Du Syncretisme',
    'Du New Age',
    'Une Croyance Aveugle',
  ],
  notProrascienceKey:
    "Point Cle : Elle ne demande jamais de \"croire\", mais toujours de \"comprendre\" et de \"verifier\".",
  studyDomains: [
    { title: "La Vie & l'Origine", definition: "Etude de la source de l'existence.", study: "Cosmogenese, apparition de la matiere.", application: "Comprendre son but sur Terre." },
    { title: "La Mort & l'Apres", definition: "Science de la transition d'etat.", study: "Processus de desincarnation, plans astraux.", application: "Se preparer sereinement a la transition." },
    { title: 'Karma & Causalite', definition: "Loi d'action-reaction universelle.", study: 'Dettes karmiques, liens de cause a effet.', application: "Maitriser son destin et rectifier ses erreurs." },
    { title: 'Reincarnation', definition: "Cycles d'evolution de la conscience.", study: 'Memoire des vies anterieures, evolution.', application: "Comprendre ses talents et epreuves inexpliques." },
    { title: 'Conscience & Esprit', definition: "Anatomie de l'etre immateriel.", study: "Corps subtils, aura, chakras, pensee.", application: "Developper ses facultes mentales et spirituelles." },
    { title: 'Memoire Ancestrale', definition: "Lien avec la lignee et l'heritage.", study: 'ADN spirituel, communication transgenerationnelle.', application: "Guerir les blessures familiales, puiser sa force." },
    { title: 'Rites & Rituels', definition: "Technologie de l'action symbolique.", study: 'Mecanique vibratoire des gestes et paroles.', application: "Agir concretement sur sa realite quotidienne." },
    { title: 'Identite & Culture', definition: "Ancrage dans son paradigme propre.", study: 'Histoire reelle, sociologie africaine.', application: "Retrouver sa dignite et sa puissance creatrice." },
  ],
  motto: 'De la prophetie a la raison, de la raison a la science, la verite se confirme.',
  mottoSteps: [
    { n: '1', title: 'Prophetie', desc: "L'intuition, la vision, le ressenti initial de la verite." },
    { n: '2', title: 'Raison', desc: "L'analyse logique, la structuration, la mise en coherence." },
    { n: '3', title: 'Science', desc: "La demonstration, la preuve, la loi universelle etablie." },
  ],
  methodPro: [
    { title: 'Observation', desc: "Regarder les faits sans filtre emotionnel." },
    { title: 'Modelisation', desc: 'Identifier les lois et structures sous-jacentes.' },
    { title: 'Verification', desc: "Tester par l'experience et la pratique." },
    { title: 'Transmission', desc: 'Enseigner ce qui a ete verifie et maitrise.' },
  ],
  whyScience: {
    title: "Pourquoi parle-t-on de \"Science\" ?",
    lead: "Ce n'est pas un abus de langage. La Prorascience repond aux criteres epistemologiques stricts d'une discipline scientifique, appliquee au domaine spirituel.",
    bullets: [
      "Elle possede un objet d'etude propre (le Reel Total).",
      "Elle utilise une methode rigoureuse et reproductible.",
      "Elle produit des resultats verifiables par l'experience.",
      "Elle evolue et se corrige face aux nouvelles decouvertes.",
    ],
  },
  africa: {
    title: "La Place de l'Afrique",
    lead: "L'Afrique n'est pas seulement un decor, elle est le Berceau. C'est la que l'Homme a vu le jour, et c'est la que la premiere Science a ete codifiee (Egypte antique, Nubie, Kongo).",
    blocks: [
      { label: 'Origine', text: "Source de toute connaissance primordiale." },
      { label: 'Civilisation', text: "Berceau des premieres unites de mesure et du calendrier." },
      { label: "Avenir", text: "L'Afrique redevient le laboratoire de la Renaissance mondiale." },
    ],
  },
};

export const WEB_FONDATEUR = {
  hero: {
    kicker: 'Institutionnel',
    title: 'PRORASCIENCE &\n5e (5ieme) MANIKONGO',
    subtitle: "Le Fondateur de la Prorascience — 5e (5ieme) Manikongo (Badika Jel David)",
    quote: "Une Vie Dediee a la Restauration de la Dignite Intellectuelle et Spirituelle de l'Afrique par la Science Sacree.",
  },
  portraitCaption: '5e Manikongo en posture de transmission rituelle',
  portraitContext:
    "Cette image capture l'essence du mandat du Manikongo: la transformation de la confusion en clarification, la transmission des savoirs ancestraux, et le passage conscient entre les mondes.",
  identity: [
    { title: 'Nom Civil', value: 'Badika Jel David', detail: "Identite juridique et civile, citoyen engage dans la cite et porteur du projet social." },
    { title: 'Titre Institutionnel', value: '5e Manikongo', detail: "Titre coutumier et spirituel herite de l'Ordre Mystique des Manikongo, marquant la 5eme generation de transmission." },
    { title: 'Fonction', value: 'Recteur ISNA', detail: "Fondateur et dirigeant de l'Initiation aux Sciences Nocturnes Africaines (PRORASCIENCE)." },
    { title: 'Positionnement', value: 'Initiateur', detail: "Ni prophete, ni gourou. Un chercheur qui enseigne ce qu'il a verifie par l'experience." },
  ],
  manikongoExplainer: {
    title: 'Comprendre le Titre de "Manikongo"',
    text: "Dans le contexte de la Prorascience, ce titre n'est pas une revendication politique de la royaute Kongo historique. Il designe une charge spirituelle et une responsabilite de garde. Le Manikongo est le \"Maitre du Savoir\" (Mani : Maitre / Kongo : Savoir, Alliance, Chasse). Il est celui qui protege l'integrite de la connaissance sacree pour sa generation.",
  },
};

export const WEB_TEAM = {
  hero: {
    title: 'Les Gardiens du Savoir',
    lead: 'Rencontrez les experts, chercheurs et initie qui portent la vision de la Prorascience et vous guident sur votre chemin.',
  },
  founders: [
    {
      name: 'Pr. Kimbembe',
      role: 'Fondateur & Grand Maitre',
      bio: "Physicien theoricien et initie aux traditions Kongo, il a consacre sa vie a unifier la science moderne et la sagesse ancestrale.",
      image: 'https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=300&h=300&fit=crop',
    },
    {
      name: 'Mme. Diop',
      role: 'Co-Fondatrice & Directrice Pedagogique',
      bio: "Docteur en Sciences de l'Education, elle veille a la rigueur academique et a la transmission pedagogique des savoirs sacres.",
      image: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=300&h=300&fit=crop',
    },
  ],
  professors: [
    { name: 'Pr. Nkosi', module: 'Pratique Rituelle', spec: 'Maitrise des Energies' },
    { name: 'Dr. Diallo', module: 'Strategie', spec: 'Leadership & Vision' },
    { name: 'M. Okafor', module: 'Histoire', spec: 'Civilisations Anciennes' },
    { name: 'Mme. Mensah', module: 'Biologie Quantique', spec: 'Guerison & Vitalite' },
  ],
  cta: {
    title: "Rejoignez l'Equipe",
    text: "Vous etes expert dans votre domaine et souhaitez contribuer a l'eveil des consciences ? Nous sommes toujours a la recherche de nouveaux talents.",
  },
};

/** @see IsnaProPage */
export const WEB_ISNA_PRO = {
  heroPillars: [
    { title: 'Presence immersive', body: "Tu n'assistes plus a un cours. Tu y es." },
    { title: 'Sans frontiere', body: "Peu importe ou tu es. Le savoir vient a toi." },
    { title: 'Guidage intelligent', body: 'IA et accompagnement humain pour progresser.' },
  ],
  futurePedagogy: [
    { title: 'Classe immersive LIRI', desc: "Presence reelle a distance, echanges en direct et experience vivante comme en presentiel." },
    { title: 'Smartboard intelligent', desc: "Les concepts deviennent visibles. Les lois, les mecanismes et les structures cessent d'etre abstraits." },
    { title: 'IA pedagogique', desc: "Reformulation, clarification, assistance et accompagnement pour comprendre au lieu de seulement ecouter." },
    { title: 'Traduction multilingue', desc: 'Cours video, transcription et accompagnement pedagogique accessibles dans plusieurs langues.' },
  ],
  mastery: [
    'La science des rituels',
    'La logique des libations',
    'Les lois ontologiques',
    "Les mecanismes energetiques",
    'La structure du destin',
    "La science des divinites",
    'La puissance de la parole',
    "L'autonomie spirituelle",
  ],
  voices: [
    { name: 'Mina K.', role: 'Eleve ISNA - Canada', quote: "J'ai enfin compris pourquoi je faisais certains actes. Ce n'est plus de l'imitation, c'est de la maitrise." },
    { name: 'Koffi B.', role: 'Transmetteur - France', quote: "La plateforme est claire, vivante, et les cours LIRI changent completement la transmission a distance." },
    { name: 'Aicha N.', role: 'Membre ISNA - Belgique', quote: "Le mix video + IA pedagogique + smartboard me permet d'avancer vite sans rester bloquee sur un concept." },
  ],
};

/** @see MentoringPage (extraits + listes) */
export const WEB_MENTORAT = {
  hero: {
    kicker: 'Mentorat — Cycle Privilegie',
    title: "Le Montorat Spirituel",
    also: "Aussi appele Guardianship ou Mandat de Veille",
    lead: "un service d'assistance spirituelle active et personnelle.",
    line: 'Document officiel — Etabli par le 5eme Manikongo — MK5',
  },
  distinction:
    "Contrairement au coaching (qui forme), le Montorat prend en charge. Le Moniteur spirituel est un Maitre d'Autel qui accepte de placer le beneficiaire sous sa protection vibratoire complete.",
  defineIntro: 'Le Moniteur spirituel accepte de :',
  defineBullets: [
    'Placer le beneficiaire sous sa protection vibratoire',
    'Exercer des rituels en son nom et pour son compte',
    'Interceder aupres des forces spirituelles en faveur du beneficiaire',
    "Surveiller l'espace energetique du beneficiaire en permanence",
    'Detecter et neutraliser les attaques, blocages et infiltrations',
    "Accompagner l'apprentissage sans que le beneficiaire n'ait a tout faire lui-meme",
  ],
  whenTitle: "Quand prend-on un Moniteur ?",
  whenIntro: "Le Montorat s'active dans les situations suivantes :",
  whenCases: [
    "Vous subissez des attaques spirituelles repetees",
    "Vous n'arrivez pas a vous proteger seul(e)",
    'Vous traversez une crise spirituelle profonde',
    "Vous avez besoin d'un diagnostic et d'une prise en charge immediate",
    'Vous souhaitez un accompagnement total pour votre evolution',
    "Vous voulez quelqu'un qui intervient a votre place quand c'est necessaire",
  ],
  typesMentorat: [
    { title: 'Montorat de Protection', desc: "Pose de boucliers, surveillance energetique, neutralisation des menaces." },
    { title: 'Montorat de Guerison', desc: "Interventions therapeutiques, liberations, purifications regulieres." },
    { title: "Montorat d'Elevation", desc: 'Accompagnement initiatique, acceleration karmique, ouverture des voies.' },
  ],
  contractNumbered: [
    "Duree definie : Date de debut, date de fin, possibilite de renouvellement",
    "Objet du mandat : Motif precis de la prise en charge",
    "Engagements du Moniteur : Nature des rituels, frequence d'intervention",
    "Engagements du beneficiaire : Comportement attendu, restrictions eventuelles",
    "Rapport d'evolution : Frequence des bilans partages",
    "Clause de resiliation : Conditions de rupture du contrat",
    "Ceremonie d'activation : Rituel d'ouverture officiel du Montorat",
    "Ceremonie de cloture : Rituel de fermeture et de liberation a terme",
  ],
  preambleObjective:
    "Placer le client « sous protection spirituelle » afin de stabiliser ses dynamiques systemiques. Le mentorat agit comme une structure de soutien temporaire, permettant a l'individu de naviguer a travers des vecteurs de destabilisation metaphysique jusqu'a la restauration complete de sa souverainete et de son autonomie operationnelle.",
  /** @see MentoringPage section C */
  whatMonitorDoes: {
    title: "Ce que fait le Moniteur pour toi",
    intro:
      "Le Moniteur Spirituel est comme un Ganga personnel, un avocat celeste, un bouclier vivant. Il execute pour toi :",
    bullets: [
      "Les prieres et rituels quotidiens que tu n'as pas le temps ou les moyens de faire",
      "La lecture reguliere de ton aura et de ton etat vibratoire",
      "L'activation de ton autel personnel a distance",
      "Les interventions d'urgence lors d'attaques soudaines",
      "Le suivi de ta trajectoire astrale et karmique",
      "La pose et le renouvellement de ta protection spirituelle",
      "L'intercession active aupres des ancetres, guides et forces lumineuses",
      "Le rapport regulier de l'evolution de ton etat spirituel",
    ],
  },
  /** Sous-titres + descriptions — @see MentoringPage Contrat de Montorat (etapes) */
  contractSteps: [
    { title: "Duree definie", description: "Date de debut, date de fin, possibilite de renouvellement" },
    { title: "Objet du mandat", description: "Motif precis de la prise en charge" },
    { title: "Engagements du Moniteur", description: "Nature des rituels, frequence d'intervention" },
    { title: "Engagements du beneficiaire", description: "Comportement attendu, restrictions eventuelles" },
    { title: "Rapport d'evolution", description: "Frequence des bilans partages" },
    { title: "Clause de resiliation", description: "Conditions de rupture du contrat" },
    { title: "Ceremonie d'activation", description: "Rituel d'ouverture officiel du Montorat" },
    { title: "Ceremonie de cloture", description: "Rituel de fermeture et de liberation a terme" },
  ],
  contractHeader: {
    kicker: 'Document Contractuel',
    title: "Contrat de Mentorat et d'Intercession Spirituelle",
    subtitle: "Cadre d'Intervention et de Protection",
  },
};

export const WEB_COACHING = {
  kicker: 'Academie Pro — Cycle Prive',
  title: "Le Coaching Therapeute Spirituel",
  lead: "Formation complete pour pratiquer l'art de l'intervention spirituelle de maniere professionnelle. Ce n'est pas une simple initiation : c'est la transmission d'un metier.",
  line: 'Document officiel — Etabli par le 5eme Manikongo — MK5',
  metierIntro: 'Le therapeute spirituel est un praticien forme a :',
  metierItems: [
    "Recevoir, ecouter, diagnostiquer l'etat des patients spirituels",
    "Differencier un cas psychologique d'un probleme d'ordre esoterique",
    "Executer un traitement (purification, protection, reparation)",
    "Tenir le journal therapeutique et le suivi a long terme",
  ],
};

/** @see MentoringVsCoachingPage (article long) + mobile (intro + 2 blocs) */
export const WEB_COACHING_VS_MENTORAT = {
  pageHero: {
    kicker: 'Article Editorial — Prorascience',
    title: 'Coaching vs Mentorat Spirituel',
    subtitle: 'La Distinction Cruciale que Vous Devez Connaitre',
  },
  intro: [
    "Dans l'economie actuelle de l'immateriel et du developpement de soi, une erreur de categorie fondamentale pollue le discernement des chercheurs de verite : la confusion systemique entre le coaching et le mentorat spirituel. Ce n'est pas une simple querelle semantique ; c'est une distinction operationnelle majeure. Choisir l'un alors que votre situation exige l'autre peut s'averer etre une erreur strategique couteuse pour votre equilibre.",
    "En tant que consultant, j'observe que cette confusion nait d'un manque de clarte sur les objectifs : cherchez-vous a acquerir une competence pour l'avenir ou avez-vous besoin d'une securite immediate ? Cet article se propose de delimiter ces deux fonctions pour vous permettre de naviguer avec une precision chirurgicale dans vos moments de transition.",
  ],
  partCoaching: {
    label: 'Partie I — Le Coaching',
    title: "L'Audit Technique : Le Coaching comme Formation de Praticien",
    paras: [
      "Le coaching spirituel, tel qu'il doit etre rigoureusement entendu, n'est pas un espace de soin personnel. C'est une transmission de protocoles. Selon les enseignements de reference, il est strictement reserve aux futurs professionnels — ceux qui aspirent a devenir les therapeutes et les praticiens de demain.",
      "Dans ce cadre, l'approche est purement pedagogique et structurelle. Le coach ne « sauve » pas son client ; il lui transmet le metier, lui enseigne comment recevoir les malades et comment etablir une grille de lecture des realites invisibles. Il s'agit d'un investissement dans la competence future.",
    ],
    blockquote: "Le coaching est aussi reserve aux futurs professionnels — exemple : transmettre les protocoles pour des interventions spirituelles.",
  },
  cahierSection: {
    h3: "Le « Cahier des Charges » : L'Arsenal du Diagnostic",
    intro:
      "Le coaching se distingue par une precision que l'on pourrait qualifier de protocolaire. Le futur praticien apprend a dresser un veritable cahier des charges du patient, une sorte d'audit technique de l'ame et de son environnement. L'objectif est de cartographier les differents types de blocages et de maitriser les types de methodes d'intervention.",
    leadIndicators: 'Cette formation technique impose la maitrise d\'indicateurs precis :',
    indicators: [
      { key: 'Activity', label: 'Terme astral & poids karmique', desc: 'Analyse du passif metaphysique' },
      { key: 'Target', label: 'Nuage de probabilite', desc: 'Trajectoire hypothetique du destin' },
      { key: 'Eye', label: "Etat de l'aura", desc: 'Temperature atmospherique des lieux' },
    ],
    after:
      "Au-dela du diagnostic, le coaching enseigne la manipulation des outils : la preparation de l'autel du patient, l'organisation d'une seance d'exorcisme, et l'utilisation rigoureuse des recipients et des reliques. C'est un apprentissage de la « techne » spirituelle pour ceux qui veulent pratiquer demain.",
  },
  partMentorat: {
    label: 'Partie II — Le Mentorat',
    title: "Le Sanctuaire de Stabilite : le Mentorat comme Ingenierie d'Intercession",
    paras: [
      "A l'oppose, le service de Mentorat spirituel est fonde sur l'inegalite voulue. L'asymetrie ici n'est pas une faute, mais une condition. Le maitre intercede, il n'enseigne pas a ce stade. Il s'agit d'une relation verticale de protection, ou le guide assume une charge karmique et energetique pour le compte d'un sujet temporairement depasse par les evenements ou les ombres.",
    ],
  },
  mentoratShield: {
    title: "Le Bouclier : Le Mentorat comme Assistance et Protection",
    paras: [
      "Si le coaching est oriente vers l'acquisition d'une autonomie future, le mentorat est une reponse a l'urgence du present. Le mentorat est une assistance spirituelle. Ici, vous ne cherchez pas a apprendre a manier l'epee ; vous cherchez quelqu'un qui tiendra le bouclier pour vous.",
      "Passer sous mentorat, c'est se placer « sous une protection » deliberee. C'est accepter une bequille necessaire lors d'une epreuve ou vos propres forces ne suffisent plus. Le mentor agit pour vous, en votre nom, jusqu'a ce que vous soyez capable de marcher a nouveau par vos propres moyens.",
    ],
    blockquote: "Le mentorat fait que tu puisses avoir un maitre pour te proteger, te defendre, exercer des rituels pour toi.",
  },
  maitreAutel: {
    h3: "Le « Maitre d'Autel » : L'Intercession dans l'Urgence",
    lead:
      "Le mentor devient votre Ganga personnel — un moteur spirituel prive qui veille quand vous dormez et agit quand vous etes epuise. Il assume la fonction de Maitre d'autel, executant les rites et les prieres que la violence du quotidien ou l'accablement ne vous permettent plus de realiser.",
    carrefourNote: "Le recours a cette protection est indispensable dans les carrefours critiques de l'existence :",
    situations: [
      { key: 'Heart', title: 'Mariage', desc: "Encadrer spirituellement l'union et proteger la nouvelle alliance contre les interferences." },
      { key: 'BookOpen', title: 'Examens', desc: "Beneficier d'un « oeil spirituel permanent » qui veille sur votre reussite pendant l'effort intellectuel." },
      { key: 'Swords', title: 'Deces / Deuil', desc: "Interceder en faveur d'une famille dont la force vitale est consumee par le chagrin." },
      { key: 'Zap', title: 'Oppression', desc: "Lorsque les epreuves depassent vos capacites de resistance et qu'une intervention exterieure est la seule issue." },
    ],
  },
  synthese: {
    title: 'Autonomie ou Assistance ?',
    text: "La distinction est desormais absolue : le coaching est un investissement dans la pratique de demain ; le mentorat est une strategie pour survivre et avancer aujourd'hui. Le coach est l'instructeur du futur praticien ; le mentor est le protecteur de l'individu en peril.",
  },
  comparisonRows: [
    ['Nature', 'Transmission de protocoles', 'Assistance et protection active'],
    ['Public', 'Futurs praticiens / therapeutes', 'Toute personne en epreuve'],
    ['Objectif', 'Acquerir un metier spirituel', 'Securiser et stabiliser le present'],
    ['Posture du maitre', 'Instructeur — il enseigne', 'Intercesseur — il agit pour vous'],
    ['Temporalite', 'Investissement pour demain', "Reponse a l'urgence d'aujourd'hui"],
    ['Outils', "Enseigne a manier l'epee", 'Tient le bouclier a votre place'],
    ['Autonomie', "Forme a l'autonomie future", "Accompagne vers l'autonomie retrouvee"],
    ['Autel', "Apprend a dresser l'autel", "Active l'autel en votre nom"],
  ],
  closingReflection: {
    p1: "En tant que consultant, je vous invite a cette reflexion finale : dans la phase de vie que vous traversez actuellement, de quoi avez-vous reellement besoin ?",
    p2: "Est-ce le moment de maitriser les protocoles et de comprendre le « nuage de probabilite », ou avez-vous besoin d'un intercesseur capable de stabiliser votre destin ?",
    p3Before: "Avez-vous aujourd'hui besoin d'",
    p3HighlightCoaching: 'apprendre a manier les outils spirituels',
    p3Between: ", ou avez-vous besoin de quelqu'un pour ",
    p3HighlightMentor: 'tenir le bouclier a votre place',
    p3After: ' ?',
  },
  footer: '© Prorascience — Article editorial — Systeme MK5 / NGOWAZULU / ISNA',
};

const WEB_CONTACT_BASE = {
  hero: { title: 'Contactez-Nous', lead: "Une question sur nos formations ? Besoin d'assistance ? Notre equipe est a votre ecoute." },
  subjects: [
    { value: 'Renseignements', label: 'Renseignements Generaux' },
    { value: 'Admission', label: "Admission & Inscription" },
    { value: 'Technique', label: 'Support Technique' },
    { value: 'Partenariat', label: 'Partenariat & Presse' },
  ],
};

/** Bloc contact avec e-mail résolu (passer `useVitrineContactEmail()` depuis un composant sous provider). */
export function getWebContact(vitrineEmail = resolveVitrineContactEmailSync()) {
  const e = vitrineEmail;
  return {
    ...WEB_CONTACT_BASE,
    info: [
      { title: 'Siege Social', lines: ['Agondje Village', 'Libreville, Gabon'] },
      { title: 'Telephone', lines: ['+33 7 66 52 57 08', 'WhatsApp disponible'] },
      { title: 'Email', lines: [e, e], email: e },
    ],
  };
}

export const WEB_COMMUNAUTE = {
  note: "La page web « Communauté » redirige vers l'inscription : la messagerie et la vie reseau sont dans l'app LIRI apres compte membre.",
};

/** Rétrocompat (imports existants) */
export const VITRINE_ISNA_PRO = {
  pillars: WEB_ISNA_PRO.heroPillars.map((p) => ({ t: p.title, b: p.body })),
  future: WEB_ISNA_PRO.futurePedagogy.map((f) => ({ t: f.title, d: f.desc })),
  mastery: WEB_ISNA_PRO.mastery,
};
