/**
 * documentTemplateLibrary.js
 *
 * Couche de service sur les 100 templates administratifs.
 * Fournit :
 *   · requêtes (par domaine, type, recherche)
 *   · mappage type interne → JSON
 *   · fabrique Konva : templateToKonvaObjects(template)
 *
 * Import : import { getTemplatesByDocType, templateToKonvaObjects } from '…'
 */
import RAW from '@/data/documentTemplates.json';

/* ─── Données brutes ─────────────────────────────────────────────── */
export const TEMPLATES  = RAW.templates;   // Array<Template>
export const DOMAINS    = RAW.domains;     // Array<{id, count, document_type}>

/* ─── Icônes et couleurs par domaine ─────────────────────────────── */
export const DOMAIN_META = {
  letters:                   { icon: '📧', label: 'Lettres',              color: '#22d3ee' },
  contracts:                 { icon: '📋', label: 'Contrats',             color: '#8b5cf6' },
  attestations_certificates: { icon: '📜', label: 'Attestations & Certif',color: '#f59e0b' },
  business:                  { icon: '🧾', label: 'Business',             color: '#f97316' },
  education:                 { icon: '🎓', label: 'Éducation',            color: '#10b981' },
  cv_profiles:               { icon: '👤', label: 'CV & Profils',         color: '#34d399' },
  reports:                   { icon: '📊', label: 'Rapports',             color: '#3b82f6' },
  legal_simple:              { icon: '⚖️',  label: 'Juridique',            color: '#e11d48' },
  hr:                        { icon: '🏢', label: 'Ressources Humaines',  color: '#a855f7' },
  personal:                  { icon: '📄', label: 'Documents personnels', color: '#06b6d4' },
};

/* ─── Mappage type interne coach → document_type JSON ──────────── */
export const COACH_TYPE_TO_JSON_DOMAIN = {
  letter:          ['letters', 'personal'],
  contract:        ['contracts'],
  attestation:     ['attestations_certificates'],
  cv:              ['cv_profiles'],
  invoice:         ['business'],
  minutes:         ['business'],
  certificate:     ['attestations_certificates'],
  report:          ['reports'],
  internal_policy: ['legal_simple', 'hr'],
  student_record:  ['education'],
};

/* ─── Requêtes ───────────────────────────────────────────────────── */
export const getTemplateById   = (id)     => TEMPLATES.find(t => t.id === id) ?? null;

/** Premier type coach dont le domaine JSON correspond (pour rapprochement template). */
export function inferCoachTypeFromDomain(domain) {
  if (!domain || typeof domain !== 'string') return null;
  for (const [coachType, domains] of Object.entries(COACH_TYPE_TO_JSON_DOMAIN)) {
    if (Array.isArray(domains) && domains.includes(domain)) return coachType;
  }
  return null;
}
export const getTemplatesByDomain = (dom) => TEMPLATES.filter(t => t.domain === dom);
export const getTemplatesByDocType = (dt) => TEMPLATES.filter(t => t.document_type === dt);

/** Retourne les templates correspondant à un type coach interne */
export function getTemplatesForCoachType(coachType) {
  const domains = COACH_TYPE_TO_JSON_DOMAIN[coachType] ?? [];
  return TEMPLATES.filter(t => domains.includes(t.domain));
}

/** Recherche textuelle dans name + description */
export function searchTemplates(query) {
  const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return TEMPLATES.filter(t =>
    t.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q) ||
    (t.description ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q) ||
    t.domain.includes(q),
  );
}

/* ═══════════════════════════════════════════════════════════════════
   FABRIQUE KONVA — Zone → objets Konva
═══════════════════════════════════════════════════════════════════ */

/* A4 @96dpi constants */
const ML = 52;
const MT = 72;
const CW = 690;
const AH = 1123;
const MB = 70;

let _gidCounter = 0;
function gid() {
  _gidCounter++;
  return `tpl_${Date.now()}_${_gidCounter}`;
}

const BASE_STYLE = {
  fontFamily: 'Georgia, serif',
  fontSize: 12,
  fontWeight: 400,
  fill: '#1e293b',
  lineHeight: 1.65,
  letterSpacing: 0,
  align: 'left',
};

function mkText(x, y, w, h, text, style = {}) {
  return {
    id: gid(), type: 'text',
    x, y, width: w, height: h,
    rotation: 0, layer: 1, visible: true, locked: false,
    step: 0, visibleFor: 'both',
    content: { text },
    style: { ...BASE_STYLE, ...style },
    opacity: 1,
  };
}

function mkRect(x, y, w, h, style = {}) {
  return {
    id: gid(), type: 'rect',
    x, y, width: w, height: h,
    rotation: 0, layer: 1, visible: true, locked: false,
    step: 0, visibleFor: 'both',
    content: {},
    style: { fill: 'transparent', stroke: '#e2e8f0', strokeWidth: 1, cornerRadius: 3, ...style },
    opacity: 1,
  };
}

function mkLine(x, y, w, style = {}) {
  return {
    id: gid(), type: 'line',
    x, y, width: Math.max(14, w), height: 2,
    rotation: 0, layer: 1, visible: true, locked: false,
    step: 0, visibleFor: 'both',
    content: { points: [0, 0, w, 0] },
    style: { stroke: '#cbd5e1', strokeWidth: 0.75, ...style },
    opacity: 1,
  };
}

/** Trait vertical (séparateur de colonne de tableau). */
function mkVLine(x, y, h, style = {}) {
  return {
    id: gid(), type: 'line',
    x, y, width: 2, height: Math.max(2, h),
    rotation: 0, layer: 1, visible: true, locked: false,
    step: 0, visibleFor: 'both',
    content: { points: [0, 0, 0, h] },
    style: { stroke: '#e2e8f0', strokeWidth: 0.75, ...style },
    opacity: 1,
  };
}

/* ═══════════════════════════════════════════════════════════════════
   FABRIQUES DE TABLEAUX — module voisin documentTables.js
   ⚠️ CONTRAINTE : documentTables.js est produit par un chantier parallèle.
   Un `import` statique ferait tomber TOUT ce module (donc les 100 modèles)
   tant que le fichier n'est pas là. D'où la résolution tolérante :
     1. injection explicite (coque / test) via enregistrerFabriquesTableau()
     2. auto-résolution Vite (import.meta.glob, absent sous Node → catch)
     3. repli interne — un tableau doit sortir dans tous les cas.
═══════════════════════════════════════════════════════════════════ */
let _fabriquesTableau = null;

/** Branche le module documentTables.js (ou tout objet exposant creerTableau/creerTableauDevis). */
export function enregistrerFabriquesTableau(mod) {
  _fabriquesTableau = mod && typeof mod === 'object' ? mod : null;
  return sourceFabriquesTableau();
}

/** Diagnostic : d'où viennent les tableaux réellement rendus. */
export function sourceFabriquesTableau() {
  const m = _fabriquesTableau;
  return {
    creerTableau: typeof m?.creerTableau === 'function',
    creerTableauDevis: typeof m?.creerTableauDevis === 'function',
    source: m ? 'documentTables.js' : 'repli interne',
  };
}

(function autoResoudreFabriquesTableau() {
  try {
    // Vite remplace cet appel à la compilation ; sous Node il lève → repli.
    const mods = import.meta.glob('./documentTables.js', { eager: true });
    const mod = mods && Object.values(mods)[0];
    if (mod) _fabriquesTableau = mod;
  } catch {
    /* module voisin pas encore livré : le repli interne prend la main */
  }
})();

/** Normalise le retour d'une fabrique externe ({objects,hauteur} | {objects,nextY} | tableau brut). */
function normaliserRetourTableau(brut, y) {
  const objs = Array.isArray(brut) ? brut
    : Array.isArray(brut?.objects) ? brut.objects
      : null;
  if (!objs || objs.length === 0) return null;
  const bas = objs.reduce((m, o) => Math.max(m, (o?.y ?? y) + (o?.height ?? 0)), y);
  const nextY = Number.isFinite(brut?.nextY) ? brut.nextY
    : Number.isFinite(brut?.hauteur) ? y + brut.hauteur + 8
      : bas + 8;
  return { objects: objs, nextY };
}

function appelerFabrique(nom, args) {
  const fn = typeof _fabriquesTableau?.[nom] === 'function' ? _fabriquesTableau[nom] : null;
  if (!fn) return null;
  try {
    return normaliserRetourTableau(fn(args), args.y);
  } catch {
    // ⚠️ une fabrique voisine qui casse ne doit JAMAIS vider le modèle
    return null;
  }
}

/* ─── Repli interne : vrai tableau (en-tête, lignes, filets, totaux) ── */
const TAB_H_ENTETE = 28;
const TAB_H_LIGNE  = 24;

function largeursColonnes(cols, w) {
  const somme = cols.reduce((s, c) => s + (Number(c.largeur) || 1), 0);
  const larg = cols.map(c => Math.round((w * (Number(c.largeur) || 1)) / somme));
  larg[larg.length - 1] = w - larg.slice(0, -1).reduce((a, b) => a + b, 0);
  return larg;
}

/* Repli : grille seule (titre, totaux et note sont posés par poserTableau). */
function tableauRepli(x, y, w, schema) {
  const objects = [];
  const cols = schema.colonnes ?? [{ titre: 'Colonne', largeur: 1 }];
  const lignes = schema.lignes ?? [];
  const larg = largeursColonnes(cols, w);
  const cy = y;

  const hCorps = TAB_H_ENTETE + lignes.length * TAB_H_LIGNE;

  // En-tête
  objects.push(mkRect(x, cy, w, TAB_H_ENTETE,
    { fill: 'rgba(30,58,95,0.08)', stroke: '#cbd5e1', cornerRadius: 2 }));
  let hx = x;
  cols.forEach((c, i) => {
    objects.push(mkText(hx + 8, cy + 8, Math.max(20, larg[i] - 16), 14, c.titre ?? '',
      { fontSize: 9.5, fontWeight: 700, fill: '#1e3a5f', letterSpacing: 0.6, lineHeight: 1.2, align: c.align ?? 'left' }));
    hx += larg[i];
  });

  // Lignes
  let ly = cy + TAB_H_ENTETE;
  lignes.forEach((ligne, r) => {
    if (r % 2 === 1) {
      objects.push(mkRect(x, ly, w, TAB_H_LIGNE,
        { fill: 'rgba(241,245,249,0.6)', stroke: 'transparent', strokeWidth: 0, cornerRadius: 0 }));
    }
    let lx = x;
    cols.forEach((c, i) => {
      objects.push(mkText(lx + 8, ly + 6, Math.max(20, larg[i] - 16), 14, String(ligne?.[i] ?? ''),
        { fontSize: 10, lineHeight: 1.2, align: c.align ?? 'left' }));
      lx += larg[i];
    });
    objects.push(mkLine(x, ly + TAB_H_LIGNE, w, { stroke: '#e2e8f0' }));
    ly += TAB_H_LIGNE;
  });

  // Cadre + séparateurs de colonnes
  objects.push(mkRect(x, cy, w, hCorps, { fill: 'transparent', stroke: '#cbd5e1', cornerRadius: 2 }));
  let sx = x;
  cols.slice(0, -1).forEach((_, i) => {
    sx += larg[i];
    objects.push(mkVLine(sx, cy, hCorps, { stroke: '#e2e8f0' }));
  });

  return { objects, nextY: ly + 10 };
}

/* Les largeurs de colonnes des schémas sont des POIDS ; creerTableau attend
   soit des ratios ≤ 1, soit des pixels — d'où la conversion en ratios. */
function colonnesEnRatios(cols) {
  const somme = cols.reduce((s, c) => s + (Number(c.largeur) || 1), 0);
  return cols.map((c, i) => ({
    cle: c.cle ?? `c${i}`,
    titre: c.titre ?? '',
    align: c.align ?? 'left',
    largeur: (Number(c.largeur) || 1) / somme,
  }));
}

/** Bloc de totaux « maison » (utilisé hors devis, ou si la fabrique est absente). */
function objetsTotauxSimples(x, y, w, totaux) {
  const objects = [];
  let cy = y;
  for (const t of totaux) {
    const lx = x + w - 250;
    if (t.fort) objects.push(mkLine(lx, cy - 6, 250, { stroke: '#94a3b8', strokeWidth: 1 }));
    objects.push(
      mkText(lx, cy, 150, 16, t.libelle,
        { fontSize: t.fort ? 11 : 10, fontWeight: t.fort ? 700 : 500, align: 'right' }),
      mkText(lx + 158, cy, 92, 16, t.valeur,
        { fontSize: t.fort ? 11 : 10, fontWeight: t.fort ? 700 : 500, align: 'right' }),
    );
    cy += 20;
  }
  return { objects, nextY: cy + 4 };
}

/**
 * Pose un tableau : fabrique voisine documentTables.js si dispo, repli sinon.
 * Le titre, la note et — hors devis — les totaux restent posés ici : la
 * fabrique voisine ne rend que la grille (et les totaux du devis).
 */
function poserTableau(y, schema) {
  const objects = [];
  let cy = y;

  if (schema.titre) {
    objects.push(mkText(ML, cy, CW, 18, schema.titre,
      { fontSize: 11, fontWeight: 700, letterSpacing: 0.8, fill: '#475569' }));
    cy += 26;
  }

  const estDevis = schema.kind === 'devis';
  const corps = estDevis
    ? appelerFabrique('creerTableauDevis', {
        x: ML, y: cy, largeur: CW, width: CW,
        lignes: schema.lignesDevis ?? [],
        lignesVides: schema.lignesVides ?? 3,
        tauxTva: schema.tauxTva ?? 20,
        devise: schema.devise ?? 'EUR',
      })
    : appelerFabrique('creerTableau', {
        x: ML, y: cy, largeur: CW, width: CW,
        colonnes: colonnesEnRatios(schema.colonnes ?? []),
        lignes: schema.lignes ?? [],
      });

  const externe = Boolean(corps);
  const grille = corps ?? tableauRepli(ML, cy, CW, schema);
  objects.push(...grille.objects);
  cy = grille.nextY;

  // Les totaux du devis viennent de la fabrique ; ailleurs (ou en repli) ils sont posés ici.
  const totaux = schema.totaux ?? [];
  if (totaux.length && !(estDevis && externe)) {
    const bloc = objetsTotauxSimples(ML, cy + 6, CW, totaux);
    objects.push(...bloc.objects);
    cy = bloc.nextY;
  }

  if (schema.note) {
    objects.push(mkText(ML, cy + 4, CW, 16, schema.note,
      { fontSize: 9, fill: '#64748b', lineHeight: 1.4 }));
    cy += 26;
  }

  return { objects, nextY: cy };
}

/* ═══════════════════════════════════════════════════════════════════
   MATIÈRE MÉTIER — le contenu qui différencie les 100 modèles.
   Clé = slug du modèle ; repli = domaine.
═══════════════════════════════════════════════════════════════════ */

/* Articles de contrat (domaine contracts, zone « articles ») */
const ARTICLES_CONTRAT = {
  contract_service: [
    ['ARTICLE 1 — OBJET', "Le Prestataire réalise pour le Client la prestation suivante : [description précise des travaux, livrables attendus et périmètre exclu]."],
    ['ARTICLE 2 — DURÉE ET DÉLAIS', "La prestation débute le [Date] et s'achève le [Date]. Tout retard imputable au Client décale les délais d'autant."],
    ['ARTICLE 3 — PRIX ET RÈGLEMENT', "Le prix est fixé à [Montant] € HT, payable [acompte / échéancier]. Tout retard de paiement entraîne les pénalités légales."],
    ['ARTICLE 4 — RÉSILIATION ET LITIGES', "Chaque partie peut résilier avec un préavis de [durée] par lettre recommandée. À défaut d'accord amiable, compétence est donnée au tribunal de [Ville]."],
  ],
  contract_employment: [
    ['ARTICLE 1 — ENGAGEMENT ET FONCTION', "Le Salarié est engagé en qualité de [Intitulé du poste], statut [cadre / non-cadre], à compter du [Date d'entrée]."],
    ['ARTICLE 2 — PÉRIODE D\'ESSAI', "Le contrat est assorti d'une période d'essai de [durée], renouvelable une fois dans les conditions prévues par la convention collective."],
    ['ARTICLE 3 — RÉMUNÉRATION ET DURÉE DU TRAVAIL', "La rémunération brute mensuelle est de [Montant] € pour [35 h] hebdomadaires, versée le [jour] de chaque mois."],
    ['ARTICLE 4 — OBLIGATIONS ET RUPTURE', "Le Salarié s'engage à la loyauté et à la confidentialité. La rupture obéit aux dispositions légales et conventionnelles applicables."],
  ],
  contract_partnership: [
    ['ARTICLE 1 — OBJET DU PARTENARIAT', "Les Parties s'associent en vue de [objectif commun], dans le respect de leur autonomie juridique et financière respective."],
    ['ARTICLE 2 — APPORTS ET ENGAGEMENTS', "La Partie A apporte [moyens, ressources, notoriété]. La Partie B apporte [moyens, ressources, réseau]."],
    ['ARTICLE 3 — GOUVERNANCE ET PARTAGE', "Un comité de pilotage se réunit [fréquence]. Les revenus et charges sont répartis selon la clé suivante : [répartition]."],
    ['ARTICLE 4 — DURÉE, SORTIE ET CONFIDENTIALITÉ', "Le partenariat est conclu pour [durée], reconductible. Chaque Partie garde confidentielles les informations reçues pendant [durée]."],
  ],
  contract_nda: [
    ['ARTICLE 1 — INFORMATIONS CONFIDENTIELLES', "Est confidentielle toute information, quel qu'en soit le support, communiquée par la Partie émettrice et non tombée dans le domaine public."],
    ['ARTICLE 2 — ENGAGEMENT DE NON-DIVULGATION', "La Partie réceptrice s'interdit de divulguer, copier ou exploiter ces informations à d'autres fins que [finalité du projet]."],
    ['ARTICLE 3 — DURÉE DE L\'ENGAGEMENT', "L'obligation de confidentialité court pendant toute la relation et [durée] après son terme, quelle qu'en soit la cause."],
    ['ARTICLE 4 — RESTITUTION ET SANCTION', "À première demande, tout document est restitué ou détruit. Tout manquement engage la responsabilité de son auteur."],
  ],
  contract_rental: [
    ['ARTICLE 1 — DÉSIGNATION DU BIEN', "Le Bailleur donne à bail le bien situé [Adresse complète], d'une surface de [m²], composé de [description des pièces]."],
    ['ARTICLE 2 — DURÉE ET DESTINATION', "Le bail est consenti pour [durée] à compter du [Date], à usage exclusif de [habitation / professionnel]."],
    ['ARTICLE 3 — LOYER, CHARGES ET DÉPÔT', "Le loyer mensuel est de [Montant] €, charges [Montant] €, payable le [jour]. Un dépôt de garantie de [Montant] € est versé à la signature."],
    ['ARTICLE 4 — ÉTAT DES LIEUX ET OBLIGATIONS', "Un état des lieux contradictoire est établi à l'entrée et à la sortie. Le Locataire entretient le bien et souscrit une assurance habitation."],
  ],
  contract_terms_sale: [
    ['ARTICLE 1 — CHAMP D\'APPLICATION', "Les présentes conditions régissent toute commande passée auprès de [Dénomination] et priment sur les conditions d'achat du Client."],
    ['ARTICLE 2 — COMMANDE ET PRIX', "Toute commande vaut acceptation des présentes. Les prix sont exprimés en euros HT, hors frais de livraison."],
    ['ARTICLE 3 — LIVRAISON ET TRANSFERT DE RISQUE', "La livraison intervient sous [délai]. Le transfert des risques s'opère à la remise du bien au Client."],
    ['ARTICLE 4 — GARANTIE, RÉTRACTATION ET LITIGES', "Le Client bénéficie des garanties légales et, le cas échéant, d'un droit de rétractation de 14 jours. Droit applicable : [pays]."],
  ],
  contract_collaboration: [
    ['ARTICLE 1 — OBJET DE LA COLLABORATION', "Les Parties collaborent sur [projet / mission], chacune conservant la maîtrise de ses moyens et de son organisation."],
    ['ARTICLE 2 — RÔLES ET LIVRABLES', "La Partie A prend en charge [périmètre]. La Partie B prend en charge [périmètre]. Livrables attendus : [liste]."],
    ['ARTICLE 3 — CALENDRIER ET SUIVI', "Le calendrier des jalons figure en annexe. Un point d'avancement est tenu [fréquence]."],
    ['ARTICLE 4 — PROPRIÉTÉ ET RÉSILIATION', "Les résultats communs sont [copropriété / attribution]. Chaque Partie peut mettre fin à la collaboration moyennant [préavis]."],
  ],
  contract_freelance: [
    ['ARTICLE 1 — MISSION CONFIÉE', "L'Indépendant réalise la mission suivante : [description], en toute autonomie et sans lien de subordination."],
    ['ARTICLE 2 — STATUT ET INDÉPENDANCE', "L'Indépendant déclare être régulièrement immatriculé sous le numéro [SIRET / RCCM] et assume ses obligations fiscales et sociales."],
    ['ARTICLE 3 — HONORAIRES ET FACTURATION', "Les honoraires s'élèvent à [Montant] € [par jour / au forfait], facturés [périodicité] et payables à [délai] jours."],
    ['ARTICLE 4 — PROPRIÉTÉ INTELLECTUELLE ET FIN DE MISSION', "Les droits sur les livrables sont cédés au Client au paiement intégral. La mission prend fin le [Date] ou par préavis de [durée]."],
  ],
  contract_rights_assignment: [
    ['ARTICLE 1 — ŒUVRE CÉDÉE', "Le Cédant cède au Cessionnaire les droits patrimoniaux sur l'œuvre suivante : [titre, nature, support, date de création]."],
    ['ARTICLE 2 — DROITS CÉDÉS', "La cession porte sur les droits de reproduction, de représentation et d'adaptation, pour les supports suivants : [liste]."],
    ['ARTICLE 3 — ÉTENDUE, DURÉE ET TERRITOIRE', "La cession est consentie pour [durée] et pour le territoire de [zone géographique]."],
    ['ARTICLE 4 — PRIX ET DROIT MORAL', "En contrepartie, le Cessionnaire verse [Montant] € [forfait / pourcentage]. Le droit moral du Cédant demeure incessible."],
  ],
  contract_commitment: [
    ['ARTICLE 1 — OBJET DE L\'ENGAGEMENT', "Le Signataire s'engage à [nature précise de l'engagement pris] au bénéfice de [Bénéficiaire]."],
    ['ARTICLE 2 — CONDITIONS D\'EXÉCUTION', "L'engagement est exécuté selon les modalités suivantes : [moyens, lieu, fréquence, indicateurs de bonne exécution]."],
    ['ARTICLE 3 — DURÉE ET RÉVISION', "L'engagement prend effet le [Date] pour [durée]. Toute modification fait l'objet d'un avenant écrit."],
    ['ARTICLE 4 — MANQUEMENT', "En cas de manquement, le Bénéficiaire peut mettre en demeure le Signataire par écrit et, à défaut de régularisation sous [délai], y mettre fin."],
  ],
};

const ARTICLES_DEFAUT = [
  ['ARTICLE 1 — OBJET', "Le présent acte a pour objet [description précise des engagements pris par chaque partie]."],
  ['ARTICLE 2 — DURÉE', "Il prend effet le [Date de début] pour une durée de [durée], soit jusqu'au [Date de fin]."],
  ['ARTICLE 3 — CONDITIONS FINANCIÈRES', "La somme de [Montant] € est due selon les modalités suivantes : [conditions de paiement]."],
  ['ARTICLE 4 — RÉSILIATION ET LITIGES', "Chaque partie peut résilier moyennant un préavis de [durée]. Compétence : tribunal de [Ville]."],
];

/* Sections de rapport (domaine reports, zone « sections ») */
const SECTIONS_RAPPORT = {
  report_professional:      ['Contexte et périmètre', 'Méthodologie', 'Résultats et analyse', 'Conclusions et recommandations'],
  report_administrative:    ['Rappel de la saisine', 'Éléments de procédure', 'Constats', 'Suites à donner'],
  report_study:             ['Problématique', 'Méthode et sources', 'Résultats de l\'étude', 'Enseignements et pistes'],
  report_mission:           ['Objet de la mission', 'Déroulement et personnes rencontrées', 'Observations', 'Recommandations'],
  report_technical:         ['Périmètre technique', 'Architecture et choix retenus', 'Tests et mesures', 'Limites et plan d\'action'],
  report_annual:            ['Faits marquants de l\'année', 'Activité et chiffres clés', 'Ressources et moyens', 'Perspectives'],
  report_white_paper:       ['Le problème', 'État des pratiques', 'La solution proposée', 'Mise en œuvre et bénéfices'],
  report_presentation_file: ['Présentation de la structure', 'Offre et références', 'Organisation et moyens', 'Proposition et suites'],
  report_internal_audit:    ['Champ et référentiel de l\'audit', 'Travaux réalisés', 'Constats et niveaux de risque', 'Plan de remédiation'],
  report_project:           ['Cadrage du projet', 'Avancement et jalons', 'Risques et points de vigilance', 'Décisions attendues'],
};
const SECTIONS_DEFAUT = ['Contexte', 'Analyse', 'Résultats', 'Conclusions et recommandations'];

const TEXTE_SECTION = [
  "[Posez ici le cadre : périmètre, commanditaire, période couverte et question à laquelle ce document répond.]",
  "[Décrivez la démarche suivie, les sources mobilisées et les limites assumées de l'exercice.]",
  "[Exposez les faits, chiffres et observations. Un tableau ou un graphique peut être inséré à cet endroit.]",
  "[Formulez des conclusions priorisées, chacune assortie d'une action, d'un responsable et d'une échéance.]",
];

/* Schémas de tableaux (zone « table ») — clé = slug, repli = domaine */
const TABLEAU_PAR_SLUG = {
  business_invoice: {
    kind: 'devis', titre: 'DÉTAIL DE LA FACTURE',
    colonnes: [
      { titre: 'Désignation', largeur: 3.2 },
      { titre: 'Qté', largeur: 0.7, align: 'center' },
      { titre: 'P.U. HT', largeur: 1, align: 'right' },
      { titre: 'Total HT', largeur: 1.1, align: 'right' },
    ],
    lignes: [
      ['[Prestation ou produit 1]', '1', '0,00', '0,00'],
      ['[Prestation ou produit 2]', '1', '0,00', '0,00'],
      ['[Prestation ou produit 3]', '1', '0,00', '0,00'],
    ],
    lignesDevis: [
      { designation: '[Prestation ou produit 1]', quantite: 1, prixUnitaire: 0 },
      { designation: '[Prestation ou produit 2]', quantite: 1, prixUnitaire: 0 },
      { designation: '[Prestation ou produit 3]', quantite: 1, prixUnitaire: 0 },
    ],
    totaux: [
      { libelle: 'Total HT', valeur: '0,00 €' },
      { libelle: 'TVA [20] %', valeur: '0,00 €' },
      { libelle: 'TOTAL TTC', valeur: '0,00 €', fort: true },
    ],
    note: "Paiement à réception. Pénalités de retard au taux légal. Pas d'escompte pour paiement anticipé.",
  },
  business_quote: {
    kind: 'devis', titre: 'DÉTAIL DU DEVIS',
    colonnes: [
      { titre: 'Prestation', largeur: 3.2 },
      { titre: 'Qté', largeur: 0.7, align: 'center' },
      { titre: 'P.U. HT', largeur: 1, align: 'right' },
      { titre: 'Total HT', largeur: 1.1, align: 'right' },
    ],
    lignes: [
      ['[Prestation 1 — description courte]', '1', '0,00', '0,00'],
      ['[Prestation 2 — description courte]', '1', '0,00', '0,00'],
      ['[Option — facultative]', '1', '0,00', '0,00'],
    ],
    lignesDevis: [
      { designation: '[Prestation 1 — description courte]', quantite: 1, prixUnitaire: 0 },
      { designation: '[Prestation 2 — description courte]', quantite: 1, prixUnitaire: 0 },
      { designation: '[Option — facultative]', quantite: 1, prixUnitaire: 0 },
    ],
    totaux: [
      { libelle: 'Total HT', valeur: '0,00 €' },
      { libelle: 'TVA [20] %', valeur: '0,00 €' },
      { libelle: 'TOTAL TTC', valeur: '0,00 €', fort: true },
    ],
    note: "Devis valable [30] jours. Bon pour accord, date et signature du client à porter ci-dessous.",
  },
  business_purchase_order: {
    // La référence article vit dans la désignation : la fabrique devis fixe
    // ses 4 colonnes, et c'est elle qui porte le recalcul des totaux.
    kind: 'devis', titre: 'ARTICLES COMMANDÉS',
    colonnes: [
      { titre: 'Désignation', largeur: 3.2 },
      { titre: 'Qté', largeur: 0.7, align: 'center' },
      { titre: 'P.U. HT', largeur: 1, align: 'right' },
      { titre: 'Total HT', largeur: 1.1, align: 'right' },
    ],
    lignes: [
      ['[REF-001] — [Désignation article]', '1', '0,00', '0,00'],
      ['[REF-002] — [Désignation article]', '1', '0,00', '0,00'],
    ],
    lignesDevis: [
      { designation: '[REF-001] — [Désignation article]', quantite: 1, prixUnitaire: 0 },
      { designation: '[REF-002] — [Désignation article]', quantite: 1, prixUnitaire: 0 },
    ],
    totaux: [
      { libelle: 'Total HT', valeur: '0,00 €' },
      { libelle: 'TOTAL TTC', valeur: '0,00 €', fort: true },
    ],
    note: 'Livraison souhaitée le [Date] à l\'adresse indiquée en en-tête.',
  },
  business_activity_report: {
    titre: 'INDICATEURS DE LA PÉRIODE',
    colonnes: [
      { titre: 'Activité', largeur: 2.4 },
      { titre: 'Objectif', largeur: 1, align: 'center' },
      { titre: 'Réalisé', largeur: 1, align: 'center' },
      { titre: 'Écart', largeur: 1, align: 'center' },
    ],
    lignes: [
      ['[Activité 1]', '[—]', '[—]', '[—]'],
      ['[Activité 2]', '[—]', '[—]', '[—]'],
      ['[Activité 3]', '[—]', '[—]', '[—]'],
    ],
  },
  business_meeting_minutes: {
    titre: 'DÉCISIONS ET ACTIONS',
    colonnes: [
      { titre: 'Décision / action', largeur: 3 },
      { titre: 'Responsable', largeur: 1.3 },
      { titre: 'Échéance', largeur: 1, align: 'center' },
    ],
    lignes: [
      ['[Décision prise en séance]', '[Nom]', '[JJ/MM]'],
      ['[Action à mener]', '[Nom]', '[JJ/MM]'],
      ['[Point reporté]', '[Nom]', '[JJ/MM]'],
    ],
  },
  business_official_minutes: {
    titre: 'RÉSOLUTIONS SOUMISES AU VOTE',
    colonnes: [
      { titre: 'Résolution', largeur: 3 },
      { titre: 'Pour', largeur: 0.7, align: 'center' },
      { titre: 'Contre', largeur: 0.7, align: 'center' },
      { titre: 'Abst.', largeur: 0.7, align: 'center' },
    ],
    lignes: [
      ['[Première résolution]', '[—]', '[—]', '[—]'],
      ['[Deuxième résolution]', '[—]', '[—]', '[—]'],
    ],
  },
  business_client_sheet: {
    titre: 'FICHE SIGNALÉTIQUE',
    colonnes: [
      { titre: 'Rubrique', largeur: 1.2 },
      { titre: 'Information', largeur: 2.8 },
    ],
    lignes: [
      ['Raison sociale', '[Dénomination]'],
      ['Contact principal', '[Nom — Fonction — Tél — Email]'],
      ['Adresse', '[Adresse complète]'],
      ['Identifiant fiscal', '[SIRET / RCCM / NIF]'],
      ['Conditions de règlement', '[Délai — Mode]'],
    ],
  },
  business_financial_report: {
    titre: 'SYNTHÈSE FINANCIÈRE',
    colonnes: [
      { titre: 'Poste', largeur: 2.4 },
      { titre: 'Budget', largeur: 1, align: 'right' },
      { titre: 'Réalisé', largeur: 1, align: 'right' },
      { titre: 'Écart', largeur: 1, align: 'right' },
    ],
    lignes: [
      ['Produits d\'exploitation', '0,00', '0,00', '0,00'],
      ['Charges de personnel', '0,00', '0,00', '0,00'],
      ['Autres charges', '0,00', '0,00', '0,00'],
    ],
    totaux: [{ libelle: 'RÉSULTAT', valeur: '0,00 €', fort: true }],
  },
  business_action_plan: {
    titre: 'PLAN D\'ACTIONS',
    colonnes: [
      { titre: 'Action', largeur: 2.6 },
      { titre: 'Responsable', largeur: 1.2 },
      { titre: 'Échéance', largeur: 0.9, align: 'center' },
      { titre: 'Statut', largeur: 0.9, align: 'center' },
    ],
    lignes: [
      ['[Action prioritaire]', '[Nom]', '[JJ/MM]', 'À faire'],
      ['[Action secondaire]', '[Nom]', '[JJ/MM]', 'En cours'],
      ['[Action de suivi]', '[Nom]', '[JJ/MM]', 'À faire'],
    ],
  },
  business_internal_strategy: {
    titre: 'AXES STRATÉGIQUES',
    colonnes: [
      { titre: 'Axe', largeur: 1.4 },
      { titre: 'Objectif visé', largeur: 2 },
      { titre: 'Moyens', largeur: 1.6 },
      { titre: 'Horizon', largeur: 0.9, align: 'center' },
    ],
    lignes: [
      ['[Axe 1]', '[Objectif mesurable]', '[Moyens engagés]', '[T1]'],
      ['[Axe 2]', '[Objectif mesurable]', '[Moyens engagés]', '[T2]'],
    ],
  },
  education_report_card: {
    titre: 'RÉSULTATS PAR MATIÈRE',
    colonnes: [
      { titre: 'Matière', largeur: 1.8 },
      { titre: 'Note /20', largeur: 0.8, align: 'center' },
      { titre: 'Moy. classe', largeur: 0.9, align: 'center' },
      { titre: 'Appréciation', largeur: 2.3 },
    ],
    lignes: [
      ['[Matière 1]', '[—]', '[—]', '[Appréciation du professeur]'],
      ['[Matière 2]', '[—]', '[—]', '[Appréciation du professeur]'],
      ['[Matière 3]', '[—]', '[—]', '[Appréciation du professeur]'],
    ],
    totaux: [{ libelle: 'Moyenne générale', valeur: '[—] /20', fort: true }],
  },
  education_attendance_sheet: {
    titre: 'FEUILLE DE PRÉSENCE',
    colonnes: [
      { titre: 'Nom et prénom', largeur: 2.2 },
      { titre: 'Matin', largeur: 0.8, align: 'center' },
      { titre: 'Après-midi', largeur: 0.9, align: 'center' },
      { titre: 'Signature', largeur: 1.6 },
    ],
    lignes: [
      ['[Participant 1]', '', '', ''],
      ['[Participant 2]', '', '', ''],
      ['[Participant 3]', '', '', ''],
      ['[Participant 4]', '', '', ''],
    ],
  },
  education_training_program: {
    titre: 'PROGRAMME DÉTAILLÉ',
    colonnes: [
      { titre: 'Séance', largeur: 0.8, align: 'center' },
      { titre: 'Thème', largeur: 2.2 },
      { titre: 'Objectifs pédagogiques', largeur: 2.2 },
      { titre: 'Durée', largeur: 0.8, align: 'center' },
    ],
    lignes: [
      ['1', '[Thème de la séance]', '[Objectif visé]', '[2 h]'],
      ['2', '[Thème de la séance]', '[Objectif visé]', '[2 h]'],
      ['3', '[Thème de la séance]', '[Objectif visé]', '[2 h]'],
    ],
  },
  education_course_plan: {
    titre: 'PLAN DU COURS',
    colonnes: [
      { titre: 'Séquence', largeur: 0.9, align: 'center' },
      { titre: 'Contenu', largeur: 2.6 },
      { titre: 'Supports', largeur: 1.6 },
      { titre: 'Durée', largeur: 0.8, align: 'center' },
    ],
    lignes: [
      ['1', '[Notion abordée]', '[Support / activité]', '[45 min]'],
      ['2', '[Notion abordée]', '[Support / activité]', '[45 min]'],
      ['3', '[Évaluation]', '[Exercice]', '[30 min]'],
    ],
  },
  education_evaluation_report: {
    titre: 'GRILLE D\'ÉVALUATION',
    colonnes: [
      { titre: 'Critère', largeur: 2.2 },
      { titre: 'Niveau atteint', largeur: 1.2, align: 'center' },
      { titre: 'Observations', largeur: 2.4 },
    ],
    lignes: [
      ['[Critère 1]', '[Acquis]', '[Observation]'],
      ['[Critère 2]', '[En cours]', '[Observation]'],
      ['[Critère 3]', '[Non acquis]', '[Observation]'],
    ],
  },
  education_student_file: {
    titre: 'DOSSIER DE L\'ÉLÈVE',
    colonnes: [
      { titre: 'Rubrique', largeur: 1.2 },
      { titre: 'Information', largeur: 2.8 },
    ],
    lignes: [
      ['Nom et prénom', '[Nom Prénom]'],
      ['Date de naissance', '[JJ/MM/AAAA]'],
      ['Classe / niveau', '[Classe]'],
      ['Responsable légal', '[Nom — Tél — Email]'],
      ['Observations', '[Aménagements, santé, suivi]'],
    ],
  },
  education_teaching_sheet: {
    titre: 'DÉROULÉ DE LA SÉANCE',
    colonnes: [
      { titre: 'Phase', largeur: 1 },
      { titre: 'Activité de l\'enseignant', largeur: 2.2 },
      { titre: 'Activité de l\'élève', largeur: 2.2 },
      { titre: 'Durée', largeur: 0.8, align: 'center' },
    ],
    lignes: [
      ['Mise en route', '[Consigne]', '[Tâche]', '[10 min]'],
      ['Apprentissage', '[Apport]', '[Tâche]', '[25 min]'],
      ['Bilan', '[Synthèse]', '[Restitution]', '[10 min]'],
    ],
  },
};

const TABLEAU_PAR_DOMAINE = {
  business: {
    titre: 'TABLEAU DE SYNTHÈSE',
    colonnes: [
      { titre: 'Élément', largeur: 2.6 },
      { titre: 'Détail', largeur: 2.2 },
      { titre: 'Montant / valeur', largeur: 1.2, align: 'right' },
    ],
    lignes: [
      ['[Élément 1]', '[Détail]', '0,00'],
      ['[Élément 2]', '[Détail]', '0,00'],
      ['[Élément 3]', '[Détail]', '0,00'],
    ],
    totaux: [{ libelle: 'TOTAL', valeur: '0,00 €', fort: true }],
  },
  education: {
    titre: 'TABLEAU RÉCAPITULATIF',
    colonnes: [
      { titre: 'Module / matière', largeur: 2.2 },
      { titre: 'Volume horaire', largeur: 1, align: 'center' },
      { titre: 'Résultat', largeur: 1, align: 'center' },
      { titre: 'Observations', largeur: 2 },
    ],
    lignes: [
      ['[Module 1]', '[— h]', '[—]', '[Observation]'],
      ['[Module 2]', '[— h]', '[—]', '[Observation]'],
      ['[Module 3]', '[— h]', '[—]', '[Observation]'],
    ],
  },
};

const TABLEAU_GENERIQUE = {
  titre: 'TABLEAU',
  colonnes: [
    { titre: 'Désignation', largeur: 2.6 },
    { titre: 'Détail', largeur: 2.2 },
    { titre: 'Valeur', largeur: 1.2, align: 'right' },
  ],
  lignes: [
    ['[Ligne 1]', '[Détail]', '[—]'],
    ['[Ligne 2]', '[Détail]', '[—]'],
    ['[Ligne 3]', '[Détail]', '[—]'],
  ],
};

function schemaTableau(ctx) {
  return TABLEAU_PAR_SLUG[ctx.slug]
      ?? TABLEAU_PAR_DOMAINE[ctx.domain]
      ?? TABLEAU_GENERIQUE;
}

/* Corps de texte par domaine (zone « body ») */
const CORPS_PAR_DOMAINE = {
  attestations_certificates: [
    "Je soussigné(e), [Nom Prénom], agissant en qualité de [Fonction] au sein de [Organisation], atteste par la présente que :",
    "[Nom Prénom du bénéficiaire], né(e) le [Date de naissance] à [Lieu], demeurant [Adresse complète], [fait attesté : a suivi / a exercé / a résidé / s'est acquitté de …] du [Date de début] au [Date de fin].",
    "La présente attestation est délivrée à l'intéressé(e) pour servir et valoir ce que de droit.",
  ],
  legal_simple: [
    "Je soussigné(e), [Nom Prénom], né(e) le [Date] à [Lieu], demeurant [Adresse complète], déclare ce qui suit :",
    "[Exposé des faits ou de la déclaration, rédigé de façon précise, datée et non équivoque.]",
    "Je suis informé(e) qu'une fausse déclaration m'expose aux sanctions prévues par la loi.",
  ],
  hr: [
    "Objet : [intitulé de la décision ou de la note].",
    "[Exposé du contexte, de la règle applicable et de la décision prise, avec les dates d'effet et les personnes concernées.]",
    "Les intéressés sont invités à prendre connaissance de la présente et à en accuser réception auprès du service [Service].",
  ],
  personal: [
    "Madame, Monsieur,",
    "[Exposez votre situation en quelques phrases, puis la demande précise que vous formulez, en mentionnant les pièces jointes utiles.]",
    "Je vous remercie par avance de l'attention portée à ma demande et reste disponible pour tout complément.",
  ],
  business: [
    "[Référence du document : n° [2026-001] — Date : [JJ/MM/AAAA] — Émetteur : [Organisation].]",
    "[Rappelez l'objet, le destinataire et le cadre : commande, réunion, période couverte ou périmètre analysé.]",
  ],
  education: [
    "[Établissement : [Nom] — Année scolaire / session : [Année] — Responsable : [Nom, fonction].]",
    "[Rappelez l'objet du document, l'élève ou le groupe concerné, la période couverte et le référentiel utilisé.]",
  ],
};

/* En-tête commercial (facture / devis / bon de commande) */
const SLUGS_COMMERCIAL = new Set(['business_invoice', 'business_quote', 'business_purchase_order']);

const LIBELLE_COMMERCIAL = {
  business_invoice:        ['FACTURE N° [2026-001]', 'Date de facture', 'Échéance de paiement'],
  business_quote:          ['DEVIS N° [D-2026-001]', 'Date du devis', 'Validité'],
  business_purchase_order: ['BON DE COMMANDE N° [BC-2026-001]', 'Date de commande', 'Livraison souhaitée'],
};

/* Profil de CV par slug (zone « profile ») */
const PROFIL_CV = {
  cv_student:   "Étudiant(e) en [filière] à [Établissement], je recherche [stage / alternance / premier poste] afin de mettre en pratique [compétences acquises].",
  cv_executive: "Dirigeant(e) avec [X] ans d'expérience en [secteur], j'ai piloté [périmètre : équipes, budget, marchés] et conduit [transformation / croissance] mesurable.",
  cv_technical: "Profil technique spécialisé en [technologies / domaines], [X] ans d'expérience sur [types de projets], à l'aise sur toute la chaîne [conception → production].",
  cv_creative:  "Profil créatif en [discipline], [X] ans de pratique. Je conçois [productions] pour [types de clients], de la recherche d'intention à la livraison finale.",
};
const PROFIL_CV_DEFAUT = "[Deux à trois phrases : votre métier, vos années d'expérience, votre spécialité et ce que vous recherchez aujourd'hui.]";

/* ─── Blocs par zone ─────────────────────────────────────────────── */
const ZONE_BUILDERS = {
  header: (y, ctx = {}) => {
    // Un CV n'a pas d'en-tête « logo » : sa tête de page, c'est l'identité.
    if (ctx.domain === 'cv_profiles') {
      return {
        objects: [
          mkText(ML, y, CW, 30, '[PRÉNOM NOM]',
            { fontSize: 24, fontWeight: 800, letterSpacing: 1 }),
          mkText(ML, y + 34, CW, 18, '[Titre du poste recherché]',
            { fontSize: 13, fill: '#64748b' }),
          mkText(ML, y + 56, CW, 16, '[Ville] · [Téléphone] · [Email] · [LinkedIn / portfolio]',
            { fontSize: 10, fill: '#475569' }),
          mkLine(ML, y + 82, CW, { stroke: '#94a3b8', strokeWidth: 1 }),
        ],
        nextY: y + 94,
      };
    }
    return {
      objects: [
        mkRect(ML, y, 170, 52, { fill: 'rgba(203,213,225,0.10)', cornerRadius: 4 }),
        mkText(ML + 8, y + 14, 154, 20, 'LOGO / EN-TÊTE',
          { fontSize: 9, fontWeight: 700, fill: '#94a3b8', align: 'center', letterSpacing: 1.5, lineHeight: 1 }),
        mkText(ML + 200, y + 8, CW - 200, 40,
          '[Organisation]\n[Adresse — Ville] · [Tél] · [Email]',
          { fontSize: 9.5, fill: '#64748b', align: 'right', lineHeight: 1.5 }),
      ],
      nextY: y + 68,
    };
  },

  sender: (y) => ({
    objects: [
      mkText(ML, y, 300, 56,
        '[Nom Prénom]\n[Adresse]\n[Ville — Code Postal]\n[Tél — Email]',
        { fontSize: 10.5, lineHeight: 1.55 }),
    ],
    nextY: y + 70,
  }),

  recipient: (y) => ({
    objects: [
      mkText(ML + 360, y, 330, 20, '[Ville], le [Date]', { fontSize: 10.5, align: 'right' }),
      mkText(ML + 360, y + 26, 330, 68,
        'À [Titre Nom]\n[Organisation / Service]\n[Adresse]\n[Ville — CP]',
        { fontSize: 10.5, lineHeight: 1.55 }),
    ],
    nextY: y + 100,
  }),

  subject: (y) => ({
    objects: [
      mkText(ML, y, CW, 20, 'Objet : [Objet de la lettre / du document]',
        { fontSize: 12, fontWeight: 700 }),
      mkLine(ML, y + 30, CW),
    ],
    nextY: y + 48,
  }),

  body: (y, ctx = {}) => {
    // Facture / devis / bon de commande : bloc émetteur ↔ client + référence,
    // sans quoi le tableau qui suit ne se rattache à personne.
    if (SLUGS_COMMERCIAL.has(ctx.slug)) {
      const [ref, l1, l2] = LIBELLE_COMMERCIAL[ctx.slug];
      return {
        objects: [
          mkText(ML, y, CW, 22, ref, { fontSize: 13, fontWeight: 700 }),
          mkText(ML, y + 26, 330, 14, `${l1} : [JJ/MM/AAAA]  ·  ${l2} : [JJ/MM/AAAA]`,
            { fontSize: 10, fill: '#475569' }),
          mkRect(ML, y + 50, 330, 84, { fill: 'rgba(241,245,249,0.5)', cornerRadius: 4 }),
          mkText(ML + 12, y + 60, 306, 66,
            'ÉMETTEUR\n[Organisation]\n[Adresse — Ville]\n[SIRET / RCCM] · [TVA]',
            { fontSize: 10, lineHeight: 1.5 }),
          mkRect(ML + 360, y + 50, 330, 84, { fill: 'rgba(241,245,249,0.5)', cornerRadius: 4 }),
          mkText(ML + 372, y + 60, 306, 66,
            'CLIENT\n[Raison sociale / Nom]\n[Adresse — Ville]\n[Référence client]',
            { fontSize: 10, lineHeight: 1.5 }),
        ],
        nextY: y + 148,
      };
    }

    const paragraphes = CORPS_PAR_DOMAINE[ctx.domain];
    if (paragraphes) {
      const objects = [];
      let cy = y;
      paragraphes.forEach((p, i) => {
        const h = i === 0 ? 20 : 52;
        objects.push(mkText(ML, cy, CW, h, p,
          { align: i === 0 ? 'left' : 'justify', lineHeight: 1.65 }));
        cy += h + 16;
      });
      return { objects, nextY: cy };
    }

    return {
      objects: [
        mkText(ML, y, CW, 20, 'Madame, Monsieur,'),
        mkText(ML, y + 32, CW, 96,
          "Je me permets de vous contacter concernant [objet de la démarche]. En effet, [développez votre argument principal].\n\nC'est pourquoi je me tourne vers vous afin de [précisez votre demande].",
          { align: 'justify' }),
        mkText(ML, y + 140, CW, 44,
          "Je reste à votre entière disposition pour tout renseignement complémentaire.",
          { align: 'justify' }),
      ],
      nextY: y + 200,
    };
  },

  formule_politesse: (y) => ({
    objects: [
      mkText(ML, y, CW, 44,
        "Dans l'attente d'une réponse favorable, veuillez agréer, Madame, Monsieur, l'expression de mes salutations les plus distinguées.",
        { align: 'justify' }),
    ],
    nextY: y + 56,
  }),

  signature: (y) => ({
    objects: [
      mkRect(ML + 380, y, 310, 80, { fill: 'rgba(203,213,225,0.06)', cornerRadius: 4 }),
      mkText(ML + 396, y + 16, 278, 30,
        '[Prénom NOM]\n[Titre / Fonction]',
        { fontWeight: 600, lineHeight: 1.5 }),
    ],
    nextY: y + 96,
  }),

  title: (y, ctx = {}) => ({
    objects: [
      mkText(ML, y, CW, 32, (ctx.nom || '[Titre du document]').toUpperCase(),
        { fontSize: 18, fontWeight: 800, align: 'center', letterSpacing: 1 }),
      mkLine(ML, y + 40, CW, { strokeWidth: 1.5, stroke: '#1e3a5f' }),
    ],
    nextY: y + 58,
  }),

  parties: (y) => ({
    objects: [
      mkText(ML, y, CW, 20, 'ENTRE LES PARTIES',
        { fontSize: 11, fontWeight: 700, letterSpacing: 1, fill: '#475569' }),
      mkText(ML, y + 24, CW, 44,
        "D'une part : [Partie A — Nom / Dénomination], représentée par [Nom], en qualité de [Fonction], ci-après « PARTIE A ».",
        { fontSize: 11, lineHeight: 1.6, align: 'justify' }),
      mkText(ML, y + 76, CW, 44,
        "D'autre part : [Partie B — Nom / Dénomination], représentée par [Nom], en qualité de [Fonction], ci-après « PARTIE B ».",
        { fontSize: 11, lineHeight: 1.6, align: 'justify' }),
    ],
    nextY: y + 136,
  }),

  clauses: (y) => ({
    objects: [
      mkText(ML, y, CW, 20, "ARTICLE 1 — OBJET",
        { fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }),
      mkText(ML, y + 24, CW, 44,
        "Le présent contrat/accord a pour objet [description précise des prestations et obligations des parties].",
        { fontSize: 11, lineHeight: 1.6, align: 'justify' }),
      mkText(ML, y + 76, CW, 20, "ARTICLE 2 — DURÉE",
        { fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }),
      mkText(ML, y + 100, CW, 44,
        "Il prend effet le [Date de début] pour une durée de [durée], soit jusqu'au [Date de fin].",
        { fontSize: 11, lineHeight: 1.6, align: 'justify' }),
    ],
    nextY: y + 160,
  }),

  modalités: (y) => ({
    objects: [
      mkText(ML, y, CW, 20, "ARTICLE 3 — MODALITÉS",
        { fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }),
      mkText(ML, y + 24, CW, 44,
        "En contrepartie, la somme de [Montant] € sera versée selon les modalités suivantes : [conditions de paiement].",
        { fontSize: 11, lineHeight: 1.6, align: 'justify' }),
    ],
    nextY: y + 80,
  }),

  date: (y) => ({
    objects: [
      mkText(ML, y, CW, 20, '[Ville], le [Date]', { align: 'right' }),
    ],
    nextY: y + 32,
  }),

  "corps de l'attestation": (y) => ({
    objects: [
      mkText(ML, y, CW, 32, 'ATTESTATION',
        { fontSize: 22, fontWeight: 800, align: 'center', letterSpacing: 3 }),
      mkText(ML, y + 36, CW, 20,
        "de [Nature — ex : présence / travail / scolarité]",
        { fontSize: 12, fill: '#475569', align: 'center' }),
      mkLine(ML, y + 64, CW, { stroke: '#94a3b8' }),
      mkText(ML, y + 88, CW, 96,
        "Je soussigné(e), [Nom Prénom], [Titre / Fonction] au sein de [Organisation], atteste par la présente que :\n\n[Nom Prénom du bénéficiaire], [né(e) le Date], demeurant [Adresse], [fait attesté].",
        { lineHeight: 1.7, align: 'justify' }),
    ],
    nextY: y + 200,
  }),

  bénéficiaire: (y) => ({
    objects: [
      mkRect(ML, y, CW, 58, { fill: 'rgba(241,245,249,0.5)', cornerRadius: 6, stroke: '#e2e8f0' }),
      mkText(ML + 16, y + 14, CW - 32, 30,
        'Bénéficiaire : [Nom Prénom]\nNé(e) le : [Date de naissance]',
        { fontSize: 11, lineHeight: 1.55 }),
    ],
    nextY: y + 74,
  }),

  identité: (y) => ({
    objects: [
      mkText(ML, y, CW, 28, '[PRÉNOM NOM]',
        { fontSize: 22, fontWeight: 800, align: 'center' }),
      mkText(ML, y + 32, CW, 20, '[Titre du poste / Profil]',
        { fontSize: 13, fill: '#64748b', align: 'center' }),
      mkLine(ML, y + 60, CW),
    ],
    nextY: y + 80,
  }),

  formation: (y) => ({
    objects: [
      mkText(ML, y, CW, 20, 'FORMATION',
        { fontSize: 11, fontWeight: 700, letterSpacing: 1.5, fill: '#475569' }),
      mkLine(ML, y + 24, CW),
      mkText(ML, y + 32, CW, 44,
        "[Diplôme ou Titre] · [Établissement]\n[Ville] · [Année de début] – [Année de fin]",
        { fontSize: 11, lineHeight: 1.55 }),
    ],
    nextY: y + 92,
  }),

  expérience: (y) => ({
    objects: [
      mkText(ML, y, CW, 20, 'EXPÉRIENCE PROFESSIONNELLE',
        { fontSize: 11, fontWeight: 700, letterSpacing: 1.5, fill: '#475569' }),
      mkLine(ML, y + 24, CW),
      mkText(ML, y + 32, CW, 60,
        "[Intitulé du poste] — [Entreprise / Organisation]\n[Ville] · [Mois/Année – Mois/Année]\n[Description des missions et réalisations principales]",
        { fontSize: 11, lineHeight: 1.55 }),
    ],
    nextY: y + 110,
  }),

  compétences: (y) => ({
    objects: [
      mkText(ML, y, CW, 20, 'COMPÉTENCES',
        { fontSize: 11, fontWeight: 700, letterSpacing: 1.5, fill: '#475569' }),
      mkLine(ML, y + 24, CW),
      mkText(ML, y + 32, CW, 44,
        "[Compétence 1] · [Compétence 2] · [Compétence 3]\n[Logiciels / Outils / Langues]",
        { fontSize: 11, lineHeight: 1.55 }),
    ],
    nextY: y + 90,
  }),

  "résumé exécutif": (y) => ({
    objects: [
      mkRect(ML, y, CW, 68, { fill: 'rgba(241,245,249,0.5)', cornerRadius: 8, stroke: '#e2e8f0' }),
      mkText(ML + 16, y + 10, CW - 32, 20, 'RÉSUMÉ EXÉCUTIF',
        { fontSize: 9, fontWeight: 700, letterSpacing: 1.5, fill: '#94a3b8' }),
      mkText(ML + 16, y + 32, CW - 32, 30,
        "[Synthèse en 2-3 phrases des conclusions principales et recommandations.]",
        { fontSize: 11, lineHeight: 1.55, fill: '#334155' }),
    ],
    nextY: y + 84,
  }),

  contexte: (y) => ({
    objects: [
      mkText(ML, y, CW, 20, '1. CONTEXTE ET OBJECTIFS',
        { fontSize: 12, fontWeight: 700 }),
      mkText(ML, y + 24, CW, 60,
        "[Décrivez le contexte dans lequel s'inscrit ce rapport : périmètre, commanditaire, période couverte, objectifs de l'analyse.]",
        { align: 'justify', lineHeight: 1.6 }),
    ],
    nextY: y + 96,
  }),

  analyse: (y) => ({
    objects: [
      mkText(ML, y, CW, 20, '2. ANALYSE',
        { fontSize: 12, fontWeight: 700 }),
      mkText(ML, y + 24, CW, 80,
        "[Développez votre analyse, vos observations, les données collectées et leur interprétation. Utilisez des titres de sections si nécessaire.]",
        { align: 'justify', lineHeight: 1.6 }),
    ],
    nextY: y + 116,
  }),

  conclusion: (y) => ({
    objects: [
      mkText(ML, y, CW, 20, '3. CONCLUSION ET RECOMMANDATIONS',
        { fontSize: 12, fontWeight: 700 }),
      mkText(ML, y + 24, CW, 60,
        "[Résumez les points clés et formulez vos recommandations concrètes et priorisées.]",
        { align: 'justify', lineHeight: 1.6 }),
    ],
    nextY: y + 96,
  }),

  footer: (y) => ({
    objects: [
      mkLine(ML, y, CW),
      mkText(ML, y + 10, CW, 14,
        '[Organisation] · [Adresse] · [Tél] · [Email]',
        { fontSize: 8.5, fill: '#64748b', align: 'center', lineHeight: 1.3 }),
    ],
    nextY: y + 32,
  }),

  /* ─── Zones tabulaires ─────────────────────────────────────────── */
  table: (y, ctx = {}) => poserTableau(y, schemaTableau(ctx)),

  /* ─── Contrats : corps d'articles numérotés ────────────────────── */
  articles: (y, ctx = {}) => {
    const articles = ARTICLES_CONTRAT[ctx.slug] ?? ARTICLES_DEFAUT;
    const objects = [];
    let cy = y;
    for (const [titre, texte] of articles) {
      objects.push(
        mkText(ML, cy, CW, 18, titre,
          { fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }),
        mkText(ML, cy + 22, CW, 44, texte,
          { fontSize: 11, lineHeight: 1.6, align: 'justify' }),
      );
      cy += 78;
    }
    objects.push(mkText(ML, cy, CW, 30,
      "Fait en deux exemplaires originaux, chaque partie reconnaissant avoir reçu le sien.",
      { fontSize: 10.5, fill: '#475569', lineHeight: 1.5 }));
    return { objects, nextY: cy + 38 };
  },

  /* ─── Attestations : lieu, date et portée ──────────────────────── */
  date_place: (y) => ({
    objects: [
      mkText(ML + 340, y, 350, 18, 'Fait à [Ville], le [JJ/MM/AAAA]',
        { fontSize: 11, align: 'right' }),
      mkText(ML, y, 330, 32,
        "Pour servir et valoir ce que de droit.",
        { fontSize: 10.5, fill: '#475569', lineHeight: 1.45 }),
    ],
    nextY: y + 46,
  }),

  /* ─── CV ───────────────────────────────────────────────────────── */
  profile: (y, ctx = {}) => ({
    objects: [
      mkText(ML, y, CW, 18, 'PROFIL',
        { fontSize: 11, fontWeight: 700, letterSpacing: 1.5, fill: '#475569' }),
      mkLine(ML, y + 22, CW),
      mkText(ML, y + 30, CW, 48, PROFIL_CV[ctx.slug] ?? PROFIL_CV_DEFAUT,
        { fontSize: 11, lineHeight: 1.6, align: 'justify' }),
    ],
    nextY: y + 88,
  }),

  experience: (y) => ({
    objects: [
      mkText(ML, y, CW, 18, 'EXPÉRIENCE PROFESSIONNELLE',
        { fontSize: 11, fontWeight: 700, letterSpacing: 1.5, fill: '#475569' }),
      mkLine(ML, y + 22, CW),
      mkText(ML, y + 32, CW, 16, '[Intitulé du poste] — [Entreprise]',
        { fontSize: 11, fontWeight: 700 }),
      mkText(ML, y + 50, CW, 14, '[Ville] · [Mois AAAA] – [Mois AAAA]',
        { fontSize: 9.5, fill: '#64748b' }),
      mkText(ML, y + 68, CW, 32,
        "• [Réalisation chiffrée]\n• [Responsabilité principale]",
        { fontSize: 10.5, lineHeight: 1.5 }),
      mkText(ML, y + 108, CW, 16, '[Intitulé du poste] — [Entreprise]',
        { fontSize: 11, fontWeight: 700 }),
      mkText(ML, y + 126, CW, 14, '[Ville] · [Mois AAAA] – [Mois AAAA]',
        { fontSize: 9.5, fill: '#64748b' }),
      mkText(ML, y + 144, CW, 32,
        "• [Réalisation chiffrée]\n• [Responsabilité principale]",
        { fontSize: 10.5, lineHeight: 1.5 }),
    ],
    nextY: y + 186,
  }),

  education: (y) => ({
    objects: [
      mkText(ML, y, CW, 18, 'FORMATION',
        { fontSize: 11, fontWeight: 700, letterSpacing: 1.5, fill: '#475569' }),
      mkLine(ML, y + 22, CW),
      mkText(ML, y + 32, CW, 32,
        "[Diplôme / Titre] — [Établissement]\n[Ville] · [AAAA] – [AAAA]",
        { fontSize: 10.5, lineHeight: 1.5 }),
      mkText(ML, y + 72, CW, 32,
        "[Diplôme / Certification] — [Établissement]\n[Ville] · [AAAA]",
        { fontSize: 10.5, lineHeight: 1.5 }),
    ],
    nextY: y + 112,
  }),

  skills: (y) => ({
    objects: [
      mkText(ML, y, CW, 18, 'COMPÉTENCES',
        { fontSize: 11, fontWeight: 700, letterSpacing: 1.5, fill: '#475569' }),
      mkLine(ML, y + 22, CW),
      mkText(ML, y + 32, 330, 44,
        "Métier : [compétence 1] · [compétence 2] · [compétence 3]\nOutils : [logiciel 1] · [logiciel 2]",
        { fontSize: 10.5, lineHeight: 1.5 }),
      mkText(ML + 360, y + 32, 330, 44,
        "Langues : [langue — niveau] · [langue — niveau]\nTransverses : [gestion de projet] · [communication]",
        { fontSize: 10.5, lineHeight: 1.5 }),
    ],
    nextY: y + 84,
  }),

  /* ─── Rapports ─────────────────────────────────────────────────── */
  cover: (y, ctx = {}) => ({
    objects: [
      mkRect(ML, y, 6, 96, { fill: '#1e3a5f', stroke: 'transparent', strokeWidth: 0, cornerRadius: 2 }),
      mkText(ML + 24, y + 4, CW - 24, 16, '[Organisation] · [Direction / Service]',
        { fontSize: 10, fill: '#64748b', letterSpacing: 1 }),
      mkText(ML + 24, y + 26, CW - 24, 40, ctx.nom || '[Titre du rapport]',
        { fontSize: 26, fontWeight: 800, lineHeight: 1.15 }),
      mkText(ML + 24, y + 74, CW - 24, 18, '[Sous-titre — périmètre et période couverte]',
        { fontSize: 12, fill: '#475569' }),
      mkRect(ML, y + 118, CW, 88, { fill: 'rgba(241,245,249,0.5)', cornerRadius: 6 }),
      mkText(ML + 16, y + 130, 320, 64,
        'Référence : [REF-2026-001]\nVersion : [1.0]\nDate : [JJ/MM/AAAA]',
        { fontSize: 10.5, lineHeight: 1.55 }),
      mkText(ML + 360, y + 130, 314, 64,
        'Rédigé par : [Nom, fonction]\nDestinataire : [Nom, fonction]\nDiffusion : [interne / restreinte]',
        { fontSize: 10.5, lineHeight: 1.55 }),
    ],
    nextY: y + 220,
  }),

  toc: (y, ctx = {}) => {
    const titres = SECTIONS_RAPPORT[ctx.slug] ?? SECTIONS_DEFAUT;
    const objects = [
      mkText(ML, y, CW, 20, 'SOMMAIRE',
        { fontSize: 12, fontWeight: 700, letterSpacing: 1.5 }),
      mkLine(ML, y + 24, CW, { stroke: '#94a3b8', strokeWidth: 1 }),
    ];
    let cy = y + 34;
    titres.forEach((t, i) => {
      objects.push(
        mkText(ML, cy, CW - 40, 16, `${i + 1}.  ${t}`, { fontSize: 11 }),
        mkText(ML + CW - 40, cy, 40, 16, `${i + 2}`, { fontSize: 11, align: 'right', fill: '#64748b' }),
        mkLine(ML, cy + 18, CW, { stroke: '#eef2f7' }),
      );
      cy += 24;
    });
    return { objects, nextY: cy + 8 };
  },

  sections: (y, ctx = {}) => {
    const titres = SECTIONS_RAPPORT[ctx.slug] ?? SECTIONS_DEFAUT;
    const objects = [];
    let cy = y;
    titres.forEach((t, i) => {
      objects.push(
        mkText(ML, cy, CW, 18, `${i + 1}. ${t.toUpperCase()}`,
          { fontSize: 12, fontWeight: 700 }),
        mkText(ML, cy + 22, CW, 48, TEXTE_SECTION[i] ?? TEXTE_SECTION[TEXTE_SECTION.length - 1],
          { fontSize: 11, lineHeight: 1.6, align: 'justify' }),
      );
      cy += 84;
    });
    return { objects, nextY: cy };
  },

  /* Zones génériques */
  default: (y, ctx = {}) => {
    const nom = ctx.zone ?? 'zone';
    const objs = [
      mkText(ML, y, CW, 20, `[${String(nom).toUpperCase()}]`,
        { fontSize: 11, fontWeight: 700, fill: '#94a3b8' }),
      mkText(ML, y + 24, CW, 44,
        `[Contenu de la zone ${nom}]`,
        { fontSize: 11, fill: '#64748b', lineHeight: 1.6 }),
    ];
    // Marqueur de repli : sert au test de non-régression [MODELE-1].
    for (const o of objs) o.generique = true;
    return { objects: objs, nextY: y + 76 };
  },
};

/* ─── Alias de zones (variantes de nommage des modèles à venir) ──── */
const ZONE_ALIAS = {
  tableau: 'table', lignes: 'table', prestations: 'table', items: 'table',
  produits: 'table', 'détail': 'table', recapitulatif: 'table',
  articles_contrat: 'articles', clauses_articles: 'articles',
  date_lieu: 'date_place', lieu_date: 'date_place',
  profil: 'profile', experiences: 'experience', 'expériences': 'experience',
  competences: 'skills', langues: 'skills',
  couverture: 'cover', sommaire: 'toc', table_des_matieres: 'toc',
  corps: 'body', objet: 'subject', destinataire: 'recipient', expediteur: 'sender',
  'expéditeur': 'sender', 'entête': 'header', 'en-tete': 'header',
  'pied_de_page': 'footer', 'piede': 'footer',
};

function resoudreZone(zone) {
  if (ZONE_BUILDERS[zone]) return zone;
  const alias = ZONE_ALIAS[zone];
  return alias && ZONE_BUILDERS[alias] ? alias : null;
}

/**
 * Diagnostic de couverture d'un modèle : quelles zones ont une vraie
 * fabrique, lesquelles tomberaient dans le rendu générique « [ZONE] ».
 */
export function diagnostiquerZones(template) {
  const zones = template?.zones ?? [];
  const couvertes = [];
  const generiques = [];
  for (const z of zones) (resoudreZone(z) ? couvertes : generiques).push(z);
  return { zones, couvertes, generiques };
}

/* ─── Ligne de pied de page (toujours ajoutée) ───────────────────── */
function addFooter(objects) {
  objects.push(
    mkLine(ML, AH - MB - 28, CW),
    mkText(ML, AH - MB - 18, CW, 14,
      '[Organisation] · [Adresse] · [Tél] · [Email]',
      { fontSize: 8.5, fill: '#64748b', align: 'center', lineHeight: 1.3 }),
  );
}

/**
 * Convertit un template JSON en tableau d'objets Konva.
 * @param {object} template — objet template depuis les 100_templates JSON
 * @returns {Array} objects — tableau compatible addObjects() du store Konva
 */
export function templateToKonvaObjects(template) {
  _gidCounter = 0;
  const objects = [];
  let y = MT;
  const zones = template.zones ?? [];
  const hasFooter = zones.includes('footer');

  const ctxBase = {
    template,
    slug: template.slug ?? '',
    domain: template.domain ?? '',
    nom: template.name ?? '',
  };

  for (const zone of zones) {
    const resolue = resoudreZone(zone);
    if (resolue === 'footer') continue; // ajouté en dernier, en pied de page
    const builder = resolue ? ZONE_BUILDERS[resolue] : ZONE_BUILDERS.default;
    const result = builder(y, { ...ctxBase, zone });
    // La zone d'origine reste sur chaque objet : la coque s'en sert pour
    // regrouper/sélectionner, et le test de couverture pour situer un repli.
    for (const o of result.objects) if (o && !o.zone) o.zone = zone;
    objects.push(...result.objects);
    y = result.nextY + 8; // 8px de marge entre zones
  }

  // Pied de page en bas de page (position fixe)
  if (hasFooter || template.auto_structure?.create_header) {
    addFooter(objects);
  }

  return objects;
}

/**
 * Retourne le style par défaut d'un template selon sa première style_variant.
 */
export function getDefaultStyle(template) {
  return template.style_variants?.[0] ?? {
    id: 'classic_admin',
    font_primary: 'Georgia',
    font_secondary: 'Georgia',
    accent: '#334155',
  };
}
