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

  // Offres — alignées sur les prix RÉELLEMENT facturés par /forfaits (billing_plans isna,
  // famille `*-monthly` que ForfaitsPage requête). NE PAS diverger : tout changement de prix
  // se décide en base (billing_plans) PUIS se recopie ici. Clés → montants :
  // consultation-privee 50 €, autonome-monthly 29 €, academique-monthly 79 €,
  // prive-monthly 199 €, privilegie-monthly 390 €.
  offers: [
    { name: 'Consultation privée', price: '50 €', suffix: '/90 min', desc: 'Un diagnostic et une orientation personnalisés avec un praticien.' },
    { name: 'Cycle Autonome', price: '29 €', suffix: '/mois', desc: 'Accès aux cursus et modules pour apprendre en autonomie.' },
    { name: 'Cycle Académique', price: '79 €', suffix: '/mois', desc: 'Le parcours complet, encadré : cursus + modules + suivi.', popular: true },
    { name: 'Cycle Privé', price: '199 €', suffix: '/mois', desc: 'Accompagnement rapproché et coaching pour futurs praticiens.' },
    { name: 'Cycle Privilégié', price: '390 €', suffix: '/mois', desc: 'Le plus haut niveau : mentorat direct, cas complexes, secrets avancés.' },
  ],

  // Comparateur des 4 cycles MENSUELS (la consultation, one-off, est comparée à part).
  // Prix alignés sur billing_plans (`*-monthly`) — mêmes montants que le bloc offers ci-dessus.
  // Chaque case est DÉRIVÉE FIDÈLEMENT des descriptions ci-dessus (aucune feature inventée) :
  // « cursus + modules » (Autonome), « encadré : … + suivi » (Académique), « coaching pour
  // futurs praticiens » (Privé), « mentorat direct, cas complexes » (Privilégié).
  comparison: {
    intro: 'Les quatre cycles, du plus autonome au plus accompagné.',
    plans: [
      { name: 'Autonome', full: 'Cycle Autonome', price: '29 €', suffix: '/mois', desc: 'Accès aux cursus et modules pour apprendre en autonomie.' },
      { name: 'Académique', full: 'Cycle Académique', price: '79 €', suffix: '/mois', popular: true, desc: 'Le parcours complet, encadré : cursus + modules + suivi.' },
      { name: 'Privé', full: 'Cycle Privé', price: '199 €', suffix: '/mois', desc: 'Accompagnement rapproché et coaching pour futurs praticiens.' },
      { name: 'Privilégié', full: 'Cycle Privilégié', price: '390 €', suffix: '/mois', desc: 'Le plus haut niveau : mentorat direct, cas complexes, secrets avancés.' },
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
  const name = id.name || 'ce site';
  const founderFacts = [
    { k: 'Rôle', v: founder.title || 'Fondateur' },
    { k: 'Mandat', v: 'Restaurer la dignité par la connaissance' },
  ];

  switch (nodeId) {
    case 'identity':
      return {
        type: 'split', headline: `${name}${id.fullName ? ` — ${id.fullName}` : ''}`,
        left: { title: "Ce que c'est", subtitle: 'La discipline', points: ["L'étude du visible ET de l'invisible", 'Unir physique et métaphysique', 'Une école ET un temple'] },
        right: { title: 'Ce que ça change', subtitle: 'Pour vous', points: ['Comprendre, pas subir', 'Le pourquoi derrière le geste', 'Une transformation réelle'] },
        tone: { left: 'gold', right: 'terra' },
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
            kind: 'plan', title: o.name, value: `${o.price}${o.suffix || ''}`, note: o.desc,
            actions: ['acheter', 'reserver', 'contacter'],
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
      return founder.name ? {
        type: 'reader', title: 'Notre histoire',
        profile: { name: founder.name, role: founder.title, avatarSeed: founder.name,
          facts: [{ k: 'Mandat', v: 'Restaurer la dignité' }, ...stats.slice(0, 2).map((s) => ({ k: s.label, v: s.value }))] },
        body: [{ h: "L'origine", p: founder.bio }, { h: 'Le mandat', p: vision.closing || vision.promise }],
        suggestions: ['Le fondateur ?', 'Vos forfaits ?'],
      } : null;
    case 'fondateur':
      return founder.name ? {
        type: 'reader', title: 'Le fondateur',
        profile: { name: founder.name, role: founder.title, avatarSeed: founder.name, facts: founderFacts },
        body: [{ h: 'Sa vision', p: founder.bio }, { h: 'Son mandat', p: vision.closing }],
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
