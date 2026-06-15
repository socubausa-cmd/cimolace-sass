import React, { useCallback, useState } from 'react';
import { Sparkles, Loader2, Wand2, Type, Heading2, Heading3, AlignLeft, Layers, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/customSupabaseClient';
import { getSupabaseFunctionErrorMessage } from '@/lib/supabaseEdgeInvoke';

function getSelectionPlainText(editor) {
  if (!editor) return '';
  const { from, to, empty } = editor.state.selection;
  if (empty) return '';
  return editor.state.doc.textBetween(from, to, '\n');
}

/**
 * LONGIA — structure, composer, texte animé, texte intelligent, 5 propositions IA.
 * @param {{ editor: import('@tiptap/core').Editor | null, documentTitle: string }} props
 */
export default function LongiaAdminDocumentPanel({ editor, documentTitle }) {
  const [topicHint, setTopicHint] = useState('');
  const [busy, setBusy] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [lastError, setLastError] = useState('');

  const insertParagraphJson = useCallback(
    (content) => {
      if (!editor) return;
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'paragraph',
          content: [{ type: 'text', text: content }],
        })
        .run();
    },
    [editor],
  );

  const insertAnimatedParagraph = useCallback(() => {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'paragraph',
        attrs: { class: 'longia-text-animated' },
        content: [
          {
            type: 'text',
            text: 'Texte mis en valeur — remplacez ce contenu. Un léger relief visuel accompagne ce bloc dans l\'interface.',
          },
        ],
      })
      .run();
  }, [editor]);

  const insertComposerBlock = useCallback(() => {
    insertParagraphJson(
      'En application des dispositions applicables et compte tenu des éléments portés à notre connaissance, nous vous informons que [précisez le fond du dossier en deux à quatre phrases]. La présente décision / communication prend effet sous réserve des formalités d\'usage. Pour toute précision, le service reste à votre disposition.',
    );
  }, [insertParagraphJson]);

  const invokeLongia = useCallback(
    async (mode) => {
      setLastError('');
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        window.alert('Connectez-vous pour utiliser LONGIA.');
        return;
      }
      const selection = getSelectionPlainText(editor);
      setBusy(mode);
      setSuggestions([]);
      try {
        const { data, error } = await supabase.functions.invoke('longia-admin-document', {
          body: {
            mode,
            documentTitle: documentTitle || 'Sans titre',
            topicHint: topicHint.trim(),
            selection,
          },
        });
        if (error) {
          const msg = (await getSupabaseFunctionErrorMessage(error)) || error.message || 'Appel LONGIA impossible';
          setLastError(msg);
          window.alert(msg);
          return;
        }
        if (mode === 'suggestions' && Array.isArray(data?.suggestions)) {
          setSuggestions(data.suggestions.filter(Boolean).slice(0, 5));
        } else if ((mode === 'compose' || mode === 'intelligent') && data?.result) {
          insertParagraphJson(data.result);
        }
      } catch (e) {
        const msg = e?.message || 'Erreur réseau';
        setLastError(msg);
        window.alert(msg);
      } finally {
        setBusy(null);
      }
    },
    [editor, documentTitle, topicHint, insertParagraphJson],
  );

  if (!editor) return null;

  return (
    <div className="rounded-xl border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_6%,white)] p-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-200 to-violet-200">
          <Sparkles className="h-4 w-4 text-[#8A6D1A]" />
        </span>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8A6D1A]">LONGIA</p>
          <p className="text-[9px] leading-snug text-[#71717A]">Rédaction administrative — structure, composer, propositions</p>
        </div>
      </div>

      <label className="mb-1 block text-[9px] font-semibold uppercase tracking-wider text-[#71717A]">Thème ou consigne (optionnel)</label>
      <input
        type="text"
        value={topicHint}
        onChange={(e) => setTopicHint(e.target.value)}
        placeholder="Ex. : convocation CA, demande de bourse, courrier aux familles…"
        className="mb-3 w-full rounded-lg border border-black/[0.08] bg-white px-2.5 py-1.5 text-[11px] text-[#18181B] placeholder:text-[#A1A1AA]"
      />

      <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-[#71717A]">Structure du texte</p>
      <div className="mb-3 flex flex-wrap gap-1">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className="inline-flex items-center gap-1 rounded-lg border border-black/[0.08] bg-white px-2 py-1 text-[10px] text-[#52525B] hover:border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)]"
          title="Titre"
        >
          <Heading2 className="h-3 w-3" /> Titre
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className="inline-flex items-center gap-1 rounded-lg border border-black/[0.08] bg-white px-2 py-1 text-[10px] text-[#52525B] hover:border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)]"
          title="Sous-titre"
        >
          <Heading3 className="h-3 w-3" /> Sous-titre
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().setParagraph().run()}
          className="inline-flex items-center gap-1 rounded-lg border border-black/[0.08] bg-white px-2 py-1 text-[10px] text-[#52525B] hover:border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)]"
          title="Paragraphe"
        >
          <AlignLeft className="h-3 w-3" /> Texte
        </button>
      </div>

      <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-[#71717A]">Composer & mise en forme</p>
      <div className="mb-3 flex flex-wrap gap-1">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={insertComposerBlock}
          className="inline-flex items-center gap-1 rounded-lg border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_12%,transparent)] px-2 py-1 text-[10px] text-[#8A6D1A] hover:bg-[color-mix(in_srgb,var(--school-accent)_18%,transparent)]"
          title="Insère un paragraphe-type administratif (à modifier)"
        >
          <Layers className="h-3 w-3" /> Composer
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={insertAnimatedParagraph}
          className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] text-violet-700 hover:bg-violet-100"
          title="Texte avec relief visuel (animation légère)"
        >
          <Zap className="h-3 w-3" /> Texte animé
        </button>
      </div>

      <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-[#71717A]">Texte intelligent (IA)</p>
      <div className="mb-3 flex flex-col gap-1.5">
        <button
          type="button"
          disabled={busy === 'compose'}
          onClick={() => invokeLongia('compose')}
          className={cn(
            'inline-flex items-center justify-center gap-1.5 rounded-lg border border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_12%,transparent)] py-2 text-[10px] font-medium text-[#8A6D1A] hover:bg-[color-mix(in_srgb,var(--school-accent)_18%,transparent)] disabled:opacity-45',
          )}
        >
          {busy === 'compose' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
          Rédiger un paragraphe avec LONGIA
        </button>
        <button
          type="button"
          disabled={busy === 'intelligent'}
          onClick={() => invokeLongia('intelligent')}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-black/[0.08] bg-white py-2 text-[10px] font-medium text-[#52525B] hover:bg-[#F4F5F7] disabled:opacity-45"
        >
          {busy === 'intelligent' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Type className="h-3.5 w-3.5" />}
          Adapter au sujet (sélection ou thème ci-dessus)
        </button>
      </div>

      <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-[#71717A]">5 propositions LONGIA</p>
      <button
        type="button"
        disabled={busy === 'suggestions'}
        onClick={() => invokeLongia('suggestions')}
        className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 py-2 text-[10px] font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-45"
      >
        {busy === 'suggestions' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        Générer 5 propositions
      </button>

      {suggestions.length > 0 ? (
        <ul className="space-y-1.5 rounded-lg border border-black/[0.08] bg-[#F4F5F7] p-2">
          {suggestions.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertParagraphJson(s)}
                className="w-full rounded-md border border-black/[0.06] bg-white px-2 py-1.5 text-left text-[10px] leading-snug text-[#52525B] hover:border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] hover:text-[#18181B]"
              >
                <span className="mr-1 font-semibold text-[#8A6D1A]">{i + 1}.</span>
                {s}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {lastError ? <p className="mt-2 text-[9px] text-red-600">{lastError}</p> : null}

      <p className="mt-3 text-[8px] leading-relaxed text-[#A1A1AA]">
        Astuce : sélectionnez un passage avant « Adapter au sujet » pour le faire reformuler par LONGIA. Le titre du dossier
        (champ en haut de page) est envoyé comme contexte.
      </p>
    </div>
  );
}
