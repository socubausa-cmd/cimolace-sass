/**
 * Convertit un `PrecepteurCourse` (sortie de la Masterclass Factory, cf. fromMasterclass.js)
 * en « draft » de formation consommable par `usePublishToClassroom` → tables relationnelles
 * (modules → formation_weeks → formation_days → formation_day_contents).
 *
 * But : un cours généré (Factory) devient une VRAIE formation visible dans l'OS
 * `/liri/formations` (rendu immersif) ET dans les lecteurs élève, en plus du mode
 * Précepteur (masterclasses.precepteur_course). Un concept → un « jour » ; ses scènes →
 * des slides de support ; les concepts → une carte mentale (mindmap) de révision.
 */

const clip = (s, n = 280) => {
  const t = String(s || '').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

// Texte brut → HTML paragraphes (PowerPointViewer/OsReader lisent du HTML dans `content`).
const toHtml = (s) => {
  const t = String(s || '').trim();
  if (!t) return '';
  return t
    .split(/\n{2,}/)
    .map((para) => `<p>${para.replace(/\n/g, '<br/>')}</p>`)
    .join('');
};

// Un concept Précepteur → slides de support (une slide par scène narrative).
const conceptToSlides = (concept) => {
  const slides = [];
  (concept?.scenes || []).forEach((sc) => {
    switch (sc?.type) {
      case 'lecon':
        slides.push({ title: sc.title || concept.title || 'Leçon', content: toHtml(sc.narration || sc.board_text) });
        break;
      case 'amorce_croquis':
        slides.push({ title: 'Pour commencer', content: toHtml(sc.narration) });
        break;
      case 'image_analogie':
        slides.push({ title: 'Analogie', content: toHtml(sc.analogie || sc.narration) });
        break;
      case 'atelier':
        slides.push({ title: 'Atelier', content: toHtml([sc.question, sc.reveal_narration].filter(Boolean).join('\n\n')) });
        break;
      default:
        break; // transition & autres → non repris en slide
    }
  });
  if (!slides.length && concept?.title) slides.push({ title: concept.title, content: toHtml(concept.title) });
  return slides;
};

// Carte mentale du cours : racine = titre ; branches = concepts (résumé = 1re leçon).
const buildMindmap = (pc) => ({
  label: pc?.title || 'Le cours',
  summary: '',
  children: (pc?.concepts || []).map((c) => {
    const lecon = (c?.scenes || []).find((s) => s?.type === 'lecon');
    return { label: c?.title || 'Concept', summary: clip(lecon?.narration || ''), keyPoints: [] };
  }),
});

/**
 * @param {{title?:string, concepts?:Array}} pc  PrecepteurCourse
 * @param {{description?:string, level?:string, category?:string, status?:string, title?:string}} [opts]
 * @returns {{title, description, status, category, level, modules:Array}} draft pour usePublishToClassroom
 */
export function precepteurCourseToClassroomDraft(pc, opts = {}) {
  const concepts = Array.isArray(pc?.concepts) ? pc.concepts : [];
  const days = concepts.map((c, i) => ({
    title: c?.title || `Leçon ${i + 1}`,
    powerpoint: { type: 'slides', title: c?.title || `Leçon ${i + 1}`, slides: conceptToSlides(c) },
  }));

  // La carte mentale de révision est portée par une « vidéo » SANS url (les tables ne
  // persistent le mindmap que dans un content `video`). Le renderer OS traite une vidéo
  // sans url comme un simple porteur de mindmap (pas de lecteur noir), cf. FormationOsDayView.
  if (days.length) {
    days[0].videos = [{ url: '', type: 'upload', title: 'Carte du cours', mindmap: buildMindmap(pc) }];
  }

  return {
    title: pc?.title || opts.title || 'Cours',
    description: opts.description || '',
    category: opts.category || null,
    level: opts.level || null,
    status: opts.status || 'published',
    modules: days.length ? [{ title: 'Programme', weeks: [{ title: 'Parcours', days }] }] : [],
  };
}

/**
 * Convertit la sortie de l'edge `liri-agent-course-generate` (Formation LLM Builder) en draft.
 * `cours` = { titre, objectif?, sous_titre?, etapes: [{ numero?, tag?, smartboard: {titre, contenu?, idee?} }] }.
 * Une étape → un « jour » (slide de support) ; les étapes → une mindmap de révision.
 * @param {object} cours
 * @param {{title?:string, status?:string}} [opts]
 */
export function agentCourseToClassroomDraft(cours, opts = {}) {
  const etapes = Array.isArray(cours?.etapes) ? cours.etapes : [];
  const days = etapes.map((st, i) => {
    const sb = st?.smartboard || {};
    const title = sb.titre || st?.tag || `Étape ${st?.numero || i + 1}`;
    const content = sb.contenu || sb.idee || '';
    return { title, powerpoint: { type: 'slides', title, slides: [{ title, content: toHtml(content) }] } };
  });
  if (days.length) {
    days[0].videos = [{
      url: '', type: 'upload', title: 'Carte du cours',
      mindmap: {
        label: cours?.titre || 'Le cours',
        summary: clip(cours?.objectif || cours?.sous_titre || '', 200),
        children: etapes.map((st, i) => {
          const sb = st?.smartboard || {};
          return { label: sb.titre || st?.tag || `Étape ${i + 1}`, summary: clip(sb.contenu || sb.idee || ''), keyPoints: [] };
        }),
      },
    }];
  }
  return {
    title: cours?.titre || opts.title || 'Cours',
    description: cours?.objectif || cours?.sous_titre || '',
    status: opts.status || 'published',
    modules: days.length ? [{ title: 'Programme', weeks: [{ title: 'Parcours', days }] }] : [],
  };
}

/**
 * Convertit le `course` de l'éditeur SmartBoard Konva (useCourseCopilotStore) en draft.
 * `course` = { title?, slides: [{ title, content: { mainIdea?, keyPoints?: string[] } }] }.
 * Le deck ENTIER → un « jour » (support = toutes les slides) + une mindmap de révision.
 * @param {object} course
 * @param {{title?:string, description?:string, status?:string}} [opts]
 */
export function smartboardCourseToClassroomDraft(course, opts = {}) {
  const slides = Array.isArray(course?.slides) ? course.slides : [];
  const pptSlides = slides.map((s, i) => {
    const c = s?.content || {};
    const kp = Array.isArray(c.keyPoints) ? c.keyPoints.filter(Boolean) : [];
    const body = [c.mainIdea, kp.length ? kp.map((k) => `• ${k}`).join('\n') : ''].filter(Boolean).join('\n\n');
    return { title: s?.title || `Slide ${i + 1}`, content: toHtml(body || s?.title || '') };
  });
  const title = course?.title || opts.title || 'Cours SmartBoard';
  const days = pptSlides.length ? [{
    title,
    powerpoint: { type: 'slides', title, slides: pptSlides },
    videos: [{
      url: '', type: 'upload', title: 'Carte du cours',
      mindmap: {
        label: title, summary: '',
        children: slides.map((s, i) => ({
          label: s?.title || `Slide ${i + 1}`,
          summary: clip(s?.content?.mainIdea || ''),
          keyPoints: Array.isArray(s?.content?.keyPoints) ? s.content.keyPoints.filter(Boolean).slice(0, 4) : [],
        })),
      },
    }],
  }] : [];
  return {
    title,
    description: opts.description || '',
    status: opts.status || 'published',
    modules: days.length ? [{ title: 'Programme', weeks: [{ title: 'Parcours', days }] }] : [],
  };
}

export default precepteurCourseToClassroomDraft;
