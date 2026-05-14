import { useDocumentCoachStore } from '@/features/smartboard-konva-editor/store/useDocumentCoachStore';
import { useAiHubStore } from '@/features/smartboard-konva-editor/store/useAiHubStore';
import { useSmartboardKonvaStore } from '@/features/smartboard-konva-editor/store/useSmartboardKonvaStore';
import {
  getEmbeddedAppContextForLongia,
  hasNativeEmbeddedShell,
  injectNativeCommand,
} from '@/lib/liriEmbeddedControl/nativeShell.js';

const CONVERT_TO_CIRCLE_TYPES = new Set(['rect', 'triangle', 'diamond', 'starshape', 'ellipse']);

function getCircleConversionSelectionSummary() {
  const { selectedIds, project } = useSmartboardKonvaStore.getState();
  const scene = project.scenes.find((s) => s.id === project.activeSceneId);
  if (!scene || !selectedIds.length) return { convertible: 0, types: /** @type {string[]} */ ([]), selected: 0 };
  const picked = selectedIds
    .map((id) => scene.objects.find((o) => o.id === id))
    .filter(Boolean);
  const targets = picked.filter((o) => CONVERT_TO_CIRCLE_TYPES.has(o.type));
  return {
    convertible: targets.length,
    types: [...new Set(targets.map((o) => o.type))],
    selected: picked.length,
  };
}

/**
 * Exécute une suggestion LONGIA (bouton sous message IA).
 * @param {{ label: string, action: string, payload?: Record<string, unknown> }} chip
 * @param {{ id?: string, role?: string, text?: string, payload?: Record<string, unknown> }} msg
 * @param {{
 *   addLongiaMessage: (m: { role: string, text: string, suggestions?: unknown[] }) => void,
 *   pushActionHistory: (e: Record<string, unknown>) => void,
 *   navigate?: (path: string) => void,
 * }} ctx
 */
export async function runLongiaHubChipAction(chip, msg, ctx) {
  const { addLongiaMessage, pushActionHistory, navigate } = ctx;
  const action = chip.action;
  const seed =
    (chip.payload && typeof chip.payload.seedText === 'string' && chip.payload.seedText.trim())
    || (msg.payload && typeof msg.payload.seedText === 'string' && msg.payload.seedText.trim())
    || '';
  const phrase = seed || 'Document professionnel';
  const now = () => Date.now();

  if (action === 'focus_embedded_app') {
    if (typeof navigate === 'function') {
      navigate('/studio/liri/embedded-control');
    }
    addLongiaMessage({
      role: 'ai',
      text: '✦ **Contrôle intégré** : liste les fenêtres, verrouille celle à piloter, puis reviens ici — LONGIA enverra le contexte `app_control` au backend.',
      suggestions: [],
    });
    pushActionHistory({ kind: 'apply', actionId: action, label: chip.label, detail: 'nav embedded-control' });
    return;
  }

  if (action === 'app_create_title') {
    const embed = getEmbeddedAppContextForLongia();
    if (!embed.embeddedControlActive) {
      addLongiaMessage({
        role: 'ai',
        text: '✦ Aucune fenêtre **verrouillée** pour l’instant. Ouvre Contrôle intégré, choisis l’app (ex. Word), puis réessaie ce raccourci.',
        suggestions: [{ label: 'Ouvrir contrôle intégré', action: 'focus_embedded_app' }],
      });
      return;
    }
    if (!hasNativeEmbeddedShell()) {
      addLongiaMessage({
        role: 'ai',
        text: '✦ Raccourci **style Titre** : l’injection clavier nécessite le shell **Electron** (pack LIRI_FULL_SYSTEM). Sur la page Contrôle intégré, tu peux aussi cliquer dans l’aperçu.',
        suggestions: [{ label: 'Contrôle intégré', action: 'focus_embedded_app' }],
      });
      return;
    }
    const res = await injectNativeCommand({
      commandType: 'press_shortcut',
      shortcut: ['cmd', 'alt', '1'],
      timestampMs: now(),
    });
    const ok = res && typeof res === 'object' && res.ok !== false;
    addLongiaMessage({
      role: 'ai',
      text: ok
        ? '✦ Raccourci **⌘⌥1** envoyé vers l’app verrouillée (souvent « Titre 1 » sous Word macOS). Si rien ne change, le raccourci peut différer selon la langue ou l’app.'
        : `✦ Injection refusée : ${typeof res?.reason === 'string' ? res.reason : 'erreur'}. Vérifie Accessibilité macOS et que la source est bien verrouillée.`,
      suggestions: [],
    });
    pushActionHistory({
      kind: 'apply',
      actionId: action,
      label: chip.label,
      detail: ok ? 'press_shortcut cmd+alt+1' : String(res?.reason ?? ''),
    });
    return;
  }

  if (action === 'app_insert_table') {
    const embed = getEmbeddedAppContextForLongia();
    if (!embed.embeddedControlActive) {
      addLongiaMessage({
        role: 'ai',
        text: '✦ Pour insérer un tableau, verrouille d’abord l’app sur **Contrôle intégré**, puis utilise le ruban / menu dans l’app ou clique dans l’aperçu (pas de raccourci universel fiable).',
        suggestions: [{ label: 'Ouvrir contrôle intégré', action: 'focus_embedded_app' }],
      });
      return;
    }
    addLongiaMessage({
      role: 'ai',
      text: '✦ **Tableau** : selon l’app, ouvre Insertion → Tableau ou clique la zone voulue dans l’aperçu **Contrôle intégré** (clic / double-clic mappés en coordonnées écran).',
      suggestions: [],
    });
    pushActionHistory({ kind: 'apply', actionId: action, label: chip.label, detail: 'guidance table' });
    return;
  }

  if (action === 'generate_visual') {
    addLongiaMessage({
      role: 'ai',
      text: '✦ **Visuel** : utilise les outils **Image**, formes ou l’assistant **Wand** sur le canevas, ou précise le format (affiche, story, slide) dans ta prochaine phrase.',
      suggestions: [],
    });
    pushActionHistory({ kind: 'apply', actionId: action, label: chip.label, detail: 'visual hint' });
    return;
  }

  if (action === 'fallback_create_flow') {
    useDocumentCoachStore.getState().activateDocumentMode();
    useDocumentCoachStore.getState().detectIntent(phrase);
    addLongiaMessage({
      role: 'ai',
      text: '✦ **Architecte documentaire** : suivez les questions dans le panneau Coach à gauche.',
      suggestions: [],
    });
    pushActionHistory({ kind: 'apply', actionId: action, label: chip.label, detail: phrase.slice(0, 120) });
    return;
  }

  if (action === 'show_selection_actions') {
    addLongiaMessage({
      role: 'ai',
      text: '✦ Avec une sélection active : barre d’outils (alignement, groupe, couleur) ou demande précise à LONGIA (ex. « aligner à gauche »).',
      suggestions: [],
    });
    return;
  }

  if (action === 'preview_convert_selected_to_circle') {
    const { convertible, types, selected } = getCircleConversionSelectionSummary();
    if (!selected) {
      addLongiaMessage({
        role: 'ai',
        text: '✦ Sélectionne une ou plusieurs formes sur le canevas (rectangle, triangle, losange, étoile, ellipse), puis réessaie.',
        suggestions: [],
      });
      return;
    }
    if (!convertible) {
      addLongiaMessage({
        role: 'ai',
        text: '✦ La sélection ne contient pas de forme convertible en cercle (essaie un rectangle ou une ellipse).',
        suggestions: [],
      });
      return;
    }
    addLongiaMessage({
      role: 'ai',
      text: `✦ **Aperçu** : ${convertible} forme(s) (${types.join(', ')}) passeraient en **cercle** (même cadre).`,
      suggestions: [{ label: 'Transformer en cercle', action: 'convert_selected_to_circle' }],
    });
    pushActionHistory({ kind: 'preview', actionId: action, label: chip.label, detail: `${convertible} obj` });
    return;
  }

  if (action === 'convert_selected_to_circle') {
    const r = useSmartboardKonvaStore.getState().convertSelectedShapesToCircles();
    if (!r.ok) {
      const hint =
        r.reason === 'no_selection'
          ? 'Sélectionne des formes sur le canevas.'
          : r.reason === 'no_convertible'
            ? 'Sélectionne au moins un rectangle, triangle, losange, étoile ou ellipse.'
            : 'Scène introuvable.';
      addLongiaMessage({
        role: 'ai',
        text: `✦ ${hint}`,
        suggestions:
          r.reason === 'no_convertible' || r.reason === 'no_selection'
            ? [{ label: 'Voir aperçu', action: 'preview_convert_selected_to_circle' }]
            : [],
      });
      return;
    }
    addLongiaMessage({
      role: 'ai',
      text: `✦ **${r.count}** forme(s) convertie(s) en cercle. **Ctrl+Z** pour annuler.`,
      suggestions: [],
    });
    pushActionHistory({ kind: 'apply', actionId: action, label: chip.label, detail: `count ${r.count}` });
    return;
  }

  if (action === 'analyze_import') {
    if (typeof navigate === 'function') navigate('/studio/liri/import');
    addLongiaMessage({
      role: 'ai',
      text: '✦ **Import LIRI** : charge un PDF ou un support ; LONGIA pourra proposer une reconstruction.',
      suggestions: [],
    });
    pushActionHistory({ kind: 'apply', actionId: action, label: chip.label, detail: 'nav import' });
    return;
  }

  if (action === 'explain_active_tool') {
    addLongiaMessage({
      role: 'ai',
      text: '✦ L’outil actif est dans la barre à gauche ou le bas : **sélection**, **texte**, **formes**, **stylo**. Choisis une icône puis demande à LONGIA une aide ciblée (ex. « comment grouper »).',
      suggestions: [],
    });
    return;
  }

  if (action === 'guest_simplify_live_topic') {
    addLongiaMessage({
      role: 'ai',
      text: '✦ Ici en studio : prépare une **phrase courte** ou un **schéma** pour tes participants. Sur le **live hôte**, la même puce enregistre aussi une entrée dans le journal.',
      suggestions: [],
    });
    return;
  }

  if (action === 'generate_document' || action === 'start_guided_flow') {
    useDocumentCoachStore.getState().activateDocumentMode();
    useDocumentCoachStore.getState().detectIntent(phrase);
    addLongiaMessage({
      role: 'ai',
      text: '✦ **Architecte documentaire** : suivez les questions dans le panneau Coach à gauche.',
      suggestions: [],
    });
    pushActionHistory({ kind: 'apply', actionId: action, label: chip.label, detail: phrase.slice(0, 120) });
    return;
  }
  if (action === 'use_architect_mode') {
    useAiHubStore.getState().setStudioQuickMode('architect');
    addLongiaMessage({
      role: 'ai',
      text: '✦ Mode **Architect** activé (barre LONGIA) — demandes de structure, JSON ou analyse poussée.',
      suggestions: [],
    });
    pushActionHistory({ kind: 'apply', actionId: 'architect_mode', label: chip.label, detail: 'studio quick mode' });
    return;
  }
  if (action === 'nearest_templates') {
    addLongiaMessage({
      role: 'ai',
      text: '✦ Utilisez le lanceur **Document** ou reformulez (ex. « lettre administrative », « attestation ») pour lister les modèles proches du catalogue.',
      suggestions: [],
    });
  }
}
