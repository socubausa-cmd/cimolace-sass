/**
 * Construction de nœuds TipTap (JSON) à partir des ids de `blockLibrary`.
 * @typedef {Record<string, string>} BlockVars
 */

const p = (text) => ({
  type: 'paragraph',
  content: text ? [{ type: 'text', text }] : [],
});

const pb = (parts) => ({
  type: 'paragraph',
  content: parts,
});

/** @param {string} s @param {BlockVars} vars */
export function replaceBlockVars(s, vars) {
  let out = String(s ?? '');
  const v = vars && typeof vars === 'object' ? vars : {};
  out = out.replace(/\{\{subject\}\}/g, v.subject ?? '…');
  out = out.replace(/\{\{recipient\}\}/g, v.recipient ?? 'Nom / Service');
  out = out.replace(
    /\{\{sender_block\}\}/g,
    v.sender_block ?? 'Organisation — Service\nAdresse — Courriel — Téléphone',
  );
  out = out.replace(/\{\{title\}\}/g, v.title ?? 'Titre du document');
  out = out.replace(/\{\{party_a\}\}/g, v.party_a ?? 'Partie A');
  out = out.replace(/\{\{party_b\}\}/g, v.party_b ?? 'Partie B');
  out = out.replace(/\{\{n\}\}/g, v.n ?? '1');
  out = out.replace(
    /\{\{content\}\}/g,
    v.content ??
      'Développez ici le fond de votre demande : contexte, arguments et suites envisagées.',
  );
  return out;
}

/**
 * @param {string} blockId
 * @param {BlockVars} [vars]
 * @returns {import('@tiptap/core').JSONContent[]}
 */
export function buildBlockNodes(blockId, vars = {}) {
  const v = { ...vars };
  switch (blockId) {
    case 'blk_header_standard': {
      const raw = v.sender_block
        ? String(v.sender_block)
        : replaceBlockVars('{{sender_block}}', v);
      const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);
      return lines.length ? lines.map((line) => p(line)) : [p('[Organisation — Service]')];
    }
    case 'blk_recipient':
      return [
        pb([
          { type: 'text', text: 'À l’attention de : ' },
          { type: 'text', marks: [{ type: 'bold' }], text: replaceBlockVars('{{recipient}}', v) },
        ]),
        p(''),
      ];
    case 'blk_subject':
      return [
        pb([
          { type: 'text', marks: [{ type: 'bold' }], text: 'Objet : ' },
          { type: 'text', text: replaceBlockVars('{{subject}}', v) },
        ]),
        p(''),
      ];
    case 'blk_paragraph':
      return [p(v.content != null && String(v.content).trim() ? String(v.content) : replaceBlockVars('Votre texte ici…', v))];
    case 'blk_body':
      return [
        p('Madame, Monsieur,'),
        p(''),
        p(replaceBlockVars('{{content}}', v)),
        p(''),
      ];
    case 'blk_closing':
      return [p(replaceBlockVars(
        'Nous vous prions d’agréer, Madame, Monsieur, l’expression de nos salutations distinguées.',
        v,
      ))];
    case 'blk_title':
      return [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: replaceBlockVars('{{title}}', v) }],
        },
        p(''),
      ];
    case 'blk_contract_title':
      return [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: replaceBlockVars('CONTRAT — {{title}}', v) }],
        },
        p(''),
      ];
    case 'blk_parties':
      return [
        p(`Entre les soussignés : ${replaceBlockVars('{{party_a}}', v)}, d’une part, et ${replaceBlockVars('{{party_b}}', v)}, d’autre part,`),
        p(''),
        p('Il a été convenu ce qui suit :'),
        p(''),
      ];
    case 'blk_article': {
      const n = v.n || '1';
      return [
        {
          type: 'heading',
          attrs: { level: 3 },
          content: [{ type: 'text', text: `Article ${n} — …` }],
        },
        p('…'),
        p(''),
      ];
    }
    case 'blk_signature':
      return [
        { type: 'horizontalRule' },
        {
          type: 'paragraph',
          content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Signatures' }],
        },
        p('Fait à _______________, le __ / __ / ______'),
        p(v.signature || 'Nom, prénom — Fonction'),
        p(''),
        p('___________________________'),
        p('(signature)'),
      ];
    default:
      return [p('')];
  }
}

/**
 * @param {string[]} blockIds
 * @param {BlockVars} [vars]
 * @returns {import('@tiptap/core').JSONContent}
 */
export function buildDocFromBlocks(blockIds, vars = {}) {
  const content = [];
  let articleIndex = 1;
  for (const id of blockIds) {
    const v = { ...vars };
    if (id === 'blk_article') {
      v.n = String(articleIndex);
      articleIndex += 1;
    }
    content.push(...buildBlockNodes(id, v));
  }
  return { type: 'doc', content: content.length ? content : [p('')] };
}
