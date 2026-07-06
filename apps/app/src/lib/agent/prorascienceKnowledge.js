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

  // Offres — les 5 paliers du site (consultation → mentorat) + les 4 cycles d'initiation.
  offers: [
    { name: 'Consultation privée', price: '50 €', suffix: '/90 min', desc: 'Un diagnostic et une orientation personnalisés avec un praticien.' },
    { name: 'Cycle Autonome', price: '55 €', suffix: '/mois', desc: 'Accès aux cursus et modules pour apprendre en autonomie.' },
    { name: 'Cycle Académique', price: '180 €', suffix: '/mois', desc: 'Le parcours complet, encadré : cursus + modules + suivi.', popular: true },
    { name: 'Cycle Privé', price: '300 €', suffix: '/mois', desc: 'Accompagnement rapproché et coaching pour futurs praticiens.' },
    { name: 'Mentorat Souverain / Privilégié', price: '500 €', suffix: '/mois', desc: 'Le plus haut niveau : mentorat direct, cas complexes, secrets avancés.' },
  ],

  // Navigation du site (ce que l'OS doit savoir présenter).
  navigation: ['Forfaits', 'Formations', 'Les 21 sciences', 'ISNA Pro', 'À propos', 'Mentorat', 'Coaching', 'Fondateur', 'Équipe', 'FAQ', 'Contact'],

  faq: [
    { q: "Qu’est-ce que la Prorascience ?", a: "L’étude systématique et vérifiable des réalités visibles et invisibles — l’unification de la science et de la spiritualité." },
    { q: "Faut-il déjà pratiquer pour rejoindre ?", a: "Non. Que vous cherchiez à comprendre, à maîtriser ou à pratiquer intelligemment, il y a un parcours pour vous." },
    { q: "Quelle est la méthode ?", a: "Comprendre, Pratiquer, Exercer, puis Évoluer — de la théorie aux techniques avancées." },
  ],
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
  return lines.join('\n');
}

// ── P4-pixel — « Fais-moi visiter » : l'OS REND le site du tenant en scènes (pas juste du chat).
// Construit une visite guidée (beats compatibles TOUR/SceneStage de l'OS) À PARTIR du knowledge
// pack — 100% piloté par les données, donc réutilisable pour n'importe quel tenant. Chaque beat =
// { reply (voix), keyword (surligné), scene? (split/aside/tutorial/reader), final? }. Les scènes
// respectent normalizeScene (aside: label+value requis ; split: 2 paliers ≥2 points ; reader: profile+body).
export function buildTenantTour(k = PRORASCIENCE_KNOWLEDGE, brandName) {
  const name = brandName || k.identity.name;
  const pillars = k.vision.pillars || [];
  const beats = [];

  // 1 — La vision : le constat vs la promesse (split).
  beats.push({
    reply: `Bienvenue sur ${name}. Tout part d'un constat simple : on vous a appris quoi faire, jamais pourquoi.`,
    keyword: 'jamais pourquoi',
    scene: {
      type: 'split', headline: name,
      left: { title: 'Le constat', subtitle: 'Le problème', points: ['On reproduit les gestes', 'On répète les traditions', 'La compréhension manque'] },
      right: { title: 'La promesse', subtitle: name, points: ['Comprendre en profondeur', 'Maîtriser vraiment', 'Puis évoluer'] },
      tone: { left: 'terra', right: 'gold' },
    },
  });

  // 2 — Les trois piliers (aside).
  if (pillars.length >= 2) {
    beats.push({
      reply: `Tout repose sur trois piliers : la Raison, la Science, et les Savoirs Africains.`,
      keyword: 'trois piliers',
      scene: {
        type: 'aside', side: 'right', title: 'Les trois piliers',
        items: pillars.slice(0, 4).map((p) => ({ label: p.title, value: (p.points && p.points[0]) || '—', note: (p.points || []).slice(1, 3).join(' · ') || undefined })),
      },
    });
  }

  // 3 — La méthode, un chemin en 4 temps (tutorial, sans CTA Cimolace).
  if ((k.method || []).length) {
    beats.push({
      reply: `La méthode est un chemin : comprendre, pratiquer, exercer, puis évoluer.`,
      keyword: 'un chemin',
      scene: {
        type: 'tutorial', title: 'La méthode, 4 temps',
        steps: k.method.slice(0, 5).map((m) => ({ title: m.step, detail: `${m.kind ? m.kind + ' — ' : ''}${(m.items || []).join(', ')}` })),
      },
    });
  }

  // 4 — Les forfaits (aside) — labels courts + prix, palier phare surligné.
  if ((k.offers || []).length) {
    const shortLabel = (nm) => nm.replace('Consultation privée', 'Consultation').replace('Mentorat Souverain / Privilégié', 'Mentorat').slice(0, 24);
    const items = k.offers.slice(0, 5)
      .filter((o) => !/autonome/i.test(o.name)) // 4 items max côté aside ; on garde les paliers phares
      .slice(0, 4)
      .map((o) => ({ label: shortLabel(o.name), value: `${o.price}${o.suffix || ''}`, note: o.desc && o.desc.slice(0, 80) }));
    const popular = k.offers.find((o) => o.popular);
    beats.push({
      reply: `Côté parcours, il y a un forfait pour chaque intention — de la consultation au mentorat.`,
      keyword: 'chaque intention',
      scene: { type: 'aside', side: 'right', title: 'Les forfaits', items, highlight: popular ? shortLabel(popular.name) : undefined },
    });
  }

  // 5 — Le fondateur (reader).
  if (k.founder && k.founder.name) {
    beats.push({
      reply: `Et tout cela porte une signature : celle du fondateur, ${k.founder.name}.`,
      keyword: k.founder.name,
      scene: {
        type: 'reader', title: 'Le fondateur',
        profile: {
          name: k.founder.name, role: k.founder.title, avatarSeed: k.founder.name,
          facts: [{ k: 'Rôle', v: 'Recteur de l’ISNA' }, { k: 'Mandat', v: 'Restaurer la dignité par la connaissance' }],
        },
        body: [
          { h: 'Sa vision', p: k.founder.bio },
          { h: 'Son mandat', p: k.vision.closing },
        ],
        suggestions: ['Vos forfaits ?', 'La méthode ?'],
      },
    });
  }

  // 6 — Final : retour à la présence-guide (pas de CTA Cimolace).
  beats.push({
    reply: `Voilà ${name} en un souffle. Dites-moi ce que vous voulez approfondir — je connais tout ce site.`,
    keyword: 'je connais tout',
    final: true,
  });

  return beats;
}

// Table (extensible) : slug tenant → knowledge pack. Pour l'instant seul isna/prorascience.
export const OS_KNOWLEDGE = { isna: PRORASCIENCE_KNOWLEDGE };
