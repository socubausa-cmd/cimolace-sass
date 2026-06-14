import { useState } from 'react';
import { COLOR_HEX, type OrganColor } from './api';

export type OrganNode = {
  code: string;
  name_fr: string;
  position: { x: number; y: number; z: number } | null;
  score: { score: number; color: OrganColor } | null;
};

const GREY = '#c9bdab';

// Front-view anatomical layout (viewBox 300 × 470). `side` = which margin the
// label sits in; `ly` = its vertical position (manually spaced to avoid overlap).
const POS: Record<string, { x: number; y: number; side: 'L' | 'R'; ly: number }> = {
  brain:        { x: 150, y: 50,  side: 'L', ly: 40 },
  thyroid:      { x: 150, y: 100, side: 'L', ly: 96 },
  heart:        { x: 134, y: 158, side: 'L', ly: 152 },
  lungs:        { x: 168, y: 150, side: 'R', ly: 142 },
  liver:        { x: 178, y: 206, side: 'R', ly: 198 },
  stomach:      { x: 122, y: 204, side: 'L', ly: 206 },
  pancreas:     { x: 150, y: 228, side: 'R', ly: 232 },
  adrenals:     { x: 120, y: 238, side: 'L', ly: 260 },
  kidneys:      { x: 180, y: 246, side: 'R', ly: 266 },
  gut:          { x: 150, y: 274, side: 'R', ly: 300 },
  immune:       { x: 112, y: 282, side: 'L', ly: 308 },
  reproductive: { x: 150, y: 306, side: 'R', ly: 336 },
};

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
  const byCode = new Map(organs.map((o) => [o.code, o]));
  const list = Object.keys(POS).map((code) => {
    const o = byCode.get(code);
    return { code, name: o?.name_fr || code, score: o?.score || null, ...POS[code] };
  });
  const colorOf = (s: OrganNode['score']) => (s ? COLOR_HEX[s.color] : GREY);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', minHeight: 460, background: 'radial-gradient(circle at 50% 20%, #ffffff, var(--zw-bg-subtle))', borderRadius: 16, padding: 8, boxSizing: 'border-box' }}>
      <svg viewBox="0 0 300 470" preserveAspectRatio="xMidYMid meet" style={{ width: '100%', flex: 1, minHeight: 380, maxHeight: 540, display: 'block' }} role="img" aria-label="Carte anatomique des organes">
        <defs>
          <linearGradient id="zw-body-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f0e7d9" />
            <stop offset="1" stopColor="#e2d4be" />
          </linearGradient>
        </defs>

        {/* Silhouette */}
        <g fill="url(#zw-body-fill)" stroke="#d7c8af" strokeWidth="1.5">
          <ellipse cx="150" cy="48" rx="27" ry="31" />
          <rect x="139" y="74" width="22" height="20" rx="9" />
          <path d="M150 90 C116 90 100 106 100 136 L104 252 C106 292 124 312 150 312 C176 312 194 292 196 252 L200 136 C200 106 184 90 150 90 Z" />
          <rect x="71" y="118" width="22" height="120" rx="11" transform="rotate(8 82 178)" />
          <rect x="207" y="118" width="22" height="120" rx="11" transform="rotate(-8 218 178)" />
          <rect x="118" y="306" width="26" height="152" rx="13" />
          <rect x="156" y="306" width="26" height="152" rx="13" />
        </g>

        {/* Leader lines + labels (clickable) */}
        {list.map((it) => {
          const active = selected === it.code || hover === it.code;
          const lx = it.side === 'L' ? 8 : 292;
          const lineStart = it.side === 'L' ? 78 : 222;
          return (
            <g key={'lbl-' + it.code} style={{ cursor: 'pointer' }}
              onClick={() => onSelect(it.code)} onMouseEnter={() => setHover(it.code)} onMouseLeave={() => setHover(null)}>
              <line x1={lineStart} y1={it.ly} x2={it.x} y2={it.y} stroke="var(--zw-border-strong)" strokeWidth={active ? 1.6 : 1} opacity={active ? 0.95 : 0.4} />
              <text x={lx} y={it.ly + 3} textAnchor={it.side === 'L' ? 'start' : 'end'} fontSize="11" fontWeight={active ? 700 : 500} fill="var(--zw-text-soft)" style={{ userSelect: 'none' }}>
                {it.name}{it.score ? ` · ${it.score.score}` : ''}
              </text>
            </g>
          );
        })}

        {/* Organ markers */}
        {list.map((it) => {
          const c = colorOf(it.score);
          const active = selected === it.code || hover === it.code;
          const r = selected === it.code ? 11 : active ? 10 : 8.5;
          const critical = it.score?.color === 'red';
          return (
            <g key={it.code} style={{ cursor: 'pointer' }}
              onClick={() => onSelect(it.code)} onMouseEnter={() => setHover(it.code)} onMouseLeave={() => setHover(null)}>
              {critical && (
                <circle cx={it.x} cy={it.y} r={r + 4} fill={c} opacity="0.25">
                  <animate attributeName="r" values={`${r + 2};${r + 9};${r + 2}`} dur="1.8s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.3;0.04;0.3" dur="1.8s" repeatCount="indefinite" />
                </circle>
              )}
              <circle cx={it.x} cy={it.y} r={r} fill={c} stroke="#fff" strokeWidth={selected === it.code ? 3 : 2} />
            </g>
          );
        })}
      </svg>

      {/* Légende */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', justifyContent: 'center', padding: '8px 4px 2px', fontSize: 11, color: 'var(--zw-text-muted)' }}>
        {(['green', 'yellow', 'orange', 'red'] as OrganColor[]).map((c, i) => (
          <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: COLOR_HEX[c] }} />
            {['Optimal', 'À surveiller', 'Sub-optimal', 'Critique'][i]}
          </span>
        ))}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: GREY }} />Non évalué
        </span>
      </div>
    </div>
  );
}
