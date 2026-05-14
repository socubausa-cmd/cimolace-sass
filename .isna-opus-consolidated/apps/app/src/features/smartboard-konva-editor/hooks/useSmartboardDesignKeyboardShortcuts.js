import { useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { useSmartboardKonvaStore } from '../store/useSmartboardKonvaStore';

/** @param {(opts: object) => void} toast — `useToast().toast` */
export function applyWorkbenchInteractionTool(toolId, toast) {
  if (toolId === 'crop-image') {
    const st = useSmartboardKonvaStore.getState();
    const id = st.selectedIds.length === 1 ? st.selectedIds[0] : null;
    const o = id ? st.getActiveScene()?.objects?.find((x) => x.id === id) : null;
    if (!o || o.type !== 'image') {
      toast({
        variant: 'destructive',
        title: 'Recadrage',
        description: 'Sélectionnez une seule image sur le canvas.',
      });
      return;
    }
  }
  useSmartboardKonvaStore.getState().setInteractionTool(toolId);
}

function isEditableFocusTarget(target) {
  const el = target instanceof Element ? target : null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  if (el.closest('[contenteditable="true"]')) return true;
  if (el.closest('[role="textbox"]')) return true;
  return false;
}

const KEY_CHAR_TO_TOOL = {
  1: 'pointer',
  2: 'marquee-rect',
  3: 'marquee-ellipse',
  4: 'marquee-lasso',
  5: 'crop-image',
};

/**
 * Raccourcis canvas : alignements (Ctrl/Cmd+Shift…), optionnellement touches 1–5 (plan Studio).
 * Annuler / refaire : déjà gérés dans `SmartboardKonvaEditorV1` (évite double exécution).
 */
export function useSmartboardDesignKeyboardShortcuts({ enableToolDigitShortcuts = false } = {}) {
  const { toast } = useToast();
  const alignSelected = useSmartboardKonvaStore((s) => s.alignSelected);
  const alignSelectedCenterBoth = useSmartboardKonvaStore((s) => s.alignSelectedCenterBoth);

  useEffect(() => {
    if (!enableToolDigitShortcuts) return undefined;
    const onKeyDown = (e) => {
      if (e.defaultPrevented) return;
      if (e.repeat) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditableFocusTarget(e.target)) return;
      const toolId = KEY_CHAR_TO_TOOL[e.key];
      if (!toolId) return;
      e.preventDefault();
      applyWorkbenchInteractionTool(toolId, toast);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enableToolDigitShortcuts, toast]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.defaultPrevented) return;
      if (isEditableFocusTarget(e.target)) return;

      const mod = e.metaKey || e.ctrlKey;
      const low = e.key.toLowerCase();

      const arrowToDir = {
        ArrowLeft: 'left',
        ArrowRight: 'right',
        ArrowUp: 'top',
        ArrowDown: 'bottom',
      };

      if (mod && e.shiftKey && arrowToDir[e.key]) {
        const { selectedIds } = useSmartboardKonvaStore.getState();
        if (!selectedIds.length) return;
        e.preventDefault();
        alignSelected(arrowToDir[e.key], { forceCanvas: e.altKey });
        return;
      }

      if (mod && e.shiftKey && !e.altKey) {
        if (e.code === 'BracketLeft') {
          const { selectedIds } = useSmartboardKonvaStore.getState();
          if (!selectedIds.length) return;
          e.preventDefault();
          alignSelected('centerV');
          return;
        }
        if (e.code === 'BracketRight') {
          const { selectedIds } = useSmartboardKonvaStore.getState();
          if (!selectedIds.length) return;
          e.preventDefault();
          alignSelected('centerH');
          return;
        }
        if (low === 'g') {
          const { selectedIds } = useSmartboardKonvaStore.getState();
          if (!selectedIds.length) return;
          e.preventDefault();
          alignSelectedCenterBoth();
          return;
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [alignSelected, alignSelectedCenterBoth]);
}
