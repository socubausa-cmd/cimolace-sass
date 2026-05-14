/**
 * Banque de polices pour SmartBoard Studio — recherche / filtrage côté UI.
 * Les familles utilisent des stacks (fallback) + polices chargées dans index.html quand indiqué.
 */
export const SB_CANVAS_FONT_CATEGORIES = ['Titres', 'Corps', 'Technique', 'Classique'];

export const SB_CANVAS_FONTS = [
  { id: 'inter', label: 'Inter', family: 'Inter, system-ui, sans-serif', category: 'Corps' },
  { id: 'playfair', label: 'Playfair Display', family: '"Playfair Display", Georgia, serif', category: 'Titres' },
  { id: 'system', label: 'System UI', family: 'system-ui, -apple-system, sans-serif', category: 'Corps' },
  { id: 'georgia', label: 'Georgia', family: 'Georgia, "Times New Roman", serif', category: 'Classique' },
  { id: 'arial', label: 'Arial', family: 'Arial, Helvetica, sans-serif', category: 'Corps' },
  { id: 'verdana', label: 'Verdana', family: 'Verdana, Geneva, sans-serif', category: 'Corps' },
  { id: 'tahoma', label: 'Tahoma', family: 'Tahoma, Geneva, sans-serif', category: 'Corps' },
  { id: 'trebuchet', label: 'Trebuchet MS', family: '"Trebuchet MS", sans-serif', category: 'Corps' },
  { id: 'impact', label: 'Impact', family: 'Impact, Haettenschweiler, sans-serif', category: 'Titres' },
  { id: 'courier', label: 'Courier New', family: '"Courier New", Courier, monospace', category: 'Technique' },
  { id: 'monaco', label: 'Monaco / Mono', family: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', category: 'Technique' },
  { id: 'palatino', label: 'Palatino', family: 'Palatino, "Palatino Linotype", serif', category: 'Classique' },
  { id: 'garamond', label: 'Garamond', family: 'Garamond, "EB Garamond", serif', category: 'Classique' },
  { id: 'times', label: 'Times New Roman', family: '"Times New Roman", Times, serif', category: 'Classique' },
  { id: 'baskerville', label: 'Baskerville', family: 'Baskerville, "Times New Roman", serif', category: 'Classique' },
  { id: 'serif', label: 'Serif générique', family: 'ui-serif, Georgia, serif', category: 'Classique' },
  { id: 'sans', label: 'Sans générique', family: 'ui-sans-serif, system-ui, sans-serif', category: 'Corps' },
];

export function filterCanvasFonts(query, category) {
  const q = String(query || '').trim().toLowerCase();
  return SB_CANVAS_FONTS.filter((f) => {
    if (category && f.category !== category) return false;
    if (!q) return true;
    return f.label.toLowerCase().includes(q) || f.family.toLowerCase().includes(q);
  });
}
