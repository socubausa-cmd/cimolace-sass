import { create } from 'zustand';

/**
 * État UI du shell Studio SmartBoard (persisté dans le payload workspace `designerStudio`).
 * @typedef {'design'|'live'|'video'|'cinema'} DesignerModeId
 */

const DEFAULT_OUTPUTS = ['screen'];

export const useDesignerShellStore = create((set, get) => ({
  docType: /** @type {string | null} */ (null),
  outputFormats: /** @type {string[]} */ ([...DEFAULT_OUTPUTS]),
  designerMode: /** @type {DesignerModeId} */ ('design'),

  /** Fiche cloud liée (hors JSON payload — id ligne Supabase). */
  cloudWorkspaceId: /** @type {string | null} */ (null),
  cloudWorkspaceTitle: '',

  setDocType: (t) => set({ docType: t ?? null }),
  setOutputFormats: (o) =>
    set({ outputFormats: Array.isArray(o) && o.length ? [...o] : [...DEFAULT_OUTPUTS] }),
  setDesignerMode: (m) =>
    set({
      designerMode: ['design', 'live', 'video', 'cinema'].includes(m) ? m : 'design',
    }),

  setCloudMeta: ({ id, title }) =>
    set({
      cloudWorkspaceId: id ?? null,
      cloudWorkspaceTitle: title != null ? String(title) : get().cloudWorkspaceTitle,
    }),

  setCloudTitleDraft: (title) => set({ cloudWorkspaceTitle: String(title ?? '') }),

  /** Nouveau document : réinitialise type + sorties + lien cloud optionnel. */
  resetForNewDocument: () =>
    set({
      docType: null,
      outputFormats: [...DEFAULT_OUTPUTS],
      cloudWorkspaceId: null,
      cloudWorkspaceTitle: '',
    }),

  /** @param {import('../lib/courseWorkspaceBundle').DesignerStudioPayload | null | undefined} ds */
  hydrateFromPayload: (ds) => {
    if (!ds || typeof ds !== 'object') return;
    const next = {
      docType: ds.docType ?? null,
      outputFormats: Array.isArray(ds.outputFormats) && ds.outputFormats.length
        ? [...ds.outputFormats]
        : [...DEFAULT_OUTPUTS],
      designerMode: ['design', 'live', 'video', 'cinema'].includes(ds.designerMode)
        ? ds.designerMode
        : 'design',
    };
    set(next);
  },
}));
