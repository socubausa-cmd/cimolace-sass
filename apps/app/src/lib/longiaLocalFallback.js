/**
 * Fallback LONGIA hors cloud : texte utile + suggestions (enveloppe alignée hub).
 * @typedef {{ label: string, action: string, payload?: Record<string, unknown> }} LongiaSuggestion
 * @typedef {{ text: string, suggestions: LongiaSuggestion[], intent?: Record<string, string>, strategy?: string, payload?: Record<string, unknown> }} LongiaRichReply
 */

/**
 * @param {string} msg
 * @param {{ objects?: Array<{ id: string, type: string }> }|null|undefined} scene
 * @param {string[]} selectedIds
 * @param {{ getLabel?: (type: string) => string }} [opts]
 * @returns {LongiaRichReply}
 */
export function buildLocalLongiaRichReply(msg, scene, selectedIds, opts = {}) {
  const getLabel = opts.getLabel || (() => 'élément');
  const objCount = scene?.objects?.length ?? 0;
  const selCount = selectedIds.length;
  const selId = selectedIds[0];
  const selObj = selId ? scene?.objects?.find((o) => o.id === selId) : null;
  const q = msg.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const loose = q.replace(/[''`]/g, ' ');

  const docChip = () => [
    { label: 'Architecte documentaire (guidé)', action: 'start_guided_flow', payload: { seedText: msg } },
    { label: 'Générer un plan de document', action: 'generate_document', payload: { seedText: msg } },
    { label: 'Mode Architect (structure / JSON)', action: 'use_architect_mode', payload: {} },
  ];

  if (
    (loose.includes('demande') && loose.includes('emploi')) ||
    loose.includes('lettre de motivation') ||
    loose.includes('candidature spont') ||
    /\b(job application|cover letter)\b/.test(q)
  ) {
    return {
      text:
        `Je peux t'aider sans modèle catalogue exact : une **demande d'emploi / lettre de motivation** suit en général coordonnées, destinataire, objet, accroche, parcours, motivation, politesse et signature. Ouvre l'architecte documentaire ou poursuis ici avec le mode Architect pour une structure détaillée.`,
      suggestions: docChip(),
      intent: { project_type: 'document', document_type: 'letter', subtype: 'employment_request', tone: 'professional' },
      strategy: 'generative_scratch',
      payload: {
        recommended_template_family: 'professional_letter',
        required_fields: ['destinataire', 'objet', 'corps', 'signature'],
      },
    };
  }

  if (loose.includes('mairie') || loose.includes('administratif') || loose.includes('prefecture')) {
    return {
      text:
        `Pour une **lettre à une mairie ou administration**, pars d'une lettre formelle : identité, coordonnées, objet précis, corps structuré, pièces jointes éventuelles, formule de politesse. Aucun intitulé exact requis dans la bibliothèque : on adapte la structure.`,
      suggestions: docChip(),
      intent: { project_type: 'document', document_type: 'letter', subtype: 'administrative', tone: 'formal' },
      strategy: 'nearest_template',
      payload: { recommended_template_family: 'administrative_letter' },
    };
  }

  if (loose.includes('attestation') || loose.includes('certificat') || loose.includes('justificatif')) {
    return {
      text:
        '**Attestation / certificat** : entête institutionnelle, corps qui énonce les faits, date, lieu, signature ou cachet. Je peux lancer le flux guidé pour remplir les champs même sans modèle identique au catalogue.',
      suggestions: docChip(),
      intent: { project_type: 'document', document_type: 'attestation', tone: 'institutional' },
      strategy: 'nearest_template',
      payload: {},
    };
  }

  if (loose.includes('cv') || loose.includes('curriculum') || loose.includes('resume') || loose.includes('résumé')) {
    return {
      text:
        `**CV** : identité, titre visé, expérience, formation, compétences, langues — je peux partir d'un modèle moderne de la bibliothèque ou générer une ossature si aucun titre ne colle.`,
      suggestions: docChip(),
      intent: { project_type: 'document', document_type: 'cv', tone: 'modern_professional' },
      strategy: 'nearest_template',
      payload: {},
    };
  }

  if (/\b(creer|créer|generer|générer|rediger|rédiger)\b/.test(loose) && /\b(document|lettre|papier|courrier|texte)\b/.test(loose)) {
    return {
      text:
        `Ton intention est claire. En l'absence d'un libellé exact dans le catalogue, je propose une **lettre ou note professionnelle** comme socle, puis on affine titre, ton et blocs sur le canvas.`,
      suggestions: docChip(),
      intent: { project_type: 'document', document_type: 'letter', tone: 'professional' },
      strategy: 'generative_default',
      payload: {},
    };
  }

  const canvas = canvasToolFallback(q, { selObj, selCount, objCount, getLabel });
  if (canvas) {
    return { text: canvas, suggestions: [], strategy: 'local_coach' };
  }

  if (selObj) {
    const typeName = getLabel(selObj.type);
    return {
      text: `J'analyse un ${typeName} sélectionné — propriétés à gauche. Pour documents ou JSON de scène, utilise le mode **Architect** puis reformule ta demande.`,
      suggestions: [
        { label: 'Passer en mode Architect', action: 'use_architect_mode', payload: {} },
      ],
      strategy: 'context_selection',
    };
  }

  if (objCount === 0) {
    return {
      text: 'Scène vide — commence par un outil (Texte, Formes, Image) ou décris un **document** à créer pour lancer l\'architecte.',
      suggestions: [
        { label: 'Démarrer un document guidé', action: 'start_guided_flow', payload: { seedText: msg } },
      ],
      strategy: 'empty_scene',
    };
  }

  return {
    text: `Scène : ${objCount} élément${objCount > 1 ? 's' : ''}. Précise une action sur le canvas ou un **type de document** (lettre, CV, attestation…).`,
    suggestions: [
      { label: 'Mode Architect', action: 'use_architect_mode', payload: {} },
      { label: 'Flux documentaire', action: 'start_guided_flow', payload: { seedText: msg } },
    ],
    strategy: 'generic_prompt',
  };
}

/**
 * @param {string} q — normalized query
 * @param {{ selObj: { type: string } | null, selCount: number, objCount: number, getLabel: (t: string) => string }} ctx
 * @returns {string | null}
 */
function canvasToolFallback(q, ctx) {
  const { selObj, selCount, objCount, getLabel } = ctx;
  if (q.includes('plume') || q.includes('pen tool') || q.includes('bezier') || q.includes('tracé')) {
    return 'Outil Plume (P) dans le panneau Formes & Vecteur — cliquez sur le canvas pour poser des ancres Bézier. Shift pour contraindre, Alt pour convertir un point.';
  }
  if (q.includes('crayon') || q.includes('dessin libre') || q.includes('freehand')) {
    return 'Outil Crayon (N) dans le panneau Formes — maintenez le clic et tracez librement sur le canvas.';
  }
  if (q.includes('direct') || q.includes('noeuds') || q.includes('ancre') || q.includes('point de controle')) {
    return selObj
      ? `Activez « Sélection directe » (A) pour éditer les nœuds de ce ${getLabel(selObj.type)}.`
      : 'Sélectionnez une forme puis « Sélection directe » (A) pour les ancres.';
  }
  if (q.includes('unir') || q.includes('fusionner') || q.includes('unite')) {
    return selCount >= 2
      ? `${selCount} formes sélectionnées — « Unir ⊕ » dans le panneau Formes.`
      : 'Sélectionnez 2 formes pour l\'union booléenne.';
  }
  if (q.includes('soustraire') || q.includes('subtract') || q.includes('retrancher')) {
    return selCount >= 2
      ? `${selCount} formes — « Soustraire ⊖ » dans Formes.`
      : 'Sélectionnez 2 formes pour la soustraction.';
  }
  if (q.includes('intersecter') || q.includes('intersect') || q.includes('zone commune')) {
    return selCount >= 2
      ? 'Formes sélectionnées — « Intersecter ⊗ » pour la zone commune.'
      : 'Sélectionnez 2 formes superposées pour l\'intersection.';
  }
  if (q.includes('grouper') || q.includes('group') || q.includes('ctrl g')) {
    return selCount >= 2
      ? `${selCount} éléments — panneau Formes ou AI Hub → Suggestion → Grouper.`
      : 'Sélectionnez au moins 2 éléments pour grouper.';
  }
  if (q.includes('degrouper') || q.includes('ungroup') || q.includes('dissocier')) {
    return selCount >= 1
      ? '« Dégrouper » dans le panneau Formes.'
      : 'Sélectionnez un groupe.';
  }
  if (q.includes('subdiviser') || q.includes('couper en 4') || q.includes('diviser la forme')) {
    return selCount >= 1
      ? '« Subdiviser » dans Formes — découpage en 4 quartiers.'
      : 'Sélectionnez une forme.';
  }
  if (q.includes('masque') || q.includes('clip') || q.includes('decoupage')) {
    return 'Masque : 2 formes (la supérieure masque), puis « Masque découp. » dans Formes.';
  }
  if (q.includes('hexagone') || q.includes('pentagone') || q.includes('polygone')) {
    return 'Formes de base — pentagone / hexagone dans le panneau Vecteur.';
  }
  if (q.includes('couleur') || q.includes('remplissage') || q.includes('color')) {
    return selObj
      ? `Couleur : panneau gauche (swatch) pour ce ${getLabel(selObj.type)}.`
      : 'Sélectionnez un élément pour la couleur.';
  }
  if (q.includes('texte') || q.includes('titre') || q.includes('ecrire') || q.includes('mot')) {
    return 'Texte (T) — clic sur le canvas pour un bloc.';
  }
  if (q.includes('forme') || q.includes('rectangle') || q.includes('cercle') || q.includes('triangle')) {
    return 'Formes & Vecteur (□) — formes, tracés et booléens.';
  }
  if (q.includes('aligner') || q.includes('centrer') || q.includes('alignement')) {
    return selObj
      ? 'Alignements : panneau propriétés ou AI Hub → Centrer.'
      : 'Sélectionnez des éléments pour aligner.';
  }
  if (q.includes('supprimer') || q.includes('effacer') || q.includes('delete')) {
    return selObj ? 'Suppr ou Backspace pour retirer la sélection.' : 'Sélectionnez puis Suppr.';
  }
  if (q.includes('annuler') || q.includes('undo') || q.includes('ctrl z')) {
    return 'Ctrl+Z / Cmd+Z annuler ; Ctrl+Shift+Z rétablir.';
  }
  if (q.includes('fond') || q.includes('background') || q.includes('arriere plan')) {
    return 'Panneau Fond : couleur, dégradé ou image.';
  }
  if (q.includes('image') || q.includes('photo') || q.includes('importer') || q.includes('import')) {
    return 'Image dans la barre d\'outils ou glisser-déposer sur le canvas.';
  }
  if (q.includes('document') || q.includes('word') || q.includes('paragraphe') || q.includes('mise en page')) {
    return 'Mode Document + onglet Architect ; ou lance le flux documentaire avec les boutons ci-dessous.';
  }
  if (q.includes('présentation') || q.includes('presentation') || q.includes('diapositive') || q.includes('slide')) {
    return 'Mode Présentation : titres, médias, transitions dans la barre gauche.';
  }
  if (q.includes('affiche') || q.includes('poster') || q.includes('impression') || q.includes('a4') || q.includes('a3')) {
    return 'Mode Affiche — format prêt impression ; outils design disponibles.';
  }
  if (q.includes('nouveau projet') || q.includes('nouveau document') || q.includes('changer de type')) {
    return '« + Nouveau » : SmartBoard, Présentation, Document, Affiche, Vidéo.';
  }
  if (q.includes('opacity') || q.includes('opacite') || q.includes('transparent')) {
    return selObj ? 'Opacité en bas du panneau propriétés.' : 'Sélectionnez un élément.';
  }
  if (q.includes('dupliquer') || q.includes('copier') || q.includes('clone')) {
    return selObj ? 'Ctrl+D duplique avec léger décalage.' : 'Sélectionnez un élément.';
  }
  return null;
}
