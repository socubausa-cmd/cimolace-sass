/**
 * Scènes SmartBoard pour le brouillon wizard (stockées dans config.smartboard_element_scenes).
 */

const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

/**
 * Référentiel de coordonnées pour le canvas SmartBoard LIRI
 * Dimensions réelles écran intelligent : 860 × 750 px (ratio ~1.15:1, paysage carré)
 * Marges : 44px gauche/droite — zone utile : 772 × 706 px
 *
 * Layout 2 colonnes pour le développement :
 *   col1 : x=44, w=370px
 *   col2 : x=446, w=370px (gap 32px)
 */
const PX = {
  // Marges et largeurs
  left:      44,
  contentW:  772,   // 860 - 2×44
  col1X:     44,
  col2X:     446,   // 44 + 370 + 32
  colW:      370,

  // Zones verticales
  badgeY:    32,
  titleY:    80,
  subtitleY: 190,
  coreY:     200,
  bodyY:     220,
  devStartY: 310,
  devRowH:   80,    // hauteur d'un bloc développement
  quoteY:    618,
  illusY:    620,
};

function sceneWithElements(name, elements, order_index) {
  return {
    id: uid('sb'),
    name,
    order_index,
    content_payload_json: { elements },
  };
}

/** Modèle infographique 4 scènes — canvas 860×750px, layout 2 colonnes. */
export function buildInfographicTemplateScenes(courseTitle = 'Votre cours') {
  return [
    sceneWithElements('Titre · ' + courseTitle.slice(0, 42), [
      { id: uid('el'), type: 'badge',     content: 'PRORASCIENCE · SmartBoard',   x: PX.left,  y: PX.badgeY,              width: 360,         height: 28,  zIndex: 2 },
      { id: uid('el'), type: 'title',     content: courseTitle,                   x: PX.left,  y: PX.titleY,              width: PX.contentW, height: 100, zIndex: 3, animation: 'fade-up' },
      { id: uid('el'), type: 'paragraph', content: 'Structure visuelle premium, hierarchie claire, transitions fluides.', x: PX.left, y: PX.bodyY, width: PX.contentW, height: 90, zIndex: 2 },
      { id: uid('el'), type: 'paragraph', content: '• Structure claire\n• Hierarchie forte',    x: PX.col1X, y: PX.devStartY,            width: PX.colW, height: PX.devRowH * 2, zIndex: 2 },
      { id: uid('el'), type: 'paragraph', content: '• Transitions fluides\n• Engagement max',   x: PX.col2X, y: PX.devStartY,            width: PX.colW, height: PX.devRowH * 2, zIndex: 2 },
      { id: uid('el'), type: 'quote',     content: "L'eleve retient ce qu'il voit structure.",   x: PX.left,  y: PX.quoteY,              width: PX.contentW, height: 80,  zIndex: 2, animation: 'spotlight' },
    ], 0),
    sceneWithElements('Axes & objectifs', [
      { id: uid('el'), type: 'badge',     content: 'Infographie',                              x: PX.left,  y: PX.badgeY,              width: 180,         height: 28,  zIndex: 2 },
      { id: uid('el'), type: 'title',     content: 'Ce que nous allons couvrir',               x: PX.left,  y: PX.titleY,              width: PX.contentW, height: 100, zIndex: 3 },
      { id: uid('el'), type: 'paragraph', content: '• Objectif mesurable',                     x: PX.col1X, y: PX.devStartY,            width: PX.colW, height: PX.devRowH, zIndex: 2 },
      { id: uid('el'), type: 'paragraph', content: '• Prerequis',                              x: PX.col2X, y: PX.devStartY,            width: PX.colW, height: PX.devRowH, zIndex: 2 },
      { id: uid('el'), type: 'paragraph', content: '• Livrables de fin de seance',             x: PX.col1X, y: PX.devStartY + PX.devRowH, width: PX.colW, height: PX.devRowH, zIndex: 2 },
      { id: uid('el'), type: 'paragraph', content: '• Indicateurs de reussite',                x: PX.col2X, y: PX.devStartY + PX.devRowH, width: PX.colW, height: PX.devRowH, zIndex: 2 },
    ], 1),
    sceneWithElements('Methode & demonstration', [
      { id: uid('el'), type: 'title',     content: 'La methode en 3 gestes',                  x: PX.left,  y: PX.titleY,              width: PX.contentW, height: 100, zIndex: 3 },
      { id: uid('el'), type: 'paragraph', content: '① Modelisation',                          x: PX.col1X, y: PX.devStartY,            width: PX.colW, height: PX.devRowH, zIndex: 2 },
      { id: uid('el'), type: 'paragraph', content: '② Pratique guidee',                       x: PX.col2X, y: PX.devStartY,            width: PX.colW, height: PX.devRowH, zIndex: 2 },
      { id: uid('el'), type: 'paragraph', content: '③ Autonomie progressive',                 x: PX.col1X, y: PX.devStartY + PX.devRowH, width: PX.colW, height: PX.devRowH, zIndex: 2 },
      { id: uid('el'), type: 'paragraph', content: '↩ Feedback continu',                      x: PX.col2X, y: PX.devStartY + PX.devRowH, width: PX.colW, height: PX.devRowH, zIndex: 2 },
      { id: uid('el'), type: 'quote',     content: 'Comprendre → Appliquer → Maitriser',      x: PX.left,  y: PX.quoteY,              width: PX.contentW, height: 72,  zIndex: 2, animation: 'spotlight' },
    ], 2),
    sceneWithElements('Synthese', [
      { id: uid('el'), type: 'title',     content: 'A retenir',                               x: PX.left,  y: PX.titleY,              width: PX.contentW, height: 100, zIndex: 3 },
      { id: uid('el'), type: 'paragraph', content: 'Recapitulatif des points cles et prochaine etape du parcours apprenant.', x: PX.left, y: PX.bodyY, width: PX.contentW, height: 80, zIndex: 2 },
      { id: uid('el'), type: 'quote',     content: 'Clarte · Rythme · Engagement',            x: PX.left,  y: PX.quoteY,              width: PX.contentW, height: 72,  zIndex: 2, animation: 'spotlight' },
    ], 3),
  ];
}

/**
 * Découpe un texte collé (chapitres séparés par lignes vides ou ##) en scènes avec master script léger.
 */
export function parseCourseTextToSmartboardScenes(text, defaultTitle = 'Cours collé') {
  const raw = String(text || '').trim();
  if (!raw) return [];

  let blocks = raw.split(/\n#{2,}\s*/).map((s) => s.trim()).filter(Boolean);
  if (blocks.length <= 1) {
    blocks = raw.split(/\n\s*\n+/).map((s) => s.trim()).filter(Boolean);
  }
  if (blocks.length === 0) return [];

  return blocks.slice(0, 24).map((block, order_index) => {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    const titleLine = lines[0]?.length > 80 ? `${defaultTitle} · Partie ${order_index + 1}` : (lines[0] || `Partie ${order_index + 1}`);
    const rest = lines.slice(1).join(' ') || block.slice(0, 320);
    const bullets = lines.slice(1, 6).filter((l) => l.length < 200);
    const body = bullets.length >= 2 ? bullets.map((b) => `• ${b}`).join('\n') : rest;

    return sceneWithElements(titleLine.slice(0, 72), [
      { id: uid('el'), type: 'badge', content: `Scène ${order_index + 1}`, x: PX.left, y: PX.badgeY, width: 180, height: 28, zIndex: 2 },
      { id: uid('el'), type: 'title', content: titleLine.slice(0, 64), x: PX.left, y: PX.titleY, width: PX.contentW, height: 100, zIndex: 3, animation: 'fade-up' },
      { id: uid('el'), type: 'paragraph', content: body.slice(0, 520), x: PX.left, y: PX.bodyY, width: PX.contentW, height: 120, zIndex: 2 },
      { id: uid('el'), type: 'quote', content: `Script conseillé : annoncer cette partie, illustrer, poser une question de compréhension.`, x: PX.left, y: PX.quoteY, width: PX.contentW, height: 72, zIndex: 2, animation: 'spotlight' },
    ], order_index);
  });
}

/**
 * Mode "Progressive Build Canvas":
 * une même scène se construit en couches (clic/scroll), sans reset visuel.
 */
export function parseCourseTextToProgressiveBuildScenes(text, defaultTitle = 'Cours collé') {
  const raw = String(text || '').trim();
  if (!raw) return [];

  let blocks = raw.split(/\n#{2,}\s*/).map((s) => s.trim()).filter(Boolean);
  if (blocks.length <= 1) {
    blocks = raw.split(/\n\s*\n+/).map((s) => s.trim()).filter(Boolean);
  }
  if (blocks.length === 0) return [];

  return blocks.slice(0, 24).map((block, order_index) => {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    const titleLine = lines[0]?.length > 84
      ? `${defaultTitle} · Partie ${order_index + 1}`
      : (lines[0] || `Partie ${order_index + 1}`);
    const subtitle = lines[1] || 'Construction progressive contextuelle';
    const candidates = lines.slice(1).filter(Boolean).slice(0, 8);
    const progressiveSteps = (candidates.length ? candidates : [block])
      .map((s) => String(s).replace(/^[-•]\s*/, '').trim())
      .filter(Boolean)
      .slice(0, 8);
    const coreIdea = progressiveSteps[0] || `Idée clé de la partie ${order_index + 1}`;
    const body = progressiveSteps.map((s) => `• ${s}`).join('\n').slice(0, 520);

    const scene = sceneWithElements(titleLine.slice(0, 72), [
      { id: uid('el'), type: 'badge', content: `Scène ${order_index + 1} · Progressive Build Canvas`, x: PX.left, y: PX.badgeY, width: 480, height: 28, zIndex: 2 },
      { id: uid('el'), type: 'title', content: titleLine.slice(0, 64), x: PX.left, y: PX.titleY, width: PX.contentW, height: 100, zIndex: 3, animation: 'fade-up' },
      { id: uid('el'), type: 'paragraph', content: `${subtitle}\n\n${body}`.slice(0, 680), x: PX.left, y: PX.bodyY, width: PX.contentW, height: 130, zIndex: 2 },
      { id: uid('el'), type: 'quote', content: 'Script conseillé : révéler une idée à chaque clic/scroll sans changer de slide.', x: PX.left, y: PX.quoteY, width: PX.contentW, height: 72, zIndex: 2, animation: 'spotlight' },
    ], order_index);

    scene.content_payload_json = {
      ...scene.content_payload_json,
      progressive_build_canvas: {
        mode: 'Progressive Build Canvas',
        subtitle,
        core_idea: coreIdea,
        progressive_steps: progressiveSteps,
        visual_type: 'schema',
        graphic_style: 'dark-gold-premium',
      },
    };
    return scene;
  });
}

export function buildMasterScriptFromScenes(scenes) {
  if (!Array.isArray(scenes)) return [];
  return scenes.map((s, i) => {
    const title = s.name || `Section ${i + 1}`;
    const objective = `Présenter « ${(s.name || '').slice(0, 60)} » et vérifier la compréhension.`;
    const description = 'Voir éléments sur la slide correspondante.';
    const retention = `Point clé scène ${i + 1} : reformuler en une phrase avant de passer à la suite.`;
    const content = `【Objectif】\n${objective}\n\n【Piste】\n${description}\n\n【Rétention】\n${retention}`;
    return {
      id: s.id || `ms-${i}`,
      slide_index: i,
      title,
      script: objective,
      content,
      objective,
      description,
      retention,
    };
  });
}
