import { create } from 'zustand';

/**
 * Présence Copilot designer : idée centrale, mode d'activité, résumés pour Architect / Guide IA.
 * Handoff Coach→Architect : file pour le prochain message `streamLongiaHub` (designer_konva_assist).
 */
export const useDesignerCopilotPresenceStore = create((set, get) => ({
  /** Idée directrice que l'utilisateur charge pour orienter le Copilot */
  centralIdea: '',
  setCentralIdea: (t) => set({ centralIdea: String(t || '') }),

  /**
   * idle | typing | voice | canvas_exam | vision | streaming
   */
  presenceMode: /** @type {'idle' | 'typing' | 'voice' | 'canvas_exam' | 'vision' | 'streaming'} */ ('idle'),
  setPresenceMode: (m) => set({ presenceMode: m }),

  /** Ligne courte sous le canvas (ce que fait l'utilisateur) */
  activitySummary: '',
  setActivitySummary: (t) => set({ activitySummary: String(t || '').slice(0, 320) }),

  /** Suggestions issues du dernier message Copilot (onglet Architect) */
  architectCopilotItems: /** @type {{ id: string; title: string; detail: string }[]} */ ([]),
  setArchitectCopilotItems: (items) =>
    set({ architectCopilotItems: Array.isArray(items) ? items : [] }),

  /** Résumé conversationnel pour l'onglet Guide IA */
  guideIaCopilotSummary: '',
  setGuideIaCopilotSummary: (t) => set({ guideIaCopilotSummary: String(t || '') }),

  copilotEngaged: false,
  setCopilotEngaged: (v) => set({ copilotEngaged: !!v }),

  /**
   * JSON handoff (base v1 + extension v2 optionnelle) joint au prochain envoi du chat designer.
   * @type {Record<string, unknown> | null}
   */
  pendingCoachArchitectHandoff: null,
  setPendingCoachArchitectHandoff: (h) =>
    set({
      pendingCoachArchitectHandoff:
        h && typeof h === 'object' && !Array.isArray(h) ? h : null,
    }),
  /** Retire et renvoie le handoff en file (un seul envoi). */
  takePendingCoachArchitectHandoff: () => {
    const h = get().pendingCoachArchitectHandoff;
    set({ pendingCoachArchitectHandoff: null });
    return h;
  },

  /** Met à jour le résumé d'activité canvas (suppression / ajout) */
  noteCanvasObjectDelta: (delta) => {
    if (delta > 0) {
      set({
        presenceMode: 'canvas_exam',
        activitySummary: 'Élément ajouté sur la scène — examen intelligent du canvas actif.',
        copilotEngaged: true,
      });
    } else if (delta < 0) {
      set({
        presenceMode: 'canvas_exam',
        activitySummary: 'Suppression ou retrait détecté — le Copilot suit la scène.',
        copilotEngaged: true,
      });
    }
  },
}));
