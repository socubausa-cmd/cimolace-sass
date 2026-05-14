/**
 * Modèles / templates prêts-à-l'emploi pour le tableau blanc scolaire.
 * Chaque template expose `create(x, y, color, lineWidth)` → stroke[].
 */

export const WHITEBOARD_TEMPLATES = [
  /* ── Géométrie ────────────────────────────────────────────────────────── */
  {
    id: 'triangle-rect',
    label: 'Triangle rectangle',
    category: 'geo',
    icon: '▷',
    description: 'Triangle ABC avec angle droit en A',
    create: (x, y, col = '#fff', lw = 2) => [
      { kind: 'triangle', x0: x, y0: y, x1: x + 130, y1: y, x2: x, y2: y - 100, color: col, lineWidth: lw },
      { kind: 'angle-mark', vx: x, vy: y, ax: x, ay: y - 60, bx: x + 60, by: y, color: col, lineWidth: lw, rightAngle: true, showDegrees: true },
      { kind: 'coord-point', x: x + 130, y, label: 'B', color: col, fontSize: 13 },
      { kind: 'coord-point', x: x, y: y - 100, label: 'C', color: col, fontSize: 13 },
      { kind: 'coord-point', x, y, label: 'A', color: col, fontSize: 13 },
    ],
  },
  {
    id: 'cercle-inscrit',
    label: 'Triangle + cercle inscrit',
    category: 'geo',
    icon: '⊙',
    description: 'Triangle isocèle avec cercle inscrit',
    create: (x, y, col = '#fff', lw = 2) => {
      const R = 80; const r = 32;
      return [
        { kind: 'triangle', x0: x, y0: y + R, x1: x + R * 1.2, y1: y + R, x2: x, y2: y - R * 0.5, color: col, lineWidth: lw },
        { kind: 'arc', cx: x + R * 0.15, cy: y + R * 0.38, r, startAngle: 0, endAngle: Math.PI * 2, color: '#60a5fa', lineWidth: lw },
      ];
    },
  },

  /* ── Mathématiques ────────────────────────────────────────────────────── */
  {
    id: 'repere-parabole',
    label: 'Repère + y = x²',
    category: 'math',
    icon: '∪',
    description: 'Repère orthogonal avec la parabole y = x²',
    create: (x, y, col = '#60a5fa', lw = 2) => [
      { kind: 'axes', cx: x, cy: y, size: 150, color: col, lineWidth: lw, showLabels: true, tickStep: 30 },
      { kind: 'function-plot', cx: x, cy: y, scaleX: 30, scaleY: 30, xMin: -5, xMax: 5, expr: 'x^2', color: '#34d399', lineWidth: lw },
    ],
  },
  {
    id: 'repere-sinus',
    label: 'Repère + y = sin(x)',
    category: 'math',
    icon: '∿',
    description: 'Repère avec la courbe sinus',
    create: (x, y, col = '#60a5fa', lw = 2) => [
      { kind: 'axes', cx: x, cy: y, size: 180, color: col, lineWidth: lw, showLabels: true, tickStep: 40 },
      { kind: 'function-plot', cx: x, cy: y, scaleX: 40, scaleY: 80, xMin: -5, xMax: 5, expr: 'sin(x)', color: '#f87171', lineWidth: lw },
    ],
  },
  {
    id: 'variation-standard',
    label: 'Tableau de variations',
    category: 'math',
    icon: '↗↘',
    description: 'Tableau de variations type : f croit puis décroit',
    create: (x, y, col = '#fff', lw = 1.5) => [
      {
        kind: 'variation-table', x, y,
        functionName: 'f',
        xValues: ['-∞', '1', '+∞'],
        derivSigns: ['+', '-'],
        critFValues: ['3'],
        increasing: [true, false],
        boundaryFValues: ['', ''],
        color: col, lineWidth: lw,
      },
    ],
  },
  {
    id: 'signe-standard',
    label: 'Tableau de signes',
    category: 'math',
    icon: '+/−',
    description: 'Tableau de signes x(x−1)',
    create: (x, y, col = '#fff', lw = 1.5) => [
      {
        kind: 'sign-table', x, y,
        xValues: ['-∞', '0', '1', '+∞'],
        rows: [
          { label: 'x', signs: ['-', '0', '+', '+', '+', '+', '+'] },
          { label: '(x−1)', signs: ['-', '-', '-', '0', '+', '+', '+'] },
          { label: 'x(x−1)', signs: ['+', '0', '-', '0', '+', '+', '+'], isFinal: true },
        ],
        color: col, lineWidth: lw,
      },
    ],
  },
  {
    id: 'arbre-proba',
    label: 'Arbre de probabilités',
    category: 'math',
    icon: '🌿',
    description: 'Arbre 2 niveaux P(A)=0.3, P(B|A)=0.4',
    create: (x, y, col = '#fff', lw = 1.5) => [
      {
        kind: 'prob-tree', x, y,
        l1: [{ label: 'A', p: '0.3' }, { label: 'Ā', p: '0.7' }],
        l2: [
          [{ label: 'B', p: '0.4' }, { label: 'B̄', p: '0.6' }],
          [{ label: 'B', p: '0.2' }, { label: 'B̄', p: '0.8' }],
        ],
        showProducts: true,
        color: col, lineWidth: lw,
      },
    ],
  },

  /* ── Sciences ─────────────────────────────────────────────────────────── */
  {
    id: 'circuit-serie',
    label: 'Circuit série',
    category: 'sciences',
    icon: '⚡',
    description: 'Pile + interrupteur + lampe en série',
    create: (x, y, col = '#fff', lw = 1.5) => {
      const SEP = 110;
      const TOP = y - 60; const BOT = y;
      const x1 = x - SEP; const x2 = x; const x3 = x + SEP; const x4 = x + SEP * 2;
      return [
        { kind: 'electric-component', cx: x1, cy: y, component: 'battery', size: 50, angle: 0, color: col, lineWidth: lw, label: 'E' },
        { kind: 'electric-component', cx: x2, cy: y, component: 'switch-open', size: 50, angle: 0, color: col, lineWidth: lw, label: 'K' },
        { kind: 'electric-component', cx: x3, cy: y, component: 'lamp', size: 50, angle: 0, color: col, lineWidth: lw, label: 'L' },
        /* fils de liaison */
        { kind: 'line', x1: x1 - SEP / 2, y1: y, x2: x1 - 25, y2: y, color: col, lineWidth: lw },
        { kind: 'line', x1: x1 + 25, y1: y, x2: x2 - 30, y2: y, color: col, lineWidth: lw },
        { kind: 'line', x1: x2 + 30, y1: y, x2: x3 - 28, y2: y, color: col, lineWidth: lw },
        { kind: 'line', x1: x3 + 28, y1: y, x2: x4, y2: y, color: col, lineWidth: lw },
        /* retour en haut */
        { kind: 'line', x1: x1 - SEP / 2, y1: y, x2: x1 - SEP / 2, y2: TOP, color: col, lineWidth: lw },
        { kind: 'line', x1: x4, y1: y, x2: x4, y2: TOP, color: col, lineWidth: lw },
        { kind: 'line', x1: x1 - SEP / 2, y1: TOP, x2: x4, y2: TOP, color: col, lineWidth: lw },
      ];
    },
  },
];

/** Catégories */
export const TEMPLATE_CATEGORIES = [
  { id: 'geo', label: 'Géométrie' },
  { id: 'math', label: 'Mathématiques' },
  { id: 'sciences', label: 'Sciences' },
];
