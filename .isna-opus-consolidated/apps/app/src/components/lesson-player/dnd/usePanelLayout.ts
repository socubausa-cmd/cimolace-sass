import { useCallback, useState } from 'react';

export type SlotId = 'main' | 'side1' | 'side2' | 'side3' | 'side4';
export type PanelId = 'mindmap' | 'summary' | 'keypoints' | 'explanation' | 'visuals';

export type PanelSlots = Record<SlotId, string>;
export type PanelCollapsed = Record<string, boolean>;

export interface PanelLayoutState {
  slots: PanelSlots;
  collapsed: PanelCollapsed;
}

export const SLOT_IDS: SlotId[] = ['main', 'side1', 'side2', 'side3', 'side4'];

export const DEFAULT_SLOTS: PanelSlots = {
  main: 'mindmap',
  side1: 'summary',
  side2: 'keypoints',
  side3: 'explanation',
  side4: 'visuals',
};

const DEFAULT_COLLAPSED: PanelCollapsed = {
  mindmap: false,
  summary: false,
  keypoints: false,
  explanation: false,
  visuals: false,
};

function readStorage(key: string, defaultSlots: PanelSlots): PanelLayoutState {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PanelLayoutState>;
      const slotsOk = parsed.slots && SLOT_IDS.every((s) => typeof (parsed.slots as PanelSlots)[s] === 'string');
      const slots: PanelSlots = slotsOk ? (parsed.slots as PanelSlots) : defaultSlots;
      const collapsed: PanelCollapsed = parsed.collapsed && typeof parsed.collapsed === 'object'
        ? { ...DEFAULT_COLLAPSED, ...parsed.collapsed }
        : { ...DEFAULT_COLLAPSED };
      return { slots, collapsed };
    }
  } catch (_) { /* ignore */ }
  return { slots: defaultSlots, collapsed: { ...DEFAULT_COLLAPSED } };
}

function writeStorage(key: string, state: PanelLayoutState) {
  try { localStorage.setItem(key, JSON.stringify(state)); } catch (_) { /* ignore */ }
}

export function usePanelLayout(
  storageKey = 'mindmap-panel-layout',
  initialSlots?: Partial<PanelSlots>,
) {
  const baseSlots: PanelSlots = { ...DEFAULT_SLOTS, ...initialSlots };

  const [state, setState] = useState<PanelLayoutState>(() => readStorage(storageKey, baseSlots));

  // ── Slot operations ──────────────────────────────────────────────────────────

  const swapPanels = useCallback(
    (sourceSlotId: SlotId, targetSlotId: SlotId) => {
      setState((prev) => {
        if (sourceSlotId === targetSlotId) return prev;
        const slots = { ...prev.slots };
        const temp = slots[sourceSlotId];
        slots[sourceSlotId] = slots[targetSlotId];
        slots[targetSlotId] = temp;
        const next: PanelLayoutState = { ...prev, slots };
        writeStorage(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  const promoteToMain = useCallback(
    (slotId: SlotId) => {
      setState((prev) => {
        if (slotId === 'main') return prev;
        const slots = { ...prev.slots, main: prev.slots[slotId], [slotId]: prev.slots.main };
        const next: PanelLayoutState = { ...prev, slots };
        writeStorage(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  // ── Collapsed operations ─────────────────────────────────────────────────────

  const toggleCollapsed = useCallback(
    (panelId: string) => {
      setState((prev) => {
        const collapsed = { ...prev.collapsed, [panelId]: !prev.collapsed[panelId] };
        const next: PanelLayoutState = { ...prev, collapsed };
        writeStorage(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  // ── Reset ────────────────────────────────────────────────────────────────────

  const resetLayout = useCallback(() => {
    const next: PanelLayoutState = { slots: baseSlots, collapsed: { ...DEFAULT_COLLAPSED } };
    setState(next);
    writeStorage(storageKey, next);
  }, [storageKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    slots: state.slots,
    collapsed: state.collapsed,
    swapPanels,
    promoteToMain,
    toggleCollapsed,
    resetLayout,
  };
}
