import { useState, useRef } from 'react';
import { COLOR_HEX, type OrganColor } from './api';

export type OrganNode = {
  code: string;
  name_fr: string;
  position: { x: number; y: number; z: number } | null;
  score: { score: number; color: OrganColor } | null;
};

const GREY = '#c9bdab';
const VBW = 360, VBH = 600;

// Each organ is a recognisable anatomical shape (paths in absolute viewBox
// coords). `c` = marker centre (for the leader line + pulse). `side`/`ly` =
// label placement in the margins.
type Organ = { code: string; name: string; side: 'L' | 'R'; ly: number; c: [number, number]; shape: React.ReactNode };

const ORGANS: Organ[] = [
  { code: 'brain', name: 'Cerveau', side: 'L', ly: 60, c: [180, 64], shape: (
    <g>
      <path d="M150 64 q-4 -26 24 -26 q8 -8 18 -2 q26 -4 22 22 q10 12 -2 24 q-2 16 -22 12 q-10 8 -22 0 q-22 0 -18 -18 q-8 -8 0 -12 Z" />
      <g fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth="1.4" strokeLinecap="round">
        <path d="M180 42 v44" /><path d="M162 50 q8 8 0 18 q-8 8 0 16" /><path d="M198 50 q-8 8 0 18 q8 8 0 16" />
      </g>
    </g>
  ) },
  { code: 'thyroid', name: 'Thyroïde', side: 'L', ly: 118, c: [180, 130], shape: (
    <path d="M180 124 q-3 -7 -12 -5 q-9 2 -8 11 q1 9 10 9 q8 0 10 -8 q2 8 10 8 q9 0 10 -9 q1 -9 -8 -11 q-9 -2 -12 5 Z" />
  ) },
  { code: 'lungs', name: 'Poumons', side: 'R', ly: 178, c: [206, 188], shape: (
    <g>
      <path d="M170 158 q-42 -4 -48 30 q-5 38 4 64 q5 14 22 11 q18 -3 22 -22 l0 -83 Z" />
      <path d="M190 158 q42 -4 48 30 q5 38 -4 64 q-5 14 -22 11 q-18 -3 -22 -22 l0 -83 Z" />
    </g>
  ) },
  { code: 'heart', name: 'Cœur', side: 'L', ly: 215, c: [172, 216], shape: (
    <g>
      <path d="M172 196 q-14 -14 -28 -2 q-12 12 -3 28 q7 13 27 31 q4 4 8 0 q18 -16 25 -29 q10 -16 -2 -30 q-13 -12 -25 2 Z" />
      <g fill="none" stroke="rgba(0,0,0,0.16)" strokeWidth="2.4" strokeLinecap="round"><path d="M168 196 q-2 -10 6 -16" /><path d="M182 196 q3 -9 12 -12" /></g>
    </g>
  ) },
  { code: 'liver', name: 'Foie', side: 'L', ly: 282, c: [152, 286], shape: (
    <path d="M120 270 q34 -16 70 -8 q14 3 12 16 q-3 18 -26 24 q-30 8 -52 -4 q-14 -8 -4 -28 Z" />
  ) },
  { code: 'stomach', name: 'Estomac', side: 'R', ly: 286, c: [208, 290], shape: (
    <path d="M198 268 q22 -6 26 14 q4 20 -10 34 q-12 12 -26 4 q-10 -6 -4 -16 q12 -2 12 -16 q0 -14 2 -20 Z" />
  ) },
  { code: 'pancreas', name: 'Pancréas', side: 'R', ly: 318, c: [184, 320], shape: (
    <path d="M150 318 q40 -12 76 -4 q10 2 8 9 q-2 7 -12 6 q-34 -6 -70 4 q-8 2 -10 -5 q-1 -7 8 -10 Z" />
  ) },
  { code: 'adrenals', name: 'Surrénales', side: 'L', ly: 332, c: [150, 332], shape: (
    <g><path d="M138 330 q12 -10 24 -1 q-2 8 -12 8 q-10 0 -12 -7 Z" /><path d="M210 330 q12 -9 24 0 q-2 8 -12 8 q-11 0 -12 -8 Z" /></g>
  ) },
  { code: 'kidneys', name: 'Reins', side: 'R', ly: 352, c: [212, 352], shape: (
    <g>
      <path d="M146 340 q-16 2 -16 22 q0 20 16 24 q12 3 14 -8 q-8 -8 -8 -16 q0 -8 8 -16 q-2 -9 -14 -6 Z" />
      <path d="M214 340 q16 2 16 22 q0 20 -16 24 q-12 3 -14 -8 q8 -8 8 -16 q0 -8 -8 -16 q2 -9 14 -6 Z" />
    </g>
  ) },
  { code: 'immune', name: 'Rate / immunité', side: 'L', ly: 364, c: [126, 320], shape: (
    <path d="M118 306 q16 -4 18 14 q2 16 -12 22 q-12 4 -16 -8 q-4 -16 10 -28 Z" />
  ) },
  { code: 'gut', name: 'Intestin', side: 'R', ly: 392, c: [180, 392], shape: (
    <g>
      <path d="M140 360 q-6 50 16 78 q24 26 48 0 q22 -28 16 -78 q-2 -10 -10 -8 q-6 2 -5 10 q5 42 -12 62 q-16 18 -32 0 q-17 -20 -12 -62 q1 -8 -5 -10 q-8 -2 -10 8 Z" />
      <g fill="none" stroke="rgba(0,0,0,0.16)" strokeWidth="2" strokeLinecap="round"><path d="M158 386 q22 -10 44 0" /><path d="M160 402 q20 -9 40 0" /></g>
    </g>
  ) },
  { code: 'reproductive', name: 'Reproducteur', side: 'R', ly: 432, c: [180, 430], shape: (
    <g>
      <path d="M180 420 q-12 -2 -14 12 q-1 12 14 16 q15 -4 14 -16 q-2 -14 -14 -12 Z" />
      <circle cx="158" cy="420" r="6" /><circle cx="202" cy="420" r="6" />
    </g>
  ) },
];

export function BodyViewer({
  organs,
  selected,
  onSelect,
}: {
  organs: OrganNode[];
  selected: string | null;
  onSelect: (code: string) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const [view, setView] = useState({ tx: 0, ty: 0, k: 1 });
  const svgRef = useRef<SVGSVGElement | null>(null);
  const drag = useRef<{ on: boolean; lx: number; ly: number; moved: boolean }>({ on: false, lx: 0, ly: 0, moved: false });

  const byCode = new Map(organs.map((o) => [o.code, o]));
  const colorOf = (code: string) => { const s = byCode.get(code)?.score; return s ? COLOR_HEX[s.color] : GREY; };
  const labelOf = (code: string, fallback: string) => byCode.get(code)?.name_fr || fallback;
  const scoreOf = (code: string) => byCode.get(code)?.score || null;

  const toVB = (cx: number, cy: number) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r || !r.width) return { x: 0, y: 0 };
    return { x: ((cx - r.left) / r.width) * VBW, y: ((cy - r.top) / r.height) * VBH };
  };
  const onDown = (e: React.PointerEvent) => { svgRef.current?.setPointerCapture?.(e.pointerId); const v = toVB(e.clientX, e.clientY); drag.current = { on: true, lx: v.x, ly: v.y, moved: false }; };
  const onMove = (e: React.PointerEvent) => { if (!drag.current.on) return; const v = toVB(e.clientX, e.clientY); const dx = v.x - drag.current.lx, dy = v.y - drag.current.ly; if (Math.abs(dx) > 1.4 || Math.abs(dy) > 1.4) drag.current.moved = true; setView((s) => ({ ...s, tx: s.tx + dx, ty: s.ty + dy })); drag.current.lx = v.x; drag.current.ly = v.y; };
  const onUp = () => { drag.current.on = false; };
  const onWheel = (e: React.WheelEvent) => { const v = toVB(e.clientX, e.clientY); const f = e.deltaY < 0 ? 1.12 : 1 / 1.12; setView((s) => { const k = Math.min(3.5, Math.max(0.6, s.k * f)); const r = k / s.k; return { k, tx: v.x - (v.x - s.tx) * r, ty: v.y - (v.y - s.ty) * r }; }); };
  const zoom = (f: number) => setView((s) => { const k = Math.min(3.5, Math.max(0.6, s.k * f)); const r = k / s.k; return { k, tx: VBW / 2 - (VBW / 2 - s.tx) * r, ty: VBH / 2 - (VBH / 2 - s.ty) * r }; });
  const clickOrgan = (code: string) => { if (!drag.current.moved) onSelect(code); };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', minHeight: 480, background: 'radial-gradient(circle at 50% 18%, #fffaf2, var(--zw-bg-subtle))', borderRadius: 16, padding: 8, boxSizing: 'border-box', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 6, zIndex: 4 }}>
        <button onClick={() => zoom(1.18)} title="Zoom avant" style={zbtn}>+</button>
        <button onClick={() => zoom(1 / 1.18)} title="Zoom arrière" style={zbtn}>−</button>
        <button onClick={() => setView({ tx: 0, ty: 0, k: 1 })} title="Réinitialiser" style={zbtn}>⟲</button>
      </div>
      <svg ref={svgRef} viewBox={`0 0 ${VBW} ${VBH}`} preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', flex: 1, minHeight: 400, maxHeight: 600, display: 'block', touchAction: 'none', cursor: 'grab' }}
        role="img" aria-label="Carte anatomique des organes"
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel}>
        <defs>
          <linearGradient id="zw-skin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f1e8da" /><stop offset="1" stopColor="#e3d5be" /></linearGradient>
          <linearGradient id="zw-sheen" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.45" /><stop offset="0.6" stopColor="#fff" stopOpacity="0" /></linearGradient>
        </defs>
        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.k})`}>
          {/* Silhouette */}
          <g fill="url(#zw-skin)" stroke="#d7c8af" strokeWidth="1.5">
            <ellipse cx="180" cy="66" rx="46" ry="52" />
            <rect x="166" y="112" width="28" height="26" rx="11" />
            <path d="M180 132 C138 132 118 150 118 184 L124 360 C126 408 150 432 180 432 C210 432 234 408 236 360 L242 184 C242 150 222 132 180 132 Z" />
            <rect x="86" y="158" width="26" height="150" rx="13" transform="rotate(8 99 233)" />
            <rect x="248" y="158" width="26" height="150" rx="13" transform="rotate(-8 261 233)" />
            <rect x="142" y="426" width="30" height="166" rx="15" />
            <rect x="188" y="426" width="30" height="166" rx="15" />
          </g>

          {/* Leader lines + labels */}
          {ORGANS.map((o) => {
            const active = selected === o.code || hover === o.code;
            const sc = scoreOf(o.code);
            const lx = o.side === 'L' ? 8 : 352;
            const lineStart = o.side === 'L' ? 92 : 268;
            return (
              <g key={'l-' + o.code} style={{ cursor: 'pointer' }} onClick={() => clickOrgan(o.code)} onMouseEnter={() => setHover(o.code)} onMouseLeave={() => setHover(null)}>
                <line x1={lineStart} y1={o.ly} x2={o.c[0]} y2={o.c[1]} stroke="var(--zw-border-strong)" strokeWidth={active ? 1.6 : 1} opacity={active ? 0.95 : 0.4} />
                <text x={lx} y={o.ly + 3} textAnchor={o.side === 'L' ? 'start' : 'end'} fontSize="12.5" fontWeight={active ? 700 : 600} fill="var(--zw-text-soft)" style={{ userSelect: 'none' }}>
                  {labelOf(o.code, o.name)}{sc ? ` · ${sc.score}` : ''}
                </text>
              </g>
            );
          })}

          {/* Organs as anatomical shapes */}
          {ORGANS.map((o) => {
            const active = selected === o.code || hover === o.code;
            const critical = scoreOf(o.code)?.color === 'red';
            return (
              <g key={o.code} style={{ cursor: 'pointer', color: colorOf(o.code) }}
                onPointerDown={(e) => { e.stopPropagation(); }}
                onClick={(e) => { e.stopPropagation(); onSelect(o.code); }}
                onMouseEnter={() => setHover(o.code)} onMouseLeave={() => setHover(null)}>
                {critical && <circle cx={o.c[0]} cy={o.c[1]} r="22" fill="currentColor" opacity="0.18"><animate attributeName="r" values="16;30;16" dur="2s" repeatCount="indefinite" /><animate attributeName="opacity" values="0.22;0.04;0.22" dur="2s" repeatCount="indefinite" /></circle>}
                {/* fill + stroke */}
                <g fill="currentColor" stroke="rgba(0,0,0,0.28)" strokeWidth={active ? 2 : 1.4} strokeLinejoin="round" style={{ transition: 'filter .15s', filter: active ? 'drop-shadow(0 2px 6px rgba(0,0,0,0.35))' : 'none' }}>
                  {o.shape}
                </g>
                {/* glossy sheen overlay (pseudo-3D) */}
                <g fill="url(#zw-sheen)" style={{ pointerEvents: 'none' }}>{o.shape}</g>
              </g>
            );
          })}
        </g>
      </svg>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', justifyContent: 'center', padding: '8px 4px 2px', fontSize: 11, color: 'var(--zw-text-muted)' }}>
        {(['green', 'yellow', 'orange', 'red'] as OrganColor[]).map((c, i) => (
          <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: COLOR_HEX[c] }} />
            {['Optimal', 'À surveiller', 'Sub-optimal', 'Critique'][i]}
          </span>
        ))}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: GREY }} />Non évalué</span>
      </div>
    </div>
  );
}

const zbtn: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 8, border: '1px solid var(--zw-border)', background: '#fff',
  color: 'var(--zw-text-soft)', fontSize: 15, lineHeight: 1, cursor: 'pointer', display: 'inline-flex',
  alignItems: 'center', justifyContent: 'center', padding: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
};
