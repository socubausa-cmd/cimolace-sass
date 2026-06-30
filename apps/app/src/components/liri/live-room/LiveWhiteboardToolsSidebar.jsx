import React, { useMemo, useState, useRef, useCallback } from 'react';
import {
  Pencil, Eraser, Type, Square, Circle, Minus, Trash2, Download,
  Undo2, Redo2, Plus, MousePointer2, Hand, Group, Ungroup, Spline, Copy, Scissors,
  ClipboardPaste, Files, ChevronLeft, ChevronRight, RotateCcw, BoxSelect,
  Bold, Italic, AlignLeft, AlignCenter, AlignRight, PenLine, BookOpen, Crosshair,
  Image as ImageIcon, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  designerShellMicroLabel,
  designerShellCardInset,
  designerShellChipGhost,
} from '@/lib/liriDesignerShellClasses';
import NeuroInkPanel from './NeuroInkPanel';
import { useLiveWhiteboardStore } from './useLiveWhiteboardStore';
import { WHITEBOARD_TEXT_PRESET_BASE } from '@/lib/whiteboardTextCanvas';
import LiveWhiteboardSchoolTab from './LiveWhiteboardSchoolTab';

const BOARD_COLORS = [
  { value: '#ffffff', label: 'Blanc' },
  { value: '#D4AF37', label: 'Or' },
  { value: '#f87171', label: 'Rouge' },
  { value: '#34d399', label: 'Vert' },
  { value: '#60a5fa', label: 'Bleu' },
  { value: '#c084fc', label: 'Violet' },
  { value: '#fb923c', label: 'Orange' },
  { value: '#000000', label: 'Noir' },
];

const RAIL_TITLE =
  'font-serif text-[13px] font-semibold text-white/92 tracking-tight uppercase tracking-wide text-white/70 text-[11px]';

const TOOLS = [
  { id: 'select', label: 'Sélection', Icon: MousePointer2 },
  { id: 'marquee', label: 'Zone', Icon: BoxSelect },
  { id: 'hand', label: 'Main', Icon: Hand },
  { id: 'pencil', label: 'Crayon', Icon: Pencil },
  { id: 'eraser', label: 'Gomme', Icon: Eraser },
  { id: 'text', label: 'Texte', Icon: Type },
  { id: 'rect', label: 'Rectangle', Icon: Square },
  { id: 'circle', label: 'Cercle', Icon: Circle },
  { id: 'line', label: 'Ligne', Icon: Minus },
  { id: 'curve', label: 'Courbe', Icon: Spline },
  { id: 'poly', label: 'Stylo', Icon: PenLine },
  { id: 'laser', label: 'Laser', Icon: Crosshair },
  { id: 'eraser-stroke', label: 'Eff. objet', Icon: Eraser },
];

/**
 * Rail latéral hôte : outils tableau + couleurs + propriétés + NeuroInk (variant compact).
 * Utilisé dans LiveRoomShell après le bloc Notifications (scène board).
 * `whiteboardStrokes` : liste courante des traits (pour n'activer « Dégrouper » que sur un vrai groupe).
 */
export default function LiveWhiteboardToolsSidebar({
  className,
  hideNeuroInk = false,
  whiteboardStrokes = null,
  whiteboardPaging = null,
}) {
  const tool = useLiveWhiteboardStore((s) => s.tool);
  const setTool = useLiveWhiteboardStore((s) => s.setTool);
  const color = useLiveWhiteboardStore((s) => s.color);
  const setColor = useLiveWhiteboardStore((s) => s.setColor);
  const size = useLiveWhiteboardStore((s) => s.size);
  const setSize = useLiveWhiteboardStore((s) => s.setSize);
  const shapeFill = useLiveWhiteboardStore((s) => s.shapeFill);
  const setShapeFill = useLiveWhiteboardStore((s) => s.setShapeFill);
  const textFontSize = useLiveWhiteboardStore((s) => s.textFontSize);
  const setTextFontSize = useLiveWhiteboardStore((s) => s.setTextFontSize);
  const textPreset = useLiveWhiteboardStore((s) => s.textPreset);
  const setTextPreset = useLiveWhiteboardStore((s) => s.setTextPreset);
  const textBold = useLiveWhiteboardStore((s) => s.textBold);
  const setTextBold = useLiveWhiteboardStore((s) => s.setTextBold);
  const textItalic = useLiveWhiteboardStore((s) => s.textItalic);
  const setTextItalic = useLiveWhiteboardStore((s) => s.setTextItalic);
  const textAlign = useLiveWhiteboardStore((s) => s.textAlign);
  const setTextAlign = useLiveWhiteboardStore((s) => s.setTextAlign);
  const neuroInkOpen = useLiveWhiteboardStore((s) => s.neuroInkOpen);
  const setNeuroInkOpen = useLiveWhiteboardStore((s) => s.setNeuroInkOpen);
  const neuroInk = useLiveWhiteboardStore((s) => s.neuroInk);
  const setNeuroInk = useLiveWhiteboardStore((s) => s.setNeuroInk);
  const undoBoard = useLiveWhiteboardStore((s) => s.undoBoard);
  const redoBoard = useLiveWhiteboardStore((s) => s.redoBoard);
  const clearBoard = useLiveWhiteboardStore((s) => s.clearBoard);
  const downloadBoard = useLiveWhiteboardStore((s) => s.downloadBoard);
  const groupBoardSelection = useLiveWhiteboardStore((s) => s.groupBoardSelection);
  const ungroupBoardSelection = useLiveWhiteboardStore((s) => s.ungroupBoardSelection);
  const copyBoardSelection = useLiveWhiteboardStore((s) => s.copyBoardSelection);
  const cutBoardSelection = useLiveWhiteboardStore((s) => s.cutBoardSelection);
  const pasteBoardClipboard = useLiveWhiteboardStore((s) => s.pasteBoardClipboard);
  const duplicateBoardSelection = useLiveWhiteboardStore((s) => s.duplicateBoardSelection);
  const boardClipboard = useLiveWhiteboardStore((s) => s.boardClipboard);
  const boardSelection = useLiveWhiteboardStore((s) => s.boardSelection);
  const setBoardSelection = useLiveWhiteboardStore((s) => s.setBoardSelection);
  const selectedStrokeInfo = useLiveWhiteboardStore((s) => s.selectedStrokeInfo);
  const updateStrokeProperties = useLiveWhiteboardStore((s) => s.updateStrokeProperties);
  const setPendingImage = useLiveWhiteboardStore((s) => s.setPendingImage);
  const snapToGrid = useLiveWhiteboardStore((s) => s.snapToGrid);
  const setSnapToGrid = useLiveWhiteboardStore((s) => s.setSnapToGrid);
  const wbTimer = useLiveWhiteboardStore((s) => s.wbTimer);
  const setWbTimer = useLiveWhiteboardStore((s) => s.setWbTimer);
  const boardFillColor = useLiveWhiteboardStore((s) => s.boardFillColor);
  const boardFillColorEnabled = useLiveWhiteboardStore((s) => s.boardFillColorEnabled);
  const setBoardFillColor = useLiveWhiteboardStore((s) => s.setBoardFillColor);
  const setBoardFillColorEnabled = useLiveWhiteboardStore((s) => s.setBoardFillColorEnabled);
  const boardSurface = useLiveWhiteboardStore((s) => s.boardSurface);
  const setBoardSurface = useLiveWhiteboardStore((s) => s.setBoardSurface);
  const resetBoardView = useLiveWhiteboardStore((s) => s.resetBoardView);
  const boardZoom = useLiveWhiteboardStore((s) => s.boardZoom);
  const setBoardZoom = useLiveWhiteboardStore((s) => s.setBoardZoom);

  const canUngroup = useMemo(() => {
    if (boardSelection.length !== 1) return false;
    const list = Array.isArray(whiteboardStrokes) ? whiteboardStrokes : [];
    const idx = boardSelection[0];
    const s = list[idx];
    return Boolean(
      s
      && s.kind === 'group'
      && Array.isArray(s.strokes)
      && s.strokes.length > 0,
    );
  }, [boardSelection, whiteboardStrokes]);

  const [sidebarTab, setSidebarTab] = useState('outils');
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const fileInputRef = useRef(null);
  const shapeTool = tool === 'rect' || tool === 'circle' || tool === 'line';

  const handleImageFile = useCallback((file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result;
      if (url) {
        setPendingImage({ url, w: 300, h: 200 });
        setTool('image-place');
        setImageDialogOpen(false);
        setImageUrl('');
      }
    };
    reader.readAsDataURL(file);
  }, [setPendingImage, setTool]);

  return (
    <div className={cn(className)}>
      <p className={cn(RAIL_TITLE, 'mb-2')}>Tableau blanc</p>

      {/* Onglets principaux */}
      <div className="flex gap-1 mb-3">
        <button
          type="button"
          onClick={() => setSidebarTab('outils')}
          className={cn(
            'flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[9px] font-semibold border flex-1 justify-center transition-colors',
            sidebarTab === 'outils'
              ? 'border-amber-500/45 bg-amber-500/14 text-amber-100'
              : 'border-white/10 bg-white/4 text-white/50 hover:text-white/70',
          )}
        >
          <Pencil className="h-3 w-3" /> Outils
        </button>
        <button
          type="button"
          onClick={() => setSidebarTab('scolaire')}
          className={cn(
            'flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[9px] font-semibold border flex-1 justify-center transition-colors',
            sidebarTab === 'scolaire'
              ? 'border-amber-500/55 bg-amber-500/16 text-amber-100'
              : 'border-white/10 bg-white/4 text-white/50 hover:text-white/70',
          )}
        >
          <BookOpen className="h-3 w-3" /> Scolaire
        </button>
      </div>

      {sidebarTab === 'scolaire' ? (
        <LiveWhiteboardSchoolTab className="space-y-1" />
      ) : (<>
      <p data-wb-guide className={cn(designerShellMicroLabel, 'mb-2 text-white/38')}>
        {hideNeuroInk
          ? 'Outils et couleurs — NeuroInk sur le cadre SmartBoard'
          : 'Outils, couleurs et NeuroInk — même logique que le designer'}
      </p>
      <p data-wb-guide className="mb-2 rounded-lg border border-white/[0.06] bg-black/30 px-2 py-1.5 text-[10px] leading-relaxed text-white/60">
        <span className="font-medium text-white/75">Raccourcis</span> (cliquer le canevas pour le clavier) :{' '}
        <span className="font-mono text-[9px] text-amber-200/90">V</span> sélection ·{' '}
        <span className="font-mono text-[9px] text-amber-200/90">M</span> zone ·{' '}
        <span className="font-mono text-[9px] text-amber-200/90">H</span> main ·{' '}
        <span className="font-mono text-[9px] text-amber-200/90">Espace</span>+glisser ·{' '}
        <span className="font-mono text-[9px] text-amber-200/90">P E T</span> etc. · Clic droit = menu (zoom sélection, reset vue) ·{' '}
        <span className="font-mono text-[9px] text-amber-200/90">Ctrl+Z</span> annuler ·{' '}
        <span className="font-mono text-[9px] text-amber-200/90">Ctrl+C / V / D</span> copier / coller / dupliquer ·{' '}
        <span className="font-mono text-[9px] text-amber-200/90">Ctrl+X</span> supprimer ·{' '}
        <span className="font-mono text-[9px] text-amber-200/90">Ctrl+G</span> grouper verrouillé ·{' '}
        <span className="font-mono text-[9px] text-amber-200/90">Échap</span> tout annuler → outil Sélection ·{' '}
        <span className="font-mono text-[9px] text-amber-200/90">Suppr</span> /{' '}
        <span className="font-mono text-[9px] text-amber-200/90">Retour</span> supprimer la sélection · Clic dans le vide (crayon / forme sans glisser) = Sélection ·{' '}
        <span className="font-mono text-[9px] text-amber-200/90">Maj</span> ou{' '}
        <span className="font-mono text-[9px] text-amber-200/90">Ctrl</span>+clic ajouter / retirer · Double-clic sur un tracé = sélection ; double-clic dans le vide = zone ; glisser en sélection = déplacer.
      </p>

      {whiteboardPaging ? (
        <div className={cn(designerShellCardInset, 'mb-2 space-y-1.5')}>
          <p className={designerShellMicroLabel}>Écrans tableau</p>
          <p data-wb-guide className="text-[8px] leading-snug text-white/38">
            Plusieurs pages plein écran : passez d'un écran à l\'autre pendant le cours.
          </p>
          <div className="flex items-center justify-between gap-1">
            <button
              type="button"
              title="Écran précédent"
              onClick={() => whiteboardPaging.onPrev?.()}
              disabled={!whiteboardPaging.onPrev || whiteboardPaging.pageIndex <= 0}
              className={cn(
                designerShellChipGhost,
                'h-8 w-8 shrink-0 p-0',
                (whiteboardPaging.pageIndex <= 0 || !whiteboardPaging.onPrev) && 'pointer-events-none opacity-35',
              )}
            >
              <ChevronLeft className="mx-auto h-4 w-4" />
            </button>
            <span className="min-w-0 flex-1 text-center text-[10px] tabular-nums text-white/65">
              {whiteboardPaging.pageIndex + 1} / {whiteboardPaging.pageCount}
            </span>
            <button
              type="button"
              title="Écran suivant"
              onClick={() => whiteboardPaging.onNext?.()}
              disabled={
                !whiteboardPaging.onNext
                || whiteboardPaging.pageIndex >= whiteboardPaging.pageCount - 1
              }
              className={cn(
                designerShellChipGhost,
                'h-8 w-8 shrink-0 p-0',
                (
                  !whiteboardPaging.onNext
                  || whiteboardPaging.pageIndex >= whiteboardPaging.pageCount - 1
                ) && 'pointer-events-none opacity-35',
              )}
            >
              <ChevronRight className="mx-auto h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => whiteboardPaging.onAdd?.()}
              disabled={!whiteboardPaging.onAdd}
              className={cn(
                designerShellChipGhost,
                'flex-1 py-1.5 text-[9px]',
                !whiteboardPaging.onAdd && 'pointer-events-none opacity-35',
              )}
            >
              + Nouvel écran
            </button>
            {whiteboardPaging.onRemove ? (
              <button
                type="button"
                onClick={() => whiteboardPaging.onRemove?.()}
                disabled={whiteboardPaging.pageCount <= 1}
                className={cn(
                  designerShellChipGhost,
                  'flex-1 border-amber-500/20 py-1.5 text-[9px] text-amber-200/85',
                  whiteboardPaging.pageCount <= 1 && 'pointer-events-none opacity-35',
                )}
              >
                Retirer cet écran
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className={cn(designerShellCardInset, 'mb-2 space-y-1.5')}>
        <p className={designerShellMicroLabel}>Surface & vue</p>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            title="Fond sombre studio"
            onClick={() => setBoardSurface('dark')}
            className={cn(
              designerShellChipGhost,
              'flex-1 py-1.5 text-[9px]',
              boardSurface === 'dark' && 'border-amber-500/40 bg-amber-500/12 text-amber-100',
            )}
          >
            Sombre
          </button>
          <button
            type="button"
            title="Tableau vert — gomme efface le dessin (calque craie)"
            onClick={() => {
              setBoardSurface('chalkboard');
              if (color === '#ffffff' || String(color).toLowerCase() === '#fff') {
                setColor('#f5f0dc');
              }
            }}
            className={cn(
              designerShellChipGhost,
              'flex-1 py-1.5 text-[9px]',
              boardSurface === 'chalkboard' && 'border-amber-500/40 bg-amber-500/12 text-amber-100',
            )}
          >
            Tableau vert
          </button>
          <button
            type="button"
            title="Géoplan — fond blanc quadrillé (points bleus)"
            onClick={() => setBoardSurface('geoplan')}
            className={cn(
              designerShellChipGhost,
              'flex-1 py-1.5 text-[9px]',
              boardSurface === 'geoplan' && 'border-amber-500/40 bg-amber-500/12 text-amber-100',
            )}
          >
            Géoplan
          </button>
          <button
            type="button"
            title="Recentrer la vue (pan)"
            onClick={() => resetBoardView()}
            className={cn(designerShellChipGhost, 'h-8 w-8 shrink-0 p-0')}
          >
            <RotateCcw className="mx-auto h-3.5 w-3.5" />
          </button>
        </div>
        <p data-wb-guide className="text-[10px] leading-snug text-white/55">
          Gomme : efface les traits sur le calque (gomme « vraie »). Le fond vert reste.
        </p>
      </div>

      <div className={cn(designerShellCardInset, 'mb-2 space-y-1.5')}>
        <p className={designerShellMicroLabel}>Outils</p>
        <div className="grid grid-cols-3 gap-1">
          {TOOLS.map(({ id, label, Icon }) => {
            const active = tool === id;
            return (
              <button
                key={id}
                type="button"
                title={label}
                onClick={() => setTool(id)}
                className={cn(
                  'flex h-9 flex-col items-center justify-center gap-0.5 rounded-lg border text-[8px] font-medium transition-colors',
                  active
                    ? 'border-amber-500/45 bg-amber-500/[0.14] text-amber-50'
                    : 'border-white/[0.08] bg-[#1f1e1c]/80 text-white/50 hover:border-white/14 hover:text-white/80',
                )}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                <span className="leading-none">{label}</span>
              </button>
            );
          })}
        </div>
        {tool === 'curve' ? (
          <p className="text-[8px] leading-snug text-amber-200/55">
            Courbe (Bézier) : 1ᵉʳ clic départ, 2ᵉ point de contrôle, 3ᵉ arrivée — aperçu au survol.
          </p>
        ) : null}
      </div>

      {/* ── Zoom + Snap ────────────────────────────────────────────── */}
      <div className={cn(designerShellCardInset, 'mb-2 space-y-1.5')}>
        <div className="flex items-center justify-between gap-2">
          <p className={designerShellMicroLabel}>Zoom</p>
          <div className="flex items-center gap-1">
            <button type="button" title="Zoom arrière"
              onClick={() => setBoardZoom((z) => Math.max(0.25, Math.round((z - 0.1) * 10) / 10))}
              className={cn(designerShellChipGhost, 'h-7 w-7 p-0')}>
              <Minus className="mx-auto h-3 w-3" />
            </button>
            <button type="button" title="Réinitialiser zoom" onClick={() => { setBoardZoom(1); resetBoardView(); }}
              className="min-w-[3rem] text-center text-[10px] tabular-nums text-white/70 hover:text-amber-200 transition-colors">
              {Math.round((boardZoom || 1) * 100)}%
            </button>
            <button type="button" title="Zoom avant"
              onClick={() => setBoardZoom((z) => Math.min(4, Math.round((z + 0.1) * 10) / 10))}
              className={cn(designerShellChipGhost, 'h-7 w-7 p-0')}>
              <Plus className="mx-auto h-3 w-3" />
            </button>
          </div>
        </div>
        <button type="button"
          onClick={() => setSnapToGrid(!snapToGrid)}
          className={cn(
            designerShellChipGhost, 'w-full py-1.5 text-[9px] flex items-center justify-center gap-1.5',
            snapToGrid && 'border-amber-500/45 bg-amber-500/12 text-amber-100',
          )}
          title="Aligner les tracés sur la grille (24px)"
        >
          <span>{snapToGrid ? '⊞' : '⬜'}</span>
          {snapToGrid ? 'Snap grille activé' : 'Snap grille désactivé'}
        </button>
      </div>

      {/* ── Minuteur ───────────────────────────────────────────────── */}
      <div className={cn(designerShellCardInset, 'mb-2 space-y-1.5')}>
        <p className={cn(designerShellMicroLabel, 'mb-1')}>Minuteur</p>
        <div className="flex items-center gap-1">
          <span className={cn(
            'flex-1 text-center font-mono font-bold tabular-nums text-[18px]',
            (wbTimer.remainingSec <= 30 && wbTimer.remainingSec > 0 && wbTimer.running) ? 'text-red-400' : 'text-amber-200/90',
          )}>
            {String(Math.floor((wbTimer.remainingSec || 0) / 60)).padStart(2, '0')}
            <span className="opacity-50">:</span>
            {String((wbTimer.remainingSec || 0) % 60).padStart(2, '0')}
          </span>
          <button type="button" title={wbTimer.running ? 'Pause' : 'Démarrer'}
            onClick={() => setWbTimer({ running: !wbTimer.running, visible: true })}
            className={cn(designerShellChipGhost, 'h-8 w-8 p-0 shrink-0',
              wbTimer.running && 'border-amber-500/40 bg-amber-500/12 text-amber-100')}>
            {wbTimer.running ? '⏸' : '▶'}
          </button>
          <button type="button" title="Réinitialiser"
            onClick={() => setWbTimer({ running: false, remainingSec: wbTimer.durationSec })}
            className={cn(designerShellChipGhost, 'h-8 w-8 p-0 shrink-0')}>
            <RotateCcw className="mx-auto h-3 w-3" />
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          {[60, 120, 180, 300, 600, 900].map((s) => (
            <button key={s} type="button"
              onClick={() => setWbTimer({ durationSec: s, remainingSec: s, running: false })}
              className={cn(designerShellChipGhost, 'flex-1 min-w-[2.5rem] py-0.5 text-[8px]',
                wbTimer.durationSec === s && 'border-amber-500/40 bg-amber-500/10 text-amber-100')}>
              {s < 60 ? `${s}s` : `${s / 60}min`}
            </button>
          ))}
        </div>
        <button type="button"
          onClick={() => setWbTimer({ visible: !wbTimer.visible })}
          className={cn(designerShellChipGhost, 'w-full py-1 text-[9px]',
            wbTimer.visible && 'border-amber-500/35 bg-amber-500/8 text-amber-200/80')}>
          {wbTimer.visible ? '👁 Visible sur le tableau' : '🙈 Masqué du tableau'}
        </button>
      </div>

      {/* ── Insérer image ──────────────────────────────────────────── */}
      <div className={cn(designerShellCardInset, 'mb-2')}>
        <p className={cn(designerShellMicroLabel, 'mb-1.5')}>Insérer une image</p>
        <button
          type="button"
          onClick={() => setImageDialogOpen(true)}
          className={cn(
            designerShellChipGhost,
            'w-full flex items-center justify-center gap-1.5 py-1.5 text-[9px]',
            tool === 'image-place' && 'border-amber-500/45 bg-amber-500/12 text-amber-100',
          )}
        >
          <ImageIcon className="h-3 w-3 shrink-0" />
          {tool === 'image-place' ? 'Cliquez sur le tableau pour placer' : 'Image URL / Fichier'}
        </button>
        {imageDialogOpen && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-[min(92vw,420px)] rounded-2xl border border-white/[0.1] bg-[#14131c]/98 p-5 shadow-[0_24px_80px_-20px_rgba(0,0,0,.9)] space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-bold text-white/90">Insérer une image</p>
                <button type="button" onClick={() => setImageDialogOpen(false)} className="text-white/40 hover:text-white/75 text-lg">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-2">
                <p className={cn(designerShellMicroLabel)}>Coller une URL</p>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl bg-white/[0.05] border border-white/10 text-white text-[11px] px-3 py-2 outline-none focus:border-amber-500/50"
                />
                <button
                  type="button"
                  disabled={!imageUrl.trim()}
                  onClick={() => {
                    if (!imageUrl.trim()) return;
                    setPendingImage({ url: imageUrl.trim(), w: 300, h: 200 });
                    setTool('image-place');
                    setImageDialogOpen(false);
                    setImageUrl('');
                  }}
                  className={cn(
                    'w-full rounded-xl border py-2 text-[11px] font-bold transition-colors',
                    imageUrl.trim()
                      ? 'border-amber-500/45 bg-amber-500/16 text-amber-100 hover:bg-amber-500/24'
                      : 'border-white/10 bg-white/4 text-white/30 pointer-events-none',
                  )}
                >
                  ✓ Placer depuis URL
                </button>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-[9px] text-white/30">ou</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleImageFile(e.target.files?.[0])}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full rounded-xl border border-white/12 bg-white/4 py-2 text-[11px] text-white/60 hover:text-white/80 hover:border-white/20 transition-colors"
                >
                  📂 Choisir un fichier image
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Propriétés de la sélection ─────────────────────────────── */}
      {selectedStrokeInfo && boardSelection.length > 0 && (
        <div className={cn(designerShellCardInset, 'mb-2 space-y-2')}>
          <p className={designerShellMicroLabel}>
            Propriétés — {boardSelection.length > 1 ? `${boardSelection.length} objets` : selectedStrokeInfo.kind}
          </p>
          <div>
            <p className={cn(designerShellMicroLabel, 'mb-1')}>Couleur</p>
            <div className="flex flex-wrap gap-1">
              {BOARD_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  onClick={() => updateStrokeProperties({ color: c.value })}
                  className={cn(
                    'h-5 w-5 rounded-full border-2 transition-transform hover:scale-110',
                    selectedStrokeInfo.color === c.value ? 'border-white scale-110' : 'border-transparent',
                  )}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className={designerShellMicroLabel}>Épaisseur</p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => updateStrokeProperties({ lineWidth: Math.max(0.5, (selectedStrokeInfo.lineWidth || 2) - 0.5) })}
                className={cn(designerShellChipGhost, 'h-7 w-7 p-0')}
              >
                <Minus className="mx-auto h-3 w-3" />
              </button>
              <span className="w-6 text-center text-[10px] tabular-nums text-white/60">
                {(selectedStrokeInfo.lineWidth || 2).toFixed(1)}
              </span>
              <button
                type="button"
                onClick={() => updateStrokeProperties({ lineWidth: Math.min(24, (selectedStrokeInfo.lineWidth || 2) + 0.5) })}
                className={cn(designerShellChipGhost, 'h-7 w-7 p-0')}
              >
                <Plus className="mx-auto h-3 w-3" />
              </button>
            </div>
          </div>
          {['rect','circle','polygon','triangle','star'].includes(selectedStrokeInfo.kind) && (
            <div>
              <p className={cn(designerShellMicroLabel, 'mb-1')}>Fond de la forme</p>
              <div className="flex flex-wrap gap-1">
                <button type="button" title="Pas de fond"
                  onClick={() => updateStrokeProperties({ fillColor: null, fill: false })}
                  className="h-5 w-5 rounded-full border-2 border-white/30 flex items-center justify-center text-[8px]">
                  ∅
                </button>
                {BOARD_COLORS.map((c) => (
                  <button key={c.value} type="button" title={c.label}
                    onClick={() => updateStrokeProperties({ fillColor: c.value, fill: true })}
                    className="h-5 w-5 rounded-full border-2 border-transparent hover:scale-110 transition-transform"
                    style={{ backgroundColor: c.value }} />
                ))}
              </div>
            </div>
          )}
          {selectedStrokeInfo.kind === 'curtain' && (
            <div className="flex items-center justify-between gap-2">
              <p className={designerShellMicroLabel}>Opacité rideau</p>
              <input
                type="range" min={0.1} max={1} step={0.05}
                value={selectedStrokeInfo.opacity ?? 0.97}
                onChange={(e) => updateStrokeProperties({ opacity: Number(e.target.value) })}
                className="flex-1 accent-amber-500/80"
              />
            </div>
          )}
        </div>
      )}

      <div className={cn(designerShellCardInset, 'mb-2 space-y-1.5')}>
        <p className={designerShellMicroLabel}>Sélection & groupes</p>
        <p data-wb-guide className="text-[8px] leading-snug text-white/38">
          Clic sur un trait, Maj+clic pour cumuler. Grouper, couper, copier, coller — style calque vectoriel.
        </p>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => copyBoardSelection()}
            disabled={boardSelection.length === 0}
            className={cn(
              designerShellChipGhost,
              'flex flex-1 min-w-[4.25rem] items-center justify-center gap-0.5 py-1.5 text-[9px]',
              boardSelection.length === 0 && 'pointer-events-none opacity-35',
            )}
          >
            <Copy className="h-3 w-3 shrink-0" />
            Copier
          </button>
          <button
            type="button"
            onClick={() => cutBoardSelection()}
            disabled={boardSelection.length === 0}
            className={cn(
              designerShellChipGhost,
              'flex flex-1 min-w-[4.25rem] items-center justify-center gap-0.5 py-1.5 text-[9px]',
              boardSelection.length === 0 && 'pointer-events-none opacity-35',
            )}
          >
            <Scissors className="h-3 w-3 shrink-0" />
            Couper
          </button>
          <button
            type="button"
            onClick={() => pasteBoardClipboard()}
            disabled={!Array.isArray(boardClipboard) || boardClipboard.length === 0}
            className={cn(
              designerShellChipGhost,
              'flex flex-1 min-w-[4.25rem] items-center justify-center gap-0.5 py-1.5 text-[9px]',
              (!Array.isArray(boardClipboard) || boardClipboard.length === 0) && 'pointer-events-none opacity-35',
            )}
          >
            <ClipboardPaste className="h-3 w-3 shrink-0" />
            Coller
          </button>
          <button
            type="button"
            onClick={() => duplicateBoardSelection()}
            disabled={boardSelection.length === 0}
            className={cn(
              designerShellChipGhost,
              'flex w-full items-center justify-center gap-0.5 py-1.5 text-[9px]',
              boardSelection.length === 0 && 'pointer-events-none opacity-35',
            )}
          >
            <Files className="h-3 w-3 shrink-0" />
            Dupliquer
          </button>
        </div>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => groupBoardSelection()}
            disabled={boardSelection.length < 2}
            className={cn(
              designerShellChipGhost,
              'flex flex-1 min-w-[4.5rem] items-center justify-center gap-1 py-1.5 text-[9px]',
              boardSelection.length < 2 && 'pointer-events-none opacity-35',
            )}
          >
            <Group className="h-3 w-3 shrink-0" />
            Grouper
          </button>
          <button
            type="button"
            onClick={() => ungroupBoardSelection()}
            disabled={!canUngroup}
            className={cn(
              designerShellChipGhost,
              'flex flex-1 min-w-[4.5rem] items-center justify-center gap-1 py-1.5 text-[9px]',
              !canUngroup && 'pointer-events-none opacity-35',
            )}
          >
            <Ungroup className="h-3 w-3 shrink-0" />
            Dégrouper
          </button>
          <button
            type="button"
            onClick={() => setBoardSelection([])}
            disabled={boardSelection.length === 0}
            className={cn(
              designerShellChipGhost,
              'w-full py-1.5 text-[9px] text-white/55',
              boardSelection.length === 0 && 'pointer-events-none opacity-35',
            )}
          >
            Effacer la sélection
          </button>
        </div>
      </div>

      <div className={cn(designerShellCardInset, 'mb-2 space-y-2')}>
        <div>
          <p className={cn(designerShellMicroLabel, 'mb-1.5')}>Couleur du trait</p>
          <div className="flex flex-wrap gap-1">
            {BOARD_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                title={c.label}
                onClick={() => {
                  setColor(c.value);
                  if (tool === 'eraser') setTool('pencil');
                }}
                className={cn(
                  'h-5 w-5 rounded-full border-2 transition-transform',
                  color === c.value && tool !== 'eraser'
                    ? 'scale-110 border-white'
                    : 'border-transparent hover:scale-105',
                )}
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className={designerShellMicroLabel}>Couleur de fond (formes)</p>
            <button type="button"
              onClick={() => setBoardFillColorEnabled(!boardFillColorEnabled)}
              className={cn('text-[8px] px-2 py-0.5 rounded-lg border transition-colors',
                boardFillColorEnabled
                  ? 'border-amber-500/40 bg-amber-500/12 text-amber-200'
                  : 'border-white/10 bg-white/4 text-white/40')}>
              {boardFillColorEnabled ? 'Activé' : 'Désactivé'}
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            <button type="button" title="Pas de fond"
              onClick={() => { setBoardFillColor(null); setBoardFillColorEnabled(false); }}
              className={cn('h-5 w-5 rounded-full border-2 transition-transform flex items-center justify-center text-[8px]',
                !boardFillColorEnabled ? 'border-white scale-110' : 'border-white/30')}>
              ∅
            </button>
            {BOARD_COLORS.map((c) => (
              <button key={c.value} type="button" title={c.label}
                onClick={() => setBoardFillColor(c.value)}
                className={cn('h-5 w-5 rounded-full border-2 transition-transform',
                  boardFillColorEnabled && boardFillColor === c.value
                    ? 'scale-110 border-white'
                    : 'border-transparent hover:scale-105')}
                style={{ backgroundColor: c.value }} />
            ))}
          </div>
        </div>
      </div>

      <div className={cn(designerShellCardInset, 'mb-2 space-y-2')}>
        <div className="flex items-center justify-between gap-2">
          <p className={designerShellMicroLabel}>Épaisseur</p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSize(Math.max(1, size - 1))}
              className={cn(designerShellChipGhost, 'h-7 w-7 p-0')}
              aria-label="Réduire"
            >
              <Minus className="mx-auto h-3 w-3" />
            </button>
            <span className="w-5 text-center text-[10px] tabular-nums text-white/60">{size}</span>
            <button
              type="button"
              onClick={() => setSize(Math.min(24, size + 1))}
              className={cn(designerShellChipGhost, 'h-7 w-7 p-0')}
              aria-label="Augmenter"
            >
              <Plus className="mx-auto h-3 w-3" />
            </button>
          </div>
        </div>

        {tool === 'text' ? (
          <>
            <div className="rounded-md border border-white/[0.06] bg-black/25 p-2">
              <p className={cn(designerShellMicroLabel, 'mb-1.5 text-white/55')}>Compositeur (Architect)</p>
              <div className="mb-2 flex flex-wrap gap-1">
                {[
                  { id: 'title', label: 'Titre' },
                  { id: 'subtitle', label: 'Sous-titre' },
                  { id: 'body', label: 'Paragr.' },
                  { id: 'caption', label: 'Légende' },
                ].map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    title={`Preset ${label}`}
                    onClick={() => {
                      setTextPreset(id);
                      const base = WHITEBOARD_TEXT_PRESET_BASE[id];
                      if (base?.fontSize) setTextFontSize(base.fontSize);
                    }}
                    className={cn(
                      designerShellChipGhost,
                      'px-2 py-1 text-[8px] font-semibold',
                      textPreset === id && 'border-amber-500/45 bg-amber-500/12 text-amber-50',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  title="Gras"
                  onClick={() => setTextBold((b) => !b)}
                  className={cn(
                    designerShellChipGhost,
                    'h-8 w-8 p-0',
                    textBold && 'border-amber-500/40 bg-amber-500/10 text-amber-100',
                  )}
                >
                  <Bold className="mx-auto h-3.5 w-3.5" strokeWidth={2.2} />
                </button>
                <button
                  type="button"
                  title="Italique"
                  onClick={() => setTextItalic((b) => !b)}
                  className={cn(
                    designerShellChipGhost,
                    'h-8 w-8 p-0',
                    textItalic && 'border-amber-500/40 bg-amber-500/10 text-amber-100',
                  )}
                >
                  <Italic className="mx-auto h-3.5 w-3.5" strokeWidth={2.2} />
                </button>
                {[
                  { id: 'left', Icon: AlignLeft },
                  { id: 'center', Icon: AlignCenter },
                  { id: 'right', Icon: AlignRight },
                ].map(({ id, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    title={id === 'left' ? 'Gauche' : id === 'center' ? 'Centre' : 'Droite'}
                    onClick={() => setTextAlign(id)}
                    className={cn(
                      designerShellChipGhost,
                      'h-8 w-8 p-0',
                      textAlign === id && 'border-amber-500/40 bg-amber-500/10 text-amber-100',
                    )}
                  >
                    <Icon className="mx-auto h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[8px] leading-snug text-white/35">
                Clic droit sur un bloc : corriger, reformuler, traduire. Pop-up de saisie : mêmes outils + IA.
              </p>
            </div>
            <label className="flex flex-col gap-0.5">
              <span className={designerShellMicroLabel}>Taille du texte</span>
              <input
                type="range"
                min={12}
                max={56}
                value={textFontSize}
                onChange={(e) => setTextFontSize(Number(e.target.value))}
                className="w-full accent-amber-500/80"
              />
              <span className="text-[9px] tabular-nums text-white/40">{textFontSize}px</span>
            </label>
          </>
        ) : null}

        {shapeTool ? (
          <label className="flex cursor-pointer items-center justify-between gap-2 text-[10px] text-white/65">
            <span>Remplissage léger</span>
            <input
              type="checkbox"
              checked={shapeFill}
              onChange={(e) => setShapeFill(e.target.checked)}
              className="accent-amber-500/80"
            />
          </label>
        ) : null}
      </div>

      {!hideNeuroInk ? (
        <div className="mb-2">
          <NeuroInkPanel
            variant="rail"
            open={neuroInkOpen}
            onOpenChange={setNeuroInkOpen}
            neuroInk={neuroInk}
            setNeuroInk={setNeuroInk}
            footerHint="S'applique au crayon libre au relâchement du trait."
          />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => undoBoard()}
          className={cn(designerShellChipGhost, 'flex flex-1 items-center justify-center gap-1 py-1.5 min-w-[3.5rem] text-[9px]')}
          title="Annuler (Ctrl+Z)"
        >
          <Undo2 className="h-3 w-3 shrink-0" />
          Annuler
        </button>
        <button
          type="button"
          onClick={() => redoBoard?.()}
          className={cn(designerShellChipGhost, 'flex flex-1 items-center justify-center gap-1 py-1.5 min-w-[3.5rem] text-[9px]')}
          title="Rétablir (Ctrl+Y)"
        >
          <Redo2 className="h-3 w-3 shrink-0" />
          Rétablir
        </button>
        <button
          type="button"
          onClick={() => downloadBoard()}
          className={cn(designerShellChipGhost, 'h-8 w-8 shrink-0 p-0')}
          title="Télécharger PNG"
        >
          <Download className="mx-auto h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => clearBoard()}
          className={cn(designerShellChipGhost, 'h-8 w-8 shrink-0 border-amber-500/25 p-0 text-amber-300/80 hover:bg-amber-500/10')}
          title="Effacer tout"
        >
          <Trash2 className="mx-auto h-3.5 w-3.5" />
        </button>
      </div>
      </>)}
    </div>
  );
}

/** Invité : affiche uniquement la page tableau synchronisée (sans outils). */
export function LiveWhiteboardGuestPageIndicator({ className, pageIndex = 0, pageCount = 1 }) {
  const pc = Math.max(1, Math.floor(Number(pageCount) || 1));
  const piRaw = Math.floor(Number(pageIndex) || 0);
  const pi = Math.min(Math.max(0, piRaw), pc - 1);
  return (
    <div className={cn(className)} role="status" aria-live="polite">
      <p className={cn(RAIL_TITLE, 'mb-1.5')}>Tableau blanc</p>
      <div className={cn(designerShellCardInset, 'py-2')}>
        <p className={designerShellMicroLabel}>Suivi hôte</p>
        <p className="mt-1.5 text-center text-[12px] font-medium tabular-nums text-white/88">
          Écran {pi + 1} / {pc}
        </p>
        <p className="mt-1 px-0.5 text-center text-[8px] leading-snug text-white/40">
          L&apos;hôte fait défiler les écrans du tableau ; vous voyez la même page qu&apos;eux.
        </p>
      </div>
    </div>
  );
}
