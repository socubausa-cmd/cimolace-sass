/**
 * LONGIA AI Hub — accès au JSON UI canonique + helpers runtime (onglets, shell, statut, contexte).
 * Source : src/data/aiHubLongiaUiCanon.json
 */
import aiHubLongiaUiCanon from '@/data/aiHubLongiaUiCanon.json';

/** @typedef {{ id: string; label: string; icon?: string; default?: boolean }} CanonTabItem */

const UI = aiHubLongiaUiCanon.ai_hub_ui;

/** Onglets canoniques → clés d’état React existantes dans StudioSmartboardKonvaPage. */
export const LONGIA_HUB_TAB_STATE_BY_CANON_ID = {
  suggestions: 'suggest',
  actions: 'action',
  tutorial: 'tutoriel',
  architect: 'architect',
  history: 'history',
};

/** @returns {typeof UI} */
export function getLongiaHubUiCanon() {
  return UI;
}

export function getLongiaHubPanelWidthPx() {
  const w = UI?.shell?.right_panel?.default_width;
  return typeof w === 'number' && w > 0 ? w : 380;
}

export function getLongiaHubPanelShellStyle() {
  const rp = UI?.shell?.right_panel ?? {};
  const width = typeof rp.default_width === 'number' ? rp.default_width : 380;
  const minWidth = typeof rp.min_width === 'number' ? rp.min_width : 320;
  const maxWidth = typeof rp.max_width === 'number' ? rp.max_width : 520;
  return {
    width,
    minWidth,
    maxWidth,
  };
}

export function getBottomBarShell() {
  return UI?.shell?.bottom_bar ?? {};
}

export function getBottomBarPlaceholder() {
  const p = UI?.shell?.bottom_bar?.input_placeholder;
  return typeof p === 'string' && p.trim() ? p.trim() : 'Écris à LONGIA…';
}

export function getBottomBarHeightPx() {
  const h = UI?.shell?.bottom_bar?.height;
  return typeof h === 'number' && h > 0 ? h : 64;
}

/**
 * Onglets pour le rendu : conserve `stateTabId` pour le state React.
 * @returns {Array<{ stateTabId: string; label: string; icon?: string; canonId: string; isDefault?: boolean }>}
 */
export function getLongiaHubTabsForRender() {
  const items = /** @type {CanonTabItem[]} */ (UI?.tabs?.items ?? []);
  return items
    .map((item) => {
      const canonId = item.id;
      const stateTabId = LONGIA_HUB_TAB_STATE_BY_CANON_ID[canonId] ?? canonId;
      return {
        stateTabId,
        canonId,
        label: item.label ?? stateTabId,
        icon: item.icon,
        isDefault: Boolean(item.default),
      };
    })
    .filter((t) => t.stateTabId);
}

export function getLongiaHubDefaultTabStateId() {
  const tabs = getLongiaHubTabsForRender();
  const def = tabs.find((t) => t.isDefault);
  return def?.stateTabId ?? 'suggest';
}

/**
 * @param {{ docType?: string|null; designerMode?: string; quickModeId?: string; selectionCount?: number; selectedTypes?: string[] }} ctx
 */
export function buildLongiaContextLine(ctx) {
  const tpl = UI?.header?.context_line?.template;
  if (typeof tpl !== 'string' || !tpl.includes('{{')) {
    return '';
  }
  const projectType = ctx.docType ? String(ctx.docType) : 'projet';
  const selection_type = formatSelectionType(ctx.selectionCount ?? 0, ctx.selectedTypes ?? []);
  const quick_mode = ctx.quickModeId ? String(ctx.quickModeId) : '—';
  return tpl
    .replace(/\{\{project_type\}\}/g, projectType)
    .replace(/\{\{selection_type\}\}/g, selection_type)
    .replace(/\{\{quick_mode\}\}/g, quick_mode)
    .replace(/\{\{designer_mode\}\}/g, ctx.designerMode ? String(ctx.designerMode) : '—');
}

function formatSelectionType(count, types) {
  if (count <= 0) return 'aucune sélection';
  if (count > 1) return 'multi-sélection';
  const t = types[0];
  if (!t) return '1 élément';
  if (t === 'text') return 'texte';
  if (t === 'image' || t === 'html') return t;
  if (['rect', 'circle', 'ellipse', 'triangle', 'line', 'arrow', 'starshape', 'diamond'].includes(t)) return 'forme';
  return t;
}

/**
 * @param {{ quickModeId?: string; isSending?: boolean }} opts
 */
export function resolveLongiaHeaderStatus(opts) {
  const values = UI?.header?.status_badge?.values;
  const list = Array.isArray(values) ? values : [];
  const idle = list[0] ?? 'En écoute';
  const coach = list[1] ?? 'Coach actif';
  const architect = list[2] ?? 'Architect actif';
  const analyzing = list[3] ?? 'Analyse la scène';
  const ready = list[4] ?? 'Prêt à agir';

  if (opts.isSending) return analyzing;

  const q = opts.quickModeId ?? '';
  if (q === 'architect') return architect;
  if (q === 'analyse') return list[3] ?? analyzing;
  if (q === 'vision' || q === 'audio') return coach;
  return idle;
}

export function getLongiaMessageEmptyState() {
  const es = UI?.message_area?.empty_state;
  return {
    title: es?.title ?? 'Bonjour 👋',
    message: es?.message ?? '',
    actions: Array.isArray(es?.actions) ? es.actions : [],
  };
}

export function getLongiaAnalyzingLabel() {
  return UI?.states?.analyzing?.loader_label ?? 'LONGIA réfléchit…';
}

export function getLongiaActionStripMaxPrimary() {
  const n = UI?.action_strip?.max_primary_actions;
  return typeof n === 'number' && n > 0 ? n : 4;
}
