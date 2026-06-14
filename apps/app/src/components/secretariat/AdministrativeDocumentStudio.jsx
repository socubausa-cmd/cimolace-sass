import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import Paragraph from '@tiptap/extension-paragraph';
import { TableKit } from '@tiptap/extension-table/kit';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Heading2,
  Heading3,
  Undo2,
  Redo2,
  Plus,
  Copy,
  Trash2,
  FileDown,
  RotateCcw,
  Split,
  Upload,
  Download,
  Minus,
  PenLine,
  Table2,
  ImageIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import {
  loadAdminDocument,
  saveAdminDocument,
  defaultDocumentState,
  newPage,
  formatFooterTemplate,
  DEFAULT_HEADER,
  DEFAULT_FOOTER,
  DEFAULT_DOCUMENT_STYLE,
  normalizeDocumentState,
} from '@/lib/adminDocumentStorage';
import { exportAdminDocumentPdf } from '@/lib/exportAdminDocumentPdf';
import { splitTrailingBlocksToNewPage } from '@/lib/adminDocumentSplit';
import { fetchAdminDocumentFromCloud, saveAdminDocumentToCloud } from '@/lib/adminDocumentCloud';
import {
  templateCourrier,
  templatePV,
  templateAttestation,
  templateContrat,
  templateCV,
  templateFacture,
  templateLettreOfficielle,
  templateRapport,
  templateFicheEleve,
  templateReglement,
  templateCertificat,
  templateRecu,
} from '@/lib/adminDocumentTemplates';
import LongiaAdminDocumentPanel from '@/components/secretariat/LongiaAdminDocumentPanel';
import AdminDocumentLibraryPanel from '@/components/secretariat/AdminDocumentLibraryPanel';
import AdminDocumentAssistantModal from '@/components/secretariat/AdminDocumentAssistantModal';

/** Paragraphe avec attribut `class` (ex. bloc « texte animé » LONGIA). */
const AdminParagraph = Paragraph.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      class: {
        default: null,
        parseHTML: (element) => element.getAttribute('class'),
        renderHTML: (attributes) => {
          if (!attributes.class) return {};
          return { class: attributes.class };
        },
      },
    };
  },
});

function ToolBtn({ active, onClick, title, children }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-md text-[11px] transition-colors',
        active
          ? 'bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] text-[#f5dd8a]'
          : 'text-white/45 hover:bg-white/[0.07] hover:text-white/80',
      )}
    >
      {children}
    </button>
  );
}

function QuickBtn({ onClick, title, children, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onMouseDown={(e) => {
        e.preventDefault();
        if (!disabled) onClick();
      }}
      title={title}
      className={cn(
        'rounded border border-white/10 bg-[#0d1525]/90 px-2 py-0.5 text-[10px] text-gray-300 hover:bg-white/10 hover:text-white',
        disabled && 'opacity-40 cursor-not-allowed hover:bg-[#0d1525]/90',
      )}
    >
      {children}
    </button>
  );
}

export default function AdministrativeDocumentStudio() {
  const { user } = useAuth();
  const initial = loadAdminDocument() || defaultDocumentState();
  const [title, setTitle] = useState(initial.title);
  const [header, setHeader] = useState(initial.header);
  const [footer, setFooter] = useState(initial.footer);
  const [documentStyle, setDocumentStyle] = useState(() => ({
    ...DEFAULT_DOCUMENT_STYLE,
    ...(initial.documentStyle || {}),
  }));
  const [pages, setPages] = useState(initial.pages);
  const [activePageIndex, setActivePageIndex] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [remoteOffer, setRemoteOffer] = useState(null);
  const [assistantModalOpen, setAssistantModalOpen] = useState(false);
  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  const activePageIndexRef = useRef(activePageIndex);
  activePageIndexRef.current = activePageIndex;
  const imageInputRef = useRef(null);
  /** Force re-render when la sélection change (barre tableau contextuelle). */
  const [, bumpEditorUi] = useReducer((x) => x + 1, 0);

  const saveTimer = useRef(null);
  const persist = useCallback(() => {
    saveAdminDocument({
      version: 1,
      title,
      header,
      footer,
      documentStyle,
      pages: pagesRef.current,
    });
  }, [title, header, footer, documentStyle]);

  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persist(), 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [title, header, footer, documentStyle, pages, persist]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const remote = await fetchAdminDocumentFromCloud();
        if (cancelled || !remote?.document) return;
        const normalized = normalizeDocumentState(remote.document);
        if (!normalized) return;
        const local = loadAdminDocument();
        const remoteTime = new Date(remote.updated_at).getTime();
        const localTime = local?.savedAt ?? 0;
        if (remoteTime > localTime + 500 && local) {
          setRemoteOffer({ doc: normalized, updatedAt: remote.updated_at });
        }
      } catch (e) {
        console.warn('[admin-doc] sync', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, paragraph: false }),
      AdminParagraph,
      TableKit.configure({
        table: { resizable: true },
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
      }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Texte de la page…' }),
    ],
    content: initial.pages[0]?.bodyJson,
    editorProps: {
      attributes: {
        class:
          'outline-none min-h-[240px] text-inherit leading-inherit text-gray-900 [&_h2]:text-[1.12em] [&_h2]:font-bold [&_h2]:text-gray-900 [&_h2]:mb-2 [&_h3]:text-[1.05em] [&_h3]:font-semibold [&_h3]:text-gray-800 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_p]:mb-2 [&_hr]:my-4 [&_hr]:border-gray-300 [&_table]:w-full [&_table]:border-collapse [&_table]:my-3 [&_td]:border [&_th]:border [&_td]:border-gray-300 [&_th]:border-gray-300 [&_td]:align-top [&_th]:align-top [&_td]:px-2 [&_th]:px-2 [&_td]:py-1.5 [&_th]:py-1.5 [&_th]:bg-gray-100 [&_th]:font-semibold [&_.tableWrapper]:max-w-full [&_.tableWrapper]:overflow-x-auto [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-sm [&_img]:my-2 [&_p.longia-text-animated]:border-l-4 [&_p.longia-text-animated]:border-[color-mix(in_srgb,var(--school-accent)_45%,transparent)] [&_p.longia-text-animated]:bg-gradient-to-r [&_p.longia-text-animated]:from-[var(--school-accent)]/[0.07] [&_p.longia-text-animated]:to-transparent [&_p.longia-text-animated]:pl-3 [&_p.longia-text-animated]:py-1 [&_p.longia-text-animated]:animate-pulse',
      },
    },
    onUpdate({ editor: ed }) {
      const json = ed.getJSON();
      const html = ed.getHTML();
      const i = activePageIndexRef.current;
      setPages((prev) => {
        const next = [...prev];
        if (!next[i]) return prev;
        next[i] = { ...next[i], bodyJson: json, bodyHtml: html };
        return next;
      });
    },
  });

  useEffect(() => {
    if (!editor) return;
    const bump = () => bumpEditorUi();
    editor.on('selectionUpdate', bump);
    return () => {
      editor.off('selectionUpdate', bump);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const p = pagesRef.current[activePageIndex];
    if (p?.bodyJson) {
      editor.commands.setContent(p.bodyJson, false);
    }
  }, [activePageIndex, editor]);

  const applyDocumentState = useCallback(
    (docState) => {
      const n = normalizeDocumentState(docState);
      if (!n) return;
      setTitle(n.title);
      setHeader(n.header);
      setFooter(n.footer);
      setDocumentStyle({ ...DEFAULT_DOCUMENT_STYLE, ...n.documentStyle });
      setPages(n.pages);
      setActivePageIndex(0);
      requestAnimationFrame(() => {
        if (editor?.commands && n.pages[0]?.bodyJson) {
          editor.commands.setContent(n.pages[0].bodyJson);
        }
      });
    },
    [editor],
  );

  const applyFullDocumentState = useCallback(
    (docState) => {
      applyDocumentState(docState);
      saveAdminDocument(docState);
    },
    [applyDocumentState],
  );

  const handleAssistantApply = useCallback(
    (docState) => {
      if (!window.confirm('Remplacer le document par la version assistée ?')) return;
      applyFullDocumentState(docState);
    },
    [applyFullDocumentState],
  );

  const goToPage = useCallback(
    (idx) => {
      if (!editor || idx === activePageIndexRef.current) return;
      setPages((prev) => {
        const next = [...prev];
        const i = activePageIndexRef.current;
        next[i] = {
          ...next[i],
          bodyJson: editor.getJSON(),
          bodyHtml: editor.getHTML(),
        };
        return next;
      });
      setActivePageIndex(idx);
    },
    [editor],
  );

  const addPage = useCallback(() => {
    if (!editor) return;
    let newIndex = 0;
    setPages((prev) => {
      const next = [...prev];
      const i = activePageIndexRef.current;
      next[i] = {
        ...next[i],
        bodyJson: editor.getJSON(),
        bodyHtml: editor.getHTML(),
      };
      next.push(newPage());
      newIndex = next.length - 1;
      return next;
    });
    setActivePageIndex(newIndex);
  }, [editor]);

  const duplicatePage = useCallback(() => {
    if (!editor) return;
    const i = activePageIndexRef.current;
    const copy = newPage();
    copy.bodyJson = editor.getJSON();
    copy.bodyHtml = editor.getHTML();
    setPages((prev) => {
      const next = [...prev];
      next[i] = {
        ...next[i],
        bodyJson: editor.getJSON(),
        bodyHtml: editor.getHTML(),
      };
      next.splice(i + 1, 0, copy);
      return next;
    });
    setActivePageIndex(i + 1);
  }, [editor]);

  const removePage = useCallback(() => {
    if (!editor) return;
    const prev = pagesRef.current;
    if (prev.length <= 1) return;
    const cur = activePageIndexRef.current;
    const next = prev.filter((_, idx) => idx !== cur);
    const newIdx = Math.min(cur, next.length - 1);
    setPages(next);
    setActivePageIndex(newIdx);
  }, [editor]);

  const resetAll = useCallback(() => {
    if (!window.confirm('Réinitialiser le document (modèles par défaut) ?')) return;
    const d = defaultDocumentState();
    setTitle(d.title);
    setHeader(d.header);
    setFooter(d.footer);
    setDocumentStyle({ ...DEFAULT_DOCUMENT_STYLE, ...d.documentStyle });
    setPages(d.pages);
    setActivePageIndex(0);
    if (editor) editor.commands.setContent(d.pages[0].bodyJson);
  }, [editor]);

  const handleExportPdf = useCallback(async () => {
    if (!editor) return;
    setExporting(true);
    try {
      const i = activePageIndexRef.current;
      const snapshot = [...pagesRef.current];
      snapshot[i] = {
        ...snapshot[i],
        bodyJson: editor.getJSON(),
        bodyHtml: editor.getHTML(),
      };
      const safe = title.replace(/[^\w\s-]/g, '').trim().slice(0, 80) || 'document';
      await exportAdminDocumentPdf({
        pages: snapshot,
        header,
        footer,
        documentStyle,
        formatFooter: formatFooterTemplate,
        fileName: `${safe}.pdf`,
      });
    } catch (e) {
      console.error(e);
      window.alert(e?.message || 'Export PDF impossible.');
    } finally {
      setExporting(false);
    }
  }, [editor, header, footer, title, documentStyle]);

  const splitTrailingToNewPage = useCallback(() => {
    if (!editor) return;
    const split = splitTrailingBlocksToNewPage(editor);
    if (!split) {
      window.alert(
        'Placez le curseur dans un bloc au-dessus du texte à déplacer : il doit rester au moins un bloc (paragraphe ou titre) en dessous.',
      );
      return;
    }
    const i = activePageIndexRef.current;
    setPages((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], bodyJson: split.headDoc, bodyHtml: split.headHtml };
      const np = newPage();
      np.bodyJson = split.tailDoc;
      np.bodyHtml = split.tailHtml;
      next.splice(i + 1, 0, np);
      return next;
    });
    setActivePageIndex(i + 1);
    editor.commands.setContent(split.tailDoc);
  }, [editor]);

  const handleSaveCloud = useCallback(async () => {
    if (!user?.id) {
      window.alert('Connectez-vous pour enregistrer dans le nuage.');
      return;
    }
    if (!editor) return;
    setCloudBusy(true);
    try {
      const i = activePageIndexRef.current;
      const snapshot = [...pagesRef.current];
      snapshot[i] = {
        ...snapshot[i],
        bodyJson: editor.getJSON(),
        bodyHtml: editor.getHTML(),
      };
      const full = { version: 1, title, header, footer, documentStyle, pages: snapshot };
      await saveAdminDocumentToCloud(full);
      saveAdminDocument(full);
      window.alert('Document enregistré sur le nuage.');
    } catch (e) {
      console.error(e);
      window.alert(e?.message || 'Échec de la sauvegarde en ligne.');
    } finally {
      setCloudBusy(false);
    }
  }, [user?.id, editor, title, header, footer, documentStyle]);

  const handleLoadCloud = useCallback(async () => {
    if (!user?.id) {
      window.alert('Connectez-vous pour charger depuis le nuage.');
      return;
    }
    setCloudBusy(true);
    try {
      const remote = await fetchAdminDocumentFromCloud();
      if (!remote?.document) {
        window.alert('Aucun document en ligne pour ce compte.');
        return;
      }
      if (!window.confirm('Remplacer le document local par la version en ligne ?')) return;
      const n = normalizeDocumentState(remote.document);
      if (!n) {
        window.alert('Données en ligne invalides.');
        return;
      }
      applyDocumentState(n);
      saveAdminDocument(n);
      setRemoteOffer(null);
    } catch (e) {
      console.error(e);
      window.alert(e?.message || 'Chargement impossible.');
    } finally {
      setCloudBusy(false);
    }
  }, [user?.id, applyDocumentState]);

  const applyTemplate = useCallback(
    (key) => {
      if (!window.confirm('Remplacer tout le document par ce modèle ?')) return;
      let next;
      switch (key) {
        case 'courrier':
          next = templateCourrier();
          break;
        case 'pv':
          next = templatePV();
          break;
        case 'attestation':
          next = templateAttestation();
          break;
        case 'contrat':
          next = templateContrat();
          break;
        case 'cv':
          next = templateCV();
          break;
        case 'facture':
          next = templateFacture();
          break;
        case 'lettre':
          next = templateLettreOfficielle();
          break;
        case 'rapport':
          next = templateRapport();
          break;
        case 'fiche_eleve':
          next = templateFicheEleve();
          break;
        case 'reglement':
          next = templateReglement();
          break;
        case 'certificat':
          next = templateCertificat();
          break;
        case 'recu':
          next = templateRecu();
          break;
        case 'standard':
        default:
          next = defaultDocumentState();
      }
      applyDocumentState(next);
      saveAdminDocument(next);
    },
    [applyDocumentState],
  );

  const insertSignatureBlock = useCallback(() => {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .insertContent([
        { type: 'horizontalRule' },
        {
          type: 'paragraph',
          content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Signatures' }],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Lu et approuvé — Nom : _______________    Date : _______________',
            },
          ],
        },
        { type: 'paragraph', content: [{ type: 'text', text: '___________________________' }] },
        { type: 'paragraph', content: [{ type: 'text', text: '(signature)' }] },
      ])
      .run();
  }, [editor]);

  const insertTableDefault = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  const deleteTableWithConfirm = useCallback(() => {
    if (!editor) return;
    if (!window.confirm('Supprimer tout le tableau ?')) return;
    editor.chain().focus().deleteTable().run();
  }, [editor]);

  const triggerImagePick = useCallback(() => {
    imageInputRef.current?.click();
  }, []);

  const onImageFileChange = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file || !editor) return;
      if (!file.type.startsWith('image/')) {
        window.alert('Veuillez choisir un fichier image.');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const src = String(reader.result || '');
        if (src) editor.chain().focus().setImage({ src }).run();
      };
      reader.readAsDataURL(file);
    },
    [editor],
  );

  const footerPreview = formatFooterTemplate(footer, activePageIndex + 1, pages.length);

  if (!editor) {
    return (
      <div className="flex min-h-[320px] items-center justify-center text-gray-400 text-sm">
        Chargement de l'éditeur…
      </div>
    );
  }

  const inTable =
    editor.isActive('table') ||
    editor.isActive('tableCell') ||
    editor.isActive('tableHeader');

  return (
    <div className="flex flex-col gap-4 text-white">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold text-white">Document administratif (A4)</h1>
          <p className="text-xs text-gray-500 mt-1">
            Pages multiples, en-tête / pied globaux, modèles en un clic, saut de page manuel, PDF, sauvegarde locale et
            option nuage (compte connecté).
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={resetAll}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs text-gray-300 hover:bg-white/5"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Réinitialiser
          </button>
          <button
            type="button"
            disabled={cloudBusy || !user?.id}
            onClick={handleLoadCloud}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs text-gray-300 hover:bg-white/5 disabled:opacity-40"
            title={!user?.id ? 'Connexion requise' : 'Charger la dernière version en ligne'}
          >
            <Download className="h-3.5 w-3.5" /> Charger nuage
          </button>
          <button
            type="button"
            disabled={cloudBusy || !user?.id}
            onClick={handleSaveCloud}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)] px-3 py-2 text-xs text-[#f5dd8a] hover:bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] disabled:opacity-40"
            title={!user?.id ? 'Connexion requise' : 'Enregistrer sur le serveur'}
          >
            <Upload className="h-3.5 w-3.5" /> {cloudBusy ? '…' : 'Enregistrer nuage'}
          </button>
          <button
            type="button"
            disabled={exporting}
            onClick={handleExportPdf}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--school-accent)] px-3 py-2 text-xs font-semibold text-black hover:bg-[#c9a532] disabled:opacity-50"
          >
            <FileDown className="h-3.5 w-3.5" /> {exporting ? 'PDF…' : 'Exporter PDF'}
          </button>
        </div>
      </div>

      {remoteOffer ? (
        <div className="flex flex-col gap-2 rounded-lg border border-amber-500/35 bg-amber-950/25 px-3 py-2.5 text-[11px] text-amber-100/95 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Version en ligne plus récente ({new Date(remoteOffer.updatedAt).toLocaleString('fr-FR')}). Vous pouvez
            restaurer ou ignorer.
          </span>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                applyDocumentState(remoteOffer.doc);
                saveAdminDocument(remoteOffer.doc);
                setRemoteOffer(null);
              }}
              className="rounded-md bg-amber-500/25 px-2.5 py-1 text-[11px] font-medium text-amber-100 hover:bg-amber-500/35"
            >
              Restaurer
            </button>
            <button
              type="button"
              onClick={() => setRemoteOffer(null)}
              className="rounded-md border border-white/15 px-2.5 py-1 text-[11px] text-gray-300 hover:bg-white/5"
            >
              Ignorer
            </button>
          </div>
        </div>
      ) : null}

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full max-w-xl rounded-lg border border-white/15 bg-[#0d1525] px-3 py-2 text-sm text-white placeholder:text-gray-600"
        placeholder="Titre du dossier"
      />

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Modèle</span>
        <select
          className="max-w-xs rounded-lg border border-white/15 bg-[#0d1525] px-2 py-1.5 text-[11px] text-white"
          defaultValue=""
          onChange={(e) => {
            const v = e.target.value;
            e.target.value = '';
            if (v) applyTemplate(v);
          }}
        >
          <option value="">Appliquer un modèle…</option>
          <option value="courrier">Courrier officiel</option>
          <option value="lettre">Lettre officielle</option>
          <option value="pv">PV de réunion (2 pages)</option>
          <option value="attestation">Attestation</option>
          <option value="certificat">Certificat (scolarité / suivi)</option>
          <option value="recu">Reçu (paiement)</option>
          <option value="contrat">Contrat / convention (2 p.)</option>
          <option value="cv">Curriculum vitæ</option>
          <option value="facture">Facture</option>
          <option value="rapport">Rapport</option>
          <option value="fiche_eleve">Fiche élève</option>
          <option value="reglement">Règlement intérieur (2 p.)</option>
          <option value="standard">Document vierge (défaut)</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(220px,300px)_1fr] gap-4 items-start">
        <div className="flex min-w-0 flex-col gap-3">
          <AdminDocumentLibraryPanel
            editor={editor}
            onApplyTemplate={applyFullDocumentState}
            onOpenAssistant={() => setAssistantModalOpen(true)}
          />
          <LongiaAdminDocumentPanel editor={editor} documentTitle={title} />
          <div className="space-y-3 rounded-xl border border-white/10 bg-black/25 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[color-mix(in_srgb,var(--school-accent)_80%,transparent)]">Pages</p>
          <div className="flex flex-wrap gap-1">
            {pages.map((p, idx) => (
              <button
                key={p.id}
                type="button"
                onClick={() => goToPage(idx)}
                className={cn(
                  'min-w-[2.25rem] rounded-md px-2 py-1 text-xs font-medium',
                  idx === activePageIndex
                    ? 'bg-[color-mix(in_srgb,var(--school-accent)_25%,transparent)] text-[#f5dd8a] border border-[color-mix(in_srgb,var(--school-accent)_40%,transparent)]'
                    : 'bg-[#0d1525] text-gray-400 border border-white/10 hover:border-white/20',
                )}
              >
                {idx + 1}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={addPage}
              className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-[#0d1525] px-2 py-1.5 text-[11px] text-gray-200 hover:bg-white/5"
            >
              <Plus className="h-3.5 w-3.5" /> Nouvelle page
            </button>
            <button
              type="button"
              onClick={duplicatePage}
              className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-[#0d1525] px-2 py-1.5 text-[11px] text-gray-200 hover:bg-white/5"
            >
              <Copy className="h-3.5 w-3.5" /> Dupliquer
            </button>
            <button
              type="button"
              onClick={removePage}
              disabled={pages.length <= 1}
              className="inline-flex items-center gap-1 rounded-md border border-red-500/25 bg-red-950/20 px-2 py-1.5 text-[11px] text-red-300 hover:bg-red-950/40 disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" /> Supprimer
            </button>
            <button
              type="button"
              onClick={splitTrailingToNewPage}
              className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-[color-mix(in_srgb,var(--school-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_5%,transparent)] px-2 py-1.5 text-[11px] text-[#f5dd8a] hover:bg-[color-mix(in_srgb,var(--school-accent)_15%,transparent)]"
              title="Découpe après le bloc actif : tout ce qui suit va sur une nouvelle page"
            >
              <Split className="h-3.5 w-3.5" />
              Blocs suivants → nouvelle page
            </button>
            <p className="text-[9px] leading-snug text-gray-600">
              Placez le curseur dans un paragraphe : les blocs situés en dessous sont déplacés sur une nouvelle page.
            </p>
          </div>

          <div className="border-t border-white/10 pt-3 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[color-mix(in_srgb,var(--school-accent)_80%,transparent)]">Style du corps</p>
            <p className="text-[9px] text-gray-600">S'applique à l\'aperçu page et à l\'export PDF.</p>
            <label className="block text-[9px] uppercase text-gray-500">Police</label>
            <select
              value={documentStyle.fontFamily}
              onChange={(e) => setDocumentStyle((s) => ({ ...s, fontFamily: e.target.value }))}
              className="w-full rounded-lg border border-white/15 bg-[#0d1525] px-2 py-1.5 text-[11px] text-gray-200"
            >
              <option value="Georgia, serif">Georgia</option>
              <option value="'Times New Roman', Times, serif">Times New Roman</option>
              <option value="Arial, Helvetica, sans-serif">Arial</option>
              <option value="system-ui, -apple-system, sans-serif">Système (sans-serif)</option>
            </select>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[9px] text-gray-500">
                <span>Taille</span>
                <span>{documentStyle.fontSize}px</span>
              </div>
              <input
                type="range"
                min={8}
                max={28}
                value={documentStyle.fontSize}
                onChange={(e) => setDocumentStyle((s) => ({ ...s, fontSize: Number(e.target.value) }))}
                className="w-full accent-[var(--school-accent)]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[9px] text-gray-500">
                <span>Interligne</span>
                <span>{documentStyle.lineHeight.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={100}
                max={250}
                step={5}
                value={Math.round(documentStyle.lineHeight * 100)}
                onChange={(e) =>
                  setDocumentStyle((s) => ({ ...s, lineHeight: Number(e.target.value) / 100 }))
                }
                className="w-full accent-[var(--school-accent)]"
              />
            </div>
          </div>

          <div className="border-t border-white/10 pt-3 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">En-tête (toutes les pages)</p>
            <textarea
              value={header}
              onChange={(e) => setHeader(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-white/15 bg-[#0d1525] px-2 py-1.5 text-[11px] text-gray-200 placeholder:text-gray-600"
              placeholder={DEFAULT_HEADER}
            />
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Pied de page</p>
            <textarea
              value={footer}
              onChange={(e) => setFooter(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-white/15 bg-[#0d1525] px-2 py-1.5 text-[11px] text-gray-200"
              placeholder={DEFAULT_FOOTER}
            />
            <p className="text-[9px] text-gray-600 leading-snug">
              Placeholders : <code className="text-gray-500">{'{page}'}</code> et{' '}
              <code className="text-gray-500">{'{total}'}</code>
            </p>
          </div>
          </div>
        </div>

        <div className="space-y-2 min-w-0">
          <div className="flex flex-wrap items-center gap-0.5 rounded-lg border border-white/10 bg-[#0a0c14] px-2 py-1.5">
            <ToolBtn
              active={editor.isActive('heading', { level: 2 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              title="Titre"
            >
              <Heading2 className="h-4 w-4" />
            </ToolBtn>
            <ToolBtn
              active={editor.isActive('heading', { level: 3 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              title="Sous-titre"
            >
              <Heading3 className="h-4 w-4" />
            </ToolBtn>
            <ToolBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Gras">
              <Bold className="h-4 w-4" />
            </ToolBtn>
            <ToolBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italique">
              <Italic className="h-4 w-4" />
            </ToolBtn>
            <ToolBtn
              active={editor.isActive('underline')}
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              title="Souligné"
            >
              <UnderlineIcon className="h-4 w-4" />
            </ToolBtn>
            <div className="mx-1 h-5 w-px bg-white/10" />
            <ToolBtn
              active={editor.isActive('bulletList')}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              title="Liste"
            >
              <List className="h-4 w-4" />
            </ToolBtn>
            <ToolBtn
              active={editor.isActive('orderedList')}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              title="Liste numérotée"
            >
              <ListOrdered className="h-4 w-4" />
            </ToolBtn>
            <div className="mx-1 h-5 w-px bg-white/10" />
            <ToolBtn active={editor.isActive('table')} onClick={insertTableDefault} title="Insérer un tableau (3×3)">
              <Table2 className="h-4 w-4" />
            </ToolBtn>
            <ToolBtn active={false} onClick={triggerImagePick} title="Insérer une image (fichier local)">
              <ImageIcon className="h-4 w-4" />
            </ToolBtn>
            <div className="mx-1 h-5 w-px bg-white/10" />
            <ToolBtn
              active={editor.isActive({ textAlign: 'left' })}
              onClick={() => editor.chain().focus().setTextAlign('left').run()}
              title="Gauche"
            >
              <AlignLeft className="h-4 w-4" />
            </ToolBtn>
            <ToolBtn
              active={editor.isActive({ textAlign: 'center' })}
              onClick={() => editor.chain().focus().setTextAlign('center').run()}
              title="Centre"
            >
              <AlignCenter className="h-4 w-4" />
            </ToolBtn>
            <ToolBtn
              active={editor.isActive({ textAlign: 'right' })}
              onClick={() => editor.chain().focus().setTextAlign('right').run()}
              title="Droite"
            >
              <AlignRight className="h-4 w-4" />
            </ToolBtn>
            <ToolBtn
              active={editor.isActive({ textAlign: 'justify' })}
              onClick={() => editor.chain().focus().setTextAlign('justify').run()}
              title="Justifier"
            >
              <AlignJustify className="h-4 w-4" />
            </ToolBtn>
            <div className="mx-1 h-5 w-px bg-white/10" />
            <ToolBtn active={false} onClick={() => editor.chain().focus().undo().run()} title="Annuler">
              <Undo2 className="h-4 w-4" />
            </ToolBtn>
            <ToolBtn active={false} onClick={() => editor.chain().focus().redo().run()} title="Refaire">
              <Redo2 className="h-4 w-4" />
            </ToolBtn>
          </div>

          {inTable ? (
            <div className="flex flex-wrap items-center gap-1 rounded-lg border border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_5%,transparent)] px-2 py-1.5">
              <span className="w-full shrink-0 text-[9px] font-bold uppercase tracking-wider text-[color-mix(in_srgb,var(--school-accent)_90%,transparent)]">
                Tableau (curseur dans une cellule)
              </span>
              <QuickBtn
                onClick={() => editor.chain().focus().addColumnBefore().run()}
                title="Insérer une colonne avant"
              >
                + col. gauche
              </QuickBtn>
              <QuickBtn
                onClick={() => editor.chain().focus().addColumnAfter().run()}
                title="Insérer une colonne après"
              >
                + col. droite
              </QuickBtn>
              <QuickBtn
                onClick={() => editor.chain().focus().deleteColumn().run()}
                title="Supprimer la colonne courante"
              >
                − colonne
              </QuickBtn>
              <QuickBtn onClick={() => editor.chain().focus().addRowBefore().run()} title="Insérer une ligne au-dessus">
                + ligne haut
              </QuickBtn>
              <QuickBtn onClick={() => editor.chain().focus().addRowAfter().run()} title="Insérer une ligne en dessous">
                + ligne bas
              </QuickBtn>
              <QuickBtn onClick={() => editor.chain().focus().deleteRow().run()} title="Supprimer la ligne courante">
                − ligne
              </QuickBtn>
              <QuickBtn
                onClick={() => editor.chain().focus().mergeOrSplit().run()}
                title="Fusionner la sélection ou scinder la cellule"
              >
                Fusion / scinder
              </QuickBtn>
              <QuickBtn
                onClick={() => editor.chain().focus().toggleHeaderRow().run()}
                title="Activer ou désactiver la ligne d'en-tête"
              >
                En-tête ligne
              </QuickBtn>
              <QuickBtn
                onClick={() => editor.chain().focus().toggleHeaderColumn().run()}
                title="Activer ou désactiver la colonne d'en-tête"
              >
                En-tête colonne
              </QuickBtn>
              <QuickBtn onClick={deleteTableWithConfirm} title="Supprimer tout le tableau">
                Supprimer tableau
              </QuickBtn>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-white/10 bg-[#0d1525]/80 px-2 py-1.5">
            <span className="w-full text-[9px] font-bold uppercase tracking-wider text-gray-500">Actions rapides</span>
            <QuickBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Titre (niveau 2)">
              Titre
            </QuickBtn>
            <QuickBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Sous-titre (niveau 3)">
              Sous-titre
            </QuickBtn>
            <QuickBtn onClick={() => editor.chain().focus().setParagraph().run()} title="Paragraphe">
              Paragraphe
            </QuickBtn>
            <QuickBtn onClick={() => editor.chain().focus().toggleBulletList().run()} title="Liste à puces">
              Liste
            </QuickBtn>
            <QuickBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Liste numérotée">
              Liste n°
            </QuickBtn>
            <QuickBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Trait horizontal">
              <Minus className="h-3.5 w-3.5 inline" /> Trait
            </QuickBtn>
            <QuickBtn onClick={insertTableDefault} title="Tableau 3×3 avec en-tête">
              <Table2 className="h-3.5 w-3.5 inline" /> Tableau
            </QuickBtn>
            <QuickBtn onClick={triggerImagePick} title="Image depuis votre ordinateur">
              <ImageIcon className="h-3.5 w-3.5 inline" /> Image
            </QuickBtn>
            <QuickBtn onClick={insertSignatureBlock} title="Bloc signatures">
              <PenLine className="h-3.5 w-3.5 inline" /> Signatures
            </QuickBtn>
          </div>

          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            aria-hidden
            tabIndex={-1}
            onChange={onImageFileChange}
          />

          <div
            className="mx-auto w-full max-w-[210mm] rounded-sm bg-white text-gray-900 shadow-2xl ring-1 ring-black/20"
            style={{ minHeight: '297mm' }}
          >
            <div className="border-b border-gray-200 px-[20mm] pt-[16mm] pb-3 text-[10pt] text-gray-700 whitespace-pre-wrap leading-snug">
              {header || '— En-tête —'}
            </div>
            <div
              className="px-[20mm] py-4 min-h-[210mm] [&_.ProseMirror]:min-h-[200mm]"
              style={{
                fontFamily: documentStyle.fontFamily,
                fontSize: `${documentStyle.fontSize}px`,
                lineHeight: documentStyle.lineHeight,
              }}
            >
              <EditorContent editor={editor} />
            </div>
            <div className="border-t border-gray-200 px-[20mm] pb-[18mm] pt-3 text-[9pt] text-gray-500 whitespace-pre-wrap">
              {footerPreview || '— Pied de page —'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
