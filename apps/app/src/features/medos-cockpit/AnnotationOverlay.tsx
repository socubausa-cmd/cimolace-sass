// ─────────────────────────────────────────────────────────────────────────────
// Calque d'annotation (Phase 3) — dessin libre par-dessus l'artefact partagé,
// synchronisé via le canal med-cockpit (coords RELATIVES [0,1] → identique chez
// le praticien et le patient quelle que soit la taille d'écran).
//
// SVG plutôt que Konva : viewBox 0→1 + preserveAspectRatio="none" mappe les
// coords relatives au conteneur ; `vector-effect: non-scaling-stroke` garde une
// épaisseur de trait constante en pixels malgré l'échelle du viewBox.
//   - editable=true  → le calque capte le pointeur (le praticien dessine).
//   - editable=false → pointer-events:none (le patient voit + peut interagir
//                       avec l'artefact dessous, ex. pivoter le jumeau 3D).
// ─────────────────────────────────────────────────────────────────────────────
import { useRef, useState } from 'react';
import type { AnnotStroke } from './useCockpitChannel';

const PEN = '#ef4444';

function toPoints(p: number[]): string {
  let s = '';
  for (let i = 0; i + 1 < p.length; i += 2) s += `${p[i]},${p[i + 1]} `;
  return s.trim();
}

export function AnnotationOverlay({
  strokes,
  editable,
  onStrokes,
  color = PEN,
}: {
  strokes: AnnotStroke[];
  editable: boolean;
  onStrokes: (s: AnnotStroke[]) => void;
  color?: string;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [draft, setDraft] = useState<number[] | null>(null);

  const rel = (e: React.PointerEvent): [number, number] => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r || !r.width || !r.height) return [0, 0];
    return [
      Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    ];
  };

  const onDown = (e: React.PointerEvent) => {
    if (!editable) return;
    e.preventDefault();
    try {
      svgRef.current?.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const [x, y] = rel(e);
    setDraft([x, y]);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!editable || !draft) return;
    const [x, y] = rel(e);
    setDraft((d) => (d ? [...d, x, y] : [x, y]));
  };
  const onUp = () => {
    if (!editable || !draft) return;
    if (draft.length >= 4) onStrokes([...strokes, { points: draft, color }]);
    setDraft(null);
  };

  const all = draft ? [...strokes, { points: draft, color }] : strokes;

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        cursor: editable ? 'crosshair' : 'default',
        pointerEvents: editable ? 'auto' : 'none',
        touchAction: 'none',
      }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {all.map((s, i) => (
        <polyline
          key={i}
          points={toPoints(s.points)}
          fill="none"
          stroke={s.color || color}
          strokeWidth={3}
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
