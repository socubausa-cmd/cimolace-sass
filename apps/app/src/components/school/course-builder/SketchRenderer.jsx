import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * SKETCH RENDERER — le CROQUIS dessiné À LA MAIN, trait par trait.
 * cf. docs/CAHIER_DE_CHARGE_PRECEPTEUR.md (§6, §8).
 *
 * Chaque élément se TRACE : le trait apparaît (pathLength) ET une MAIN tenant une
 * craie SUIT la pointe d'écriture (comme un prof qui dessine pour un enfant). Les
 * étiquettes ont un halo blanc + sont décalées perpendiculairement (zéro superposition).
 * Vocabulaire fermé : vector · arrow · line · curve · point · circle · spiral · axis · label.
 */

const VW = 160;
const VH = 90;
const EXPO = [0.16, 1, 0.3, 1];

const COLORS = { blue: '#2563eb', amber: '#d97706', green: '#16a34a', purple: '#9333ea', slate: '#334155', red: '#dc2626' };
const col = (c) => COLORS[c] || c || COLORS.slate;
const px = (x) => (x / 100) * VW;
const py = (y) => (y / 100) * VH;
const pr = (r) => (r / 100) * VH;

// Points d'une spirale d'Archimède qui s'enroule VERS le centre.
function spiralPoints(cx, cy, turns = 2.5, maxR = 30) {
  const steps = Math.max(56, Math.ceil(turns * 44));
  const pts = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const theta = t * turns * 2 * Math.PI;
    const r = (1 - t) * maxR;
    pts.push([cx + r * Math.cos(theta), cy + r * Math.sin(theta)]);
  }
  return pts;
}
const ptsToPath = (pts) => pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ');

function arrowHead(from, to, size = 4.6) {
  const ax = px(to[0]); const ay = py(to[1]);
  const ang = Math.atan2(py(to[1]) - py(from[1]), px(to[0]) - px(from[0]));
  const a1 = ang + Math.PI - 0.42; const a2 = ang + Math.PI + 0.42;
  return `M ${(ax + size * Math.cos(a1)).toFixed(2)} ${(ay + size * Math.sin(a1)).toFixed(2)} L ${ax.toFixed(2)} ${ay.toFixed(2)} L ${(ax + size * Math.cos(a2)).toFixed(2)} ${(ay + size * Math.sin(a2)).toFixed(2)}`;
}

// La MAIN à la craie : pointe (craie) à l'origine (0,0), la main au-dessus à droite.
function TracerHand() {
  return (
    <g>
      <g transform="rotate(30)">
        <rect x="-1.5" y="-15" width="3.4" height="15" rx="1.6" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="0.4" />
        <ellipse cx="0.5" cy="-17" rx="6.5" ry="5" fill="#bd8150" />
        <rect x="-3.2" y="-19" width="8.4" height="2.9" rx="1.4" fill="#c4894f" />
        <rect x="-3.2" y="-16.2" width="8" height="2.9" rx="1.4" fill="#b87a48" />
      </g>
      <circle r="1.2" fill="#1e293b" />
    </g>
  );
}

export default function SketchRenderer({ sketch, play = true, className = '' }) {
  const rm = useReducedMotion();
  const elements = (sketch?.elements || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  // rayon de spirale (pour placer l'étiquette du point central en dessous)
  const spiralEl = elements.find((e) => e.kind === 'spiral');

  const stroke = (delay, dur) => ({
    initial: { pathLength: rm ? 1 : 0, opacity: rm ? 1 : 0.85 },
    animate: play ? { pathLength: 1, opacity: 1 } : { pathLength: rm ? 1 : 0 },
    transition: { duration: rm ? 0 : dur, ease: 'easeInOut', delay: rm ? 0 : delay },
  });
  const labelIn = (delay) => ({
    initial: { opacity: 0 },
    animate: play ? { opacity: 1 } : { opacity: 0 },
    transition: { duration: 0.4, ease: EXPO, delay: rm ? 0 : delay },
  });
  // étiquette avec halo blanc (lisible par-dessus n'importe quel trait)
  const Label = ({ x, y, text, color, anchor = 'middle', delay }) => (
    <motion.text x={x} y={y} fontSize="4.7" fontWeight="800" fill={color} textAnchor={anchor}
      stroke="#ffffff" strokeWidth="2.6" paintOrder="stroke" strokeLinejoin="round" {...labelIn(delay)}>
      {text}
    </motion.text>
  );
  // la main qui suit le trait (points -> translation cadencée)
  const Tracer = ({ pts, delay, dur }) => {
    if (rm || !play || !pts || pts.length === 0) return null;
    const xs = pts.map((p) => p[0]); const ys = pts.map((p) => p[1]);
    const times = pts.length > 1 ? pts.map((_, i) => i / (pts.length - 1)) : [0, 1];
    return (
      <motion.g
        initial={{ opacity: 0, x: xs[0], y: ys[0] }}
        animate={{ opacity: [0, 1, 1, 1, 0], x: pts.length > 1 ? xs : [xs[0], xs[0]], y: pts.length > 1 ? ys : [ys[0], ys[0]] }}
        transition={{
          x: { duration: dur, delay, ease: 'easeInOut', times },
          y: { duration: dur, delay, ease: 'easeInOut', times },
          opacity: { duration: dur + 0.25, delay, times: [0, 0.05, 0.5, 0.92, 1] },
        }}
      >
        <TracerHand />
      </motion.g>
    );
  };

  let acc = 0;
  return (
    <div className={`flex h-full w-full flex-col ${className}`}>
      {sketch?.caption ? (
        <div className="mb-2 shrink-0 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{sketch.caption}</div>
      ) : null}
      <svg viewBox={`-16 -18 ${VW + 32} ${VH + 38}`} preserveAspectRatio="xMidYMid meet" className="min-h-0 w-full flex-1" fill="none">
        {elements.map((el, i) => {
          const c = col(el.color);
          const delay = acc;
          const isSpiral = el.kind === 'spiral';
          const dur = isSpiral ? 2.7 : 1.45; // tracé DÉLIBÉRÉ (comme on dessine pour un enfant)
          acc += dur + 0.4;
          const key = `${el.kind}-${i}`;

          if (el.kind === 'point') {
            const cx = px(el.center[0]); const cy = py(el.center[1]);
            // si le point est au centre d'une spirale, on place l'étiquette SOUS la spirale
            const sameSpiral = spiralEl && spiralEl.center[0] === el.center[0] && spiralEl.center[1] === el.center[1];
            const ly = sameSpiral ? cy + pr(spiralEl.radius || 30) + 9 : cy + 8;
            return (
              <g key={key}>
                <motion.circle cx={cx} cy={cy} r="3.4" fill={c}
                  initial={{ scale: rm ? 1 : 0, opacity: 0 }} animate={play ? { scale: 1, opacity: 1 } : { scale: 0 }}
                  transition={{ duration: rm ? 0 : 0.35, ease: EXPO, delay: rm ? 0 : delay }}
                  style={{ transformOrigin: `${cx}px ${cy}px` }} />
                {el.label ? <Label x={cx} y={ly} text={el.label} color={c} delay={delay + 0.3} /> : null}
              </g>
            );
          }

          if (el.kind === 'spiral') {
            const cx = px(el.center[0]); const cy = py(el.center[1]);
            const pts = spiralPoints(cx, cy, el.turns || 2.5, pr(el.radius || 30));
            return (
              <g key={key}>
                <motion.path d={ptsToPath(pts)} stroke={c} strokeWidth="2.5" strokeLinecap="round" {...stroke(delay, dur)} />
                <Tracer pts={pts} delay={delay} dur={dur} />
                {el.label ? <Label x={cx} y={cy - pr(el.radius || 30) - 6} text={el.label} color={c} delay={delay + 0.4} /> : null}
              </g>
            );
          }

          if (el.kind === 'circle') {
            const cx = px(el.center[0]); const cy = py(el.center[1]); const r = pr(el.radius || 14);
            const pts = []; for (let k = 0; k <= 20; k += 1) { const a = (k / 20) * 2 * Math.PI - Math.PI / 2; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
            return (
              <g key={key}>
                <motion.circle cx={cx} cy={cy} r={r} stroke={c} strokeWidth="2.3" strokeLinecap="round" {...stroke(delay, dur)} />
                <Tracer pts={pts} delay={delay} dur={dur} />
                {el.label ? <Label x={cx} y={cy - r - 5} text={el.label} color={c} delay={delay + 0.3} /> : null}
              </g>
            );
          }

          if (el.kind === 'axis') {
            const cx = px(el.center[0]); const cy = py(el.center[1]); const r = pr(el.radius || 22);
            return (
              <g key={key} stroke={c} strokeWidth="1.6" strokeLinecap="round">
                <motion.line x1={cx - r} y1={cy} x2={cx + r} y2={cy} {...stroke(delay, dur)} />
                <motion.line x1={cx} y1={cy - r} x2={cx} y2={cy + r} {...stroke(delay, dur)} />
              </g>
            );
          }

          if (el.kind === 'label') {
            return <Label key={key} x={px(el.center[0])} y={py(el.center[1])} text={el.label} color={c} delay={delay} />;
          }

          // vector | arrow | line | curve
          const fx = px(el.from[0]); const fy = py(el.from[1]); const tx = px(el.to[0]); const ty = py(el.to[1]);
          const isCurve = el.kind === 'curve';
          const cpx = px((el.from[0] + el.to[0]) / 2); const cpy = py(Math.min(el.from[1], el.to[1])) - 14;
          const lineD = isCurve ? `M ${fx} ${fy} Q ${cpx} ${cpy} ${tx} ${ty}` : `M ${fx} ${fy} L ${tx} ${ty}`;
          // points pour le tracé
          let pts;
          if (isCurve) { pts = []; for (let k = 0; k <= 10; k += 1) { const t = k / 10; const x = (1 - t) * (1 - t) * fx + 2 * (1 - t) * t * cpx + t * t * tx; const y = (1 - t) * (1 - t) * fy + 2 * (1 - t) * t * cpy + t * t * ty; pts.push([x, y]); } }
          else pts = [[fx, fy], [tx, ty]];
          const showHead = el.kind === 'vector' || el.kind === 'arrow';
          // étiquette : décalée PERPENDICULAIREMENT au trait, vers son extrémité (zéro superposition)
          const t = 0.66; const ax = fx + (tx - fx) * t; const ay = fy + (ty - fy) * t;
          const dx = tx - fx; const dy = ty - fy; const len = Math.hypot(dx, dy) || 1;
          const off = el.labelSide === 'below' ? 8.5 : -8.5;
          return (
            <g key={key}>
              <motion.path d={lineD} stroke={c} strokeWidth="2.5" strokeLinecap="round" {...stroke(delay, dur)} />
              {showHead ? (
                <motion.path d={arrowHead(el.from, el.to)} stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  initial={{ opacity: 0 }} animate={play ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.2, delay: rm ? 0 : delay + dur * 0.85 }} />
              ) : null}
              <Tracer pts={pts} delay={delay} dur={dur} />
              {el.label ? <Label x={ax + (-dy / len) * off} y={ay + (dx / len) * off} text={el.label} color={c} delay={delay + 0.35} /> : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
