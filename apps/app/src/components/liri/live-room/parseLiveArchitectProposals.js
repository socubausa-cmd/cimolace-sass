import { parseCopilotReplyToSuggestions } from '@/features/smartboard-konva-editor/lib/parseCopilotReplyToSuggestions';

/**
 * Extrait des cartes « propositions visuelles » depuis la réponse Architect (JSON ou puces).
 * @param {string} raw
 * @returns {Array<{ id: string; title: string; detail: string; imageUrl?: string | null; type?: string }>}
 */
export function parseLiveArchitectProposals(raw) {
  const text = String(raw || '').trim();
  if (!text) return [];

  const tryJson = (slice) => {
    try {
      const o = JSON.parse(String(slice || '').trim());
      const arr = o.proposals || o.visual_proposals || o.suggestions;
      if (!Array.isArray(arr)) return null;
      return arr
        .filter((x) => x && (x.label || x.title || x.body || x.detail || x.text))
        .slice(0, 8)
        .map((x, i) => ({
          id: String(x.id || `p-${i}`),
          title: String(x.label || x.title || x.type || 'Proposition').slice(0, 120),
          detail: String(x.body || x.detail || x.text || x.description || '').slice(0, 600),
          imageUrl: x.imageUrl || x.url || x.image || null,
          type: x.type ? String(x.type) : undefined,
        }));
    } catch {
      return null;
    }
  };

  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    const parsed = tryJson(fence[1]);
    if (parsed?.length) return parsed;
  }
  const direct = tryJson(text);
  if (direct?.length) return direct;

  const chips = parseCopilotReplyToSuggestions(text);
  if (chips.length) {
    return chips.slice(0, 6).map((c, i) => ({
      id: String(c.id || `c-${i}`),
      title: String(c.title || 'Idée').slice(0, 120),
      detail: String(c.detail || '').slice(0, 600),
      imageUrl: null,
    }));
  }

  const lines = text
    .split('\n')
    .map((l) => l.replace(/^\s*[-*•]\s*/, '').trim())
    .filter((l) => l.length > 4 && l.length < 400);
  return lines.slice(0, 5).map((l, i) => ({
    id: `l-${i}`,
    title: l.slice(0, 80),
    detail: l.length > 80 ? l : '',
    imageUrl: null,
  }));
}
