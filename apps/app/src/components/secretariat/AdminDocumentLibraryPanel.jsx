import React, { useCallback, useState } from 'react';
import { Library, Puzzle, Quote, Bot } from 'lucide-react';
import { templateLibrary, blockLibrary, textLibrary, quickActions } from '@/data/adminDocumentLibrary';
import { composeDocumentFromLibraryTemplate, insertBlockIntoEditor } from '@/lib/adminDocumentTemplateEngine';

/**
 * @param {{
 *   editor: import('@tiptap/core').Editor | null,
 *   onApplyTemplate: (state: import('@/lib/adminDocumentStorage').AdminDocumentState) => void,
 *   onOpenAssistant: () => void,
 * }} props
 */
export default function AdminDocumentLibraryPanel({ editor, onApplyTemplate, onOpenAssistant }) {
  const [tplBusy, setTplBusy] = useState(null);

  const applyLibraryTemplate = useCallback(
    (templateId) => {
      if (!window.confirm('Remplacer tout le document par ce modèle de bibliothèque ?')) return;
      setTplBusy(templateId);
      try {
        const state = composeDocumentFromLibraryTemplate(templateId);
        if (state) onApplyTemplate(state);
      } finally {
        setTplBusy(null);
      }
    },
    [onApplyTemplate],
  );

  const insertBlock = useCallback(
    (blockId) => {
      if (!editor) return;
      insertBlockIntoEditor(editor, blockId, {});
    },
    [editor],
  );

  const insertTextLine = useCallback(
    (text) => {
      if (!editor) return;
      editor.chain().focus().insertContent({ type: 'paragraph', content: [{ type: 'text', text }] }).run();
    },
    [editor],
  );

  const runQuickAction = useCallback(
    (id) => {
      if (!editor) return;
      switch (id) {
        case 'add_paragraph':
          editor.chain().focus().insertContent({ type: 'paragraph', content: [] }).run();
          break;
        case 'add_signature':
          editor
            .chain()
            .focus()
            .insertContent([
              { type: 'horizontalRule' },
              {
                type: 'paragraph',
                content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Signatures' }],
              },
              { type: 'paragraph', content: [{ type: 'text', text: 'Nom — Date — _______________' }] },
            ])
            .run();
          break;
        case 'add_header':
          insertBlockIntoEditor(editor, 'blk_header_standard', {});
          break;
        case 'add_subject':
          insertBlockIntoEditor(editor, 'blk_subject', { subject: '…' });
          break;
        case 'add_clause':
          insertTextLine(textLibrary.clauses[0] || 'Clause : …');
          break;
        default:
          break;
      }
    },
    [editor, insertTextLine],
  );

  return (
    <div className="rounded-xl border border-cyan-200 bg-cyan-50/60 p-3">
      <div className="mb-2 flex items-center gap-2">
        <Library className="h-4 w-4 text-cyan-600" />
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-700">Bibliothèque système</p>
          <p className="text-[9px] text-[var(--lt-muted)]">Templates · blocs · textes · actions</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenAssistant}
        className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg border border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_12%,transparent)] py-2 text-[10px] font-semibold text-[var(--lt-gold-ink)] hover:bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)]"
      >
        <Bot className="h-3.5 w-3.5" />
        Assistant (structure en 5 étapes)
      </button>

      <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-[var(--lt-muted)]">Templates</p>
      <div className="mb-3 flex flex-col gap-1">
        {templateLibrary.map((t) => (
          <button
            key={t.id}
            type="button"
            disabled={!!tplBusy}
            onClick={() => applyLibraryTemplate(t.id)}
            className="rounded-lg border border-[var(--lt-border)] bg-[var(--lt-card-bg)] px-2 py-1.5 text-left text-[10px] text-[var(--lt-text)] hover:border-cyan-400 disabled:opacity-50"
          >
            <span className="font-medium text-cyan-700">{t.name}</span>
            <span className="ml-2 text-[9px] text-[#A1A1AA]">{t.type}</span>
          </button>
        ))}
      </div>

      <p className="mb-1 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-[var(--lt-muted)]">
        <Puzzle className="h-3 w-3" /> Blocs
      </p>
      <div className="mb-3 flex flex-wrap gap-1">
        {blockLibrary.map((b) => (
          <button
            key={b.id}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertBlock(b.id)}
            title={b.default_content || b.type}
            className="rounded border border-[var(--lt-border)] bg-[var(--lt-card-bg)] px-1.5 py-0.5 text-[9px] text-[var(--lt-sub)] hover:border-cyan-400"
          >
            {b.label}
          </button>
        ))}
      </div>

      <p className="mb-1 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-[var(--lt-muted)]">
        <Quote className="h-3 w-3" /> Textes types
      </p>
      <div className="mb-3 max-h-28 space-y-1 overflow-y-auto pr-1 [scrollbar-width:thin]">
        <p className="text-[8px] uppercase text-[#A1A1AA]">Phrases</p>
        {textLibrary.paragraphs.map((line, i) => (
          <button
            key={`p-${i}`}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertTextLine(line)}
            className="block w-full rounded border border-transparent px-1 py-0.5 text-left text-[9px] leading-snug text-[var(--lt-sub)] hover:border-[var(--lt-border)] hover:bg-[var(--lt-card-bg)]"
          >
            {line}
          </button>
        ))}
        <p className="mt-1 text-[8px] uppercase text-[#A1A1AA]">Clauses</p>
        {textLibrary.clauses.map((line, i) => (
          <button
            key={`c-${i}`}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertTextLine(line)}
            className="block w-full rounded border border-transparent px-1 py-0.5 text-left text-[9px] leading-snug text-[var(--lt-sub)] hover:border-[var(--lt-border)] hover:bg-[var(--lt-card-bg)]"
          >
            {line}
          </button>
        ))}
      </div>

      <p className="mb-1 text-[9px] font-semibold uppercase tracking-wider text-[var(--lt-muted)]">Actions rapides (clés)</p>
      <div className="flex flex-wrap gap-1">
        {quickActions.map((q) => (
          <button
            key={q.id}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runQuickAction(q.id)}
            className="rounded border border-[var(--lt-border)] bg-[var(--lt-card-bg)] px-2 py-0.5 text-[9px] text-[var(--lt-sub)] hover:bg-[var(--lt-inner-bg)]"
          >
            {q.label}
          </button>
        ))}
      </div>
    </div>
  );
}
