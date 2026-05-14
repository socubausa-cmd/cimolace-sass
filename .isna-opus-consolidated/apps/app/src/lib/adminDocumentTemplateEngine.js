import { templateLibrary } from '@/data/adminDocumentLibrary';
import { DEFAULT_FOOTER, DEFAULT_HEADER, DEFAULT_DOCUMENT_STYLE, newPage } from '@/lib/adminDocumentStorage';
import { buildBlockNodes, buildDocFromBlocks } from '@/lib/adminDocumentBlockBuilders';

/**
 * @param {string} templateId
 * @returns {typeof templateLibrary[0] | undefined}
 */
export function getTemplateDefinition(templateId) {
  return templateLibrary.find((t) => t.id === templateId);
}

/**
 * @param {string} templateId
 * @param {Record<string, string>} [vars]
 * @returns {import('@/lib/adminDocumentStorage').AdminDocumentState | null}
 */
export function composeDocumentFromLibraryTemplate(templateId, vars = {}) {
  const tpl = getTemplateDefinition(templateId);
  if (!tpl?.default_blocks?.length) return null;

  const title =
    vars.title?.trim() ||
    vars.subject?.trim() ||
    (tpl.type === 'contract' ? 'Contrat — brouillon' : 'Lettre administrative — brouillon');

  const bodyJson = buildDocFromBlocks(tpl.default_blocks, {
    ...vars,
    title: vars.title || title,
  });

  const pg = newPage();
  pg.bodyJson = bodyJson;
  pg.bodyHtml = '';

  return {
    version: 1,
    title,
    header: vars.header ?? DEFAULT_HEADER,
    footer: vars.footer ?? DEFAULT_FOOTER,
    documentStyle: { ...DEFAULT_DOCUMENT_STYLE },
    pages: [pg],
    savedAt: Date.now(),
  };
}

/**
 * @param {import('@tiptap/core').Editor} editor
 * @param {string} blockId
 * @param {Record<string, string>} [vars]
 */
export function insertBlockIntoEditor(editor, blockId, vars = {}) {
  if (!editor?.chain) return;
  const nodes = buildBlockNodes(blockId, vars);
  if (!nodes.length) return;
  editor.chain().focus().insertContent(nodes).run();
}
