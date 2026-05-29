/**
 * Modèle canevas SmartBoard Studio (1037×750) — export vers SlideParallaxStage (elements legacy).
 */
import {
  SMARTBOARD_DESIGN_WIDTH,
  SMARTBOARD_DESIGN_HEIGHT,
} from '@/lib/smartboardDesignCanvas';

export const SB_CANVAS_GOLD = '#D4AF37';
export const SB_CANVAS_GOLD_DIM = 'rgba(212,175,55,0.12)';

export const CANVAS_W = SMARTBOARD_DESIGN_WIDTH;
export const CANVAS_H = SMARTBOARD_DESIGN_HEIGHT;

let _idSeq = 1;
export function genCanvasObjectId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `sb_${crypto.randomUUID().slice(0, 12)}`;
  }
  return `sb_${Date.now()}_${(_idSeq += 1)}`;
}

export function mkCanvasText(overrides = {}) {
  return {
    id: genCanvasObjectId(),
    type: 'text',
    x: 100,
    y: 100,
    width: 300,
    height: 60,
    text: 'Texte',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 24,
    fontWeight: '400',
    color: '#111',
    textAlign: 'left',
    italic: false,
    underline: false,
    strikethrough: false,
    lineHeight: 1.35,
    fill: 'transparent',
    stroke: 'transparent',
    strokeWidth: 0,
    borderRadius: 0,
    opacity: 1,
    rotation: 0,
    locked: false,
    visibleFor: 'both',
    step: 0,
    mindmapNodeId: '',
    masterScriptRef: '',
    ...overrides,
  };
}

export function mkCanvasShape(type, overrides = {}) {
  return {
    id: genCanvasObjectId(),
    type,
    x: 150,
    y: 150,
    width: 200,
    height: 120,
    fill: SB_CANVAS_GOLD_DIM,
    stroke: SB_CANVAS_GOLD,
    strokeWidth: 2,
    borderRadius: type === 'rect' ? 10 : 0,
    opacity: 1,
    rotation: 0,
    locked: false,
    visibleFor: 'both',
    step: 0,
    mindmapNodeId: '',
    masterScriptRef: '',
    ...overrides,
  };
}

const G = SB_CANVAS_GOLD;
const GD = SB_CANVAS_GOLD_DIM;

/** Modèles type Canva / LIRI — objets repositionnables sur le canevas */
export const SB_CANVAS_TEMPLATES = {
  vide: { name: 'Page vide', objects: [] },
  /** Mise en page « une page » pour courriers / actes (pas de pagination Word : tout tient sur le canevas). */
  admin_courrier: {
    name: 'Admin — Courrier officiel',
    objects: [
      mkCanvasShape('rect', { x: 48, y: 28, width: 941, height: 4, fill: G, stroke: 'transparent', borderRadius: 0 }),
      mkCanvasText({
        x: 519,
        y: 48,
        width: 900,
        height: 40,
        text: "NOM DE L'INSTITUTION / SERVICE",
        fontFamily: 'Georgia, serif',
        fontSize: 22,
        fontWeight: '700',
        color: '#1a1a1a',
        textAlign: 'center',
      }),
      mkCanvasText({
        x: 519,
        y: 86,
        width: 900,
        height: 32,
        text: 'Adresse · Téléphone · Courriel institutionnel',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 11,
        color: '#555',
        textAlign: 'center',
      }),
      mkCanvasText({
        x: 80,
        y: 138,
        width: 480,
        height: 28,
        text: 'À l\'attention de : Nom Prénom / Service',
        fontFamily: 'Georgia, serif',
        fontSize: 13,
        color: '#222',
        textAlign: 'left',
      }),
      mkCanvasText({
        x: 80,
        y: 172,
        width: 780,
        height: 32,
        text: 'Objet : Objet du courrier (à compléter)',
        fontFamily: 'Georgia, serif',
        fontSize: 13,
        fontWeight: '600',
        color: '#111',
        textAlign: 'left',
      }),
      mkCanvasText({
        x: 80,
        y: 218,
        width: 880,
        height: 340,
        text: "Madame, Monsieur,\n\nRemplacez ce texte par le contenu du courrier. Utilisez l'onglet Texte et le panneau Propriétés pour le gras, la justification, l'interligne et la couleur.\n\nDeuxième paragraphe pour la suite ou les décisions notifiées.\n\nCordialement,",
        fontFamily: 'Georgia, serif',
        fontSize: 14,
        color: '#222',
        textAlign: 'justify',
        lineHeight: 1.45,
      }),
      mkCanvasText({
        x: 80,
        y: 558,
        width: 420,
        height: 88,
        text: 'Nom et qualité du signataire\nFonction',
        fontFamily: 'Georgia, serif',
        fontSize: 12,
        color: '#333',
        textAlign: 'left',
      }),
      mkCanvasText({
        x: 519,
        y: 708,
        width: 880,
        height: 28,
        text: 'Réf. interne · Confidentiel · Une page (capture ou export depuis le flux cours / studio)',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 9,
        color: '#888',
        textAlign: 'center',
        italic: true,
      }),
    ],
  },
  admin_pv: {
    name: 'Admin — PV de réunion',
    objects: [
      mkCanvasText({
        x: 519,
        y: 34,
        width: 900,
        height: 44,
        text: 'PROCÈS-VERBAL DE RÉUNION',
        fontFamily: 'Georgia, serif',
        fontSize: 26,
        fontWeight: '700',
        color: G,
        textAlign: 'center',
      }),
      mkCanvasShape('rect', { x: 60, y: 92, width: 917, height: 2, fill: G, stroke: 'transparent' }),
      mkCanvasText({
        x: 80,
        y: 112,
        width: 420,
        height: 24,
        text: 'Date : __ / __ / ______',
        fontSize: 13,
        color: '#222',
        textAlign: 'left',
      }),
      mkCanvasText({
        x: 520,
        y: 112,
        width: 420,
        height: 24,
        text: 'Lieu : …',
        fontSize: 13,
        color: '#222',
        textAlign: 'left',
      }),
      mkCanvasText({
        x: 80,
        y: 150,
        width: 880,
        height: 96,
        text: 'Présents : …\nExcusés : …',
        fontSize: 13,
        color: '#222',
        textAlign: 'left',
        lineHeight: 1.4,
      }),
      mkCanvasText({
        x: 80,
        y: 268,
        width: 240,
        height: 28,
        text: 'Ordre du jour',
        fontSize: 15,
        fontWeight: '700',
        color: '#111',
        textAlign: 'left',
      }),
      mkCanvasText({
        x: 100,
        y: 298,
        width: 840,
        height: 200,
        text: '1. …\n2. …\n3. …',
        fontSize: 13,
        color: '#333',
        textAlign: 'left',
        lineHeight: 1.45,
      }),
      mkCanvasText({
        x: 80,
        y: 512,
        width: 280,
        height: 28,
        text: 'Décisions / synthèse',
        fontSize: 15,
        fontWeight: '700',
        color: '#111',
        textAlign: 'left',
      }),
      mkCanvasText({
        x: 80,
        y: 542,
        width: 880,
        height: 160,
        text: 'Compte rendu des échanges et décisions adoptées…',
        fontSize: 13,
        color: '#222',
        textAlign: 'justify',
        lineHeight: 1.45,
      }),
      mkCanvasText({
        x: 519,
        y: 718,
        width: 880,
        height: 22,
        text: 'Signatures (nom · rôle)',
        fontSize: 10,
        color: '#777',
        textAlign: 'center',
        italic: true,
      }),
    ],
  },
  admin_attestation: {
    name: 'Admin — Attestation',
    objects: [
      mkCanvasShape('rect', {
        x: 120,
        y: 36,
        width: 797,
        height: 678,
        fill: 'rgba(212,175,55,0.06)',
        stroke: G,
        strokeWidth: 2,
        borderRadius: 4,
      }),
      mkCanvasText({
        x: 519,
        y: 68,
        width: 700,
        height: 44,
        text: 'ATTESTATION',
        fontFamily: 'Georgia, serif',
        fontSize: 32,
        fontWeight: '700',
        color: G,
        textAlign: 'center',
      }),
      mkCanvasText({
        x: 519,
        y: 128,
        width: 760,
        height: 320,
        text: 'Je soussigné(e), _____________________________, certifie que :\n\n____________________________________________________________\n\nFait pour servir et valoir ce que de droit.',
        fontFamily: 'Georgia, serif',
        fontSize: 15,
        color: '#222',
        textAlign: 'center',
        lineHeight: 1.55,
      }),
      mkCanvasText({
        x: 519,
        y: 472,
        width: 700,
        height: 40,
        text: 'Fait à _____________, le __ / __ / ______',
        fontSize: 13,
        color: '#444',
        textAlign: 'center',
      }),
      mkCanvasText({
        x: 519,
        y: 548,
        width: 500,
        height: 72,
        text: 'Signature et cachet',
        fontSize: 12,
        color: '#666',
        textAlign: 'center',
        italic: true,
      }),
    ],
  },
  atelier: {
    name: "Atelier d'ouverture",
    objects: [
      mkCanvasText({ x: 519, y: 40, width: 950, height: 55, text: "Atelier d'ouverture", fontFamily: 'Georgia, serif', fontSize: 38, fontWeight: '700', color: G, textAlign: 'center' }),
      mkCanvasShape('rect', { x: 89, y: 130, width: 420, height: 240, fill: 'rgba(26,122,74,0.08)', stroke: 'rgba(26,122,74,0.4)', borderRadius: 12 }),
      mkCanvasShape('rect', { x: 527, y: 130, width: 420, height: 240, fill: 'rgba(26,95,168,0.08)', stroke: 'rgba(26,95,168,0.4)', borderRadius: 12 }),
      mkCanvasText({ x: 299, y: 235, width: 400, height: 40, text: 'Camp A — votre position', fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: '600', color: '#1a7a4a', textAlign: 'center' }),
      mkCanvasText({ x: 737, y: 235, width: 400, height: 40, text: 'Camp B — votre position', fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: '600', color: '#1a5fa8', textAlign: 'center' }),
      mkCanvasText({ x: 519, y: 460, width: 860, height: 50, text: "❓ Si tout était identique dans l'univers, que se passerait-il ?", fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: '400', color: '#444', textAlign: 'center', italic: true }),
    ],
  },
  definition: {
    name: 'Définition du concept',
    objects: [
      mkCanvasText({ x: 519, y: 40, width: 950, height: 55, text: 'Définition du concept', fontFamily: 'Georgia, serif', fontSize: 38, fontWeight: '700', color: G, textAlign: 'center' }),
      mkCanvasShape('rect', { x: 519, y: 160, width: 880, height: 180, fill: GD, stroke: G, borderRadius: 14 }),
      mkCanvasText({ x: 519, y: 235, width: 860, height: 80, text: '"Définition formelle ici…"', fontFamily: 'Georgia, serif', fontSize: 20, color: '#333', textAlign: 'center', italic: true }),
      mkCanvasText({ x: 210, y: 400, width: 260, height: 40, text: '① Composante 1', fontSize: 16, fontWeight: '600', color: '#1a7a4a', textAlign: 'center' }),
      mkCanvasText({ x: 519, y: 400, width: 260, height: 40, text: '② Composante 2', fontSize: 16, fontWeight: '600', color: '#1a5fa8', textAlign: 'center' }),
      mkCanvasText({ x: 828, y: 400, width: 260, height: 40, text: '③ Composante 3', fontSize: 16, fontWeight: '600', color: G, textAlign: 'center' }),
      mkCanvasText({ x: 519, y: 560, width: 600, height: 50, text: 'D + A = C', fontFamily: 'Georgia, serif', fontSize: 32, fontWeight: '700', color: G, textAlign: 'center' }),
    ],
  },
  conclusion: {
    name: 'Conclusion doctrinale',
    objects: [
      mkCanvasText({ x: 519, y: 40, width: 950, height: 55, text: 'Conclusion doctrinale', fontFamily: 'Georgia, serif', fontSize: 38, fontWeight: '700', color: G, textAlign: 'center' }),
      mkCanvasShape('rect', { x: 519, y: 160, width: 880, height: 220, fill: GD, stroke: G, borderRadius: 16 }),
      mkCanvasText({ x: 519, y: 255, width: 860, height: 100, text: '"Là où la différence est accordée,\nl\'univers lui-même se met à parler."', fontFamily: 'Georgia, serif', fontSize: 22, color: '#444', textAlign: 'center', italic: true }),
      mkCanvasText({ x: 519, y: 470, width: 700, height: 50, text: 'Prorascience · Loi de la Différence Accordée', fontSize: 14, fontWeight: '400', color: '#999', textAlign: 'center' }),
    ],
  },
  debat: {
    name: 'Débat / confrontation',
    objects: [
      mkCanvasText({ x: 519, y: 40, width: 950, height: 55, text: 'Débat', fontFamily: 'Georgia, serif', fontSize: 38, fontWeight: '700', color: G, textAlign: 'center' }),
      mkCanvasShape('rect', { x: 89, y: 130, width: 380, height: 520, fill: 'rgba(26,122,74,0.07)', stroke: 'rgba(26,122,74,0.4)', borderRadius: 14 }),
      mkCanvasShape('rect', { x: 329, y: 310, width: 380, height: 100, fill: 'rgba(0,0,0,0.04)', stroke: 'rgba(0,0,0,0.1)', borderRadius: 50 }),
      mkCanvasShape('rect', { x: 568, y: 130, width: 380, height: 520, fill: 'rgba(26,95,168,0.07)', stroke: 'rgba(26,95,168,0.4)', borderRadius: 14 }),
      mkCanvasText({ x: 279, y: 165, width: 360, height: 40, text: 'POUR', fontSize: 22, fontWeight: '700', color: '#1a7a4a', textAlign: 'center' }),
      mkCanvasText({ x: 758, y: 165, width: 360, height: 40, text: 'CONTRE', fontSize: 22, fontWeight: '700', color: '#c0392b', textAlign: 'center' }),
      mkCanvasText({ x: 519, y: 345, width: 360, height: 40, text: 'VS', fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: '700', color: '#333', textAlign: 'center' }),
    ],
  },
  citation: {
    name: 'Citation / adage',
    objects: [
      mkCanvasText({ x: 80, y: 100, width: 80, height: 200, text: '"', fontFamily: 'Georgia, serif', fontSize: 160, fontWeight: '700', color: 'rgba(212,175,55,0.25)', textAlign: 'left' }),
      mkCanvasText({ x: 519, y: 220, width: 820, height: 160, text: 'Citation ou adage ici…', fontFamily: 'Georgia, serif', fontSize: 26, color: '#333', textAlign: 'center', italic: true }),
      mkCanvasText({ x: 519, y: 420, width: 400, height: 36, text: '— Source / Doctrine Prorascience', fontSize: 14, color: '#999', textAlign: 'center', italic: true }),
    ],
  },
  comparaison: {
    name: 'Comparaison',
    objects: [
      mkCanvasText({ x: 519, y: 40, width: 950, height: 55, text: 'Comparaison', fontFamily: 'Georgia, serif', fontSize: 38, fontWeight: '700', color: G, textAlign: 'center' }),
      mkCanvasShape('rect', { x: 89, y: 130, width: 430, height: 520, fill: 'rgba(26,122,74,0.07)', stroke: 'rgba(26,122,74,0.4)', borderRadius: 14 }),
      mkCanvasShape('rect', { x: 518, y: 130, width: 430, height: 520, fill: 'rgba(26,95,168,0.07)', stroke: 'rgba(26,95,168,0.4)', borderRadius: 14 }),
      mkCanvasText({ x: 304, y: 175, width: 390, height: 40, text: 'Avant / Sans loi', fontSize: 20, fontWeight: '600', color: '#1a7a4a', textAlign: 'center' }),
      mkCanvasText({ x: 733, y: 175, width: 390, height: 40, text: 'Après / Avec loi', fontSize: 20, fontWeight: '600', color: '#1a5fa8', textAlign: 'center' }),
    ],
  },
};

/**
 * Objet éditeur → élément legacy SlideParallaxStage
 */
export function canvasObjectToSlideElement(obj, zIndex) {
  const z = zIndex ?? 1;
  const id = obj.id || genCanvasObjectId();

  if (obj.type === 'text') {
    return {
      type: 'free_text',
      id,
      x: obj.x,
      y: obj.y,
      width: obj.width,
      height: obj.height,
      content: obj.text ?? '',
      fontFamily: obj.fontFamily,
      fontSize: obj.fontSize,
      fontWeight: obj.fontWeight,
      color: obj.color,
      textAlign: obj.textAlign,
      italic: obj.italic,
      underline: obj.underline,
      strikethrough: obj.strikethrough,
      lineHeight: obj.lineHeight,
      opacity: obj.opacity ?? 1,
      rotation: obj.rotation ?? 0,
      zIndex: z,
    };
  }

  if (obj.type === 'rect') {
    return {
      type: 'shape_rect',
      id,
      x: obj.x,
      y: obj.y,
      width: obj.width,
      height: obj.height,
      fill: obj.fill,
      stroke: obj.stroke,
      strokeWidth: obj.strokeWidth ?? 2,
      borderRadius: obj.borderRadius ?? 0,
      opacity: obj.opacity ?? 1,
      rotation: obj.rotation ?? 0,
      zIndex: z,
    };
  }

  if (obj.type === 'circle') {
    return {
      type: 'shape_circle',
      id,
      x: obj.x,
      y: obj.y,
      width: obj.width,
      height: obj.height,
      fill: obj.fill,
      stroke: obj.stroke,
      strokeWidth: obj.strokeWidth ?? 2,
      opacity: obj.opacity ?? 1,
      rotation: obj.rotation ?? 0,
      zIndex: z,
    };
  }

  if (obj.type === 'arrow') {
    return {
      type: 'shape_arrow',
      id,
      x: obj.x,
      y: obj.y,
      width: obj.width,
      height: obj.height,
      fill: obj.fill || G,
      opacity: obj.opacity ?? 1,
      rotation: obj.rotation ?? 0,
      zIndex: z,
    };
  }

  if (obj.type === 'image' && obj.src) {
    return {
      type: 'image',
      id,
      x: obj.x,
      y: obj.y,
      width: obj.width,
      height: obj.height,
      src: obj.src,
      content: obj.alt || '',
      opacity: obj.opacity ?? 1,
      rotation: obj.rotation ?? 0,
      zIndex: z,
    };
  }

  return null;
}

export function canvasObjectsToSlideElements(objects) {
  if (!Array.isArray(objects)) return [];
  return objects
    .map((o, i) => canvasObjectToSlideElement(o, i + 1))
    .filter(Boolean);
}

/** Relecture minimale depuis elements (import JSON Architect) */
export function slideElementsToCanvasObjects(elements) {
  if (!Array.isArray(elements)) return [];
  return elements.map((el) => {
    if (el.type === 'free_text') {
      return mkCanvasText({
        id: el.id,
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        text: el.content ?? '',
        fontFamily: el.fontFamily,
        fontSize: el.fontSize,
        fontWeight: String(el.fontWeight ?? '400'),
        color: el.color,
        textAlign: el.textAlign,
        italic: el.italic,
        underline: el.underline,
        strikethrough: el.strikethrough,
        lineHeight: el.lineHeight,
        opacity: el.opacity ?? 1,
        rotation: el.rotation ?? 0,
      });
    }
    if (el.type === 'shape_rect') {
      return mkCanvasShape('rect', {
        id: el.id,
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        fill: el.fill,
        stroke: el.stroke,
        strokeWidth: el.strokeWidth,
        borderRadius: el.borderRadius,
        opacity: el.opacity ?? 1,
        rotation: el.rotation ?? 0,
      });
    }
    if (el.type === 'shape_circle') {
      return mkCanvasShape('circle', {
        id: el.id,
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        fill: el.fill,
        stroke: el.stroke,
        strokeWidth: el.strokeWidth,
        opacity: el.opacity ?? 1,
        rotation: el.rotation ?? 0,
      });
    }
    if (el.type === 'shape_arrow') {
      return {
        ...mkCanvasShape('arrow', { x: el.x, y: el.y, width: el.width, height: el.height, fill: el.fill }),
        id: el.id || genCanvasObjectId(),
        type: 'arrow',
        opacity: el.opacity ?? 1,
        rotation: el.rotation ?? 0,
      };
    }
    if (el.type === 'image' && (el.src || el.url)) {
      return {
        id: el.id || genCanvasObjectId(),
        type: 'image',
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        src: el.src || el.url,
        alt: el.content,
        opacity: el.opacity ?? 1,
        rotation: el.rotation ?? 0,
        locked: false,
        visibleFor: 'both',
        step: 0,
        mindmapNodeId: '',
        masterScriptRef: '',
      };
    }
    return null;
  }).filter(Boolean);
}
