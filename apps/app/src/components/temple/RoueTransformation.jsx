import React, { useMemo, useState } from 'react';
import { AXES, POLES } from '@/lib/temple/roueModel';

/**
 * Roue de Transformation — radar 12 axes (pendant spirituel de la roue Détox MEDOS).
 * `scores` = { [axisId]: 0..10 }. Data-driven : les axes viennent de roueModel (éditable).
 */
export default function RoueTransformation({ scores = {}, size = 300, className = '' }) {
  const cx = size / 2, cy = size / 2, R = size * 0.36, RINGS = 5, MAXV = 10;
  const [hover, setHover] = useState(null);
  const poleAccent = useMemo(() => Object.fromEntries(POLES.map((p) => [p.id, p.accent])), []);

  const ptOf = (i, r) => {
    const a = -Math.PI / 2 + i * ((2 * Math.PI) / AXES.length);
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  const ringPath = (rr) => AXES.map((_, i) => { const [x, y] = ptOf(i, rr); return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`; }).join(' ') + ' Z';
  const dataPath = AXES.map((a, i) => { const [x, y] = ptOf(i, R * (scores[a.id] ?? 0) / MAXV); return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`; }).join(' ') + ' Z';

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className={className} style={{ overflow: 'visible', display: 'block', maxWidth: '100%' }}>
      {Array.from({ length: RINGS }, (_, k) => (
        <path key={k} d={ringPath(R * (k + 1) / RINGS)} fill="none" stroke="rgba(255,255,255,.06)" />
      ))}
      {AXES.map((a, i) => { const [x, y] = ptOf(i, R); return <line key={a.id} x1={cx} y1={cy} x2={x.toFixed(1)} y2={y.toFixed(1)} stroke="rgba(255,255,255,.05)" />; })}
      <path d={dataPath} fill="color-mix(in srgb, var(--coral, #d97757) 15%, transparent)" stroke="var(--coral, #d97757)" strokeWidth={2} strokeLinejoin="round" />
      {AXES.map((a, i) => {
        const [x, y] = ptOf(i, R * (scores[a.id] ?? 0) / MAXV);
        return <circle key={a.id} cx={x.toFixed(1)} cy={y.toFixed(1)} r={hover === a.id ? 6 : 4} fill={poleAccent[a.pole]} stroke="var(--base, #232220)" strokeWidth={1.5}
          style={{ cursor: 'pointer', transition: 'r .12s' }} onMouseEnter={() => setHover(a.id)} onMouseLeave={() => setHover(null)} />;
      })}
      {AXES.map((a, i) => {
        const [x, y] = ptOf(i, R + size * 0.06);
        const anchor = Math.abs(x - cx) < 8 ? 'middle' : (x > cx ? 'start' : 'end');
        return <text key={a.id} x={x.toFixed(1)} y={(y + 3).toFixed(1)} textAnchor={anchor}
          style={{ fontSize: Math.max(9, size * 0.032), fontWeight: 600, fill: hover === a.id ? 'var(--coral, #d97757)' : 'rgba(205,199,191,.9)', cursor: 'default', transition: 'fill .15s' }}
          onMouseEnter={() => setHover(a.id)} onMouseLeave={() => setHover(null)}>{a.name}</text>;
      })}
    </svg>
  );
}
