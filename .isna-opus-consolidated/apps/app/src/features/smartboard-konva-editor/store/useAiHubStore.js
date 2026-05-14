import { create } from 'zustand';

/**
 * Historique des actions exécutées depuis l’AI Hub (suggestions / onglet Action).
 * @typedef {{ id: string; ts: number; kind: 'apply'|'explain'; actionId: string; label: string; detail?: string }} AiHubHistoryEntry
 */
export const useAiHubStore = create((set) => ({
  /** Mode barre LONGIA : `architect` route vers LLM lourd + JSON ; les autres → coach rapide (Groq 8B / mini). */
  studioQuickMode: /** @type {string} */ ('analyse'),
  setStudioQuickMode: (id) => set({ studioQuickMode: id || 'analyse' }),

  /** @type {AiHubHistoryEntry[]} */
  actionHistory: [],

  /** @param {Omit<AiHubHistoryEntry, 'id' | 'ts'>} entry */
  pushActionHistory: (entry) =>
    set((s) => ({
      actionHistory: [
        {
          id: `ah_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          ts: Date.now(),
          ...entry,
        },
        ...s.actionHistory,
      ].slice(0, 80),
    })),

  clearActionHistory: () => set({ actionHistory: [] }),

  /**
   * Onglet à activer au prochain cycle (rail droit, languette, dock compact).
   * @type {string | null}
   */
  pendingHubTab: null,
  /** @param {string} tabId — ex. `suggest`, `action`, `architect` */
  requestAiHubTab: (tabId) => set({ pendingHubTab: tabId || 'suggest' }),

  /** Barre du bas : envoi en cours (badge hub « Analyse la scène »). */
  longiaChatSending: false,
  setLongiaChatSending: (v) => set({ longiaChatSending: Boolean(v) }),

  /** Dernier routage renvoyé par studio-longia-chat (coach vs architect). */
  lastLongiaRouting: /** @type {Record<string, unknown> | null} */ (null),
  setLastLongiaRouting: (r) =>
    set({ lastLongiaRouting: r && typeof r === 'object' ? r : null }),
}));
