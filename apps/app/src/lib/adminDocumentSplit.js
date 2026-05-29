/**
 * Déplace tous les blocs **après** le bloc courant vers une nouvelle page (saut de page manuel).
 * @param {import('@tiptap/core').Editor} editor
 * @returns {{ headDoc: object, headHtml: string, tailDoc: object, tailHtml: string } | null}
 */
export function splitTrailingBlocksToNewPage(editor) {
  if (!editor) return null;
  const json = editor.getJSON();
  if (!json.content?.length) return null;

  const { state } = editor;
  const $from = state.selection.$from;
  const blockIndex = $from.index(0);
  const tail = json.content.slice(blockIndex + 1);
  if (tail.length === 0) return null;

  const head = json.content.slice(0, blockIndex + 1);
  const headDoc = { type: 'doc', content: head };
  const tailDoc = { type: 'doc', content: tail };

  editor.commands.setContent(headDoc);
  const headHtml = editor.getHTML();
  editor.commands.setContent(tailDoc);
  const tailHtml = editor.getHTML();

  return { headDoc, headHtml, tailDoc, tailHtml };
}
