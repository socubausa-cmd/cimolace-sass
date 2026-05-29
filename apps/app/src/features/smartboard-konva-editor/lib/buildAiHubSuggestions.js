import { longiaObjectTypeHistogram } from './buildLongiaStudioContext.js';

/**
 * @typedef {{ id: string; label: string; description: string; why?: string; apply_action: string | null; disabled?: boolean }} AiHubSuggestion
 * @param {{
 *   selectedIds: string[];
 *   objectTypes: string[];
 *   courseTitle?: string | null;
 *   sceneObjectCount?: number;
 *   sceneObjects?: Array<{ type?: string }>;
 *   slideCount?: number;
 *   activeSlideIndex?: number;
 *   activeSlideTitle?: string | null;
 *   activeSlideObjective?: string | null;
 *   lastRouting?: { requestedMode?: string; effectiveMode?: string; routingReason?: string } | null;
 *   complexity?: string | null;
 * }} ctx
 * @returns {AiHubSuggestion[]}
 */
function truncHint(s, max) {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function buildAiHubSuggestions(ctx) {
  const {
    selectedIds,
    objectTypes,
    courseTitle,
    sceneObjectCount = 0,
    sceneObjects,
    slideCount: slideCountRaw,
    activeSlideIndex: slideIdxRaw,
    activeSlideTitle,
    activeSlideObjective,
    lastRouting,
    complexity,
  } = ctx;
  const n = selectedIds.length;
  const hist = longiaObjectTypeHistogram(sceneObjects);
  const slideCount = typeof slideCountRaw === 'number' ? slideCountRaw : 0;
  const slideIdx =
    typeof slideIdxRaw === 'number' && Number.isFinite(slideIdxRaw) ? Math.max(0, slideIdxRaw) : 0;
  const objectiveTrim =
    activeSlideObjective && String(activeSlideObjective).trim()
      ? String(activeSlideObjective).trim()
      : '';
  const lr = lastRouting && typeof lastRouting === 'object' ? lastRouting : null;
  /** @type {AiHubSuggestion[]} */
  const out = [];

  if (
    lr?.requestedMode &&
    lr?.effectiveMode &&
    lr.requestedMode !== lr.effectiveMode
  ) {
    out.push({
      id: 'sug_routing_note',
      label: 'Routage LONGIA',
      description: `Vous avez demandé « ${lr.requestedMode} » ; la réponse est partie en mode « ${lr.effectiveMode} ».`,
      why: truncHint(lr.routingReason, 140) || undefined,
      apply_action: null,
      disabled: true,
    });
  }

  if (slideCount > 0 && !objectiveTrim) {
    const fi = slideIdx + 1;
    const st = activeSlideTitle && String(activeSlideTitle).trim();
    const short = st && st.length > 36 ? `${st.slice(0, 36)}…` : st;
    out.push({
      id: 'sug_slide_objective',
      label: 'Objectif de fiche',
      description: short
        ? `La fiche ${fi} « ${short} » n'a pas d'objectif pédagogique dans le plan Copilot.`
        : `La fiche ${fi} du plan n'a pas d'objectif — complétez-le dans le panneau Plan.`,
      why: 'Un objectif clair aide LONGIA à rester aligné sur votre intention.',
      apply_action: null,
      disabled: true,
    });
  }

  const imgN = Number(hist.image || 0);
  const txtN = Number(hist.text || 0);
  if (imgN >= 2 && txtN === 0 && sceneObjectCount >= 2) {
    out.push({
      id: 'sug_visual_labels',
      label: 'Légendes pour les visuels',
      description: `${imgN} image(s) sans bloc texte sur la scène — ajoutez un titre ou une courte légende.`,
      why: 'Utile pour l\'accessibilité et la compréhension rapide.',
      apply_action: null,
      disabled: true,
    });
  }

  const cx = complexity && String(complexity).toLowerCase();
  if (cx === 'avance' && slideCount >= 3) {
    out.push({
      id: 'sug_complexity_pace',
      label: 'Rythme (parcours avancé)',
      description:
        'Le plan est marqué « avance » — une idée forte par fiche évite la surcharge cognitive.',
      apply_action: null,
      disabled: true,
    });
  }

  if (n === 0 && sceneObjectCount > 0) {
    out.push({
      id: 'sug_select_all',
      label: 'Tout sélectionner sur la scène',
      description: `${sceneObjectCount} objet${sceneObjectCount > 1 ? 's' : ''} — pour grouper, dupliquer ou centrer en une fois.`,
      why: 'La multi-sélection (Shift ou Cmd/Ctrl + clic) fonctionne aussi depuis le canvas.',
      apply_action: 'select_all_on_canvas',
    });
    out.push({
      id: 'sug_typo_stack',
      label: 'Hiérarchie typographique',
      description: 'Outil Texte : enchaînez Titre 1, Sous-titre et Corps pour une diapositive lisible.',
      apply_action: null,
      disabled: true,
    });
  }

  if (n === 0 && sceneObjectCount === 0) {
    const ct =
      courseTitle && String(courseTitle).trim()
        ? String(courseTitle).trim()
        : null;
    const short = ct && ct.length > 44 ? `${ct.slice(0, 44)}…` : ct;
    out.push({
      id: 'sug_empty_scene',
      label: 'Scène vide',
      description: short
        ? `Le cours « ${short} » est prêt — ajoutez un Titre 1 ou un modèle Intro (barre d'outils).`
        : 'Outils Texte ou Modèles : titres, corps, citations, Intro, Timeline, comparaison…',
      why: undefined,
      apply_action: null,
      disabled: true,
    });
  }

  if (n >= 2) {
    out.push({
      id: 'sug_group',
      label: 'Grouper la sélection',
      description: 'Lie les éléments pour les manipuler ensemble (identifiant de groupe commun).',
      why: 'Plusieurs objets sont sélectionnés — le regroupement simplifie la mise en page.',
      apply_action: 'group_selection',
    });
  }

  if (n >= 1) {
    const typeHint =
      objectTypes.length === 1
        ? `Type : ${objectTypes[0]}.`
        : objectTypes.length > 1
          ? `${objectTypes.length} types différents dans la sélection.`
          : '';
    out.push({
      id: 'sug_dup',
      label: 'Dupliquer',
      description: 'Crée une copie décalée de chaque élément sélectionné.',
      why: typeHint ? `${typeHint} La duplication accélère les répétitions visuelles.` : 'Accélère les répétitions visuelles.',
      apply_action: 'duplicate_selection',
    });
    out.push({
      id: 'sug_center',
      label: 'Centrer sur le canvas',
      description: 'Aligne la sélection au centre horizontal et vertical du document.',
      why: 'Utile pour titres, cartes ou blocs centrés dans le format courant.',
      apply_action: 'align_center_canvas',
    });
  }

  if (n >= 1 && objectTypes.includes('text')) {
    out.push({
      id: 'sug_text_coherence',
      label: 'Cohérence des textes',
      description: 'Vérifiez tailles : un titre dominant, un sous-titre plus léger, corps confortable à lire.',
      apply_action: null,
      disabled: true,
    });
  }

  if (out.length === 0) {
    out.push({
      id: 'sug_pick',
      label: 'Sélectionnez un élément',
      description: 'Cliquez sur un objet du canvas pour voir des actions rapides adaptées.',
      apply_action: null,
      disabled: true,
    });
  }

  return out;
}
