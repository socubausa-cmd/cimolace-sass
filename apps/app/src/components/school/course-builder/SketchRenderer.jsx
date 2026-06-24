import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * SKETCH RENDERER — le CROQUIS dessiné à la main (idéogramme vectoriel).
 * cf. docs/CAHIER_DE_CHARGE_PRECEPTEUR.md (§6, §8).
 *
 * Interprète `sketch.elements[]` (coords en % du cadre 16:9) et les TRACE trait par
 * trait, dans l'ordre `order`, via motion.path pathLength (comme un prof au tableau).
 * Vocabulaire fermé : vector · arrow · line · curve · point · circle · spiral · axis · label.
 */

const VW = 160;
const VH = 90;
const EXPO = [0.16, 1, 0.3, 1];

const COLORS = {
  blue: '#2563eb',
  amber: '#d97706',
  green: '#16a34a',
  purple: '#9333ea',
  slate: '#334155',
  red: '#dc2626',
};
const col = (c) => COLORS[c] || c || COLORS.slate;

const px = (x) => (x / 100) * VW;
const py = (y) => (y / 100) * VH;
const pr = (r) => (r / 100) * VH;

// Spirale d'Archimède qui s'enroule VERS le centre (le temps happé par le point de gravité).
function spiralD(cx, cy, turns = 2.5, maxR = 26) {
  const steps = Math.max(48, Math.ceil(turns * 40));
  let d = '';
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const theta = t * turns * 2 * Math.PI;
    const r = (1 - t) * maxR; // de l'extérieur vers le centre
    const x = cx + r * Math.cos(theta);
    const y = cy + r * Math.sin(theta);
    d += `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)} `;
  }
  return d.trim();
}

// Tête de flèche (deux petits traits) à l'extrémité `to`, orientée from→to.
function arrowHead(from, to, size = 4.4) {
  const ax = px(to[0]);
  const ay = py(to[1]);
  const dx = px(to[0]) - px(from[0]);
  const dy = py(to[1]) - py(from[1]);
  const ang = Math.atan2(dy, dx);
  const a1 = ang + Math.PI - 0.42;
  const a2 = ang + Math.PI + 0.42;
  return `M ${(ax + size * Math.cos(a1)).toFixed(2)} ${(ay + size * Math.sin(a1)).toFixed(2)} L ${ax.toFixed(2)} ${ay.toFixed(2)} L ${(ax + size * Math.cos(a2)).toFixed(2)} ${(ay + size * Math.sin(a2)).toFixed(2)}`;
}

export default function SketchRenderer({ sketch, play = true, className = '' }) {
  const rm = useReducedMotion();
  const elements = (sketch?.elements || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  const stroke = (delay, dur = 0.85) => ({
    initial: { pathLength: rm ? 1 : 0, opacity: rm ? 1 : 0.9 },
    animate: play ? { pathLength: 1, opacity: 1 } : { pathLength: rm ? 1 : 0 },
    transition: { duration: rm ? 0 : dur, ease: EXPO, delay: rm ? 0 : delay },
  });
  const labelIn = (delay) => ({
    initial: { opacity: 0, y: 3 },
    animate: play ? { opacity: 1, y: 0 } : { opacity: 0 },
    transition: { duration: 0.4, ease: EXPO, delay: rm ? 0 : delay + 0.5 },
  });

  let acc = 0; // délai cumulé (chaque élément se trace après le précédent)

  return (
    <div className={`flex h-full w-full flex-col ${className}`}>
      {sketch?.caption ? (
        <div className="mb-2 shrink-0 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
          {sketch.caption}
        </div>
      ) : null}
      <svg viewBox={`-14 -16 ${VW + 28} ${VH + 32}`} preserveAspectRatio="xMidYMid meet" className="min-h-0 w-full flex-1" fill="none">
        {elements.map((el, i) => {
          const c = col(el.color);
          const delay = acc;
          acc += el.kind === 'spiral' ? 1.4 : 0.95;
          const key = `${el.kind}-${i}`;

          if (el.kind === 'point') {
            return (
              <g key={key}>
                <motion.circle
                  cx={px(el.center[0])} cy={py(el.center[1])} r="3.4" fill={c}
                  initial={{ scale: rm ? 1 : 0, opacity: 0 }}
                  animate={play ? { scale: 1, opacity: 1 } : { scale: 0 }}
                  transition={{ duration: rm ? 0 : 0.4, ease: EXPO, delay: rm ? 0 : delay }}
                  style={{ transformOrigin: `${px(el.center[0])}px ${py(el.center[1])}px` }}
                />
                {el.label ? (
                  <motion.text x={px(el.center[0])} y={py(el.center[1]) + 9} fontSize="4.8" fill={c} fontWeight="700" textAnchor="middle" {...labelIn(delay)}>
                    {el.label}
                  </motion.text>
                ) : null}
              </g>
            );
          }

          if (el.kind === 'circle') {
            return (
              <g key={key}>
                <motion.circle cx={px(el.center[0])} cy={py(el.center[1])} r={pr(el.radius || 14)} stroke={c} strokeWidth="2.2" strokeLinecap="round" {...stroke(delay)} />
                {el.label ? <motion.text x={px(el.center[0])} y={py(el.center[1]) - pr(el.radius || 14) - 2} fontSize="5" fill={c} fontWeight="700" textAnchor="middle" {...labelIn(delay)}>{el.label}</motion.text> : null}
              </g>
            );
          }

          if (el.kind === 'spiral') {
            const cx = px(el.center[0]);
            const cy = py(el.center[1]);
            const d = spiralD(cx, cy, el.turns || 2.5, pr(el.radius || 26));
            const startX = cx + pr(el.radius || 26);
            return (
              <g key={key}>
                <motion.path d={d} stroke={c} strokeWidth="2.4" strokeLinecap="round" {...stroke(delay, 1.3)} />
                {el.label ? <motion.text x={cx} y={cy - pr(el.radius || 26) - 4} fontSize="4.8" fill={c} fontWeight="700" textAnchor="middle" {...labelIn(delay + 0.4)}>{el.label}</motion.text> : null}
              </g>
            );
          }

          if (el.kind === 'axis') {
            return (
              <g key={key} stroke={c} strokeWidth="1.6" strokeLinecap="round">
                <motion.line x1={px(el.center[0]) - pr(el.radius || 22)} y1={py(el.center[1])} x2={px(el.center[0]) + pr(el.radius || 22)} y2={py(el.center[1])} {...stroke(delay)} />
                <motion.line x1={px(el.center[0])} y1={py(el.center[1]) - pr(el.radius || 22)} x2={px(el.center[0])} y2={py(el.center[1]) + pr(el.radius || 22)} {...stroke(delay)} />
              </g>
            );
          }

          if (el.kind === 'label') {
            return (
              <motion.text key={key} x={px(el.center[0])} y={py(el.center[1])} fontSize="5.4" fill={c} fontWeight="700" textAnchor="middle" {...labelIn(delay - 0.5)}>
                {el.label}
              </motion.text>
            );
          }

          // vector | arrow | line | curve
          const isCurve = el.kind === 'curve';
          const lineD = isCurve
            ? `M ${px(el.from[0])} ${py(el.from[1])} Q ${px((el.from[0] + el.to[0]) / 2)} ${py(Math.min(el.from[1], el.to[1]) - 14)} ${px(el.to[0])} ${py(el.to[1])}`
            : `M ${px(el.from[0])} ${py(el.from[1])} L ${px(el.to[0])} ${py(el.to[1])}`;
          const showHead = el.kind === 'vector' || el.kind === 'arrow';
          const midX = px((el.from[0] + el.to[0]) / 2);
          const midY = py((el.from[1] + el.to[1]) / 2);
          return (
            <g key={key}>
              <motion.path d={lineD} stroke={c} strokeWidth="2.4" strokeLinecap="round" {...stroke(delay)} />
              {showHead ? (
                <motion.path
                  d={arrowHead(el.from, el.to)}
                  stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
                  initial={{ opacity: 0 }}
                  animate={play ? { opacity: 1 } : { opacity: 0 }}
                  transition={{ duration: 0.25, delay: rm ? 0 : delay + 0.7 }}
                />
              ) : null}
              {el.label ? (
                <motion.text x={midX} y={midY - 3} fontSize="5" fill={c} fontWeight="700" textAnchor="middle" {...labelIn(delay)}>
                  {el.label}
                </motion.text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
