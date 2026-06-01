export const LONGIA_ENVELOPE_MARK = '<<<LONGIA_ENVELOPE>>>';

export function parseLongiaAssistantRaw(raw: string): {
  displayText: string;
  envelope: Record<string, unknown> | null;
} {
  const s = String(raw ?? '');
  const idx = s.lastIndexOf(LONGIA_ENVELOPE_MARK);
  if (idx === -1) {
    return { displayText: s.trim(), envelope: null };
  }
  const displayText = s.slice(0, idx).trim();
  const jsonPart = s.slice(idx + LONGIA_ENVELOPE_MARK.length).trim();
  try {
    const envelope = JSON.parse(jsonPart) as Record<string, unknown>;
    return { displayText, envelope };
  } catch {
    return { displayText, envelope: null };
  }
}

export function longiaEnvelopeSystemAddition(): string {
  return `

## Enveloppe LONGIA (obligatoire après chaque réponse)

Après ton **texte visible** (français, ton **humain** et naturel ; 1 à 12 phrases selon le besoin ; **jamais** une première phrase qui n’est qu’un **diagnostic technique** de scène si l’utilisateur salue ou parle normalement) :

1. Une ligne contenant **exactement** : ${LONGIA_ENVELOPE_MARK}
2. Puis **un seul objet JSON** valide avec les clés **optionnelles** suivantes :

- **tone_mode** : "human" | "coach" | "architect" | "action_contextual" | "vision" | "writing" | "fallback" — pour salutations / conversation normale, utilise **"human"**.
- **intent** : { "project_type"?, "document_type"?, "subtype"?, "task"? } (task ex. chat, write, design, layout, analyze, import_rebuild)
- **strategy** : string court (ex. exact_match, nearest_template, generative_scratch, infer_intent)
- **message** : string optionnel (répète le cœur du message si tu veux ; sinon le texte au-dessus du marqueur suffit)
- **understanding** : objet court (ex. { "selection", "tool", "task" }) — ce que tu as compris du contexte, **sans** parler d’« agents » internes
- **actions** : boutons **principaux** (exécution / priorité) — { "label": string, "action": string, "payload"?: object }
- **suggestions** : compléments / pistes secondaires — { "label": string, "action": string, "description"?, "why"?, "payload"? }
- **preview** : string courte optionnelle (aperçu ou résumé d’étape)
- **explanations** : string ou tableau de strings optionnel (détails en repli UI)
- **payload** : objet libre (ex. recommended_template_family, required_fields, seedText)

**Règle LONGIA Core** : une seule voix — le **texte humain** au-dessus du marqueur vient **en premier** pour l’utilisateur ; puis ce JSON **complète** avec \`actions\` (priorité exécution) et \`suggestions\` (pistes secondaires). Pour salutations / small talk, tableaux **vides** ou **très courts** sont acceptables. Pour une demande **création / outil**, privilégie des \`action\` explicites (ex. generate_document, start_guided_flow, use_architect_mode, nearest_templates, duplicate_selection) — sans en faire le **substitut** d’une réponse conversationnelle quand l’utilisateur est relationnel.

Pour **generate_document** / **start_guided_flow**, mets si utile \`payload.seedText\` = résumé court de la demande utilisateur.

**Ne pas** remplir l’enveloppe avec des refus secs : même en incertitude, propose des actions exploratoires.
`;
}

type Suggestion = {
  label: string;
  action: string;
  payload?: Record<string, unknown>;
};

function asRecordArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function normalizeOneRow(x: unknown, source: 'action' | 'suggestion'): Suggestion | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as { label?: unknown; action?: unknown; payload?: unknown; description?: unknown; why?: unknown };
  const label = typeof o.label === 'string' ? o.label.trim() : '';
  let action = typeof o.action === 'string' ? o.action.trim() : '';
  if (!label) return null;
  if (!action) {
    if (source === 'suggestion') action = 'nearest_templates';
    else return null;
  }
  const payload: Record<string, unknown> = {};
  if (o.payload && typeof o.payload === 'object') {
    Object.assign(payload, o.payload as Record<string, unknown>);
  }
  if (typeof o.description === 'string' && o.description.trim()) {
    payload.description = o.description.trim();
  }
  if (typeof o.why === 'string' && o.why.trim()) {
    payload.why = o.why.trim();
  }
  if (Object.keys(payload).length === 0) {
    return { label, action };
  }
  return { label, action, payload };
}

function dedupeSuggestions(list: Suggestion[]): Suggestion[] {
  const seen = new Set<string>();
  const out: Suggestion[] = [];
  for (const s of list) {
    const k = `${s.label}\0${s.action}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

/** Boutons principaux uniquement (enveloppe.actions). */
export function normalizeLongiaPrimaryActions(envelope: Record<string, unknown> | null): Suggestion[] {
  if (!envelope) return [];
  const out: Suggestion[] = [];
  for (const x of asRecordArray(envelope.actions)) {
    const s = normalizeOneRow(x, 'action');
    if (s) out.push(s);
  }
  return out;
}

/** Suggestions secondaires uniquement (enveloppe.suggestions). */
export function normalizeLongiaSecondarySuggestions(envelope: Record<string, unknown> | null): Suggestion[] {
  if (!envelope) return [];
  const out: Suggestion[] = [];
  for (const x of asRecordArray(envelope.suggestions)) {
    const s = normalizeOneRow(x, 'suggestion');
    if (s) out.push(s);
  }
  return out;
}

/** Compat : actions puis suggestions, dédupliqués (strip dock / anciens clients). */
export function normalizeLongiaSuggestions(envelope: Record<string, unknown> | null): Suggestion[] {
  return dedupeSuggestions([
    ...normalizeLongiaPrimaryActions(envelope),
    ...normalizeLongiaSecondarySuggestions(envelope),
  ]);
}

function pickUnderstanding(
  envelope: Record<string, unknown> | null,
  intent: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (envelope && typeof envelope.understanding === 'object' && envelope.understanding) {
    return envelope.understanding as Record<string, unknown>;
  }
  if (intent && Object.keys(intent).length) {
    return { intent };
  }
  return null;
}

function pickPreview(envelope: Record<string, unknown> | null): string | null {
  if (!envelope || typeof envelope.preview !== 'string') return null;
  const t = envelope.preview.trim();
  return t || null;
}

function pickExplanations(envelope: Record<string, unknown> | null): string | string[] | null {
  if (!envelope || envelope.explanations === undefined || envelope.explanations === null) return null;
  if (typeof envelope.explanations === 'string') {
    const t = envelope.explanations.trim();
    return t || null;
  }
  if (Array.isArray(envelope.explanations)) {
    const lines = envelope.explanations.filter((x): x is string => typeof x === 'string' && x.trim());
    return lines.length ? lines : null;
  }
  return null;
}

export function buildLongiaJsonBody(params: { rawAssistant: string; provider: string; mode: string }) {
  const { displayText, envelope } = parseLongiaAssistantRaw(params.rawAssistant);
  const primaryActions = normalizeLongiaPrimaryActions(envelope);
  const secondarySuggestions = normalizeLongiaSecondarySuggestions(envelope);
  const suggestions = dedupeSuggestions([...primaryActions, ...secondarySuggestions]);
  const textOut =
    displayText ||
    (envelope && typeof envelope.message === 'string' ? String(envelope.message).trim() : '') ||
    params.rawAssistant.trim();

  const tone_mode =
    envelope && typeof envelope.tone_mode === 'string' ? String(envelope.tone_mode) : null;

  const intent =
    envelope && typeof envelope.intent === 'object' && envelope.intent
      ? (envelope.intent as Record<string, unknown>)
      : null;

  const understanding = pickUnderstanding(envelope, intent);
  const preview = pickPreview(envelope);
  const explanations = pickExplanations(envelope);
  const strategy = envelope && typeof envelope.strategy === 'string' ? envelope.strategy : null;

  const unified = {
    message: textOut,
    understanding,
    actions: primaryActions,
    suggestions: secondarySuggestions,
    preview,
    explanations,
  };

  return {
    text: textOut,
    suggestions,
    primaryActions,
    secondarySuggestions,
    unified,
    intent,
    strategy,
    payload:
      envelope && typeof envelope.payload === 'object' && envelope.payload
        ? (envelope.payload as Record<string, unknown>)
        : null,
    tone_mode,
    provider: params.provider,
    mode: params.mode,
  };
}
