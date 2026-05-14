/** @typedef {{ id: string, bodyJson: import('@tiptap/core').JSONContent, bodyHtml: string }} AdminDocPage */

const STORAGE_KEY = 'isna_admin_document_studio_v1';

/**
 * @typedef {{
 *   fontFamily: string,
 *   fontSize: number,
 *   lineHeight: number,
 * }} AdminDocumentStyle
 */

/**
 * @typedef {{
 *   version: 1,
 *   pages: AdminDocPage[],
 *   header: string,
 *   footer: string,
 *   title: string,
 *   documentStyle?: AdminDocumentStyle,
 *   savedAt?: number,
 * }} AdminDocumentState
 */

export const DEFAULT_HEADER = 'ORGANISATION — Service ou direction\nAdresse · Téléphone · Courriel';

export const DEFAULT_FOOTER = 'Document interne · Page {page} / {total} · Confidentiel';

/** Styles du corps de page (aperçu + export PDF) */
export const DEFAULT_DOCUMENT_STYLE = {
  fontFamily: 'Georgia, serif',
  fontSize: 13,
  lineHeight: 1.45,
};

/** @returns {import('@tiptap/core').JSONContent} */
export function emptyDocJson() {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [] }],
  };
}

export function newPage() {
  return {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `p_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    bodyJson: emptyDocJson(),
    bodyHtml: '<p></p>',
  };
}

/** @param {AdminDocumentState | Record<string, unknown>} raw */
export function normalizeDocumentState(raw) {
  if (!raw || raw.version !== 1 || !Array.isArray(raw.pages) || raw.pages.length === 0) return null;
  return {
    version: 1,
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title : 'Sans titre',
    header: typeof raw.header === 'string' ? raw.header : DEFAULT_HEADER,
    footer: typeof raw.footer === 'string' ? raw.footer : DEFAULT_FOOTER,
    pages: raw.pages.map((p, idx) => ({
      id: typeof p.id === 'string' && p.id ? p.id : `p_${idx}_${Math.random().toString(36).slice(2, 11)}`,
      bodyJson: p.bodyJson && typeof p.bodyJson === 'object' ? p.bodyJson : emptyDocJson(),
      bodyHtml: typeof p.bodyHtml === 'string' ? p.bodyHtml : '<p></p>',
    })),
    savedAt: typeof raw.savedAt === 'number' ? raw.savedAt : Date.now(),
    documentStyle: normalizeDocumentStyle(raw.documentStyle),
  };
}

/** @param {unknown} raw */
function normalizeDocumentStyle(raw) {
  const d = raw && typeof raw === 'object' ? raw : {};
  const fontFamily =
    typeof d.fontFamily === 'string' && d.fontFamily.trim() ? d.fontFamily.trim() : DEFAULT_DOCUMENT_STYLE.fontFamily;
  let fontSize = typeof d.fontSize === 'number' ? d.fontSize : DEFAULT_DOCUMENT_STYLE.fontSize;
  if (fontSize < 8) fontSize = 8;
  if (fontSize > 28) fontSize = 28;
  let lineHeight = typeof d.lineHeight === 'number' ? d.lineHeight : DEFAULT_DOCUMENT_STYLE.lineHeight;
  if (lineHeight < 1) lineHeight = 1;
  if (lineHeight > 2.5) lineHeight = 2.5;
  return { fontFamily, fontSize, lineHeight };
}

/** @returns {AdminDocumentState} */
export function defaultDocumentState() {
  return {
    version: 1,
    title: 'Sans titre',
    header: DEFAULT_HEADER,
    footer: DEFAULT_FOOTER,
    documentStyle: { ...DEFAULT_DOCUMENT_STYLE },
    savedAt: Date.now(),
    pages: [
      {
        ...newPage(),
        bodyJson: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'Objet : ',
                },
                {
                  type: 'text',
                  marks: [{ type: 'bold' }],
                  text: 'Titre du dossier',
                },
              ],
            },
            { type: 'paragraph', content: [] },
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'Corps du document : développez ici le texte administratif. Ajoutez des pages avec le bouton « Nouvelle page ». L’en-tête et le pied s’appliquent à toutes les pages à l’export PDF.',
                },
              ],
            },
          ],
        },
        bodyHtml: '',
      },
    ],
  };
}

export function loadAdminDocument() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return normalizeDocumentState(data);
  } catch {
    return null;
  }
}

/** @param {AdminDocumentState} state */
export function saveAdminDocument(state) {
  try {
    const withTime = { ...state, savedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(withTime));
  } catch {
    /* quota */
  }
}

export function formatFooterTemplate(template, pageIndex1, total) {
  const t = String(template ?? '');
  return t.replace(/\{page\}/g, String(pageIndex1)).replace(/\{total\}/g, String(total));
}
