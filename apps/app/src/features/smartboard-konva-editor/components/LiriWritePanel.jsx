import React, { useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { cn } from '@/lib/utils';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import {
  Bold, Italic, UnderlineIcon, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Heading2, Undo2, Redo2, Trash2,
} from 'lucide-react';

const LIRI_WRITE_LOCAL_KEY = 'liri_write_notes';

function ToolBtn({ active, onClick, title, children }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={cn(
        'flex h-6 w-6 items-center justify-center rounded-md text-[10px] transition-colors',
        active
          ? 'bg-[#D4AF37]/20 text-[#f5dd8a]'
          : 'text-white/45 hover:bg-white/[0.07] hover:text-white/80',
      )}
    >
      {children}
    </button>
  );
}

export default function LiriWritePanel({ className }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Notes du professeur — idees, scripts, consignes...' }),
    ],
    content: (() => {
      try { return localStorage.getItem(LIRI_WRITE_LOCAL_KEY) || ''; } catch { return ''; }
    })(),
    editorProps: {
      attributes: {
        class: 'outline-none min-h-[200px] text-[12px] leading-relaxed text-white/85 [&_h2]:text-[14px] [&_h2]:font-bold [&_h2]:text-[#f5dd8a] [&_h2]:mb-1 [&_h3]:text-[12px] [&_h3]:font-semibold [&_h3]:text-white/80 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:mb-0.5 [&_p]:mb-1',
      },
    },
    onUpdate({ editor: e }) {
      try { localStorage.setItem(LIRI_WRITE_LOCAL_KEY, e.getHTML()); } catch { /**/ }
    },
  });

  const clearAll = useCallback(() => {
    if (!editor) return;
    editor.commands.clearContent(true);
    try { localStorage.removeItem(LIRI_WRITE_LOCAL_KEY); } catch { /**/ }
  }, [editor]);

  if (!editor) return null;

  return (
    <div className={cn('flex min-h-0 flex-col overflow-hidden', className)}>
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/[0.07] bg-[#0a0c14] px-2.5 py-1.5">
        <span className="inline-flex items-end gap-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-[#D4AF37]/70">
          <LiriWordmark size="footer" className="text-[#D4AF37]/70" subtleGlow />
          <span>WRITE</span>
        </span>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); clearAll(); }}
          className="flex h-5 w-5 items-center justify-center rounded-md text-white/30 hover:bg-red-950/40 hover:text-red-400"
          title="Effacer tout"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-0.5 border-b border-white/[0.06] bg-[#0b0d16] px-2 py-1">
        <ToolBtn active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Titre">
          <Heading2 className="h-3 w-3" />
        </ToolBtn>
        <ToolBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Gras">
          <Bold className="h-3 w-3" />
        </ToolBtn>
        <ToolBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italique">
          <Italic className="h-3 w-3" />
        </ToolBtn>
        <ToolBtn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Souligne">
          <UnderlineIcon className="h-3 w-3" />
        </ToolBtn>
        <div className="mx-1 h-4 w-px bg-white/10" />
        <ToolBtn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Liste">
          <List className="h-3 w-3" />
        </ToolBtn>
        <ToolBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Liste numerotee">
          <ListOrdered className="h-3 w-3" />
        </ToolBtn>
        <div className="mx-1 h-4 w-px bg-white/10" />
        <ToolBtn active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Gauche">
          <AlignLeft className="h-3 w-3" />
        </ToolBtn>
        <ToolBtn active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Centre">
          <AlignCenter className="h-3 w-3" />
        </ToolBtn>
        <ToolBtn active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="Droite">
          <AlignRight className="h-3 w-3" />
        </ToolBtn>
        <ToolBtn active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()} title="Justifier">
          <AlignJustify className="h-3 w-3" />
        </ToolBtn>
        <div className="mx-1 h-4 w-px bg-white/10" />
        <ToolBtn active={false} onClick={() => editor.chain().focus().undo().run()} title="Annuler">
          <Undo2 className="h-3 w-3" />
        </ToolBtn>
        <ToolBtn active={false} onClick={() => editor.chain().focus().redo().run()} title="Retablir">
          <Redo2 className="h-3 w-3" />
        </ToolBtn>
      </div>

      {/* Editor */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3 [scrollbar-width:thin]">
        <EditorContent editor={editor} />
      </div>

      {/* Footer hint */}
      <div className="shrink-0 border-t border-white/[0.05] px-2.5 py-1">
        <p className="text-[8px] text-white/22">Sauvegarde automatique en local</p>
      </div>
    </div>
  );
}
