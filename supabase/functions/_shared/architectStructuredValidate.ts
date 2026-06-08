/**
 * Contrat JSON Architect (SmartBoard) — validation stricte côté Edge.
 * Codes d’erreur stables pour le client et les logs.
 */

export const ARCHITECT_ITEM_KINDS = ['layout', 'content', 'visual', 'accessibility'] as const;
export type ArchitectItemKind = (typeof ARCHITECT_ITEM_KINDS)[number];

export type ArchitectItem = {
  id: string;
  title: string;
  detail: string;
  kind: ArchitectItemKind;
};

export type ArchitectErrorCode =
  | 'JSON_PARSE_FAILED'
  | 'ROOT_NOT_OBJECT'
  | 'ITEMS_NOT_ARRAY'
  | 'MODEL_OUTPUT_INVALID'
  | 'ITEMS_EMPTY_AFTER_NORMALIZE';

export type ArchitectErrorBody = {
  code: ArchitectErrorCode;
  message: string;
  details?: string;
};

const KIND_SET = new Set<string>(ARCHITECT_ITEM_KINDS);

export function parseJsonFromText(text: string | null | undefined): unknown {
  if (!text || typeof text !== 'string') return null;
  const raw = text.trim();
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    return JSON.parse(m?.[0] || raw);
  } catch {
    return null;
  }
}

export function normalizeArchitectItems(parsed: unknown): ArchitectItem[] {
  if (!parsed || typeof parsed !== 'object') return [];
  const o = parsed as { items?: unknown };
  const arr = Array.isArray(o.items) ? o.items : [];
  const out: ArchitectItem[] = [];
  for (let i = 0; i < arr.length; i += 1) {
    const it = arr[i];
    if (!it || typeof it !== 'object') continue;
    const row = it as Record<string, unknown>;
    const title = String(row.title || '').trim();
    const detail = String(row.detail || '').trim();
    if (title.length < 2 || detail.length < 4) continue;
    const id = String(row.id || `s${i + 1}`).slice(0, 64);
    const k = String(row.kind || '').trim();
    const kind = (KIND_SET.has(k) ? k : 'layout') as ArchitectItemKind;
    out.push({
      id,
      title: title.slice(0, 200),
      detail: detail.slice(0, 500),
      kind,
    });
  }
  return out.slice(0, 10);
}

export function validateParsedRoot(parsed: unknown): ArchitectErrorBody | null {
  if (parsed === null || parsed === undefined) {
    return { code: 'JSON_PARSE_FAILED', message: 'Sortie modèle vide ou JSON absent.' };
  }
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { code: 'ROOT_NOT_OBJECT', message: 'La racine JSON doit être un objet avec une clé items[].' };
  }
  const o = parsed as { items?: unknown };
  if (!('items' in o)) {
    return { code: 'MODEL_OUTPUT_INVALID', message: 'Objet JSON sans clé items.' };
  }
  if (!Array.isArray(o.items)) {
    return { code: 'ITEMS_NOT_ARRAY', message: 'items doit être un tableau.' };
  }
  return null;
}
