/**
 * smartboardIAMapper
 *
 * Mappe la sortie du GPT SmartBoard (format officiel) vers le format
 * de scènes internes utilisé par le wizard LiveStudio et le SlideParallaxStage.
 *
 * Format GPT en entrée :
 *   { slides: [ { title, subtitle, core_idea, hero_visual, development: [{label, points[]}], illustration, … } ] }
 *   (development peut encore être un tableau de chaînes — legacy)
 *
 * Format scène interne en sortie :
 *   {
 *     id, name, order_index, scene_type: 'progressive_build',
 *     ia_data: <slide GPT brut>,
 *     elements: [ { id, type, content, x, y, width, height, zIndex } ]
 *   }
 */

/**
 * Canvas affichage legacy : 860 × 750. Les gabarits GPT sont en 1037 × 750 → scale X.
 */
const CANVAS_W = 860;
const GPT_W = 1037;
const SCALE_X = CANVAS_W / GPT_W;

/**
 * Référentiel legacy — layout 2 colonnes classique
 */
const PX = {
  left:      44,
  right:     816,
  contentW:  772,
  col1X:     44,
  col2X:     446,
  colW:      370,
  badgeY:    32,
  titleY:    80,
  subtitleY: 56,
  coreY:     200,
  devStartY: 310,
  devRowH:   75,
  illusY:    620,
  illusH:    110,
};

/** Zones horizontal_split (GPT) ramenées au canvas 860px de large */
const HZ = {
  devX: Math.round(70 * SCALE_X),
  devW: Math.round(360 * SCALE_X),
  visX: Math.round(455 * SCALE_X),
  visW: Math.round(500 * SCALE_X),
  rowY: 300,
  blockH: 92,
};

/**
 * Construit un tableau d'éléments positionnels à partir d'une slide GPT.
 * Ces éléments alimentent le renderer legacy (SlideParallaxStage classique).
 * Le renderer ProgressiveBuildSlide utilise directement ia_data.
 */
function isStructuredDevelopment(slide) {
  const d = slide.development;
  return Array.isArray(d) && d.length > 0 && typeof d[0] === 'object' && Array.isArray(d[0].points);
}

function buildElementsFromIASlide(slide, slideIdx) {
  const prefix = `ia-${slideIdx}`;
  const els = [];
  const horizontal = slide.layout_mode === 'smartboard_horizontal' || isStructuredDevelopment(slide);

  // Badge — smartboard horizontal ou sous-titre
  const badgeText = horizontal ? 'SmartBoard · 1037×750' : (slide.subtitle || '');
  if (badgeText) {
    els.push({
      id: `${prefix}-badge`, type: 'badge', content: badgeText,
      x: PX.left, y: PX.badgeY, width: horizontal ? 520 : 480, height: 26, zIndex: 1,
    });
  }

  if (horizontal && slide.subtitle) {
    els.push({
      id: `${prefix}-sub`, type: 'badge', content: slide.subtitle,
      x: PX.left, y: PX.badgeY + 30, width: PX.contentW, height: 22, zIndex: 1,
    });
  }

  els.push({
    id: `${prefix}-title`, type: 'title', content: slide.title || `Slide ${slideIdx + 1}`,
    x: PX.left, y: horizontal ? PX.titleY + 24 : PX.titleY, width: PX.contentW, height: 88, zIndex: 2,
  });

  if (slide.core_idea) {
    els.push({
      id: `${prefix}-core`, type: 'quote', content: slide.core_idea,
      x: PX.left, y: horizontal ? 168 : PX.coreY, width: PX.contentW, height: 56, zIndex: 3,
    });
  }

  const imgSrc = slide.illustration_image_url || slide.illustration?.image_url;

  if (horizontal && isStructuredDevelopment(slide)) {
    (slide.development || []).slice(0, 3).forEach((block, j) => {
      const label = block.label || `Bloc ${j + 1}`;
      const text = [label, ...(block.points || []).map((p) => `• ${p}`)].join('\n');
      els.push({
        id: `${prefix}-dev-${j}`,
        type: 'paragraph',
        content: text,
        x: HZ.devX,
        y: HZ.rowY + j * HZ.blockH,
        width: HZ.devW,
        height: HZ.blockH - 6,
        zIndex: 4,
      });
    });
    const heroTxt = slide.hero_visual?.description || slide.visual_description || '';
    if (heroTxt) {
      els.push({
        id: `${prefix}-hero`,
        type: 'paragraph',
        content: `${slide.hero_visual?.type || 'Visuel'}\n${heroTxt}`,
        x: HZ.visX,
        y: HZ.rowY,
        width: HZ.visW,
        height: 120,
        zIndex: 4,
      });
    }
    if (imgSrc) {
      els.push({
        id: `${prefix}-illus-img`,
        type: 'image',
        src: imgSrc,
        content: slide.illustration?.scene || '',
        x: HZ.visX,
        y: HZ.rowY + 128,
        width: HZ.visW,
        height: 160,
        zIndex: 4,
      });
    }
  } else {
    const devPoints = (slide.development || []).slice(0, 4).map((p) => (typeof p === 'string' ? p : (p.label || JSON.stringify(p))));
    devPoints.forEach((point, j) => {
      const isCol2 = j % 2 === 1;
      const row = Math.floor(j / 2);
      els.push({
        id: `${prefix}-dev-${j}`,
        type: 'paragraph',
        content: `• ${point}`,
        x: isCol2 ? PX.col2X : PX.col1X,
        y: PX.devStartY + row * PX.devRowH,
        width: PX.colW, height: PX.devRowH - 8,
        zIndex: 4,
      });
    });
    if (imgSrc) {
      els.push({
        id: `${prefix}-illus-img`,
        type: 'image',
        src: imgSrc,
        content: slide.visual_description || '',
        x: PX.col2X,
        y: PX.titleY,
        width: PX.colW,
        height: 220,
        zIndex: 4,
      });
    }
  }

  if (slide.illustration?.insight) {
    els.push({
      id: `${prefix}-insight`, type: 'quote', content: slide.illustration.insight,
      x: PX.left, y: PX.illusY, width: PX.contentW, height: 56, zIndex: 5,
    });
  }
  if (slide.illustration?.formula) {
    els.push({
      id: `${prefix}-formula`, type: 'badge', content: slide.illustration.formula,
      x: PX.left, y: PX.illusY + 60, width: PX.contentW, height: 28, zIndex: 5,
    });
  }

  return els;
}

/**
 * Mappe un tableau de slides GPT vers des scènes internes du wizard.
 *
 * @param {Array}  iaSlides  — tableau `slides` issu du GPT
 * @param {string} [prefix]  — préfixe d'ID optionnel
 * @returns {Array}          — scènes au format interne
 */
export function mapIASlidesToScenes(iaSlides = [], prefix = 'ia', deckFormat = null) {
  const ts = Date.now();
  const fmt =
    deckFormat && Number(deckFormat.width) > 0 && Number(deckFormat.height) > 0
      ? { width: Math.round(Number(deckFormat.width)), height: Math.round(Number(deckFormat.height)) }
      : null;
  return iaSlides.map((slide, i) => {
    const hasDc =
      slide.design_canvas &&
      Number(slide.design_canvas.width) > 0 &&
      Number(slide.design_canvas.height) > 0;
    const ia = fmt && !hasDc ? { ...slide, design_canvas: fmt } : slide;
    return {
      id: `${prefix}-${ts}-${i}`,
      name: ia.title || `Slide ${i + 1}`,
      order_index: i,
      scene_type: 'progressive_build',
      ia_data: ia,
      elements: buildElementsFromIASlide(ia, i),
    };
  });
}

/**
 * Mappe la réponse complète de l'API smartboard-ia-generate vers les champs
 * du draft wizard (smartboard_element_scenes + smartboard_master_script_sections).
 *
 * @param {{ slides: Array, provider: string }} apiResponse
 * @param {object} [existingDraft]  — draft actuel pour conserver les autres champs
 * @returns {Partial<DraftState>}
 */
export function mapIAResponseToDraft(apiResponse, existingDraft = {}) {
  const slides = apiResponse.slides || [];
  const scenes = mapIASlidesToScenes(slides, 'ia', apiResponse.format);
  const deckTitle = typeof apiResponse.deck_title === 'string' ? apiResponse.deck_title.trim() : '';
  const masterRows = Array.isArray(apiResponse.master_scripts) ? apiResponse.master_scripts : [];
  const ts = Date.now();

  const masterScriptSections = scenes.map((scene, i) => {
    const slide = slides[i];
    const m = masterRows[i];
    if (m && typeof m === 'object' && (m.teacher_script || m.intention || m.message_central)) {
      return buildMasterScriptSectionFromAgent(scene, slide, i, m, ts);
    }
    return {
      id: `ms-${ts}-${i}`,
      scene_id: scene.id,
      slide_index: i,
      title: slide?.title || scene.name || `Slide ${i + 1}`,
      script: buildSceneScript(slide),
      content: buildSceneScript(slide),
      objective: slide?.core_idea || '',
      description: '',
      retention: '',
      duration_estimate: estimateDuration(slide),
    };
  });

  return {
    ...existingDraft,
    ...(deckTitle && !String(existingDraft?.title || '').trim() ? { title: deckTitle } : {}),
    smartboard_element_scenes: scenes,
    smartboard_master_script_sections: masterScriptSections,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Texte structuré pour le panneau MasterScript / prompteur (champ `content`).
 */
export function formatMasterAgentContent(agent) {
  if (!agent || typeof agent !== 'object') return '';
  const lines = [];
  if (agent.intention) lines.push(`【Intention du slide】\n${agent.intention}`);
  if (agent.message_central) lines.push(`【Message central】\n${agent.message_central}`);
  if (agent.teacher_script) lines.push(`【Discours du professeur】\n${agent.teacher_script}`);
  if (Array.isArray(agent.key_points) && agent.key_points.length) {
    lines.push(`【Grandes idées à insister】\n${agent.key_points.map((k) => `• ${k}`).join('\n')}`);
  }
  if (agent.student_understanding) {
    lines.push(`【Ce que l'élève doit comprendre】\n${agent.student_understanding}`);
  }
  if (agent.transition) lines.push(`【Transition】\n${agent.transition}`);
  if (agent.simple_version) lines.push(`【Variante simple】\n${agent.simple_version}`);
  return lines.join('\n\n');
}

function estimateDurationFromTeacherScript(teacherScript, slide) {
  const w = String(teacherScript || '').split(/\s+/).filter(Boolean).length;
  if (w >= 35) return Math.max(45, Math.round((w / 130) * 60));
  return estimateDuration(slide);
}

function buildMasterScriptSectionFromAgent(scene, slide, i, m, ts) {
  const agent = {
    slide_id: m.slide_id,
    slide_title: m.slide_title,
    intention: m.intention,
    message_central: m.message_central,
    teacher_script: m.teacher_script,
    key_points: Array.isArray(m.key_points) ? m.key_points : [],
    student_understanding: m.student_understanding,
    transition: m.transition,
    simple_version: m.simple_version,
  };
  const oral = String(m.teacher_script || '').trim() || buildSceneScript(slide);
  return {
    id: `ms-${ts}-${i}`,
    scene_id: scene.id,
    slide_index: i,
    title: String(m.slide_title || slide?.title || scene.name || `Slide ${i + 1}`).trim(),
    script: oral,
    content: formatMasterAgentContent(agent) || oral,
    objective: String(m.message_central || slide?.core_idea || '').trim(),
    description: String(m.intention || '').trim(),
    retention: String(m.student_understanding || '').trim(),
    memorization_tip: String(m.simple_version || '').trim() || undefined,
    transition: String(m.transition || '').trim() || undefined,
    master_agent: agent,
    duration_estimate: estimateDurationFromTeacherScript(m.teacher_script, slide),
  };
}

function buildSceneScript(slide) {
  const parts = [];
  if (slide.title)    parts.push(`[Afficher] ${slide.title}`);
  if (slide.core_idea) parts.push(`[Idée centrale] ${slide.core_idea}`);
  if (slide.development?.length) {
    parts.push('[Développement]');
    slide.development.forEach((p) => {
      if (typeof p === 'string') parts.push(`  • ${p}`);
      else if (p?.label) {
        parts.push(`  [${p.label}]`);
        (p.points || []).forEach((pt) => parts.push(`    • ${pt}`));
      }
    });
  }
  if (slide.hero_visual?.description) {
    parts.push(`[Visuel] ${slide.hero_visual.description}`);
  }
  const ill = slide.illustration;
  if (ill?.scene)   parts.push(`[Illustration] ${ill.scene}`);
  if (ill?.insight) parts.push(`[Message clé] ${ill.insight}`);
  if (ill?.formula) parts.push(`[Formule] ${ill.formula}`);
  if (ill?.advice)  parts.push(`[Conseil] ${ill.advice}`);
  if (slide.slide_summary) parts.push(`[Résumé slide]\n${slide.slide_summary}`);
  return parts.join('\n');
}

function estimateDuration(slide) {
  let devWords = 0;
  (slide.development || []).forEach((p) => {
    if (typeof p === 'string') devWords += p.split(' ').length;
    else if (p?.points) devWords += p.points.join(' ').split(' ').length;
  });
  const wordCount =
    (slide.title || '').split(' ').length +
    (slide.core_idea || '').split(' ').length +
    devWords;
  return Math.max(30, Math.round((wordCount / 100) * 60));
}
