/**
 * Mock generator for the LIRI Masterclass Coach pipeline.
 *
 * Donne un parcours pédagogique complet et démontrable sans dépendance API.
 * Quand la vraie API LIRI Brain est branchée (voir `runtime.js`), ces sorties
 * servent de fallback réaliste si la réponse manque ou échoue.
 *
 * Le contenu utilise la démo "somnolence" de la spec LIRI Masterclass Coach,
 * mais les fonctions sont génériques : elles s'adaptent au texte reçu pour
 * que l'aperçu reste cohérent dans tous les cas.
 */

/* eslint-disable no-restricted-globals */

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const SOMNOLENCE_FALLBACK = `pour reussire une protection sprituel il faut transferer la conscience dans le monde sprituel et la porte qui conduit dans ce monde c'est la somnolence...`;

function looksLikeSomnolence(text) {
  const t = String(text || '').toLowerCase();
  return ['somnolence', 'firmament', 'katiokeni', 'monde du milieu'].some((k) => t.includes(k));
}

function lineCountOf(text) {
  if (!text) return 0;
  return String(text).split(/\r?\n|\.\s+/).filter(Boolean).length;
}

function pickFirstSentences(text, count = 3) {
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  return cleaned
    .split(/(?<=[.!?])\s+/)
    .slice(0, count)
    .filter(Boolean);
}

/* ─────────────────────────── ANALYSE GLOBALE ─────────────────────────── */

export async function mockGenerateAnalysis(rawText, { delayMs = 900 } = {}) {
  await wait(delayMs);

  if (looksLikeSomnolence(rawText)) {
    return {
      global_subject:
        "La somnolence comme porte initiatique vers le monde spirituel, le monde du milieu, le firmament intérieur et la protection.",
      intention:
        "Comprendre, reconnaître et maîtriser l'état intermédiaire entre éveil et sommeil pour accéder au monde spirituel.",
      audience: "Croyants, disciples, formateurs et chercheurs spirituels.",
      difficulty: "intermediate",
      difficulty_score: 0.7,
      estimated_total_duration: "107 min",
      central_themes: [
        "Transfert de conscience",
        "État intermédiaire (somnolence)",
        "Firmament intérieur / Katiokeni",
        "Cœur comme centre spirituel",
        "Chambre intérieure et prière",
        "Deux sommeils (mort symbolique vs repos)",
        "Nuit, conseil et consolateur",
        "Eau, sang et esprit",
      ],
      global_revelations: [
        "La protection spirituelle exige un transfert de conscience.",
        "La somnolence est la porte d'accès au monde spirituel.",
        "La somnolence est un état de superposition entre éveil et sommeil.",
        "Le firmament n'est pas seulement cosmique, mais un état intérieur intermédiaire.",
        "Cœur, chambre, firmament et Katiokeni renvoient au même centre.",
        "Le sommeil profond ferme la conscience ; le sommeil léger l'ouvre.",
        "La nuit porte conseil parce qu'elle ouvre l'état intermédiaire.",
        "Eau, sang et esprit forment une structure : âme, chair, milieu.",
        "Le monde des eaux renvoie à la mémoire de l'âme et des ancêtres.",
        "L'ordre mystique d'ouverture du monde spirituel est l'état de somnolence.",
      ],
      analysis_steps: [
        { label: "Compréhension globale du sujet", done: true },
        { label: "Extraction des idées principales", done: true },
        { label: "Identification des blocs de sens", done: true },
        { label: "Détection des révélations", done: true },
        { label: "Évaluation de la pertinence pédagogique", done: true },
      ],
    };
  }

  const sentences = pickFirstSentences(rawText, 5);
  return {
    global_subject: sentences[0] || "Sujet à préciser à partir du texte source.",
    intention: "Transmettre le contenu sous forme de masterclass structurée et participative.",
    audience: "Apprenants curieux, formateurs, créateurs de contenu pédagogique.",
    difficulty: "intermediate",
    difficulty_score: 0.55,
    estimated_total_duration: `${Math.max(40, Math.min(120, lineCountOf(rawText) * 4))} min`,
    central_themes: sentences.slice(0, 4).map((s) => s.slice(0, 80)),
    global_revelations: sentences.slice(0, 5).map((s) => s.replace(/[.!?]$/, "")).filter(Boolean),
    analysis_steps: [
      { label: "Compréhension globale du sujet", done: true },
      { label: "Extraction des idées principales", done: true },
      { label: "Identification des blocs de sens", done: true },
      { label: "Détection des révélations", done: true },
      { label: "Évaluation de la pertinence pédagogique", done: true },
    ],
  };
}

/* ─────────────────────────── BLOCS / IDÉES ─────────────────────────── */

const SOMNOLENCE_BLOCKS = [
  {
    id: 1,
    lines_label: "Lignes 1 → 2",
    from_line: 1,
    to_line: 2,
    title: "Protection spirituelle et transfert de conscience",
    central_idea: "La protection commence par un déplacement intérieur de la conscience.",
    duration_minutes: 8,
    revelations: [
      "La formule seule ne suffit pas.",
      "La conscience doit entrer dans le champ spirituel.",
    ],
    tensions: ["Parole extérieure vs état intérieur"],
    keywords: ["protection", "conscience", "spirituel"],
    type: "doctrine",
    difficulty: "medium",
  },
  {
    id: 2,
    lines_label: "Lignes 2 → 6",
    from_line: 2,
    to_line: 6,
    title: "Définition de la somnolence",
    central_idea: "La somnolence est un état intermédiaire entre éveil et sommeil.",
    duration_minutes: 15,
    revelations: ["L'être capte deux mondes.", "La somnolence est une superposition."],
    tensions: ["éveil vs sommeil", "conscience vs inconscience"],
    keywords: ["somnolence", "rêve", "éveil"],
    type: "definition",
    difficulty: "medium",
  },
  {
    id: 3,
    lines_label: "Lignes 6 → 9",
    from_line: 6,
    to_line: 9,
    title: "Firmament, monde du milieu et Katiokeni",
    central_idea: "Le monde du milieu est un lieu intérieur de passage.",
    duration_minutes: 15,
    revelations: ["Le firmament peut être intérieur.", "Le Katiokeni est le milieu."],
    tensions: ["lieu physique vs état intérieur"],
    keywords: ["firmament", "Katiokeni", "milieu"],
    type: "revelation",
    difficulty: "high",
  },
  {
    id: 4,
    lines_label: "Lignes 9 → 15",
    from_line: 9,
    to_line: 15,
    title: "Le cœur comme centre spirituel",
    central_idea: "Le cœur est le symbole du centre intérieur où l'esprit se manifeste.",
    duration_minutes: 12,
    revelations: ["Le cœur n'est pas seulement émotionnel.", "Dieu sonde le centre intérieur."],
    tensions: ["cœur sentimental vs cœur métaphysique"],
    keywords: ["cœur", "centre", "intérieur"],
    type: "doctrine",
    difficulty: "medium",
  },
  {
    id: 5,
    lines_label: "Lignes 15 → 24",
    from_line: 15,
    to_line: 24,
    title: "La chambre et la prière intérieure",
    central_idea: "Rentrer dans sa chambre signifie entrer dans la somnolence et fermer la porte au monde éveillé.",
    duration_minutes: 15,
    revelations: ["La chambre est un code spirituel.", "La prière véritable est une bascule intérieure."],
    tensions: ["lieu physique vs état mental"],
    keywords: ["chambre", "prière", "intérieur"],
    type: "doctrine",
    difficulty: "medium",
  },
  {
    id: 6,
    lines_label: "Lignes 24 → 32",
    from_line: 24,
    to_line: 32,
    title: "Les deux sommeils",
    central_idea: "Tous les sommeils ne donnent pas le même accès spirituel.",
    duration_minutes: 12,
    revelations: ["Le sommeil léger est plus initiatique que le profond.", "Le profond ferme la conscience."],
    tensions: ["sommeil profond vs sommeil léger"],
    keywords: ["sommeil", "mort", "repos"],
    type: "definition",
    difficulty: "medium",
  },
  {
    id: 7,
    lines_label: "Lignes 32 → 44",
    from_line: 32,
    to_line: 44,
    title: "La nuit porte conseil",
    central_idea: "La nuit est le temps de réception de la sagesse, par le consolateur.",
    duration_minutes: 15,
    revelations: ["Le conseil vient du monde du milieu.", "Le consolateur est l'esprit de la nuit."],
    tensions: ["jour vs nuit", "agir vs recevoir"],
    keywords: ["nuit", "conseil", "consolateur"],
    type: "revelation",
    difficulty: "high",
  },
  {
    id: 8,
    lines_label: "Lignes 44 → 51",
    from_line: 44,
    to_line: 51,
    title: "Eau, sang et esprit",
    central_idea: "L'esprit est le médiateur entre l'âme et la chair.",
    duration_minutes: 12,
    revelations: ["Le troisième est le médiateur.", "Eau = âme, sang = chair, esprit = milieu."],
    tensions: ["matière vs esprit", "deux vs trois"],
    keywords: ["eau", "sang", "esprit"],
    type: "analogy",
    difficulty: "high",
  },
  {
    id: 9,
    lines_label: "Lignes 51 → fin",
    from_line: 51,
    to_line: 60,
    title: "Monde des eaux et ancêtres",
    central_idea: "Accéder au monde du milieu permet d'accéder aux eaux profondes de l'âme.",
    duration_minutes: 10,
    revelations: ["La somnolence ouvre la mémoire ancestrale.", "Les eaux sont le monde des ancêtres."],
    tensions: ["surface vs profondeur"],
    keywords: ["eaux", "ancêtres", "âme"],
    type: "revelation",
    difficulty: "high",
  },
];

export async function mockGenerateBlocks(rawText, analysis, { delayMs = 700 } = {}) {
  await wait(delayMs);
  if (looksLikeSomnolence(rawText)) {
    return SOMNOLENCE_BLOCKS;
  }

  const sentences = pickFirstSentences(rawText, 9);
  if (!sentences.length) return [];
  return sentences.map((s, i) => ({
    id: i + 1,
    lines_label: `Bloc ${i + 1}`,
    from_line: i * 4 + 1,
    to_line: (i + 1) * 4,
    title: s.slice(0, 80),
    central_idea: s,
    duration_minutes: 10 + (i % 3) * 2,
    revelations: [s.slice(0, 60)],
    tensions: ["à expliciter par LIRI"],
    keywords: s
      .toLowerCase()
      .replace(/[^a-zàâäéèêëïîôöùûüç ]/gi, "")
      .split(/\s+/)
      .filter((w) => w.length > 4)
      .slice(0, 4),
    type: "definition",
    difficulty: "medium",
  }));
}

/* ─────────────────────────── CHAPITRES ─────────────────────────── */

const SOMNOLENCE_CHAPTERS = [
  {
    chapter_id: 1,
    title: "La protection commence par le transfert de conscience",
    source_segments: [1],
    objective: "Comprendre que la protection spirituelle dépend d'un état intérieur, pas seulement d'un geste extérieur.",
    skill_to_acquire: "Savoir identifier l'état intérieur nécessaire avant une pratique spirituelle.",
    knowledge_to_transmit: "Une protection spirituelle fonctionne lorsque la conscience entre dans le champ spirituel.",
    main_revelation: "La protection ne commence pas par la parole. Elle commence par le déplacement de la conscience.",
    recommended_duration_minutes: 20,
    difficulty: "medium",
  },
  {
    chapter_id: 2,
    title: "La somnolence, porte du monde spirituel",
    source_segments: [2],
    objective: "Comprendre la somnolence comme état intermédiaire entre veille et sommeil.",
    skill_to_acquire: "Savoir reconnaître l'état de somnolence sans le confondre avec le sommeil profond.",
    knowledge_to_transmit: "La somnolence est un état de superposition où l'être capte le monde éveillé et le monde du rêve.",
    main_revelation: "La somnolence est le passage lui-même.",
    recommended_duration_minutes: 25,
    difficulty: "medium",
  },
  {
    chapter_id: 3,
    title: "Le monde du milieu : firmament et Katiokeni",
    source_segments: [3],
    objective: "Comprendre que le monde spirituel accessible par la somnolence est un monde intermédiaire.",
    skill_to_acquire: "Savoir expliquer le firmament comme état intérieur de séparation et de passage.",
    knowledge_to_transmit: "Le Katiokeni est le monde du milieu : ni ici, ni là-bas, mais entre les deux.",
    main_revelation: "Le firmament peut être compris comme l'état intérieur qui sépare et relie.",
    recommended_duration_minutes: 25,
    difficulty: "high",
  },
  {
    chapter_id: 4,
    title: "Le cœur comme centre spirituel",
    source_segments: [4],
    objective: "Voir le cœur comme symbole du centre intérieur, pas seulement organe émotionnel.",
    skill_to_acquire: "Reconnaître quand un texte parle du cœur au sens métaphysique.",
    knowledge_to_transmit: "Le cœur, dans la tradition, désigne souvent le lieu intérieur où Dieu sonde.",
    main_revelation: "Le cœur métaphysique est le même lieu que le firmament intérieur.",
    recommended_duration_minutes: 12,
    difficulty: "medium",
  },
  {
    chapter_id: 5,
    title: "La chambre et la prière intérieure",
    source_segments: [5],
    objective: "Lire la « chambre » comme code spirituel d'entrée en somnolence.",
    skill_to_acquire: "Savoir préparer son état avant la prière.",
    knowledge_to_transmit: "Entrer dans la chambre = se déconnecter du monde éveillé pour basculer intérieurement.",
    main_revelation: "La chambre est un code, pas un lieu physique seul.",
    recommended_duration_minutes: 15,
    difficulty: "medium",
  },
  {
    chapter_id: 6,
    title: "Les deux sommeils",
    source_segments: [6],
    objective: "Distinguer sommeil profond (mort symbolique) et sommeil léger (repos initiatique).",
    skill_to_acquire: "Identifier l'état de sommeil propice à la rencontre du divin.",
    knowledge_to_transmit: "Le sommeil léger est la zone d'accès, de réception et de conseil.",
    main_revelation: "Le sommeil léger est plus initiatique que le sommeil profond.",
    recommended_duration_minutes: 12,
    difficulty: "medium",
  },
  {
    chapter_id: 7,
    title: "La nuit porte conseil",
    source_segments: [7],
    objective: "Comprendre que la nuit est le moment d'ouverture à la sagesse.",
    skill_to_acquire: "Savoir utiliser la nuit comme cadre de réception spirituelle.",
    knowledge_to_transmit: "Le conseiller / consolateur est l'esprit de la nuit, du monde du milieu.",
    main_revelation: "Le conseil ne vient pas du jour, il vient de la nuit.",
    recommended_duration_minutes: 15,
    difficulty: "high",
  },
  {
    chapter_id: 8,
    title: "Eau, sang et esprit",
    source_segments: [8, 9],
    objective: "Lire la triade eau/sang/esprit comme âme/chair/milieu.",
    skill_to_acquire: "Reconnaître la structure ternaire du témoignage intérieur.",
    knowledge_to_transmit: "L'esprit est le troisième témoin entre l'âme (eau) et la chair (sang).",
    main_revelation: "Le médiateur structure tout passage spirituel.",
    recommended_duration_minutes: 18,
    difficulty: "high",
  },
];

export async function mockGenerateChapters(rawText, blocks, { delayMs = 700 } = {}) {
  await wait(delayMs);
  if (looksLikeSomnolence(rawText)) {
    return SOMNOLENCE_CHAPTERS;
  }
  return (blocks || []).slice(0, 8).map((b, i) => ({
    chapter_id: i + 1,
    title: b.title,
    source_segments: [b.id],
    objective: `Transmettre l'idée centrale du bloc ${b.id}.`,
    skill_to_acquire: `Reconnaître et appliquer : ${b.title}.`,
    knowledge_to_transmit: b.central_idea,
    main_revelation: (b.revelations && b.revelations[0]) || b.central_idea,
    recommended_duration_minutes: b.duration_minutes || 12,
    difficulty: b.difficulty || "medium",
  }));
}

/* ─────────────────────────── PÉDAGOGIE COMPLÈTE ─────────────────────────── */

const SOMNOLENCE_PEDAGOGY = {
  1: {
    real_life_situation:
      "Une personne récite une prière de protection tout en pensant à ses problèmes, son téléphone, son travail, ses peurs. Elle parle, mais sa conscience n'est pas entrée dans le lieu de la protection.",
    pedagogical_tension:
      "Peut-on être spirituellement protégé si la conscience reste entièrement attachée au monde extérieur ?",
    thought_experiment:
      "Deux personnes disent la même prière : la première récite mécaniquement, la seconde entre dans un état de présence profonde. Est-ce vraiment la même prière ?",
    revelation_moment:
      "La protection ne commence pas par la parole. Elle commence par le déplacement de la conscience.",
    simple_lesson: "Pour être protégé spirituellement, il faut d'abord entrer dans le monde où la protection agit.",
    deep_lesson:
      "Une parole spirituelle agit dans un champ spirituel. Si la conscience reste enfermée dans l'agitation extérieure, la parole reste faible. Le premier acte est donc le transfert de conscience : quitter l'état ordinaire pour entrer dans l'état intérieur.",
    analogies: [
      { type: "concrete", content: "Comme une radio : si elle n'est pas sur la bonne fréquence, elle ne reçoit pas le signal." },
      { type: "concrete", content: "Comme une clé : elle n'ouvre que lorsqu'elle entre dans la bonne serrure." },
      { type: "concrete", content: "Comme un téléphone sans réseau : il peut être allumé, mais ne communique pas." },
    ],
    examples: [
      { type: "real_life", content: "Une personne prie mais reste distraite : elle parle sans entrer." },
      { type: "real_life", content: "Une personne s'apaise d'abord, puis prie : elle commence à se connecter." },
      { type: "spiritual_or_conceptual", content: "Un initié prépare son état avant la parole : il sait que l'état ouvre la porte." },
    ],
    reformulation:
      "Autrement dit, la protection spirituelle n'est pas seulement ce que tu dis, mais l'endroit intérieur depuis lequel tu le dis.",
    workshop: {
      instructions: "Demander aux élèves : « Quelle est la différence entre réciter une parole et entrer dans une parole ? »",
      questions: ["Différence réciter / entrer ?", "Comment reconnaît-on qu'on est entré ?"],
      expected_answers: ["Réciter = parler mécaniquement.", "Entrer = mettre sa conscience dans l'acte."],
      expected_errors: ["Croire que la formule seule suffit."],
    },
    deep_error: "Croire que le spirituel agit automatiquement sans état de conscience.",
    pedagogical_correction: "La formule est un véhicule. La conscience est le conducteur.",
    je_retiens: [
      "La protection spirituelle commence par un transfert de conscience.",
      "Une parole spirituelle agit mieux lorsque l'être entre dans l'état correspondant.",
      "La formule seule ne suffit pas si la conscience reste dispersée.",
      "L'état intérieur ouvre la porte de l'action spirituelle.",
    ],
    understanding_test: [
      { question: "Pourquoi la conscience doit-elle être engagée avant la prière ?", expected_answer: "Parce que la prière agit depuis un état intérieur, pas seulement depuis les mots." },
      { question: "La parole seule suffit-elle ?", expected_answer: "Non, elle dépend de l'état intérieur de celui qui prie." },
    ],
    real_application:
      "Avant une prière, prendre 3 minutes pour calmer le corps, ralentir la respiration et retirer l'attention du monde extérieur.",
    concept_links: ["somnolence", "monde du milieu", "cœur"],
    mastery_level: {
      level_1_understand: "Sait que la protection commence par un état intérieur.",
      level_2_explain: "Sait expliquer pourquoi la formule seule ne suffit pas.",
      level_3_apply: "Sait préparer son état avant une prière.",
      level_4_transmit: "Sait transmettre cette logique à un autre apprenant.",
    },
    transition_to_next:
      "Maintenant que nous savons qu'il faut transférer la conscience, il faut découvrir la porte qui permet ce transfert : la somnolence.",
  },
  2: {
    real_life_situation:
      "Tu es allongé. Tu entends encore les bruits autour de toi, mais des images commencent à apparaître dans ton esprit. Tu n'es plus totalement ici, mais tu n'es pas encore parti.",
    pedagogical_tension: "Dans cet instant, es-tu éveillé ou endormi ?",
    thought_experiment:
      "Tu es sur le seuil d'une porte. Derrière toi, la pièce du jour. Devant toi, la pièce du rêve. Tu n'es ni dans l'une ni dans l'autre : tu es dans le passage.",
    revelation_moment: "La somnolence est le passage lui-même.",
    simple_lesson: "La somnolence est l'état entre le sommeil et l'éveil.",
    deep_lesson:
      "Dans la somnolence, l'être n'est pas coupé du monde éveillé, mais il n'est pas encore absorbé par le sommeil. Il peut donc recevoir des informations des deux côtés : la perception extérieure et l'image intérieure.",
    analogies: [
      { type: "concrete", content: "La porte entre deux pièces." },
      { type: "concrete", content: "Le crépuscule entre le jour et la nuit." },
      { type: "symbolic", content: "Le pont entre deux rives." },
    ],
    examples: [
      { type: "real_life", content: "Tu entends quelqu'un parler pendant que tu commences à rêver." },
      { type: "real_life", content: "Tu vois une image intérieure mais tu sais encore que tu es dans ton lit." },
      { type: "spiritual_or_conceptual", content: "Tu reçois une intuition juste avant de dormir." },
    ],
    reformulation:
      "Autrement dit, la somnolence est le moment où l'être est assez détaché du monde extérieur pour recevoir, mais assez conscient pour se souvenir.",
    workshop: {
      instructions: "À quel moment vos rêves sont-ils les plus faciles à retenir : en sommeil profond ou au réveil léger ?",
      questions: ["Quand retenez-vous le mieux les rêves ?"],
      expected_answers: ["Au réveil léger, dans la zone de somnolence."],
      expected_errors: ["Répondre : le sommeil profond."],
    },
    deep_error: "Croire que plus on dort profondément, plus on est spirituel.",
    pedagogical_correction: "Le sommeil profond coupe la conscience. La somnolence la maintient ouverte.",
    je_retiens: [
      "La somnolence est un état entre l'éveil et le sommeil.",
      "Dans cet état, l'être capte à la fois le monde éveillé et le monde du rêve.",
      "La somnolence n'est pas le sommeil profond.",
      "La somnolence est la porte du monde spirituel parce qu'elle garde une conscience active.",
    ],
    understanding_test: [
      { question: "Pourquoi la somnolence est-elle plus utile que le sommeil profond ?", expected_answer: "Parce qu'elle permet de recevoir tout en restant conscient." },
    ],
    real_application: "Observer pendant trois soirs le moment précis où les images apparaissent avant le sommeil.",
    concept_links: ["transfert de conscience", "monde du milieu"],
    mastery_level: {
      level_1_understand: "Sait que la somnolence est intermédiaire.",
      level_2_explain: "Sait la distinguer du sommeil profond.",
      level_3_apply: "Sait remarquer ses propres moments de somnolence.",
      level_4_transmit: "Peut décrire l'état à un débutant.",
    },
    transition_to_next:
      "Si la somnolence est une porte, il faut nommer le lieu où elle nous place : le monde du milieu.",
  },
  3: {
    real_life_situation:
      "Imagine un enfant placé entre deux adultes qui parlent chacun une langue différente. L'enfant comprend un peu des deux côtés. Il devient le lieu de passage entre deux mondes.",
    pedagogical_tension: "Peut-on appartenir à deux mondes sans être totalement dans l'un ni totalement dans l'autre ?",
    thought_experiment: "Imagine la ligne entre la mer et le ciel : l'horizon. Tu ne peux pas le saisir, pourtant il organise ta vision.",
    revelation_moment: "Le firmament n'est pas seulement au-dessus de nous : il est l'état intérieur qui sépare et relie.",
    simple_lesson: "Le monde du milieu est l'espace entre deux états.",
    deep_lesson:
      "Le texte appelle cet espace firmament, Katiokeni ou monde du milieu. C'est le lieu où l'être n'est plus seulement attaché à la perception physique, mais pas encore englouti par le rêve. C'est un état de passage, d'écoute et de réception.",
    analogies: [
      { type: "concrete", content: "Le pont entre deux rives." },
      { type: "concrete", content: "L'horizon entre mer et ciel." },
      { type: "human", content: "Le médiateur entre deux personnes." },
    ],
    examples: [
      { type: "real_life", content: "L'instant entre inspiration et expiration." },
      { type: "real_life", content: "Le moment entre veille et rêve." },
      { type: "real_life", content: "Le silence entre deux paroles." },
    ],
    reformulation: "Autrement dit, le monde du milieu est l'état où deux réalités se touchent sans se confondre.",
    workshop: {
      instructions: "Donnez un exemple dans la vie où quelque chose sert de milieu entre deux réalités.",
      questions: ["Quel objet, lieu ou moment sert de milieu ?"],
      expected_answers: ["Pont, médiateur, horizon, crépuscule, respiration."],
      expected_errors: ["Chercher uniquement un lieu physique."],
    },
    deep_error: "Croire que le firmament est seulement un endroit matériel.",
    pedagogical_correction: "Un lieu spirituel peut être un état de conscience.",
    je_retiens: [
      "Le monde du milieu est l'état entre deux réalités.",
      "Le firmament peut être compris comme un espace intérieur de séparation et de passage.",
      "Le Katiokeni désigne ce lieu intermédiaire.",
      "Celui qui entre dans la somnolence entre dans le monde du milieu.",
    ],
    understanding_test: [
      { question: "Pourquoi le monde du milieu n'est-il ni le monde éveillé ni le sommeil profond ?", expected_answer: "Parce qu'il relie les deux sans se confondre avec eux." },
    ],
    real_application: "Observer les moments de transition : crépuscule, silence, pause, respiration, somnolence.",
    concept_links: ["somnolence", "cœur", "chambre intérieure"],
    mastery_level: {
      level_1_understand: "Sait que le monde du milieu est intérieur.",
      level_2_explain: "Sait le distinguer d'un lieu physique.",
      level_3_apply: "Sait identifier ses moments de transition.",
      level_4_transmit: "Sait expliquer le firmament intérieur à un autre.",
    },
    transition_to_next:
      "Maintenant que nous comprenons le monde du milieu, nous pouvons comprendre pourquoi les traditions parlent du cœur, de la chambre et du dedans.",
  },
};

function genericPedagogyFor(chapter) {
  return {
    real_life_situation: `Imagine une situation où ${chapter.title.toLowerCase()} devient un enjeu vivant pour l'apprenant.`,
    pedagogical_tension: `Comment éviter de ramener « ${chapter.title} » à un simple concept abstrait ?`,
    thought_experiment: `Imagine que tu dois transmettre « ${chapter.title} » à quelqu'un qui n'a aucune base : que fais-tu en premier ?`,
    revelation_moment: chapter.main_revelation || chapter.knowledge_to_transmit,
    simple_lesson: chapter.knowledge_to_transmit,
    deep_lesson: `${chapter.knowledge_to_transmit} ${chapter.main_revelation ? `Cela révèle que : ${chapter.main_revelation}` : ""}`.trim(),
    analogies: [
      { type: "concrete", content: "Comme une porte qui ne s'ouvre que si on tourne la bonne clé." },
      { type: "human", content: "Comme un médiateur qui relie deux interlocuteurs." },
    ],
    examples: [
      { type: "real_life", content: "Un cas observable dans la vie quotidienne." },
      { type: "pedagogical", content: "Un exemple en classe pour rendre l'idée claire." },
      { type: "spiritual_or_conceptual", content: "Un cas conceptuel pour aller plus loin." },
    ],
    reformulation: `Autrement dit : ${chapter.knowledge_to_transmit}`,
    workshop: {
      instructions: `Demander aux élèves : « Avec vos mots, expliquez ${chapter.title.toLowerCase()} ».`,
      questions: [`Que retenez-vous de « ${chapter.title} » ?`],
      expected_answers: [chapter.knowledge_to_transmit],
      expected_errors: ["Donner une définition trop scolaire et plate."],
    },
    deep_error: "Confondre le concept avec son nom.",
    pedagogical_correction: "Toujours revenir à l'expérience pour valider l'idée.",
    je_retiens: [
      `${chapter.title}.`,
      chapter.knowledge_to_transmit,
      chapter.main_revelation || "Idée centrale à fixer.",
    ],
    understanding_test: [
      { question: `Comment expliquerais-tu « ${chapter.title} » à un débutant ?`, expected_answer: chapter.knowledge_to_transmit },
    ],
    real_application: "Observer une situation concrète qui illustre cette idée dans les 24h.",
    concept_links: ["chapitres voisins"],
    mastery_level: {
      level_1_understand: "Sait répéter l'idée.",
      level_2_explain: "Sait reformuler avec ses mots.",
      level_3_apply: "Sait l'illustrer par un exemple personnel.",
      level_4_transmit: "Sait l'enseigner à quelqu'un.",
    },
    transition_to_next: "Maintenant que nous avons posé cette idée, nous pouvons aborder la suivante.",
  };
}

export async function mockGeneratePedagogy(rawText, chapters, { delayMs = 1000 } = {}) {
  await wait(delayMs);
  return (chapters || []).map((ch) => {
    const seed = looksLikeSomnolence(rawText) ? SOMNOLENCE_PEDAGOGY[ch.chapter_id] : null;
    const ped = seed || genericPedagogyFor(ch);
    return { ...ch, ...ped };
  });
}

/* ─────────────────────────── SLIDES SMARTBOARD ─────────────────────────── */

export async function mockGenerateSlides(rawText, fullChapters, { delayMs = 800 } = {}) {
  await wait(delayMs);
  const slides = [];
  let order = 1;
  (fullChapters || []).forEach((ch) => {
    slides.push({
      slide_id: order++,
      chapter_id: ch.chapter_id,
      kind: "title",
      title: ch.title,
      subtitle: `Chapitre ${ch.chapter_id} · ${ch.recommended_duration_minutes || 15} min`,
      body: ch.knowledge_to_transmit || "",
    });
    if (ch.main_revelation || ch.revelation_moment) {
      slides.push({
        slide_id: order++,
        chapter_id: ch.chapter_id,
        kind: "revelation",
        title: "Révélation",
        body: ch.main_revelation || ch.revelation_moment,
      });
    }
    if (Array.isArray(ch.je_retiens) && ch.je_retiens.length) {
      slides.push({
        slide_id: order++,
        chapter_id: ch.chapter_id,
        kind: "je_retiens",
        title: "JE RETIENS",
        bullets: ch.je_retiens,
      });
    }
    if (ch.workshop?.instructions) {
      slides.push({
        slide_id: order++,
        chapter_id: ch.chapter_id,
        kind: "workshop",
        title: "Atelier",
        body: ch.workshop.instructions,
      });
    }
  });
  return slides;
}

/* ─────────────────────────── SCRIPT PROFESSEUR ─────────────────────────── */

export async function mockGenerateScripts(rawText, fullChapters, { delayMs = 700 } = {}) {
  await wait(delayMs);
  return (fullChapters || []).map((ch) => {
    const lines = [];
    if (ch.real_life_situation) lines.push(`« ${ch.real_life_situation} »`);
    if (ch.pedagogical_tension) lines.push(`« ${ch.pedagogical_tension} »`);
    if (ch.thought_experiment) lines.push(`« ${ch.thought_experiment} »`);
    if (ch.revelation_moment || ch.main_revelation) {
      lines.push(`« ${ch.revelation_moment || ch.main_revelation} »`);
    }
    if (Array.isArray(ch.je_retiens) && ch.je_retiens.length) {
      lines.push("« Prenez vos cahiers. Écrivez. »");
      ch.je_retiens.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
    }
    if (ch.transition_to_next) lines.push(`« ${ch.transition_to_next} »`);
    return {
      chapter_id: ch.chapter_id,
      title: ch.title,
      lines,
    };
  });
}

/* ─────────────────────────── EXPORTS ─────────────────────────── */

export function buildExportSummary(project) {
  const chapters = project.chapters || [];
  const slides = project.slides || [];
  const totalMinutes = chapters.reduce((acc, c) => acc + (Number(c.recommended_duration_minutes) || 0), 0);
  const exercises = chapters.reduce(
    (acc, c) => acc + (Array.isArray(c.workshop?.questions) ? c.workshop.questions.length : 0),
    0,
  );
  const tests = chapters.reduce(
    (acc, c) => acc + (Array.isArray(c.understanding_test) ? c.understanding_test.length : 0),
    0,
  );
  return {
    chapters_count: chapters.length,
    minutes_total: totalMinutes,
    slides_count: slides.length,
    exercises_count: exercises,
    tests_count: tests,
  };
}

/* ─────────────────────────── SOURCE TEXT ─────────────────────────── */

export function defaultDemoText() {
  return SOMNOLENCE_FALLBACK;
}
