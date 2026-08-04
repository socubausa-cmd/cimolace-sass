/**
 * prorascienceKnowledge — MÉMOIRE CENTRALISÉE de prorascience (tenant `isna`), pour que
 * l'OS Cimolace RENDE et GUIDE prorascience.org (realm isolé). Agrégé fidèlement depuis le
 * contenu réel du site (data/prorascienceVitrineFromWebContent, cycleInitiationProduct,
 * MaquetteHero04/Temple/Fondateur, prorascienceVitrineMenu). Sert : (1) le cerveau
 * `prorascience-brain` (connaissance injectée) ; (2) le rendu natif des pages/offres/tour.
 *
 * Enrichissable : à terme, migrer vers `iri_pages`/`knowledge_base` (DB) — cette source reste
 * le fallback complet + la « photo » du site.
 */

export const PRORASCIENCE_KNOWLEDGE = {
  identity: {
    slug: 'isna',
    name: 'Prorascience',
    fullName: 'ISNA — Initiation aux Sciences Nocturnes Africaines',
    subtitle: 'Intégrer la Science et la Spiritualité pour une Transformation Authentique.',
    website: 'prorascience.org',
    stats: [
      { label: 'Étudiants formés', value: '2500+' },
      { label: 'Modules créés', value: '100+' },
      { label: 'Transmetteurs', value: '50+' },
      { label: 'Pays représentés', value: '30+' },
      { label: 'Satisfaction', value: '95%' },
    ],
  },

  founder: {
    name: 'Badika Jel David',
    title: 'Le 5ᵉ Manikongo — Recteur de l’ISNA',
    bio: "Fondateur et Recteur de l’ISNA, il porte le mandat de restaurer la dignité intellectuelle et spirituelle de l’Homme africain par la connaissance — unir la rigueur d’une école et la profondeur d’un temple.",
  },

  visuals: {
    hero: '/image-pro/hero-vitrine-prorascience-accueil.png',
    rupture: '/image-pro/prorascience-rupture-tradition-numerique.png',
    ritesPanels: '/image-pro/prorascience-histoire-rites-panels.png',
    histoire: '/image-pro/prorascience-histoire-custom.png',
    appleRites: '/image-pro/prorascience-apple-hero-rites.png',
    voyageur: '/image-pro/isna-pro-voyageur-cinematic.png',
    distance: '/image-pro/aprendre-a-distance.png',
    mondeAvant: '/image-pro/isna-pro-monde-avant-rituel.png',
    rituelCompris: '/image-pro/isna-pro-rituel-compris-cinematic.png',
  },

  vision: {
    whatIs: "La PRORASCIENCE est l’étude systématique, rationnelle et vérifiable des réalités visibles ET invisibles. C’est la science qui unifie la physique (le monde matériel) et la métaphysique (le monde spirituel) en une seule structure cohérente de connaissance.",
    problem: "On vous a appris quoi faire, mais jamais pourquoi le faire. Les pratiques sont reproduites, les traditions répétées — mais la compréhension manque.",
    promise: "Prorascience vous redonne la compréhension. Vous n’êtes pas ici pour reproduire des gestes, mais pour comprendre, maîtriser, puis évoluer.",
    closing: "La pratique sans compréhension est aveugle. La compréhension sans pratique est inutile. Ce n’est pas une formation, c’est une transformation.",
    pillars: [
      { title: 'La Raison', points: ['Logique déductive et inductive', 'Pensée critique sans tabou', 'Rejet du dogmatisme aveugle', 'Structuration mentale rigoureuse'] },
      { title: 'La Science', points: ['Méthode expérimentale', 'Observation des lois universelles', 'Répétabilité des résultats', 'Modélisation mathématique et géométrique'] },
      { title: 'Savoirs Africains', points: ['Sagesse ancestrale (Maât)', 'Cosmogonie totémique', 'Technologies spirituelles éprouvées', "Vision holistique de l’Univers"] },
    ],
    values: [
      { title: 'Intégrité Scientifique', desc: "Une approche rigoureuse qui ne sacrifie jamais la vérité sur l’autel du dogme." },
      { title: 'Authenticité Spirituelle', desc: "Un retour aux sources de la tradition primordiale, vécu dans le cœur." },
      { title: 'Responsabilité Éthique', desc: "La connaissance n’est rien sans la conscience de ses conséquences." },
      { title: 'Transformation Consciente', desc: "Le but n’est pas d’accumuler du savoir, mais l’élévation de l’être." },
    ],
  },

  // La méthode = le fil du parcours (Comprendre → Pratiquer → Exercer → Évoluer).
  method: [
    { step: 'Comprendre', kind: 'Cursus', items: ['lois invisibles', 'métaphysique', 'énergie', 'structure des rituels'], foot: 'Formation continue' },
    { step: 'Pratiquer', kind: 'Modules', items: ['libation', 'talisman', 'protection', 'guérison'], foot: 'Formation à la carte' },
    { step: 'Exercer', kind: 'Coaching', items: ['apprendre le métier', 'accompagner', 'diagnostiquer'], foot: 'Réservé aux futurs praticiens' },
    { step: 'Évoluer', kind: 'Spécial', items: ['techniques avancées', 'secrets spirituels', 'cas complexes'], foot: 'Accès libre / événements' },
  ],

  // Offres — alignées sur les prix RÉELLEMENT facturés par /forfaits (billing_plans isna,
  // famille `*-monthly` que ForfaitsPage requête). NE PAS diverger : tout changement de prix
  // se décide en base (billing_plans) PUIS se recopie ici. Clés → montants :
  // consultation-privee 50 €, autonome-monthly 30 €, academique-monthly 50 €,
  // prive-monthly 200 €, privilegie-monthly 390 €. (repositionnement fondateur 2026-07-12)
  offers: [
    { name: 'Consultation privée', price: '50 €', suffix: '/90 min', desc: 'Un diagnostic et une orientation personnalisés avec un praticien.' },
    { name: 'Cycle Autonome', price: '30 €', suffix: '/mois', desc: 'Apprendre seul, par les enregistrements : formations, corpus et forum.' },
    { name: 'Cycle Académique', price: '50 €', suffix: '/mois', desc: "L'école en salle de classe : cours en direct, préparation à l'initiation (n'enseigne pas le métier).", popular: true },
    { name: 'Cycle Privé', price: '200 €', suffix: '/mois', desc: 'Suivi personnel : assistant spirituel, séances privées, prières et interventions pour les cas particuliers.' },
    { name: 'Cycle Privilégié', price: '390 €', suffix: '/mois', desc: 'Devenir praticien : formation métier (mage/ganga), jours personnalisés et stages pratiques.' },
  ],

  // Comparateur des 4 cycles MENSUELS (la consultation, one-off, est comparée à part).
  // Prix alignés sur billing_plans (`*-monthly`) — mêmes montants que le bloc offers ci-dessus.
  // Chaque case est DÉRIVÉE FIDÈLEMENT des descriptions ci-dessus (aucune feature inventée) :
  // « cursus + modules » (Autonome), « encadré : … + suivi » (Académique), « coaching pour
  // futurs praticiens » (Privé), « mentorat direct, cas complexes » (Privilégié).
  comparison: {
    intro: 'Les quatre cycles, du plus autonome au plus accompagné.',
    plans: [
      { name: 'Autonome', full: 'Cycle Autonome', price: '30 €', suffix: '/mois', desc: 'Apprendre seul, par les enregistrements.' },
      { name: 'Académique', full: 'Cycle Académique', price: '50 €', suffix: '/mois', popular: true, desc: "L'école en salle de classe : préparation à l'initiation." },
      { name: 'Privé', full: 'Cycle Privé', price: '200 €', suffix: '/mois', desc: 'Suivi personnel : séances privées, prières et interventions.' },
      { name: 'Privilégié', full: 'Cycle Privilégié', price: '390 €', suffix: '/mois', desc: 'Devenir praticien : formation métier, stages pratiques.' },
    ],
    rows: [
      { feature: 'Cursus — comprendre les lois', has: [true, true, true, true] },
      { feature: 'Modules — pratiquer (libation, talisman…)', has: [true, true, true, true] },
      { feature: 'Suivi encadré', has: [false, true, true, true] },
      { feature: 'Coaching — exercer le métier', has: [false, false, true, true] },
      { feature: 'Mentorat direct — cas complexes, secrets', has: [false, false, false, true] },
    ],
  },

  // Navigation du site (ce que l'OS doit savoir présenter).
  navigation: ['Forfaits', 'Formations', 'Les 21 sciences', 'ISNA Pro', 'À propos', 'Mentorat', 'Coaching', 'Fondateur', 'Équipe', 'FAQ', 'Contact'],

  faq: [
    { q: "Qu’est-ce que la Prorascience ?", a: "L’étude systématique et vérifiable des réalités visibles et invisibles — l’unification de la science et de la spiritualité." },
    { q: "Faut-il déjà pratiquer pour rejoindre ?", a: "Non. Que vous cherchiez à comprendre, à maîtriser ou à pratiquer intelligemment, il y a un parcours pour vous." },
    { q: "Quelle est la méthode ?", a: "Comprendre, Pratiquer, Exercer, puis Évoluer — de la théorie aux techniques avancées." },
  ],

  // Glossaire — termes de domaine rendus CLIQUABLES dans les scènes prose (reader/faq) via glossify()
  // → tiroir focus. Définitions COURTES et fidèles (vision/method/faq + sens de domaine pour Maât/
  // Manikongo). On EXCLUT les mots communs (« Raison », « Science », « pratique »…) pour éviter le
  // sur-lienage : seuls les termes distinctifs. Forme = [{ term, def }] (matcher mot entier, accents ok).
  glossary: [
    { term: 'Prorascience', def: "L’étude systématique, rationnelle et vérifiable des réalités visibles ET invisibles, unifiant la physique et la métaphysique en une seule structure de connaissance." },
    { term: 'ISNA', def: "Initiation aux Sciences Nocturnes Africaines — l’école-temple qui enseigne la Prorascience, dirigée par son recteur-fondateur." },
    { term: 'métaphysique', def: "Le monde spirituel, l’invisible ; ce que la Prorascience unifie avec la physique (le monde matériel)." },
    { term: 'Maât', def: "Principe africain ancien d’ordre, de vérité et de justice cosmiques ; sagesse ancestrale au fondement des Savoirs Africains." },
    { term: 'Manikongo', def: "Titre du souverain historique du royaume Kongo ; porté par le fondateur comme « 5ᵉ Manikongo », recteur de l’ISNA." },
    { term: 'cosmogonie totémique', def: "Vision de l’origine et de l’ordre du monde structurée autour des totems, l’un des Savoirs Africains transmis." },
    { term: 'sciences nocturnes africaines', def: "Les savoirs spirituels africains de l’invisible enseignés par l’ISNA — présentés comme « les 21 sciences »." },
    { term: 'Savoirs Africains', def: "Le troisième pilier : sagesse ancestrale (Maât), cosmogonie totémique, technologies spirituelles éprouvées et vision holistique de l’Univers." },
    { term: 'libation', def: "Rite d’offrande consistant à verser un liquide (aux ancêtres ou aux esprits) ; module pratique du parcours." },
    { term: 'talisman', def: "Objet chargé d’une fonction de protection ou d’action spirituelle ; module pratique du parcours." },
    { term: 'transmetteur', def: "Enseignant-guide de l’ISNA qui transmet les savoirs et accompagne chaque étudiant à travers le monde." },
    { term: 'Mentorat', def: "Le plus haut palier d’accompagnement : mentorat direct, cas complexes et secrets avancés." },
  ],

  // TEMPLE — le « Pôle Ngowazulu » de Prorascience (dimension mystique/spirituelle, distincte de
  // l’école). L’agent OS s’en sert pour PRÉSENTER le temple aux visiteurs (consultations, cultes,
  // boutique sacrée, mentorat « veille patrimoniale »). Tables ngowazulu_* portées en base.
  temple: {
    name: "Le Temple Ngowazulu",
    tagline: "Le Pôle Temple de Prorascience — transformation, intervention et guérison.",
    raison: "Transformer ce que vous ne pouviez pas résoudre seul : une prise en charge sérieuse des blocages profonds, avec méthode, confidentialité et responsabilité.",
    master: "5ᵉ Manikongo (Badika Jel David), sous le sacerdoce du Génie Kimbangu.",
    sections: [
      { title: "Culte en ligne", desc: "Ouverture dominicale et fermeture du vendredi pour les membres." },
      { title: "Consultations", desc: "Diagnostic, orientation et résolution des cas spirituels." },
      { title: "Interventions mystiques", desc: "Délivrance, purification et rupture karmique selon le cas." },
      { title: "Hôpital traditionnel", desc: "Prise en charge profonde des cas lourds et suivi d'évolution." },
      { title: "Voyages initiatiques", desc: "Rites de passage, débaptisation et sortie des anciens pactes." },
      { title: "Communauté Ngowazulu", desc: "Membres actifs, entraide structurée et accompagnement collectif." },
    ],
    services: [
      { name: "Consultation privée", price: "50 €", suffix: "/90 min" },
      { name: "Mentorat Essentiel", price: "55 €", suffix: "/mois · 1 rencontre/mois" },
      { name: "Mentorat Confort", price: "180 €", suffix: "/mois · 1 rencontre/semaine" },
      { name: "Mentorat Intensif", price: "300 €", suffix: "/mois · 2 rencontres/semaine" },
      { name: "Mentorat Souverain", price: "500 €", suffix: "/mois · jusqu'à 3 rencontres/semaine" },
      // ⚠️ Pas un commerce : le matériel REQUIS pour entrer en initiation. Les 9
      // objets forment un ensemble indivisible — on ne les vend jamais séparément.
      { name: "Matériel initiatique", price: "700 €", suffix: "· les 9 instruments sacrés, indivisibles — activation + suivi 3 mois" },
    ],
    boutique: ["Savon NVOURIMPARA", "Huile BUMBALOWAH", "Poudre MPEVELO", "Poudre ZAZI", "Bougie IMBONGA", "Cloche Sacrée", "Séguelebélé", "Saquet et Manadrome", "Poudre de Souhaits"],
    policy: "Entrée encadrée : paiement d'ouverture + formulaire + serment de confidentialité et disclaimer médical + 3 pièces (photo, identité, preuve d'habitation). Gouvernance : le secrétariat qualifie et suit l'administratif ; le maître donne l'orientation et le protocole spirituel. Confidentialité stricte.",
  },
};

// Sérialise la connaissance en TEXTE compact pour le system prompt du cerveau (borne le périmètre).
export function prorascienceKnowledgeText(k = PRORASCIENCE_KNOWLEDGE) {
  const lines = [];
  lines.push(`PLATEFORME : ${k.identity.name} (${k.identity.fullName}) — ${k.identity.subtitle} Site : ${k.identity.website}.`);
  lines.push(`FONDATEUR : ${k.founder.name}, ${k.founder.title}. ${k.founder.bio}`);
  lines.push(`VISION : ${k.vision.whatIs} PROBLÈME : ${k.vision.problem} PROMESSE : ${k.vision.promise}`);
  lines.push(`PILIERS : ${k.vision.pillars.map((p) => `${p.title} (${p.points.join(', ')})`).join(' ; ')}.`);
  lines.push(`MÉTHODE : ${k.method.map((m) => `${m.step} [${m.kind}] : ${m.items.join(', ')}`).join(' → ')}.`);
  lines.push(`OFFRES : ${k.offers.map((o) => `${o.name} (${o.price}${o.suffix}) — ${o.desc}`).join(' ; ')}.`);
  lines.push(`NAVIGATION DU SITE : ${k.navigation.join(', ')}.`);
  lines.push(`FAQ : ${k.faq.map((f) => `Q:${f.q} R:${f.a}`).join(' | ')}.`);
  lines.push(`CHIFFRES : ${k.identity.stats.map((s) => `${s.value} ${s.label}`).join(', ')}.`);
  if (k.temple) {
    const t = k.temple;
    lines.push(`TEMPLE (Pôle Ngowazulu) : ${t.tagline} ${t.raison} Maître : ${t.master}`);
    lines.push(`TEMPLE — SECTIONS : ${(t.sections || []).map((s) => `${s.title} (${s.desc})`).join(' ; ')}.`);
    lines.push(`TEMPLE — SERVICES : ${(t.services || []).map((s) => `${s.name} ${s.price}${s.suffix ? ' ' + s.suffix : ''}`).join(' ; ')}.`);
    if (t.boutique) lines.push(`TEMPLE — BOUTIQUE SACRÉE (pack indivisible) : ${t.boutique.join(', ')}.`);
    if (t.policy) lines.push(`TEMPLE — POLITIQUE : ${t.policy}`);
  }
  return lines.join('\n');
}

// ── P4-pixel — « Fais-moi visiter » : l'OS REND le site du tenant en scènes (pas juste du chat).
// Construit une visite guidée (beats compatibles TOUR/SceneStage de l'OS) À PARTIR du knowledge
// pack — 100% piloté par les données, donc réutilisable pour n'importe quel tenant. Chaque beat =
// { reply (voix), keyword (surligné), scene? (split/aside/tutorial/reader), final? }. Les scènes
// respectent normalizeScene (aside: label+value requis ; split: 2 paliers ≥2 points ; reader: profile+body).
export function buildTenantTour(k = PRORASCIENCE_KNOWLEDGE, brandName) {
  const id = k.identity || {};
  const vision = k.vision || {};
  const name = brandName || id.name || 'ce site';
  const pillars = vision.pillars || [];
  const method = k.method || [];
  const offers = k.offers || [];
  const visuals = k.visuals || {};
  const beats = [];

  // Pack data-driven (champ `scenes`, ex. Cimolace) → tour GÉNÉRIQUE ; sinon tour prorascience hardcodé.
  const generic = !!k.scenes;

  // 1 — Mode visitation : l’agent ouvre par une carte claire du territoire, façon réponse IA.
  beats.push({
    reply: generic
      ? `Je vous fais visiter ${name}. On commence par la carte générale, puis je vous guide vers les zones importantes.`
      : `Je vous fais visiter ${name}. On commence par la carte générale : ce que c'est, comment on apprend, et comment choisir son parcours.`,
    keyword: 'carte générale:',
    scene: {
      type: 'answer',
      question: 'Fais-moi visiter',
      title: `Visite guidée de ${name}`,
      summary: generic
        ? `Voici la logique du portail ${name} : comprendre le projet, explorer les contenus, choisir le bon chemin, puis rejoindre l’espace adapté.`
        : `${name} est présenté comme un moteur de découverte : l’agent ne vous laisse pas devant une vitrine statique, il vous oriente vers la vision, la méthode, les forfaits et les contenus utiles selon votre intention.`,
      sections: [
        {
          h: 'Ce que vous allez voir',
          bullets: generic
            ? ['L’identité du projet et sa promesse.', 'Les contenus et espaces disponibles.', 'Les actions utiles pour continuer.']
            : ['La vision : pourquoi la Prorascience existe.', 'La méthode : comprendre, pratiquer, exercer, évoluer.', 'Les forfaits : choisir le niveau d’accompagnement juste.', 'Le fondateur : comprendre la source du projet.'],
        },
        {
          h: 'Comment naviguer ici',
          p: 'Vous pouvez laisser l’agent guider la visite automatiquement, cliquer sur une carte “À explorer”, ou poser directement votre question dans le champ d’écriture.',
        },
      ],
      sources: [
        { label: 'Vision', note: 'Comprendre le sens du projet.', nodeId: 'vision' },
        { label: 'Méthode', note: 'Voir la progression pédagogique.', nodeId: 'services' },
        { label: 'Forfaits', note: 'Choisir un parcours adapté.', nodeId: 'produits' },
      ],
    },
  });

  // 2 — Récit illustré : l'histoire, la problématique et le basculement (ancienne academy → moteur actuel).
  if (!generic) {
    beats.push({
      reply: `Avant, pour comprendre ces savoirs, il fallait souvent voyager, chercher un initié, attendre longtemps. La Prorascience change cela : elle transforme le voyage en parcours intelligible.`,
      keyword: 'voyager',
      scene: {
        type: 'story',
        eyebrow: 'Le récit',
        title: 'Avant il fallait voyager. Maintenant, il faut comprendre.',
        summary: `La Prorascience ne remplace pas la tradition : elle lui redonne une carte. Elle montre le problème, la solution, puis la différence entre pratiquer par répétition et apprendre avec méthode.`,
        heroImage: visuals.rupture || visuals.hero,
        heroAlt: 'Rupture entre transmission ancienne et apprentissage numérique',
        chapters: [
          {
            kicker: 'Le monde avant',
            title: 'Des gestes transmis, mais peu expliqués.',
            body: 'Libations, prières, rituels, protections : beaucoup de pratiques étaient reçues comme des actes à répéter, sans toujours voir les lois qui les organisent.',
            image: visuals.ritesPanels || visuals.mondeAvant,
            accent: 'terra',
          },
          {
            kicker: 'La fracture',
            title: 'Apprendre signifiait quitter, chercher, attendre.',
            body: 'Il fallait voyager, retourner au village, trouver le bon transmetteur, et accepter une connaissance souvent fragmentée.',
            image: visuals.voyageur,
          },
          {
            kicker: 'La solution',
            title: 'Le temple devient une école navigable.',
            body: 'Avec LIRI, l’étudiant peut découvrir, questionner, voir, écouter, reprendre un point et entrer dans un parcours structuré depuis son téléphone ou son ordinateur.',
            image: visuals.distance || visuals.appleRites,
            accent: 'gold',
          },
        ],
        contrasts: [
          { before: 'Pratique répétée', after: 'Compréhension consciente' },
          { before: 'Voyage obligatoire', after: 'Accès guidé en ligne' },
          { before: 'Savoir fragmenté', after: 'Parcours structuré' },
          { before: 'Vitrine statique', after: 'Moteur intelligent' },
        ],
      },
    });
  }

  // 3 — La vision : le constat vs la promesse (réponse structurée, plus lisible qu’un simple split).
  beats.push({
    reply: generic
      ? `Première étape : la vision. C'est la promesse centrale de ${name}.`
      : `Première étape : la vision. Le problème n'est pas seulement l'accès aux pratiques, c'est le manque de compréhension.`,
    keyword: 'la vision',
    scene: (k.scenes && k.scenes.vision) || {
      type: 'answer',
      question: `Quelle est la vision de ${name} ?`,
      title: 'La vision en une lecture',
      summary: vision.promise || vision.whatIs || `${name} clarifie sa promesse centrale et guide le visiteur vers le bon chemin.`,
      sections: [
        { h: 'Le constat', p: vision.problem || 'Le visiteur arrive souvent avec un besoin, mais sans carte claire du chemin.' },
        { h: 'La promesse', p: vision.closing || 'Comprendre, choisir, puis avancer avec un parcours adapté.' },
      ],
      sources: [
        { label: 'Qu’est-ce que Prorascience ?', note: 'La définition centrale du projet.', nodeId: 'identity' },
        { label: 'Forfaits', note: 'Transformer la vision en parcours concret.', nodeId: 'produits' },
      ],
    },
  });

  // 4 — Les piliers (cards au lieu d'aside : plus visuel et plus navigable).
  if (pillars.length >= 2) {
    beats.push({
      reply: generic
        ? `${name} tient sur ${pillars.length} piliers.`
        : `Ensuite, les piliers : la Raison, la Science, et les Savoirs Africains.`,
      keyword: generic ? 'piliers' : 'les piliers',
      scene: {
        type: 'cards', title: generic ? 'Les piliers' : 'Les trois piliers',
        cards: pillars.slice(0, 4).map((p, i) => ({
          title: p.title,
          value: `${i + 1}`,
          note: (p.points || []).slice(0, 3).join(' · '),
          accent: i % 2 ? 'terra' : 'gold',
        })),
      },
    });
  }

  // 5 — La méthode, en frise de parcours.
  if (method.length) {
    beats.push({
      reply: generic
        ? `La méthode suit un chemin : ${method.map((m) => m.step.toLowerCase()).join(', ')}.`
        : `La méthode est un chemin : comprendre, pratiquer, exercer, puis évoluer.`,
      keyword: 'un chemin',
      scene: {
        type: 'timeline', title: 'La méthode de progression',
        steps: method.slice(0, 5).map((m, i) => ({
          marker: String(i + 1),
          kicker: m.kind || 'Étape',
          title: m.step,
          detail: (m.items || []).join(', '),
          foot: m.foot,
          accent: i % 2 ? 'terra' : 'gold',
        })),
      },
    });
  }

  // 6 — Les parcours : tableau comparatif narratif (pas une simple grille de cartes).
  if (k.comparison && Array.isArray(k.comparison.plans) && Array.isArray(k.comparison.rows)) {
    const cmp = k.comparison;
    beats.push({
      reply: `Maintenant, le choix du parcours. L'axe est simple : plus vous avez besoin d'accompagnement, plus le cycle monte en intensité.`,
      keyword: 'choix du parcours',
      scene: {
        type: 'comparateur',
        title: 'Choisir son parcours',
        intro: cmp.intro || 'Du plus autonome au plus accompagné.',
        plans: cmp.plans.map((p) => ({
          name: p.name,
          value: `${p.price}${p.suffix || ''}`,
          popular: !!p.popular,
          ref: {
            kind: 'plan',
            title: p.full || p.name,
            value: `${p.price}${p.suffix || ''}`,
            note: p.desc,
            related: [{ nodeId: 'produits', label: 'Tous les forfaits' }],
          },
        })),
        rows: cmp.rows,
      },
    });
  } else if (offers.length) {
    beats.push({
      reply: `Côté parcours, il y a un forfait pour chaque intention — de la consultation au mentorat.`,
      keyword: 'chaque intention',
      scene: {
        type: 'cards', title: 'Choisir son parcours',
        cards: offers.slice(0, 5).map((o) => ({
          title: o.name,
          value: `${o.price}${o.suffix || ''}`,
          note: o.desc,
          badge: o.popular ? 'Recommandé' : undefined,
          accent: o.popular ? 'gold' : undefined,
          ref: { kind: 'plan', title: o.name, value: `${o.price}${o.suffix || ''}`, note: o.desc, related: [{ nodeId: 'produits', label: 'Tous les forfaits' }] },
        })),
      },
    });
  }

  // 7 — Le fondateur (reader).
  if (k.founder && k.founder.name) {
    beats.push({
      reply: `Enfin, la visite passe par la source du projet : ${k.founder.name}.`,
      keyword: k.founder.name,
      scene: {
        type: 'founder',
        title: 'Le 5ᵉ Manikongo',
        name: k.founder.name,
        role: k.founder.title,
        image: '/founder.jpg',
        alt: 'Badika Jel David, 5ᵉ Manikongo et fondateur de Prorascience',
        quote: 'Une école n’est pas seulement un lieu où l’on reçoit des contenus : c’est un lieu où la connaissance reprend corps.',
        facts: k.founder.facts || [{ k: 'Rôle', v: 'Recteur de l’ISNA' }, { k: 'Mandat', v: 'Restaurer la dignité par la connaissance' }],
        body: [
          { h: 'La présence', p: k.founder.bio },
          { h: 'Le mandat', p: vision.closing },
        ],
        suggestions: ['Vos forfaits ?', 'La méthode ?'],
      },
    });
  }

  // 8 — Final : retour à la présence-guide.
  beats.push({
    reply: `Voilà ${name} en mode visite. Vous pouvez maintenant me demander un point précis, choisir un forfait, ou créer votre compte.`,
    keyword: 'mode visite',
    final: true,
  });

  return beats;
}

// buildNodeScene(nodeId, knowledge) — LE PROJECTEUR : pour un nœud VNP, compose une SCÈNE designée
// (au lieu d'un pavé de texte plat). PUR, data-driven, borné. normalizeScene reste l'autorité finale
// (null → narration `speak()` de repli). Réutilise les formes du tour (split/aside/tutorial/reader)
// + le layout `cards` (grille) pour les nœuds « liste de faits homogènes » (forfaits, chiffres, valeurs).
export function buildNodeScene(nodeId, k = PRORASCIENCE_KNOWLEDGE) {
  if (!k) return null;
  const id = k.identity || {};
  const vision = k.vision || {};
  const founder = k.founder || {};
  const offers = k.offers || [];
  const method = k.method || [];
  const stats = id.stats || [];
  const faqs = k.faq || [];
  const values = vision.values || [];
  const visuals = k.visuals || {};
  const name = id.name || 'ce site';
  const founderFacts = founder.facts || [
    { k: 'Rôle', v: founder.title || 'Fondateur' },
    { k: 'Mandat', v: 'Restaurer la dignité par la connaissance' },
  ];

  // Scène DESIGNÉE fournie par le pack (data-driven, ex. Cimolace) → surcharge le hardcode ci-dessous,
  // qui reste le fallback pour prorascience (isna, qui n'a pas de champ `scenes`).
  if (k.scenes && k.scenes[nodeId]) return k.scenes[nodeId];

  switch (nodeId) {
    case 'identity':
      return {
        type: 'answer',
        question: 'Qu’est-ce que la Prorascience ?',
        title: 'La Prorascience, en clair',
        summary: vision.whatIs || "La Prorascience est une discipline qui cherche à comprendre les réalités visibles et invisibles avec méthode, rigueur et responsabilité.",
        sections: [
          {
            h: 'L’idée centrale',
            p: 'La Prorascience ne demande pas seulement de reproduire des gestes ou des traditions. Elle cherche à expliquer pourquoi une pratique existe, comment elle agit, et dans quelle structure de connaissance elle s’inscrit.',
          },
          {
            h: 'Ce que cela change pour l’étudiant',
            bullets: [
              'Comprendre au lieu de subir ou répéter mécaniquement.',
              'Relier la physique, la métaphysique et les savoirs africains dans une lecture cohérente.',
              'Avancer vers une transformation réelle : comprendre, maîtriser, puis évoluer.',
            ],
          },
          {
            h: 'Comment on l’apprend',
            p: `Le parcours suit une progression simple : ${method.map((m) => m.step).filter(Boolean).join(' → ') || 'comprendre → pratiquer → exercer → évoluer'}. Chaque niveau sert à passer de la théorie à une pratique plus consciente.`,
          },
        ],
        sources: [
          { label: 'Vision de Prorascience', note: vision.promise || 'La promesse pédagogique et spirituelle du projet.', nodeId: 'vision' },
          { label: 'Méthode du parcours', note: 'Comprendre, pratiquer, exercer, évoluer.', nodeId: 'services' },
          { label: 'Forfaits & accès', note: 'Trouver le niveau d’accompagnement adapté.', nodeId: 'produits' },
        ],
      };
    case 'vision':
      return {
        type: 'split', headline: name,
        left: { title: 'Le constat', subtitle: 'Le problème', points: ['On reproduit les gestes', 'On répète les traditions', 'La compréhension manque'] },
        right: { title: 'La promesse', subtitle: name, points: ['Comprendre en profondeur', 'Maîtriser vraiment', 'Puis évoluer'] },
        tone: { left: 'terra', right: 'gold' },
      };
    case 'mission':
      return {
        type: 'split', headline: 'Notre mission',
        left: { title: 'Pourquoi', subtitle: 'Le sens', points: ['Restaurer la compréhension', 'Rendre la dignité intellectuelle', 'Unir rigueur et profondeur'] },
        right: { title: "Ce qu'on vise", subtitle: 'Le cap', points: ['Comprendre', 'Maîtriser', 'Puis évoluer'] },
        tone: { left: 'gold', right: 'terra' },
      };
    case 'valeurs':
      return values.length ? {
        type: 'cards', title: 'Nos valeurs',
        cards: values.slice(0, 4).map((v) => ({ title: v.title, note: v.desc })),
      } : null;
    case 'services':
      // La méthode = une SÉQUENCE (Comprendre → Pratiquer → Exercer → Évoluer) → frise verticale.
      return method.length ? {
        type: 'timeline', title: 'La méthode, 4 temps',
        steps: method.slice(0, 6).map((m, i) => ({
          marker: String(i + 1),
          icon: ['book', 'compass', 'users', 'sparkles'][i] || 'hexagon',
          kicker: m.kind || undefined,
          title: m.step,
          detail: (m.items || []).join(' · ') || undefined,
          foot: m.foot || undefined,
          accent: i === method.length - 1 ? 'gold' : 'terra',
          ref: {
            kind: 'info', title: m.step, value: m.kind || undefined,
            note: `${(m.items || []).join(', ')}${m.foot ? ` — ${m.foot}` : ''}`,
            related: [{ nodeId: 'solutions', label: 'Comparer les cycles' }, { nodeId: 'produits', label: 'Les forfaits' }],
          },
        })),
      } : null;
    case 'solutions': {
      // « Choisir son parcours » = comparer les cycles → tableau comparateur (données k.comparison).
      const cmp = k.comparison;
      if (cmp && Array.isArray(cmp.plans) && cmp.plans.length >= 2 && Array.isArray(cmp.rows) && cmp.rows.length) {
        return {
          type: 'comparateur', title: 'Comparer les cycles', intro: cmp.intro || undefined,
          plans: cmp.plans.slice(0, 4).map((p, i) => ({
            name: p.name, value: `${p.price}${p.suffix || ''}`, popular: !!p.popular,
            icon: ['compass', 'grad', 'users', 'gem'][i] || 'sparkles',
            ref: {
              kind: 'plan', title: p.full || p.name, value: `${p.price}${p.suffix || ''}`, note: p.desc,
              actions: ['acheter', 'reserver', 'contacter'],
              related: [{ nodeId: 'services', label: 'La méthode' }, { nodeId: 'produits', label: 'Tous les forfaits' }],
            },
          })),
          rows: cmp.rows.slice(0, 8).map((r) => ({ feature: r.feature, has: (r.has || []).slice(0, 4).map(Boolean) })),
        };
      }
      return method.length ? {
        type: 'tutorial', title: 'Choisir son parcours',
        steps: method.slice(0, 5).map((m) => ({ title: m.step, detail: m.foot || (m.items || []).slice(0, 2).join(', ') })),
        cta: 'Voir les forfaits',
      } : null;
    }
    case 'produits':
      return offers.length ? {
        type: 'cards', title: 'Nos forfaits',
        cards: offers.slice(0, 6).map((o, i) => ({
          title: o.name, value: `${o.price}${o.suffix || ''}`, note: o.desc,
          icon: ['calendar', 'compass', 'grad', 'users', 'gem'][i] || 'sparkles',
          badge: o.popular ? 'Le plus choisi' : undefined, accent: o.popular ? 'gold' : undefined,
          // MODE FOCUS : cliquer une carte ouvre le tiroir (détail + actions + suites).
          ref: {
            kind: 'plan', title: o.name, value: `${o.price}${o.suffix || ''}`, note: o.desc, link: o.link, tiers: o.tiers,
            actions: o.link ? ['acheter'] : ['acheter', 'reserver', 'contacter'],
            related: [{ nodeId: 'services', label: 'La méthode' }, { nodeId: 'solutions', label: 'Comparer les cycles' }],
          },
        })),
      } : null;
    case 'realisations':
      // Chiffres homogènes → dashboard de stats (gros chiffres + count-up, jauge pour les %).
      return stats.length ? {
        type: 'stats', title: 'Nos réalisations',
        metrics: stats.slice(0, 6).map((s, i) => ({ label: s.label, value: s.value, icon: ['grad', 'book', 'users', 'compass', 'sparkles'][i] || 'hexagon' })),
      } : null;
    case 'documentation':
      return {
        type: 'cards', title: 'Documentation',
        cards: [
          (k.navigation || []).includes('Les 21 sciences') ? { title: 'Les 21 sciences', note: 'Sciences nocturnes africaines', accent: 'gold' } : null,
          ...method.slice(0, 4).map((m) => ({ title: m.kind || m.step, note: (m.items || []).slice(0, 2).join(', ') })),
        ].filter(Boolean),
      };
    case 'ressources': {
      const nav = (k.navigation || []).filter((n) => /formation|pro|mentorat|coaching|science/i.test(n));
      return nav.length ? { type: 'cards', title: 'Ressources', cards: nav.slice(0, 6).map((n) => ({ title: n })) } : null;
    }
    case 'histoire':
      return {
        type: 'story',
        eyebrow: 'Histoire',
        title: 'De la tradition fragmentée au parcours intelligent',
        summary: 'L’histoire de Prorascience est celle d’un passage : quitter une transmission difficile d’accès pour construire une école capable d’expliquer, de guider et de rendre les savoirs africains navigables.',
        heroImage: visuals.histoire || visuals.ritesPanels || visuals.hero,
        heroAlt: 'Histoire visuelle de la Prorascience',
        chapters: [
          {
            kicker: 'Avant',
            title: 'On recevait les gestes.',
            body: 'Les pratiques existaient, mais leur logique profonde restait souvent cachée ou dispersée.',
            image: visuals.ritesPanels || visuals.mondeAvant,
            accent: 'terra',
          },
          {
            kicker: 'Le problème',
            title: 'La connaissance demandait un déplacement.',
            body: 'Voyager, trouver un transmetteur, attendre le bon moment : l’accès au savoir dépendait du lieu, du hasard et de la disponibilité.',
            image: visuals.voyageur,
          },
          {
            kicker: 'La réponse',
            title: 'Une école qui rend l’invisible intelligible.',
            body: 'La Prorascience structure la découverte : définition, méthode, cycles, exercices, accompagnement et reprise par l’agent.',
            image: visuals.rituelCompris || visuals.distance,
            accent: 'gold',
          },
        ],
        contrasts: [
          { before: 'Faire sans carte', after: 'Comprendre le chemin' },
          { before: 'Transmission rare', after: 'Parcours accessible' },
          { before: 'Informations dispersées', after: 'Navigation intelligente' },
        ],
      };
    case 'fondateur':
      return founder.name ? {
        type: 'founder',
        title: 'Le 5ᵉ Manikongo',
        name: founder.name,
        role: founder.title,
        image: '/founder.jpg',
        alt: 'Badika Jel David, 5ᵉ Manikongo et fondateur de Prorascience',
        quote: 'Une école n’est pas seulement un lieu où l’on reçoit des contenus : c’est un lieu où la connaissance reprend corps.',
        facts: founderFacts,
        body: [{ h: 'La présence', p: founder.bio }, { h: 'Le mandat', p: vision.closing }],
        suggestions: ['Vos forfaits ?', 'La méthode ?'],
      } : null;
    case 'equipe':
      return founder.name ? {
        type: 'reader', title: 'Notre équipe',
        profile: { name: founder.name, role: 'Recteur — direction', avatarSeed: founder.name,
          facts: stats.filter((s) => /transmet|pays/i.test(s.label)).slice(0, 2).map((s) => ({ k: s.label, v: s.value })) },
        body: [
          { h: 'La direction', p: `Sous la direction de ${founder.name}, ${founder.title}.` },
          { h: 'Les transmetteurs', p: 'Une communauté de transmetteurs accompagne chaque étudiant à travers le monde.' },
        ],
        suggestions: ['Le fondateur ?', 'Nous contacter'],
      } : null;
    case 'faq':
      // Q&R → accordéon interactif (chaque question se déplie), meilleur que le pavé reader.
      return faqs.length ? {
        type: 'faq', title: 'Questions fréquentes',
        items: faqs.slice(0, 8).map((f) => ({ q: f.q, a: f.a })),
      } : null;
    case 'actions':
      return {
        type: 'tutorial', title: "Passer à l'action",
        steps: [
          { title: 'Choisir un forfait', detail: offers.length ? `De ${offers[0].price}${offers[0].suffix || ''} au mentorat` : 'Selon votre intention' },
          { title: 'Réserver', detail: 'Une consultation privée, 90 min' },
          { title: 'Rejoindre', detail: 'Le cursus qui vous correspond' },
        ],
        cta: 'Voir les forfaits',
      };
    default:
      return null; // contact / support : le formulaire inline est le meilleur rendu → speak court
  }
}

// Table (extensible) : slug tenant → knowledge pack. Pour l'instant seul isna/prorascience.
export const OS_KNOWLEDGE = { isna: PRORASCIENCE_KNOWLEDGE };
