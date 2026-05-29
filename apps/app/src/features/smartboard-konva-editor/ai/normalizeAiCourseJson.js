/**
 * Normalise la sortie JSON du modèle (souvent partielle) vers LiriCourseCopilotCourse.
 */

/** @type {import('../model/courseCopilotTypes').CourseSlideType[]} */
const SLIDE_TYPES = [
  'atelier',
  'confrontation',
  'definition',
  'demonstration',
  'exemple',
  'synthese',
];

const SLIDE_TYPE_SET = new Set(SLIDE_TYPES);

function slugId(prefix) {
  const r =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().slice(0, 8)
      : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  return `${prefix}_${r}`;
}

function asStr(v, fallback = '') {
  if (v == null) return fallback;
  const s = String(v).trim();
  return s || fallback;
}

function asStrArr(v, max = 12) {
  if (!Array.isArray(v)) return [];
  return v.map((x) => asStr(x)).filter(Boolean).slice(0, max);
}

function normSlideType(t) {
  const s = asStr(t, 'definition').toLowerCase();
  return SLIDE_TYPE_SET.has(/** @type {any} */ (s)) ? /** @type {any} */ (s) : 'definition';
}

/**
 * @param {unknown} raw
 * @returns {import('../model/courseCopilotTypes').LiriCourseCopilotCourse}
 */
export function normalizeAiCourseJson(raw) {
  const root =
    raw && typeof raw === 'object' && 'course' in /** @type {object} */ (raw)
      ? /** @type {any} */ (raw).course
      : raw;
  if (!root || typeof root !== 'object') {
    throw new Error('Réponse IA : objet cours attendu');
  }
  const o = /** @type {Record<string, unknown>} */ (root);

  const slidesIn = Array.isArray(o.slides) ? o.slides : [];
  if (slidesIn.length === 0) {
    throw new Error('Réponse IA : aucun slide');
  }

  const title = asStr(o.title, 'Cours structuré').slice(0, 200);

  /** @type {import('../model/courseCopilotTypes').CourseSlide[]} */
  const slides = slidesIn.slice(0, 24).map((s, i) => {
    const sl = s && typeof s === 'object' ? /** @type {Record<string, unknown>} */ (s) : {};
    const c = sl.content && typeof sl.content === 'object' ? /** @type {Record<string, unknown>} */ (sl.content) : {};
    const ms =
      sl.masterScript && typeof sl.masterScript === 'object'
        ? /** @type {Record<string, unknown>} */ (sl.masterScript)
        : {};
    const su =
      sl.suggestions && typeof sl.suggestions === 'object'
        ? /** @type {Record<string, unknown>} */ (sl.suggestions)
        : {};
    const zonesIn = Array.isArray(sl.zones) ? sl.zones : [];
    const zones = zonesIn.slice(0, 8).map((z, zi) => {
      const zz = z && typeof z === 'object' ? /** @type {Record<string, unknown>} */ (z) : {};
      return {
        id: asStr(zz.id, `z-${zi}`).slice(0, 64),
        role: asStr(zz.role, 'Zone').slice(0, 120),
        hint: asStr(zz.hint, '').slice(0, 400),
      };
    });
    if (zones.length === 0) {
      zones.push(
        { id: 'z-titre', role: 'Titre', hint: 'Ligne forte en haut.' },
        { id: 'z-corps', role: 'Corps', hint: 'Liste ou paragraphe court.' },
      );
    }
    const kp = asStrArr(ms.keyPoints, 8);
    while (kp.length < 2) kp.push('—');

    return {
      id: asStr(sl.id, slugId('sl')).slice(0, 80),
      title: asStr(sl.title, `Slide ${i + 1}`).slice(0, 200),
      type: normSlideType(sl.type),
      objective: asStr(sl.objective, `Objectif du slide ${i + 1}.`).slice(0, 600),
      content: {
        title: asStr(c.title, title).slice(0, 160),
        subtitle: asStr(c.subtitle, '').slice(0, 200),
        mainText: asStr(c.mainText, c.body || c.text || '').slice(0, 4000),
        blocks: (() => {
          const b = asStrArr(c.blocks, 10);
          while (b.length < 2) b.push('—');
          return b.slice(0, 8);
        })(),
      },
      zones,
      masterScript: {
        discourse: asStr(ms.discourse, ms.script || '').slice(0, 2500),
        keyPoints: kp.slice(0, 8),
        transitions: asStr(ms.transitions, '').slice(0, 800),
      },
      suggestions: {
        visualType: asStr(su.visualType, 'schema_simple').slice(0, 80),
        diagramHint: asStr(su.diagramHint, '').slice(0, 500),
        layoutTips: (() => {
          const t = asStrArr(su.layoutTips, 6);
          while (t.length < 1) t.push('Hiérarchie typographique claire.');
          return t.slice(0, 6);
        })(),
      },
    };
  });

  const chaptersIn = Array.isArray(o.chapters) ? o.chapters : [];
  /** @type {import('../model/courseCopilotTypes').CourseChapter[]} */
  let chapters = chaptersIn.slice(0, 12).map((ch, ci) => {
    const c = ch && typeof ch === 'object' ? /** @type {Record<string, unknown>} */ (ch) : {};
    const sp = asStrArr(c.subparts, 8);
    while (sp.length < 2) sp.push('—');
    return {
      id: asStr(c.id, slugId('ch')).slice(0, 80),
      title: asStr(c.title, `Chapitre ${ci + 1}`).slice(0, 160),
      summary: asStr(c.summary, '').slice(0, 400),
      subparts: sp.slice(0, 8),
    };
  });

  if (chapters.length === 0) {
    const n = Math.min(3, Math.max(2, Math.ceil(slides.length / 4) || 2));
    for (let c = 0; c < n; c += 1) {
      chapters.push({
        id: slugId('ch'),
        title:
          c === 0
            ? 'Introduction'
            : c === n - 1
              ? 'Synthèse'
              : `Partie ${c + 1}`,
        summary: slides[Math.min(c, slides.length - 1)]?.content?.mainText?.slice(0, 200) || '—',
        subparts: ['Objectifs', 'Prérequis', 'Activité'],
      });
    }
  }

  const analysis = o.analysis && typeof o.analysis === 'object' ? /** @type {Record<string, unknown>} */ (o.analysis) : {};
  const cx = asStr(analysis.complexity, 'intermediaire').toLowerCase();
  const complexity =
    cx === 'debutant' || cx === 'intermediaire' || cx === 'avance' ? /** @type {any} */ (cx) : 'intermediaire';

  const progression =
    o.progression && typeof o.progression === 'object'
      ? /** @type {Record<string, unknown>} */ (o.progression)
      : {};
  const phases = asStrArr(progression.pedagogicalPhases, 12);
  const pedagogicalPhases =
    phases.length > 0
      ? phases
      : [
          'Question initiale',
          'Tension cognitive',
          'Définition',
          'Démonstration',
          'Synthèse',
        ];

  /** @type {import('../model/courseCopilotTypes').CourseMindmapNode | null} */
  let mindmap = null;
  if (o.mindmap && typeof o.mindmap === 'object') {
    const m = /** @type {Record<string, unknown>} */ (o.mindmap);
    const walk = (node, depth) => {
      if (!node || typeof node !== 'object' || depth > 8) return null;
      const n = /** @type {Record<string, unknown>} */ (node);
      const childrenIn = Array.isArray(n.children) ? n.children : [];
      return {
        id: asStr(n.id, slugId('mm')).slice(0, 80),
        label: asStr(n.label, n.title || 'Nœud').slice(0, 200),
        children: childrenIn
          .map((ch) => walk(ch, depth + 1))
          .filter(Boolean),
      };
    };
    mindmap = walk(m, 0);
  }
  if (!mindmap) {
    const nc = Math.max(chapters.length, 1);
    mindmap = {
      id: 'root',
      label: title,
      children: chapters.map((ch, ci) => ({
        id: ch.id,
        label: ch.title,
        children: slides
          .filter((_, si) => si % nc === ci)
          .slice(0, 4)
          .map((s) => ({ id: s.id, label: s.title, children: [] })),
      })),
    };
  }

  return {
    title,
    description: asStr(o.description, `Cours structuré (${slides.length} slides).`).slice(0, 800),
    analysis: {
      mainTopic: asStr(analysis.mainTopic, title).slice(0, 200),
      subthemes: asStrArr(analysis.subthemes, 8).slice(0, 6),
      complexity,
      estimatedDurationMinutes: Math.min(
        480,
        Math.max(15, Number(analysis.estimatedDurationMinutes) || 20 + slides.length * 4),
      ),
    },
    progression: {
      narrative: asStr(progression.narrative, 'Progression pédagogique du document source.').slice(0, 800),
      pedagogicalPhases,
    },
    chapters,
    slides,
    mindmap,
    masterScriptOverview: asStr(o.masterScriptOverview || o.master_script_overview, '').slice(0, 2000),
  };
}
