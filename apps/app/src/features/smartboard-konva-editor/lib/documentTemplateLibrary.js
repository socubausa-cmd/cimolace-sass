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

/* ─── Blocs par zone ─────────────────────────────────────────────── */
const ZONE_BUILDERS = {
  header: (y, _opts) => ({
    objects: [
      mkRect(ML, y, 170, 52, { fill: 'rgba(203,213,225,0.10)', cornerRadius: 4 }),
      mkText(ML + 8, y + 14, 154, 20, 'LOGO / EN-TÊTE',
        { fontSize: 9, fontWeight: 700, fill: '#94a3b8', align: 'center', letterSpacing: 1.5, lineHeight: 1 }),
    ],
    nextY: y + 68,
  }),

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

  body: (y) => ({
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
  }),

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

  title: (y) => ({
    objects: [
      mkText(ML, y, CW, 32, '[TITRE DU DOCUMENT]',
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

  /* Zones génériques */
  default: (y, zoneName) => ({
    objects: [
      mkText(ML, y, CW, 20, `[${zoneName.toUpperCase()}]`,
        { fontSize: 11, fontWeight: 700, fill: '#94a3b8' }),
      mkText(ML, y + 24, CW, 44,
        `[Contenu de la zone ${zoneName}]`,
        { fontSize: 11, fill: '#64748b', lineHeight: 1.6 }),
    ],
    nextY: y + 76,
  }),
};

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

  for (const zone of zones) {
    if (zone === 'footer') continue; // ajouté en dernier
    const builder = ZONE_BUILDERS[zone] ?? ((cy) => ZONE_BUILDERS.default(cy, zone));
    const result = builder(y);
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
