/**
 * Analyse document → cours structuré.
 * Si l’utilisateur est connecté, tente d’abord la fonction Netlify ; sinon (ou en cas d’erreur) mock local.
 * L’IA structure le savoir, pas le canvas Konva.
 */
import { tryAnalyzeCourseWithCopilot } from '../lib/callLiriKonvaCourseCopilot';
import { normalizeAiCourseJson } from './normalizeAiCourseJson';

/** @type {import('../model/courseCopilotTypes').CourseSlideType[]} */
const SLIDE_TYPES_ROTATION = [
  'definition',
  'demonstration',
  'exemple',
  'confrontation',
  'atelier',
  'synthese',
];

/** Phases pédagogiques du cahier des charges */
export const PEDAGOGICAL_PHASES = [
  'Question initiale',
  'Tension cognitive',
  'Confrontation',
  'Limite',
  'Introduction du concept',
  'Définition',
  'Démonstration',
  'Synthèse',
];

function slugId(prefix, i) {
  return `${prefix}-${i}-${Math.random().toString(36).slice(2, 7)}`;
}

function inferTitle(text) {
  const line = (text || '').split('\n').map((l) => l.trim()).find(Boolean) || '';
  const t = line.slice(0, 100).replace(/\s+/g, ' ');
  return t || 'Nouveau cours';
}

function chunkParagraphs(text) {
  return (text || '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Mock local (déterministe côté structure, délai court).
 * @param {string} rawText
 * @returns {Promise<import('../model/courseCopilotTypes').LiriCourseCopilotCourse>}
 */
export async function analyzeCourseDocumentLocal(rawText) {
  await new Promise((r) => setTimeout(r, 900));

  const text = (rawText || '').trim() || 'Document vide — collez un cours, une transcription ou des notes.';
  const title = inferTitle(text);
  const paras = chunkParagraphs(text);
  const subthemes = paras.slice(0, 5).map((p) => (p.length > 60 ? `${p.slice(0, 57)}…` : p));
  if (subthemes.length === 0) subthemes.push('Introduction au sujet');

  const chapterCount = Math.min(3, Math.max(2, Math.ceil(paras.length / 3) || 2));
  /** @type {import('../model/courseCopilotTypes').CourseChapter[]} */
  const chapters = [];
  for (let c = 0; c < chapterCount; c += 1) {
    const part = paras[c] || `Partie ${c + 1} — à développer à partir de votre document.`;
    chapters.push({
      id: slugId('ch', c),
      title: c === 0 ? 'Introduction et cadrage' : c === chapterCount - 1 ? 'Synthèse et prolongements' : `Chapitre ${c + 1} — concepts clés`,
      summary: part.slice(0, 220),
      subparts: [
        'Objectifs de la séquence',
        'Prérequis des élèves',
        'Activité d’ancrage',
      ],
    });
  }

  const slideCount = Math.min(8, Math.max(4, Math.ceil(paras.length / 2) + 2));
  /** @type {import('../model/courseCopilotTypes').CourseSlide[]} */
  const slides = [];
  for (let i = 0; i < slideCount; i += 1) {
    const type = SLIDE_TYPES_ROTATION[i % SLIDE_TYPES_ROTATION.length];
    const excerpt = paras[i % Math.max(paras.length, 1)] || text.slice(0, 200);
    slides.push({
      id: slugId('sl', i),
      title:
        i === 0
          ? `Ouverture : ${title.slice(0, 40)}${title.length > 40 ? '…' : ''}`
          : `Slide ${i + 1} — ${type}`,
      type,
      objective: `À l’issue de ce slide, l’élève distingue les notions clés liées à : ${inferTitle(excerpt).slice(0, 60)}.`,
      content: {
        title: i === 0 ? title : `Point ${i + 1}`,
        subtitle: `Type : ${type} — à adapter à votre public`,
        mainText:
          excerpt.length > 320
            ? `${excerpt.slice(0, 300)}…`
            : excerpt || 'Insérez ici le contenu issu de votre document source (copier-coller dans Konva).',
        blocks: [
          'Une question pour lancer la réflexion',
          '2 à 3 idées à faire apparaître sur le slide',
          'Un exemple concret court',
        ],
      },
      zones: [
        { id: 'z-titre', role: 'Titre principal', hint: 'Zone haute — une ligne forte, lisible de loin.' },
        { id: 'z-corps', role: 'Corps du message', hint: 'Liste courte ou paragraphe — éviter le mur de texte.' },
        { id: 'z-visuel', role: 'Visuel / schéma', hint: 'Image, icône ou forme pour ancrer la notion (vous dessinez dans Konva).' },
      ],
      masterScript: {
        discourse: `Vous accueillez les élèves sur ce point : « ${title.slice(0, 80)} ». Reformulez avec vos mots, puis reliez au vécu.`,
        keyPoints: [
          'Nommer l’objectif en une phrase',
          'Vérifier une compréhension orale rapide',
          'Annoncer la transition vers la suite',
        ],
        transitions: i < slideCount - 1 ? 'Prochain slide : on approfondit ou on confronte une idée reçue.' : 'Clôture : synthèse et ouverture.',
      },
      suggestions: {
        visualType: ['schema_simple', 'photo_illustrative', 'icone_concept', 'comparatif_deux_colonnes'][i % 4],
        diagramHint: 'Deux boîtes + une flèche, ou un axe avant / après.',
        layoutTips: [
          'Hiérarchie typographique : titre > sous-titre > corps',
          'Marge généreuse — le silence visuel aide la lecture',
        ],
      },
    });
  }

  /** @type {import('../model/courseCopilotTypes').CourseMindmapNode} */
  const mindmap = {
    id: 'root',
    label: title,
    children: chapters.map((ch, i) => ({
      id: ch.id,
      label: ch.title,
      children: slides
        .filter((_, si) => si % chapterCount === i)
        .slice(0, 3)
        .map((s) => ({ id: s.id, label: s.title, children: [] })),
    })),
  };

  return {
    title,
    description: `Cours structuré à partir d’un document d’environ ${text.length} caractères. Les slides sont des guides — la mise en page reste entièrement manuelle dans SmartBoard.`,
    analysis: {
      mainTopic: title,
      subthemes: subthemes.slice(0, 4),
      complexity: text.length > 4000 ? 'avance' : text.length > 1200 ? 'intermediaire' : 'debutant',
      estimatedDurationMinutes: Math.round(20 + slideCount * 4),
    },
    progression: {
      narrative: 'Progression : accroche → clarification des concepts → confrontation / limite → mise en pratique → synthèse.',
      pedagogicalPhases: [...PEDAGOGICAL_PHASES],
    },
    chapters,
    slides,
    mindmap,
    masterScriptOverview: `Fil conducteur : partir de la question des élèves, créer une tension, puis stabiliser par la définition et la démonstration, avant l’atelier et la synthèse.`,
  };
}

/**
 * @param {string} rawText
 * @returns {Promise<import('../model/courseCopilotTypes').LiriCourseCopilotCourse>}
 */
export async function analyzeCourseDocument(rawText) {
  const remote = await tryAnalyzeCourseWithCopilot(rawText);
  if (remote?.course != null) {
    try {
      return normalizeAiCourseJson(remote.course);
    } catch {
      /* fallback local */
    }
  }
  return analyzeCourseDocumentLocal(rawText);
}
