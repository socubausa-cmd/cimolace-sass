/**
 * LONGIA Core — réponse unifiée (un seul message visible, actions / suggestions structurées).
 * Le serveur renvoie déjà `unified` + `primaryActions` / `secondarySuggestions` ; ce module
 * normalise les réponses API et le fallback local pour le store UI.
 */

/**
 * @param {Array<{ label: string, action: string, payload?: Record<string, unknown> }>} rows
 */
function dedupeChips(rows) {
  const seen = new Set();
  const out = [];
  for (const s of rows) {
    if (!s || typeof s.label !== 'string') continue;
    const k = `${s.label}\0${s.action || ''}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

/**
 * @param {Record<string, unknown>} composed — sortie Response Composer v1 (`data.composed`)
 * @param {Record<string, unknown>|null|undefined} data
 * @param {string} [textOverride]
 */
export function mergeFromComposedV1(composed, data, textOverride) {
  const text = String(textOverride ?? composed?.message ?? data?.text ?? '').trim();
  const actionsRaw = Array.isArray(composed?.actions) ? composed.actions : [];
  const suggRaw = Array.isArray(composed?.suggestions) ? composed.suggestions : [];

  const actionChips = actionsRaw.map((a) => {
    const pl = {};
    if (a.payload && typeof a.payload === 'object') Object.assign(pl, a.payload);
    if (a.variant) pl.variant = a.variant;
    if (a.id) pl.composed_id = a.id;
    return {
      label: a.label,
      action: a.action,
      payload: Object.keys(pl).length ? pl : undefined,
    };
  });

  const suggChips = suggRaw.map((s) => {
    const pl = { ...(s.payload && typeof s.payload === 'object' ? s.payload : {}) };
    if (s.description) pl.description = s.description;
    if (s.why) pl.why = s.why;
    if (s.id) pl.composed_id = s.id;
    return {
      label: s.label,
      action: s.action,
      payload: Object.keys(pl).length ? pl : undefined,
    };
  });

  const merged = dedupeChips([...actionChips, ...suggChips]);
  const longiaUnified = {
    message: text,
    understanding:
      composed?.understanding && typeof composed.understanding === 'object' ? composed.understanding : null,
    actions: actionChips,
    suggestions: suggChips,
    preview: composed?.preview ?? null,
    explanations: composed?.explanations ?? null,
    composedV1: composed,
  };

  return {
    text,
    suggestions: merged,
    longiaUnified,
    longiaComposed: composed,
    intent: data?.intent ?? null,
    strategy: composed?.strategy ?? data?.strategy ?? null,
    payload: data?.payload ?? null,
    tone_mode: composed?.tone_mode ?? data?.tone_mode ?? null,
  };
}

/**
 * @param {Record<string, unknown>|null|undefined} data — corps JSON studio-longia-chat
 * @param {string} [textOverride] — texte affiché final (après fallback local)
 */
export function mergeApiLongiaForStore(data, textOverride) {
  const composed = data?.composed && typeof data.composed === 'object' ? data.composed : null;
  if (composed) {
    return mergeFromComposedV1(composed, data, textOverride);
  }

  const text = String(textOverride ?? data?.text ?? '').trim();
  const primary = Array.isArray(data?.primaryActions)
    ? data.primaryActions
    : Array.isArray(data?.actions)
      ? data.actions
      : [];
  const secondary = Array.isArray(data?.secondarySuggestions) ? data.secondarySuggestions : [];
  const merged =
    Array.isArray(data?.suggestions) && data.suggestions.length
      ? data.suggestions
      : dedupeChips([...primary, ...secondary]);

  let longiaUnified = null;
  if (data?.unified && typeof data.unified === 'object') {
    const u = /** @type {Record<string, unknown>} */ (data.unified);
    longiaUnified = {
      message: typeof u.message === 'string' && u.message.trim() ? u.message.trim() : text,
      understanding:
        u.understanding && typeof u.understanding === 'object' ? u.understanding : null,
      actions:
        Array.isArray(u.actions) && u.actions.length ? u.actions : primary,
      suggestions:
        Array.isArray(u.suggestions) && u.suggestions.length ? u.suggestions : secondary,
      preview: typeof u.preview === 'string' && u.preview.trim() ? u.preview.trim() : null,
      explanations: normalizeExplanationsField(u.explanations),
    };
  } else {
    longiaUnified = {
      message: text,
      understanding: data?.intent && typeof data.intent === 'object' ? { intent: data.intent } : null,
      actions: primary,
      suggestions: secondary,
      preview: null,
      explanations: null,
    };
  }

  return {
    text,
    suggestions: merged,
    longiaUnified,
    longiaComposed: null,
    intent: data?.intent ?? null,
    strategy: data?.strategy ?? null,
    payload: data?.payload ?? null,
    tone_mode: data?.tone_mode ?? null,
  };
}

/** @param {unknown} v */
function normalizeExplanationsField(v) {
  if (v == null) return null;
  if (typeof v === 'string') {
    const t = v.trim();
    return t || null;
  }
  if (Array.isArray(v)) {
    const lines = v.filter((x) => typeof x === 'string' && x.trim());
    return lines.length ? lines : null;
  }
  return null;
}

/**
 * @param {{ text: string; suggestions?: unknown[]; intent?: Record<string, unknown>; strategy?: string; payload?: Record<string, unknown> }} localRich
 */
export function enrichLocalLongiaForStore(localRich) {
  const actions = Array.isArray(localRich.suggestions) ? localRich.suggestions : [];
  const text = String(localRich.text ?? '').trim();
  const composed = {
    longia_response_composer: { id: 'longia_response_composer_v1', enabled: true },
    response_id: `lr_local_${Date.now()}`,
    tone_mode: 'coach',
    message: text,
    understanding:
      localRich.intent && typeof localRich.intent === 'object'
        ? { ...localRich.intent }
        : { task: 'chat' },
    strategy: localRich.strategy || 'local_fallback',
    actions: actions.map((s, i) => ({
      id: `a_${i + 1}`,
      label: s.label,
      action: s.action,
      payload: s.payload,
      variant: 'primary',
    })),
    suggestions: [],
    preview: null,
    explanations: [],
    render_hints: {
      open_tab: actions.length ? 'actions' : 'suggestions',
      show_overlay: false,
      show_preview_panel: false,
      highlight_selection: false,
    },
  };
  return {
    text,
    suggestions: actions,
    longiaUnified: {
      message: text,
      understanding: composed.understanding,
      actions,
      suggestions: [],
      preview: null,
      explanations: null,
      composedV1: composed,
    },
    longiaComposed: composed,
    intent: localRich.intent ?? null,
    strategy: localRich.strategy ?? null,
    payload: localRich.payload ?? null,
    tone_mode: 'coach',
  };
}
