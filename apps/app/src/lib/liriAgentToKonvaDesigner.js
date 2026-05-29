/**
 * Pont Agent LIRI → SmartBoard Designer (Konva) : plan pédagogique + brouillon de scènes.
 */
import { buildLiriCourseTextForLiveStudio } from '@/lib/liriAgentExportToLiveStudio';
import {
  SB_KONVA_CANVAS_W,
  SB_KONVA_CANVAS_H,
  createEmptyScene,
  mkTextObject,
} from '@/features/smartboard-konva-editor/model/sceneModel';

export const LIRI_AGENT_TO_KONVA_STORAGE_KEY = 'liri_agent_to_konva_v1';

function slug(prefix) {
  const r =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().slice(0, 8)
      : `${Date.now().toString(36)}`;
  return `${prefix}_${r}`;
}

/** @param {string} tag */
function tagToSlideType(tag) {
  const t = String(tag || '').toLowerCase();
  if (t.includes('déclenc') || t.includes('atelier')) return 'atelier';
  if (t.includes('conflit') || t.includes('limit')) return 'confrontation';
  if (t.includes('défin')) return 'definition';
  if (t.includes('raison') || t.includes('démon')) return 'demonstration';
  if (t.includes('illustr') || t.includes('exemple')) return 'exemple';
  if (t.includes('synth') || t.includes('sagesse') || t.includes('adage')) return 'synthese';
  return 'definition';
}

/**
 * Transforme le JSON cours Agent LIRI → structure Course Copilot (coaching / colonne plan).
 * @param {Record<string, unknown>} cours
 * @returns {import('@/features/smartboard-konva-editor/model/courseCopilotTypes').LiriCourseCopilotCourse}
 */
export function buildLiriCourseCopilotCourseFromAgent(cours) {
  const title = String(cours?.titre || 'Cours LIRI').slice(0, 200);
  const etapes = Array.isArray(cours?.etapes) ? cours.etapes : [];

  /** @type {import('@/features/smartboard-konva-editor/model/courseCopilotTypes').CourseSlide[]} */
  const slides = etapes.slice(0, 24).map((e, i) => {
    const sb = e?.smartboard || {};
    const ms = e?.masterscript || {};
    const st = String(sb.titre || `Étape ${i + 1}`).slice(0, 200);
    const main = [sb.idee, sb.contenu, sb.support_visuel, sb.question_cle]
      .filter(Boolean)
      .map((x) => String(x))
      .join('\n\n')
      .slice(0, 4000);
    const qs = Array.isArray(ms.questions) ? ms.questions.map((q) => String(q)) : [];
    const kp = [...qs, ...(Array.isArray(ms.reponses_attendues) ? ms.reponses_attendues : [])].slice(0, 8);
    while (kp.length < 2) kp.push('—');

    return {
      id: slug('sl'),
      title: st,
      type: tagToSlideType(e?.tag),
      objective: String(ms.intention || `Étape ${i + 1} — ${e?.tag || 'LIRI'}`).slice(0, 600),
      content: {
        title: st,
        subtitle: String(sb.idee || '').slice(0, 200),
        mainText: main || '—',
        blocks: ['Vue élève (SmartBoard)', 'À compléter au designer'].slice(0, 8),
      },
      zones: [
        { id: 'z-titre', role: 'Titre', hint: 'Titre fort, lisible au fond de salle.' },
        { id: 'z-corps', role: 'Corps', hint: String(sb.support_visuel || 'Hiérarchie courte + visuel.').slice(0, 400) },
      ],
      masterScript: {
        discourse: String(ms.script || '').slice(0, 2500),
        keyPoints: kp,
        transitions: String(ms.transition || '').slice(0, 800),
      },
      suggestions: {
        visualType: 'schema_simple',
        diagramHint: String(sb.support_visuel || sb.question_cle || '').slice(0, 500),
        layoutTips: [
          'Repérer une idée forte par slide.',
          'Alléger le texte au profit du visuel Konva.',
        ],
      },
    };
  });

  const chapters = [
    {
      id: slug('ch'),
      title: 'Ouverture LIRI',
      summary: String(etapes[0]?.smartboard?.contenu || title).slice(0, 400),
      subparts: ['Accroche', 'Problème', 'Annonce'],
    },
    {
      id: slug('ch'),
      title: 'Corps du cours',
      summary: 'Développement et démonstrations.',
      subparts: ['Concepts', 'Exemples', 'Synthèse'],
    },
    {
      id: slug('ch'),
      title: 'Clôture',
      summary: String(cours?.adage_final || cours?.loi_doctrinale || '').slice(0, 400) || '—',
      subparts: ['Synthèse', 'Adage', 'Ouverture'],
    },
  ];

  const mindmap = {
    id: 'root',
    label: title,
    children: etapes.slice(0, 6).map((e, i) => ({
      id: slug('mm'),
      label: String(e?.smartboard?.titre || `Étape ${i + 1}`).slice(0, 120),
      children: [],
    })),
  };

  return {
    title,
    description: String(cours?.sous_titre || cours?.objectif || `Parcours LIRI — ${slides.length} étapes.`).slice(0, 800),
    analysis: {
      mainTopic: title,
      subthemes: [String(cours?.contexte || 'LIRI')].filter(Boolean),
      complexity: 'intermediaire',
      estimatedDurationMinutes: Math.min(240, 20 + slides.length * 8),
    },
    progression: {
      narrative: String(cours?.objectif || 'Progression méthode LIRI (10 étapes).').slice(0, 800),
      pedagogicalPhases: ['Ouverture', 'Tension', 'Concepts', 'Synthèse'],
    },
    chapters,
    slides,
    mindmap,
    masterScriptOverview: [
      cours?.objectif,
      cours?.conseil_prof,
      cours?.adage_final,
    ]
      .filter(Boolean)
      .map((x) => String(x))
      .join('\n\n')
      .slice(0, 2000),
  };
}

/**
 * Une scène Konva par étape — texte brut à affiner (style « fiche brouillon »).
 * @param {Record<string, unknown>} cours
 * @returns {import('@/features/smartboard-konva-editor/model/sceneTypes').SbKonvaProject | null}
 */
export function buildKonvaProjectFromLiriAgentCours(cours) {
  const etapes = Array.isArray(cours?.etapes) ? cours.etapes : [];
  if (etapes.length === 0) return null;

  const scenes = etapes.map((e, index) => {
    const sb = e?.smartboard || {};
    const name = String(sb.titre || `Étape ${index + 1}`).slice(0, 80);
    const scene = createEmptyScene(name);
    const headline = mkTextObject({
      x: 48,
      y: 36,
      width: SB_KONVA_CANVAS_W - 96,
      height: 64,
      content: { text: name },
      style: {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 26,
        fontWeight: 700,
        fill: '#F5E6C8',
        align: 'left',
        lineHeight: 1.2,
      },
      masterScriptRef: `etape_${e?.numero ?? index + 1}`,
    });
    const tag = String(e?.tag || '').slice(0, 48);
    const tagLine = mkTextObject({
      x: 48,
      y: 100,
      width: 420,
      height: 28,
      content: { text: tag ? `· ${tag}` : '' },
      style: {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 13,
        fontWeight: 600,
        fill: 'rgba(212,175,55,0.85)',
        align: 'left',
      },
    });
    const bodyText = [
      sb.idee ? `— ${sb.idee}` : '',
      sb.contenu ? String(sb.contenu) : '',
      sb.question_cle ? `\n\n→ ${sb.question_cle}` : '',
    ]
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 4500);

    const body = mkTextObject({
      x: 48,
      y: 138,
      width: SB_KONVA_CANVAS_W - 96,
      height: SB_KONVA_CANVAS_H - 170,
      content: { text: bodyText || '—' },
      style: {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 16,
        fontWeight: 400,
        fill: 'rgba(245,242,232,0.92)',
        align: 'left',
        lineHeight: 1.45,
      },
    });

    scene.objects = tag ? [headline, tagLine, body] : [headline, body];
    return scene;
  });

  return {
    version: 1,
    canvas: {
      width: SB_KONVA_CANVAS_W,
      height: SB_KONVA_CANVAS_H,
      background: '#0b0f1a',
    },
    scenes,
    activeSceneId: scenes[0].id,
  };
}

export function saveLiriAgentCoursForKonvaDesigner(cours) {
  try {
    localStorage.setItem(
      LIRI_AGENT_TO_KONVA_STORAGE_KEY,
      JSON.stringify({ v: 1, cours, savedAt: new Date().toISOString() }),
    );
  } catch (e) {
    console.warn('[liriAgentToKonvaDesigner] save failed', e);
  }
}

/** @returns {Record<string, unknown> | null} */
export function consumeLiriAgentCoursForKonvaDesigner() {
  try {
    const raw = localStorage.getItem(LIRI_AGENT_TO_KONVA_STORAGE_KEY);
    if (!raw) return null;
    localStorage.removeItem(LIRI_AGENT_TO_KONVA_STORAGE_KEY);
    const data = JSON.parse(raw);
    const c = data?.cours;
    if (!c || typeof c !== 'object') return null;
    return c;
  } catch {
    return null;
  }
}

export { buildLiriCourseTextForLiveStudio };
