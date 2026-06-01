/**
 * LONGIA Response Composer v1 — fusion déterministe (sans LLM) des sorties
 * (enveloppe modèle + orchestration) en une seule réponse produit alignée schéma `longia_response_composer`.
 */
import type { LongiaClientMode } from './longiaIntentRouter.ts';
import type { LongiaOrchestrationResult } from './longiaCoreOrchestrator.ts';

type Chip = { label: string; action: string; payload?: Record<string, unknown> };

const MAX_PRIMARY_ACTIONS = 4;
const MAX_SUGGESTION_ROWS = 5;

const TONE_MODES = new Set([
  'human',
  'coach',
  'architect',
  'action_contextual',
  'vision',
  'writing',
  'fallback',
]);

function chipDedupeKey(c: Chip): string {
  let p = '';
  try {
    p = c.payload && Object.keys(c.payload).length ? JSON.stringify(c.payload) : '';
  } catch {
    p = '';
  }
  return `${c.label}\0${c.action}\0${p}`;
}

function dedupeChips(list: Chip[]): Chip[] {
  const seen = new Set<string>();
  const out: Chip[] = [];
  for (const c of list) {
    const k = chipDedupeKey(c);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}

function asChipArray(v: unknown): Chip[] {
  if (!Array.isArray(v)) return [];
  const out: Chip[] = [];
  for (const x of v) {
    if (!x || typeof x !== 'object') continue;
    const o = x as { label?: unknown; action?: unknown; payload?: unknown };
    const label = typeof o.label === 'string' ? o.label.trim() : '';
    const action = typeof o.action === 'string' ? o.action.trim() : '';
    if (!label || !action) continue;
    if (o.payload && typeof o.payload === 'object') {
      out.push({ label, action, payload: { ...(o.payload as Record<string, unknown>) } });
    } else {
      out.push({ label, action });
    }
  }
  return out;
}

function resolveComposedToneMode(
  bodyTone: string | null | undefined,
  ir: Record<string, unknown> | null,
  effectiveMode: LongiaClientMode,
): string {
  if (bodyTone && TONE_MODES.has(bodyTone)) return bodyTone;
  const intent = ir && typeof ir.intent === 'string' ? ir.intent.toLowerCase() : '';
  if (intent === 'chat') return 'human';
  if (intent === 'create' || intent === 'document') return 'architect';
  if (intent === 'action' || intent === 'design') return 'action_contextual';
  if (intent === 'analyze') return 'coach';
  if (intent === 'writing') return 'writing';
  return effectiveMode === 'architect' ? 'architect' : 'coach';
}

function mergeUnderstanding(
  unified: Record<string, unknown> | undefined,
  orch: LongiaOrchestrationResult,
): Record<string, unknown> {
  const base =
    unified?.understanding && typeof unified.understanding === 'object' && unified.understanding
      ? { ...(unified.understanding as Record<string, unknown>) }
      : {};
  const ir = orch.intentResolution;
  const ca = orch.contextAnalysis;
  if (ir?.intent != null) base.intent = String(ir.intent);
  if (ir?.confidence != null && !Number.isNaN(Number(ir.confidence))) {
    base.confidence = Number(ir.confidence);
  }
  if (ir?.target != null) base.target = String(ir.target);
  if (ir?.task != null) base.task = String(ir.task);
  if (base.project_type == null && ca.designerMode) base.project_type = ca.designerMode;
  if (base.selection_type == null) {
    base.selection_type = ca.selectionCount > 0 ? 'active' : 'none';
  }
  const pro = orch.longiaProDeterministic;
  if (pro && typeof pro === 'object') {
    const u = (pro as { understanding?: Record<string, unknown> }).understanding;
    if (u && typeof u === 'object' && u.intent != null && base.longia_pro_intent == null) {
      base.longia_pro_intent = String(u.intent);
    }
    if (u && typeof u === 'object' && typeof u.confidence === 'number' && base.longia_pro_confidence == null) {
      base.longia_pro_confidence = u.confidence;
    }
  }
  return base;
}

function normalizeExplanationsToSchema(
  exp: unknown,
): Array<{ label: string; content: string }> {
  if (exp == null) return [];
  if (Array.isArray(exp)) {
    const out: Array<{ label: string; content: string }> = [];
    let i = 0;
    for (const item of exp) {
      if (item && typeof item === 'object' && 'content' in item) {
        const o = item as { label?: unknown; content?: unknown };
        const content = typeof o.content === 'string' ? o.content.trim() : '';
        if (!content) continue;
        const label = typeof o.label === 'string' && o.label.trim() ? o.label.trim() : `Détail ${i + 1}`;
        out.push({ label, content });
        i++;
      } else if (typeof item === 'string' && item.trim()) {
        out.push({ label: `Point ${i + 1}`, content: item.trim() });
        i++;
      }
    }
    return out;
  }
  if (typeof exp === 'string' && exp.trim()) {
    return [{ label: 'Détail', content: exp.trim() }];
  }
  return [];
}

function buildPreviewObject(unified: Record<string, unknown> | undefined): Record<string, unknown> | null {
  const p = unified?.preview;
  if (p && typeof p === 'object' && !Array.isArray(p)) return p as Record<string, unknown>;
  if (typeof p === 'string' && p.trim()) {
    return { type: 'text_preview', text: p.trim() };
  }
  return null;
}

function buildRenderHints(params: {
  toneMode: string;
  selectionCount: number;
  hasPreview: boolean;
  primaryCount: number;
}): Record<string, unknown> {
  const { toneMode, selectionCount, hasPreview, primaryCount } = params;
  let open_tab: string = 'suggestions';
  if (primaryCount > 0) open_tab = 'actions';
  if (toneMode === 'architect') open_tab = 'architect';
  return {
    open_tab,
    show_overlay: toneMode === 'action_contextual' && selectionCount > 0,
    show_preview_panel: hasPreview,
    highlight_selection: selectionCount > 0 && toneMode === 'action_contextual',
  };
}

/**
 * Produit l’objet `composed` ajouté à la réponse HTTP studio-longia-chat.
 */
export function composeLongiaPublishedResponseV1(params: {
  body: Record<string, unknown>;
  orchestration: LongiaOrchestrationResult;
  effectiveMode: LongiaClientMode;
}): Record<string, unknown> {
  const { body, orchestration, effectiveMode } = params;
  const text = String(body.text ?? '').trim();
  const unified = body.unified && typeof body.unified === 'object' ? (body.unified as Record<string, unknown>) : undefined;

  const primaryRaw = dedupeChips([
    ...asChipArray(body.primaryActions),
    ...asChipArray(unified?.actions),
  ]);
  const secondaryRaw = dedupeChips([
    ...asChipArray(body.secondarySuggestions),
    ...asChipArray(unified?.suggestions),
  ]);

  const primaryTaken = primaryRaw.slice(0, MAX_PRIMARY_ACTIONS);
  const primaryOverflow = primaryRaw.slice(MAX_PRIMARY_ACTIONS);
  const primaryKeys = new Set(primaryTaken.map(chipDedupeKey));
  const mergedSecondary = dedupeChips([...primaryOverflow, ...secondaryRaw]).filter(
    (c) => !primaryKeys.has(chipDedupeKey(c)),
  );
  const suggestionPool = mergedSecondary.slice(0, MAX_SUGGESTION_ROWS);

  const actionsOut = primaryTaken.map((a, i) => {
    const row: Record<string, unknown> = {
      id: `a_${i + 1}`,
      label: a.label,
      action: a.action,
      variant: 'primary',
    };
    if (a.payload && Object.keys(a.payload).length) row.payload = a.payload;
    return row;
  });

  const suggestionsOut = suggestionPool.map((s, i) => {
    const pl = s.payload && typeof s.payload === 'object' ? { ...s.payload } : {};
    const description = typeof pl.description === 'string' ? pl.description : '';
    const why = typeof pl.why === 'string' ? pl.why : '';
    delete pl.description;
    delete pl.why;
    const row: Record<string, unknown> = {
      id: `s_${i + 1}`,
      label: s.label,
      description: description || '',
      why: why || '',
      action: s.action,
    };
    if (Object.keys(pl).length) row.payload = pl;
    return row;
  });

  const tone_mode = resolveComposedToneMode(
    typeof body.tone_mode === 'string' ? body.tone_mode : null,
    orchestration.intentResolution,
    effectiveMode,
  );
  const strategy =
    typeof body.strategy === 'string' && body.strategy.trim()
      ? body.strategy.trim()
      : 'longia_compose_v1';

  const understanding = mergeUnderstanding(unified, orchestration);
  const previewObj = buildPreviewObject(unified);
  const explanationsUnified = normalizeExplanationsToSchema(unified?.explanations);

  const render_hints = buildRenderHints({
    toneMode: tone_mode,
    selectionCount: orchestration.contextAnalysis.selectionCount,
    hasPreview: previewObj != null,
    primaryCount: actionsOut.length,
  });

  return {
    longia_response_composer: {
      id: 'longia_response_composer_v1',
      enabled: true,
    },
    response_id: `lr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    tone_mode,
    message: text,
    understanding,
    strategy,
    actions: actionsOut,
    suggestions: suggestionsOut,
    preview: previewObj,
    explanations: explanationsUnified,
    render_hints,
  };
}
