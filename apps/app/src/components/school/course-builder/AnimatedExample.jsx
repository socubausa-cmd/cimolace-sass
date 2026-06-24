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

// L'ANALOGIE de l'oiseau : il s'envole mais un animal lui tient la patte (corde tendue)
// => il ne peut pas filer droit. Illustration ANIMÉE explicite (ailes qui battent, oiseau
// qui force vers le haut, corde tendue retenue par l'animal au sol).
function BirdTethered({ rm }) {
  return (
    <svg viewBox="0 0 220 200" className="h-full w-full" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="btSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dbeafe" />
          <stop offset="100%" stopColor="#fef3c7" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="220" height="200" rx="14" fill="url(#btSky)" opacity="0.55" />
      {/* sol */}
      <path d="M0 182 Q 110 174 220 182 L 220 200 L 0 200 Z" fill="#9ca38a" opacity="0.6" />
      {/* l'animal qui tient (silhouette assise, patte levée) */}
      <g fill="#475569">
        <ellipse cx="58" cy="170" rx="22" ry="15" />
        <circle cx="42" cy="153" r="12" />
        <path d="M34 145 l-3 -11 l8 6 Z" />
        <path d="M46 143 l2 -11 l7 7 Z" />
        <path d="M60 158 q11 -9 18 -3" stroke="#475569" strokeWidth="6" strokeLinecap="round" fill="none" />
      </g>
      {/* corde tendue (frémit) */}
      <motion.path
        fill="none" stroke="#92400e" strokeWidth="2.4" strokeLinecap="round"
        initial={{ d: 'M78 153 Q 112 130 142 104' }}
        animate={rm ? {} : { d: ['M78 153 Q 112 130 142 104', 'M78 153 Q 114 126 144 98', 'M78 153 Q 112 130 142 104'] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* l'oiseau qui force vers le haut, retenu */}
      <motion.g
        animate={rm ? {} : { y: [0, -7, 0], rotate: [0, -3, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        style={{ transformOrigin: '148px 90px' }}
      >
        <ellipse cx="150" cy="92" rx="14" ry="8.5" fill="#2563eb" />
        <circle cx="164" cy="86" r="7" fill="#1d4ed8" />
        <path d="M170 86 l10 -2 l-10 5 Z" fill="#f59e0b" />
        <path d="M136 94 l-15 4 l11 -9 Z" fill="#1d4ed8" />
        <line x1="144" y1="100" x2="142" y2="105" stroke="#1e3a8a" strokeWidth="2" strokeLinecap="round" />
        <motion.path d="M148 86 q-18 -22 -36 -13 q15 3 19 18 Z" fill="#3b82f6"
          animate={rm ? {} : { rotate: [0, -28, 0] }} transition={{ duration: 0.5, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformOrigin: '148px 88px' }} />
        <motion.path d="M152 86 q-1 -27 17 -28 q-7 12 1 25 Z" fill="#60a5fa"
          animate={rm ? {} : { rotate: [0, 28, 0] }} transition={{ duration: 0.5, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformOrigin: '152px 88px' }} />
      </motion.g>
    </svg>
  );
}

const SUBJECTS = { earth_orbit: EarthOrbit, galaxy_spin: GalaxySpin, orbit_generic: EarthOrbit, bird_tethered: BirdTethered };

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
