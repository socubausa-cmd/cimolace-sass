/**
 * vnp.js — VibeNavigation Protocol (VNP), implémenté À LA LETTRE du cahier des charges.
 *
 * Le VNP remplace la navigation (menus/pages) par une conversation : le visiteur ne parcourt plus
 * des pages, il DIALOGUE. Ce module est la couche « Knowledge Graph + Moteur d'intentions » du VNP :
 *   - VNP_SUBJECTS  : la CARTOGRAPHIE UNIVERSELLE (16 sujets) — commune à tout site.
 *   - VNP_INTENTS   : les 9 INTENTIONS canoniques du doc (+ « visiter »).
 *   - buildVnpGraph : mappe un knowledge pack tenant → un GRAPHE de nœuds au schéma EXACT du doc
 *                     { id, title, summary, content, related[], actions[], resources[] }.
 *   - helpers       : accueil (suggestions = intentions), résolution de nœud, sérialisation cerveau.
 *
 * Générique (un standard) : marche pour n'importe quel tenant via son knowledge pack.
 * Réf : Cahier_des_Charges_VibeNavigation_Protocol_VNP.md (§ Architecture, Cartographie, Knowledge Graph, Intentions).
 */

// ── Cartographie universelle (§ doc) — l'ordre = l'ossature de tout site VNP. ──
export const VNP_SUBJECTS = [
  'identity', 'mission', 'vision', 'valeurs', 'histoire', 'equipe',
  'produits', 'services', 'solutions', 'realisations',
  'documentation', 'ressources', 'faq', 'contact', 'support', 'actions',
];

// ── Les 9 INTENTIONS canoniques (§ doc « Intentions ») + « visiter » (l'accueil intelligent). ──
// verb = mot d'action ; kind = comment le moteur la réalise (navigate | tour | compare | action).
export const VNP_INTENTS = [
  { id: 'visiter', label: 'Fais-moi visiter', verb: 'Visiter', icon: 'compass', kind: 'tour' },
  { id: 'decouvrir', label: 'Découvrir', verb: 'Découvrir', icon: 'sparkles', kind: 'navigate', target: 'identity' },
  { id: 'comprendre', label: 'Comprendre', verb: 'Comprendre', icon: 'book', kind: 'navigate', target: 'vision' },
  { id: 'comparer', label: 'Comparer', verb: 'Comparer', icon: 'scale', kind: 'compare', target: 'produits' },
  { id: 'acheter', label: 'Acheter', verb: 'Acheter', icon: 'cart', kind: 'action', action: 'acheter', target: 'produits' },
  { id: 'reserver', label: 'Réserver', verb: 'Réserver', icon: 'calendar', kind: 'action', action: 'reserver', target: 'produits' },
  { id: 'telecharger', label: 'Télécharger', verb: 'Télécharger', icon: 'download', kind: 'action', action: 'telecharger', target: 'ressources' },
  { id: 'participer', label: 'Participer', verb: 'Participer', icon: 'users', kind: 'action', action: 'participer', target: 'actions' },
  { id: 'contacter', label: 'Nous contacter', verb: 'Contacter', icon: 'mail', kind: 'action', action: 'contacter', target: 'contact' },
  { id: 'rejoindre', label: 'Rejoindre', verb: 'Rejoindre', icon: 'user-plus', kind: 'action', action: 'rejoindre', target: 'actions' },
];

export const vnpIntent = (id) => VNP_INTENTS.find((i) => i.id === id) || null;

// ── Nœud VNP au schéma EXACT du doc (§ Structure JSON). ──
const node = (id, title, summary, content, related = [], actions = [], resources = []) =>
  ({ id, title, summary, content, related, actions, resources });

/**
 * buildVnpGraph(knowledge, name) — instancie le graphe VNP d'un tenant depuis son knowledge pack.
 * Retourne { name, nodes:{id→node}, order:[id], byId(id), accueil:[intentSuggestions] }.
 * Le mapping ci-dessous est l'ADAPTATEUR prorascience→VNP (fidèle aux données réelles).
 */
export function buildVnpGraph(knowledge, name) {
  const k = knowledge || {};
  const id = k.identity || {};
  const brand = name || id.name || 'ce site';
  const vision = k.vision || {};
  const founder = k.founder || {};
  const offers = k.offers || [];
  const method = k.method || [];
  const stats = id.stats || [];
  const faqs = k.faq || [];

  const offerLine = (o) => `${o.name} — ${o.price}${o.suffix || ''} : ${o.desc}`;
  const nodes = {};
  const add = (n) => { nodes[n.id] = n; };

  add(node('identity', `Qu'est-ce que ${brand} ?`,
    id.subtitle || `Découvrez ${brand}.`,
    `${brand}${id.fullName ? ` (${id.fullName})` : ''}. ${vision.whatIs || ''}`.trim(),
    ['mission', 'vision', 'fondateur'], ['decouvrir', 'contacter'],
    id.website ? [{ label: 'Site', href: `https://${id.website}` }] : []));

  add(node('mission', 'Notre mission',
    'Restaurer la compréhension — comprendre, maîtriser, puis évoluer.',
    `${founder.bio || ''} ${vision.promise || ''}`.trim(),
    ['vision', 'valeurs', 'fondateur'], ['decouvrir', 'rejoindre']));

  add(node('vision', 'Notre vision',
    vision.problem || 'Notre regard sur le monde.',
    `${vision.whatIs || ''} ${vision.promise || ''} ${vision.closing || ''}`.trim(),
    ['mission', 'services', 'valeurs'], ['comprendre', 'rejoindre']));

  add(node('valeurs', 'Nos valeurs',
    'Les principes qui nous engagent.',
    (vision.values || []).map((v) => `${v.title} — ${v.desc}`).join(' '),
    ['vision', 'mission'], ['comprendre']));

  add(node('histoire', 'Notre histoire',
    `L'ISNA et le mandat de ${founder.name || 'son fondateur'}.`,
    `${founder.name || ''}, ${founder.title || ''}. ${founder.bio || ''}${stats.length ? ` À ce jour : ${stats.map((s) => `${s.value} ${s.label.toLowerCase()}`).join(', ')}.` : ''}`.trim(),
    ['fondateur', 'realisations', 'equipe'], ['decouvrir']));

  add(node('equipe', 'Notre équipe',
    `${founder.name || 'Le fondateur'} et les transmetteurs.`,
    `Sous la direction de ${founder.name || 'notre fondateur'} (${founder.title || ''})${stats.find((s) => /transmet/i.test(s.label)) ? `, ${stats.find((s) => /transmet/i.test(s.label)).value} transmetteurs accompagnent les étudiants.` : '.'}`,
    ['fondateur', 'contact'], ['contacter', 'rejoindre']));

  // Nœud fondateur (sujet phare prorascience — au-delà des 16 universels).
  add(node('fondateur', 'Le fondateur',
    `${founder.name || ''} — ${founder.title || ''}`.trim(),
    founder.bio || '',
    ['mission', 'histoire', 'equipe'], ['decouvrir', 'contacter']));

  add(node('produits', 'Nos forfaits',
    'Un forfait pour chaque intention — de la consultation au mentorat.',
    offers.map(offerLine).join(' '),
    ['services', 'solutions', 'contact'], ['comparer', 'acheter', 'reserver'],
    offers.map((o) => ({ label: o.name, value: `${o.price}${o.suffix || ''}` }))));

  add(node('services', 'Nos services',
    'La méthode, un chemin en quatre temps.',
    method.map((m) => `${m.step}${m.kind ? ` (${m.kind})` : ''} : ${(m.items || []).join(', ')}.`).join(' '),
    ['produits', 'solutions', 'documentation'], ['comprendre', 'rejoindre']));

  add(node('solutions', 'Nos parcours',
    'Des parcours selon votre intention : comprendre, pratiquer, exercer, évoluer.',
    method.map((m) => `${m.step} — ${m.foot || ''}`).join(' '),
    ['services', 'produits'], ['comparer', 'rejoindre']));

  add(node('realisations', 'Nos réalisations',
    'Ce que nous avons accompli.',
    stats.map((s) => `${s.value} ${s.label}`).join(' · '),
    ['histoire', 'identity'], ['decouvrir', 'rejoindre']));

  add(node('documentation', 'Documentation',
    'Les corpus et sciences enseignés.',
    `${(k.navigation || []).includes('Les 21 sciences') ? 'Les 21 sciences, ' : ''}${method.map((m) => m.kind).filter(Boolean).join(', ')}.`,
    ['services', 'ressources'], ['comprendre', 'telecharger']));

  add(node('ressources', 'Ressources',
    'Formations, ISNA Pro, mentorat, coaching.',
    (k.navigation || []).filter((n) => /formation|pro|mentorat|coaching|science/i.test(n)).join(', ') || 'Nos ressources d\'apprentissage.',
    ['documentation', 'produits'], ['telecharger', 'comprendre']));

  add(node('faq', 'Questions fréquentes',
    'Les réponses aux questions les plus courantes.',
    faqs.map((f) => `${f.q} — ${f.a}`).join(' '),
    ['vision', 'produits', 'contact'], ['comprendre', 'contacter']));

  add(node('contact', 'Nous contacter',
    'Parlez-nous — nous vous répondons.',
    `Laissez-nous un message et l'équipe de ${brand} vous recontacte.`,
    ['support', 'equipe'], ['contacter']));

  add(node('support', 'Support',
    'Besoin d\'aide ? Nous sommes là.',
    `Pour toute question sur votre parcours ou votre compte ${brand}, écrivez-nous.`,
    ['contact', 'faq'], ['contacter']));

  add(node('actions', 'Passer à l\'action',
    'Rejoignez, réservez, commencez maintenant.',
    `Choisissez un forfait, réservez une consultation, ou rejoignez ${brand}.`,
    ['produits', 'contact'], ['rejoindre', 'reserver', 'acheter']));

  const order = [...VNP_SUBJECTS.filter((s) => nodes[s])];
  if (nodes.fondateur && !order.includes('fondateur')) order.splice(order.indexOf('equipe') + 1, 0, 'fondateur');

  // Accueil intelligent (§ doc) — l'agent propose des INTENTIONS, pas des liens.
  const accueil = [
    { intent: 'visiter', label: 'Fais-moi visiter' },
    { intent: 'decouvrir', nodeId: 'identity', label: `Qu'est-ce que ${brand} ?` },
    { intent: 'comprendre', nodeId: 'mission', label: 'Notre mission' },
    { intent: 'comprendre', nodeId: 'vision', label: 'Notre vision' },
    { intent: 'comparer', nodeId: 'produits', label: 'Nos forfaits' },
    { intent: 'decouvrir', nodeId: 'fondateur', label: 'Le fondateur' },
    { intent: 'contacter', nodeId: 'contact', label: 'Nous contacter' },
  ];

  return {
    name: brand,
    nodes,
    order,
    accueil,
    byId: (nid) => nodes[nid] || null,
  };
}

// Sérialise le graphe en TEXTE compact pour le system prompt du cerveau (borne le périmètre + navigation).
export function vnpSerialize(graph) {
  if (!graph) return '';
  return graph.order.map((id) => {
    const n = graph.nodes[id];
    const rel = n.related && n.related.length ? ` [liés: ${n.related.join(', ')}]` : '';
    const act = n.actions && n.actions.length ? ` [actions: ${n.actions.join(', ')}]` : '';
    return `# ${n.id} — ${n.title}\n${n.summary}\n${n.content}${rel}${act}`;
  }).join('\n\n');
}

// Sujets liés → suggestions de suite (NAVIGATION GUIDÉE § doc).
export function vnpRelated(graph, id, max = 3) {
  const n = graph && graph.nodes[id];
  if (!n) return [];
  return (n.related || []).map((rid) => graph.nodes[rid]).filter(Boolean).slice(0, max)
    .map((r) => ({ nodeId: r.id, label: r.title }));
}
