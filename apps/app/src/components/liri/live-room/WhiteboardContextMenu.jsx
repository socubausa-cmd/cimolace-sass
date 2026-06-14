import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { designerShellMicroLabel } from '@/lib/liriDesignerShellClasses';
import { useLiveWhiteboardStore } from './useLiveWhiteboardStore';
import { invokeWhiteboardTextAi } from '@/lib/liriWhiteboardTextAi';
import { WHITEBOARD_TEXT_PRESET_BASE } from '@/lib/whiteboardTextCanvas';

const MENU_MAX_W = 240;

function MenuBtn({ children, disabled, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onClick?.();
      }}
      className={cn(
        'w-full rounded-md px-2.5 py-1.5 text-left text-[12px] transition-colors',
        disabled
          ? 'cursor-not-allowed text-white/28'
          : 'text-white/88 hover:bg-white/[0.08] active:bg-white/[0.12]',
      )}
    >
      {children}
    </button>
  );
}

function MenuSubLabel({ children }) {
  return <p className={cn(designerShellMicroLabel, 'mb-1 mt-2 px-2 text-white/45')}>{children}</p>;
}

/**
 * Menu contextuel tableau (clic droit) — outils sur le vide, actions type traitement de texte sur la sélection.
 */
export default function WhiteboardContextMenu({
  open,
  anchor,
  hitStrokeIndex,
  hitStrokeKind = null,
  hitTextContent = '',
  strokeCount = 0,
  readOnly,
  onClose,
  /** Zoom centré sur la sélection (logique canvas — passé par le parent). */
  onZoomToSelection,
  /** Remplace le texte d'un bloc `kind: text` (index dans la liste des traits). */
  onReplaceBoardText,
  /** Met à jour style / preset d'un bloc texte existant. */
  onUpdateBoardTextStyle,
}) {
  const ref = useRef(null);
  const [iaBusy, setIaBusy] = useState(null);
  const setTool = useLiveWhiteboardStore((s) => s.setTool);
  const setNeuroInkOpen = useLiveWhiteboardStore((s) => s.setNeuroInkOpen);
  const setBoardSelection = useLiveWhiteboardStore((s) => s.setBoardSelection);
  const boardSelection = useLiveWhiteboardStore((s) => s.boardSelection);
  const boardClipboard = useLiveWhiteboardStore((s) => s.boardClipboard);
  const copyBoardSelection = useLiveWhiteboardStore((s) => s.copyBoardSelection);
  const cutBoardSelection = useLiveWhiteboardStore((s) => s.cutBoardSelection);
  const pasteBoardClipboard = useLiveWhiteboardStore((s) => s.pasteBoardClipboard);
  const duplicateBoardSelection = useLiveWhiteboardStore((s) => s.duplicateBoardSelection);
  const deleteBoardSelection = useLiveWhiteboardStore((s) => s.deleteBoardSelection);
  const resetBoardView = useLiveWhiteboardStore((s) => s.resetBoardView);
  const setTextPreset = useLiveWhiteboardStore((s) => s.setTextPreset);
  const setTextFontSize = useLiveWhiteboardStore((s) => s.setTextFontSize);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (ev) => {
      if (ref.current?.contains(ev.target)) return;
      onClose?.();
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) setIaBusy(null);
  }, [open]);

  if (!open || readOnly || !anchor || typeof document === 'undefined') return null;

  const canPaste = Array.isArray(boardClipboard) && boardClipboard.length > 0;
  const hasSelection = boardSelection.length > 0;

  const left = Math.min(
    anchor.x,
    Math.max(8, (typeof window !== 'undefined' ? window.innerWidth : 999) - MENU_MAX_W - 8),
  );
  const top = Math.min(
    anchor.y,
    Math.max(8, (typeof window !== 'undefined' ? window.innerHeight : 999) - 420),
  );

  const onStrokeHit = hitStrokeIndex >= 0;
  const isTextHit = hitStrokeKind === 'text' && String(hitTextContent || '').trim().length > 0;

  const runTextAi = async (mode) => {
    if (!isTextHit || typeof onReplaceBoardText !== 'function') return;
    const raw = String(hitTextContent || '').trim();
    if (!raw) return;
    setIaBusy(mode);
    try {
      const next = await invokeWhiteboardTextAi(raw, mode, 'en');
      onReplaceBoardText(hitStrokeIndex, next);
      onClose?.();
    } catch (err) {
      window.alert(err?.message || 'IA indisponible');
    } finally {
      setIaBusy(null);
    }
  };

  return createPortal(
    <div
      ref={ref}
      role="menu"
      className="fixed z-[6100] min-w-[200px] max-w-[260px] rounded-xl border border-white/[0.1] bg-[#0c1018]/98 py-1.5 shadow-2xl shadow-black/55 ring-1 ring-white/[0.06] backdrop-blur-md"
      style={{ left, top }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {onStrokeHit ? (
        <>
          <MenuSubLabel>Élément</MenuSubLabel>
          <MenuBtn
            disabled={!hasSelection}
            onClick={() => {
              cutBoardSelection();
              onClose?.();
            }}
          >
            Couper
          </MenuBtn>
          <MenuBtn
            disabled={!hasSelection}
            onClick={() => {
              copyBoardSelection();
              onClose?.();
            }}
          >
            Copier
          </MenuBtn>
          <MenuBtn
            onClick={() => {
              pasteBoardClipboard();
              onClose?.();
            }}
          >
            Coller
          </MenuBtn>
          <MenuBtn
            disabled={!hasSelection}
            onClick={() => {
              duplicateBoardSelection();
              onClose?.();
            }}
          >
            Dupliquer
          </MenuBtn>
          <MenuBtn
            disabled={!hasSelection}
            onClick={() => {
              deleteBoardSelection();
              onClose?.();
            }}
          >
            Supprimer
          </MenuBtn>
          <p className="px-2.5 py-1 text-[11px] text-white/45">
            Groupage définitif : Ctrl+G (Ctrl+Shift+G pour dégrouper)
          </p>
        </>
      ) : null}

      {onStrokeHit && isTextHit ? (
        <>
          <MenuSubLabel>Compositeur (rapide)</MenuSubLabel>
          {[
            { id: 'title', label: 'Titre' },
            { id: 'subtitle', label: 'Sous-titre' },
            { id: 'body', label: 'Paragraphe' },
            { id: 'caption', label: 'Légende' },
          ].map(({ id, label }) => (
            <MenuBtn
              key={id}
              onClick={() => {
                const base = WHITEBOARD_TEXT_PRESET_BASE[id];
                setTextPreset(id);
                if (base?.fontSize) setTextFontSize(base.fontSize);
                if (typeof onUpdateBoardTextStyle === 'function') {
                  onUpdateBoardTextStyle(hitStrokeIndex, {
                    textPreset: id,
                    fontSize: base?.fontSize,
                  });
                }
                onClose?.();
              }}
            >
              Appliquer · {label}
            </MenuBtn>
          ))}
          <MenuSubLabel>IA sur ce texte</MenuSubLabel>
          <MenuBtn disabled={Boolean(iaBusy)} onClick={() => void runTextAi('fix')}>
            {iaBusy === 'fix' ? 'Correction…' : 'Corriger les fautes'}
          </MenuBtn>
          <MenuBtn disabled={Boolean(iaBusy)} onClick={() => void runTextAi('rephrase')}>
            {iaBusy === 'rephrase' ? 'Reformulation…' : 'Reformuler'}
          </MenuBtn>
          <MenuBtn disabled={Boolean(iaBusy)} onClick={() => void runTextAi('translate')}>
            {iaBusy === 'translate' ? 'Traduction…' : 'Traduire en anglais'}
          </MenuBtn>
        </>
      ) : null}

      {!onStrokeHit && hasSelection ? (
        <>
          <MenuSubLabel>Sélection</MenuSubLabel>
          <MenuBtn
            onClick={() => {
              cutBoardSelection();
              onClose?.();
            }}
          >
            Couper
          </MenuBtn>
          <MenuBtn
            onClick={() => {
              copyBoardSelection();
              onClose?.();
            }}
          >
            Copier
          </MenuBtn>
          <MenuBtn
            onClick={() => {
              deleteBoardSelection();
              onClose?.();
            }}
          >
            Supprimer
          </MenuBtn>
        </>
      ) : null}

      <MenuSubLabel>{onStrokeHit ? 'Outils' : 'Outils du tableau'}</MenuSubLabel>
      <MenuBtn
        onClick={() => {
          setTool('select');
          onClose?.();
        }}
      >
        Sélection
      </MenuBtn>
      <MenuBtn
        onClick={() => {
          setTool('marquee');
          onClose?.();
        }}
      >
        Zone de sélection
      </MenuBtn>
      <MenuBtn
        onClick={() => {
          setTool('hand');
          onClose?.();
        }}
      >
        Main (déplacer la vue)
      </MenuBtn>
      <MenuBtn
        onClick={() => {
          setTool('pencil');
          onClose?.();
        }}
      >
        Crayon
      </MenuBtn>
      <MenuBtn
        onClick={() => {
          setTool('eraser');
          onClose?.();
        }}
      >
        Gomme
      </MenuBtn>
      <MenuBtn
        onClick={() => {
          setTool('text');
          onClose?.();
        }}
      >
        Texte
      </MenuBtn>
      <MenuBtn
        onClick={() => {
          setTool('rect');
          onClose?.();
        }}
      >
        Rectangle
      </MenuBtn>
      <MenuBtn
        onClick={() => {
          setTool('circle');
          onClose?.();
        }}
      >
        Cercle
      </MenuBtn>
      <MenuBtn
        onClick={() => {
          setTool('line');
          onClose?.();
        }}
      >
        Ligne
      </MenuBtn>
      <MenuBtn
        onClick={() => {
          setTool('curve');
          onClose?.();
        }}
      >
        Courbe
      </MenuBtn>

      <MenuSubLabel>Vue</MenuSubLabel>
      <MenuBtn
        disabled={!hasSelection || typeof onZoomToSelection !== 'function'}
        onClick={() => {
          onZoomToSelection?.();
          onClose?.();
        }}
      >
        Zoom sur la sélection (Ctrl+1)
      </MenuBtn>
      <MenuBtn
        onClick={() => {
          resetBoardView();
          onClose?.();
        }}
      >
        Réinitialiser la vue
      </MenuBtn>

      <MenuSubLabel>Autres</MenuSubLabel>
      <MenuBtn
        onClick={() => {
          setNeuroInkOpen(true);
          onClose?.();
        }}
      >
        NeuroInk…
      </MenuBtn>
      {!onStrokeHit ? (
        <>
          <MenuBtn
            disabled={strokeCount <= 0}
            onClick={() => {
              setBoardSelection(
                Array.from({ length: strokeCount }, (_, i) => i),
              );
              onClose?.();
            }}
          >
            Tout sélectionner
          </MenuBtn>
          <MenuBtn
            disabled={!canPaste}
            onClick={() => {
              pasteBoardClipboard();
              onClose?.();
            }}
          >
            Coller
          </MenuBtn>
        </>
      ) : null}
    </div>,
    document.body,
  );
}
