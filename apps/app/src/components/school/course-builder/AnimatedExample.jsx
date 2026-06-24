import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * ANIMATED EXAMPLE — l'exemple animé réel qui fait « asseoir » l'idée.
 * cf. docs/CAHIER_DE_CHARGE_PRECEPTEUR.md (§6 animated_example.subject).
 * Banque fermée (extensible) : earth_orbit · galaxy_spin · orbit_generic.
 */

const spin = (dur) => ({ animate: { rotate: 360 }, transition: { duration: dur, repeat: Infinity, ease: 'linear' } });

function EarthOrbit({ rm }) {
  return (
    <svg viewBox="0 0 220 220" className="h-full w-full" style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id="sunG" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="60%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#b45309" />
        </radialGradient>
        <radialGradient id="earthG" cx="38%" cy="34%" r="70%">
          <stop offset="0%" stopColor="#7dd3fc" />
          <stop offset="55%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#1e3a8a" />
        </radialGradient>
      </defs>
      {/* orbite */}
      <ellipse cx="110" cy="110" rx="82" ry="82" fill="none" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 4" opacity="0.5" />
      {/* soleil + halo */}
      <circle cx="110" cy="110" r="34" fill="#f59e0b" opacity="0.18" />
      <circle cx="110" cy="110" r="22" fill="url(#sunG)" />
      {/* la Terre orbite (groupe qui tourne) */}
      <motion.g style={{ transformOrigin: '110px 110px' }} {...(rm ? {} : spin(14))}>
        <g transform="translate(192,110)">
          {/* la Terre tourne aussi sur elle-même */}
          <motion.g style={{ transformOrigin: '0px 0px' }} {...(rm ? {} : spin(3))}>
            <circle r="11" fill="url(#earthG)" />
            <path d="M-6 -3 q4 -2 7 1 q-2 4 -6 3 q-3 -2 -1 -4 Z" fill="#22c55e" opacity="0.8" />
            <path d="M2 4 q3 0 4 3 q-3 2 -5 0 Z" fill="#22c55e" opacity="0.7" />
          </motion.g>
        </g>
      </motion.g>
    </svg>
  );
}

function GalaxySpin({ rm }) {
  const arms = [0, 1, 2];
  const armPath = (rot) => {
    let d = '';
    const steps = 60;
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const theta = t * 2.4 * Math.PI + (rot * 2 * Math.PI) / 3;
      const r = t * 90;
      const x = 110 + r * Math.cos(theta);
      const y = 110 + r * Math.sin(theta);
      d += `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)} `;
    }
    return d;
  };
  return (
    <svg viewBox="0 0 220 220" className="h-full w-full" style={{ overflow: 'visible' }}>
      <motion.g style={{ transformOrigin: '110px 110px' }} {...(rm ? {} : spin(20))}>
        <circle cx="110" cy="110" r="16" fill="#fde68a" opacity="0.85" />
        <circle cx="110" cy="110" r="28" fill="#f59e0b" opacity="0.12" />
        {arms.map((a) => (
          <path key={a} d={armPath(a)} fill="none" stroke="#93c5fd" strokeWidth="2.2" strokeLinecap="round" opacity="0.85" />
        ))}
        {arms.map((a) => (
          <path key={`g${a}`} d={armPath(a + 0.12)} fill="none" stroke="#c4b5fd" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
        ))}
      </motion.g>
    </svg>
  );
}

const SUBJECTS = { earth_orbit: EarthOrbit, galaxy_spin: GalaxySpin, orbit_generic: EarthOrbit };

export default function AnimatedExample({ subject = 'earth_orbit', caption, className = '' }) {
  const rm = useReducedMotion();
  const Cmp = SUBJECTS[subject] || EarthOrbit;
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="h-44 w-44 md:h-52 md:w-52">
        <Cmp rm={rm} />
      </div>
      {caption ? <p className="mt-3 max-w-md text-center text-sm leading-relaxed text-slate-600">{caption}</p> : null}
    </div>
  );
}
