import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { GraduationCap, MessageCircle, BookOpen, Sparkles, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

function OrbitIcon({ className, style, children, i, reduce }) {
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, scale: 0.86, y: 6 }}
      animate={reduce ? { opacity: 1, scale: 1, y: 0 } : { opacity: 1, scale: 1, y: [0, -5 - (i % 3) * 1.5, 0] }}
      transition={
        reduce
          ? { duration: 0.2 }
          : {
              opacity: { duration: 0.5, delay: 0.08 + i * 0.1 },
              scale: { duration: 0.5, delay: 0.08 + i * 0.1 },
              y: { duration: 2.3 + i * 0.15, repeat: Infinity, ease: 'easeInOut', delay: i * 0.12 },
            }
      }
    >
      <motion.div
        animate={reduce ? {} : { scale: [1, 1.06, 1], rotate: [0, 1.5, 0, -1.5, 0] }}
        transition={reduce ? {} : { duration: 2.8 + i * 0.18, repeat: Infinity, ease: 'easeInOut' }}
        className={[
          'relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-2xl sm:h-10 sm:w-10',
          'border border-white/30 text-orange-50',
          'bg-gradient-to-br from-white/15 via-orange-400/20 to-amber-600/15',
          'shadow-[0_4px_24px_rgba(122,54,32,0.4),inset_0_1px_0_0_rgba(255,255,255,0.35),inset_0_-1px_0_0_rgba(0,0,0,0.12)]',
          'backdrop-blur-xl backdrop-saturate-150',
          'ring-1 ring-white/15',
        ].join(' ')}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

/** Portrait (svg seul, sans cadre) */
function ImmersiveAfricanPortrait() {
  return (
    <svg
      viewBox="0 0 200 240"
      className="h-auto w-full max-w-[160px] drop-shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
      fill="none"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      <defs>
        <linearGradient id="liriSkin" x1="100" y1="50" x2="100" y2="200" gradientUnits="userSpaceOnUse">
          <stop stopColor="#c9986e" />
          <stop offset="0.45" stopColor="#a06b42" />
          <stop offset="1" stopColor="#6b4528" />
        </linearGradient>
        <radialGradient id="liriCheek" cx="0.35" cy="0.4" r="0.5" gradientUnits="objectBoundingBox">
          <stop offset="0" stopColor="#c46b5a" stopOpacity="0.4" />
          <stop offset="1" stopColor="#c46b5a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="liriHood" x1="30" y1="175" x2="170" y2="240">
          <stop stopColor="#7a3620" />
          <stop offset="0.5" stopColor="#a94f33" />
          <stop offset="1" stopColor="#3a1810" />
        </linearGradient>
        <linearGradient id="liriRim" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#e0926a" stopOpacity="0.5" />
          <stop offset="0.5" stopColor="#e2854f" stopOpacity="0.15" />
          <stop offset="1" stopColor="#c96a4c" stopOpacity="0.3" />
        </linearGradient>
        <filter id="liriSOft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1" result="b" />
          <feOffset in="b" dy="1" result="o" />
          <feMerge>
            <feMergeNode in="o" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g opacity="0.98">
        <ellipse cx="100" cy="70" rx="78" ry="64" fill="#120c0a" />
        <ellipse cx="45" cy="100" rx="32" ry="40" fill="#1a100c" transform="rotate(-8 45 100)" />
        <ellipse cx="155" cy="100" rx="32" ry="40" fill="#1a100c" transform="rotate(8 155 100)" />
        <path
          d="M25 100 C25 45 60 25 100 25s75 20 75 75c-8-35-32-50-50-50s-38 8-50 32c-6-20-20-32-50-32z"
          fill="#0d0a0a"
        />
      </g>

      <ellipse cx="100" cy="110" rx="48" ry="60" fill="url(#liriSkin)" filter="url(#liriSOft)" />
      <ellipse cx="70" cy="120" rx="16" ry="10" fill="url(#liriCheek)" />
      <ellipse cx="130" cy="120" rx="16" ry="10" fill="url(#liriCheek)" />

      <path d="M60 100 Q72 95 86 100" stroke="#2d1810" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <path d="M114 100 Q128 95 140 100" stroke="#2d1810" strokeWidth="2.2" strokeLinecap="round" fill="none" />

      <ellipse cx="75" cy="110" rx="9" ry="5.5" fill="#0f0a08" />
      <ellipse cx="125" cy="110" rx="9" ry="5.5" fill="#0f0a08" />
      <circle cx="77" cy="108" r="1.5" fill="#fff" fillOpacity="0.85" />
      <circle cx="127" cy="108" r="1.5" fill="#fff" fillOpacity="0.85" />

      <path
        d="M92 128 Q100 125 108 128"
        stroke="#3d2318"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.7"
      />

      <path
        d="M86 150 Q100 160 114 150 Q100 156 86 150"
        fill="#6b2f28"
        opacity="0.9"
      />
      <path d="M90 150 Q100 154 110 150" fill="#3d1a16" fillOpacity="0.6" />

      <path
        d="M50 80 Q100 30 150 100"
        stroke="url(#liriRim)"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />

      <path
        d="M52 175 Q100 200 148 175 L155 240 H45L52 175Z"
        fill="url(#liriHood)"
      />
      <path
        d="M70 180 Q100 195 130 180"
        stroke="rgba(255,255,255,0.12)"
        strokeWidth="1.2"
        fill="none"
      />
    </svg>
  );
}

/**
 * Avatar + icônes pédagogiques animées en couronne (sans cadre ni conteneur décoratif).
 * @param {{ className?: string, compact?: boolean }} [props]
 */
export function LiriConnectionHeroAvatar({ className, compact = false }) {
  const reduce = useReducedMotion();

  return (
    <div
      className={cn(
        'relative mx-auto mt-1.5 w-full max-w-[min(100%,280px)]',
        compact && 'mt-0 max-w-[200px] scale-[0.88] [transform-origin:top_center] sm:scale-95',
        className,
      )}
      role="img"
      aria-label="Portrait illustré et icônes de formation animées"
    >
      <div
        className={`relative mx-auto w-full ${
          compact
            ? 'h-[min(180px,42vw)] min-h-[160px] sm:h-[190px] sm:min-h-[180px]'
            : 'h-[200px] min-h-[200px] sm:h-[220px] sm:min-h-[220px]'
        }`}
      >
        <OrbitIcon
          i={0}
          reduce={reduce}
          className="absolute z-20"
          style={{ left: '2%', top: '8%' }}
        >
          <GraduationCap className="h-[18px] w-[18px] sm:h-5 sm:w-5" strokeWidth={1.5} />
        </OrbitIcon>
        <OrbitIcon
          i={1}
          reduce={reduce}
          className="absolute z-20"
          style={{ right: '2%', top: '6%' }}
        >
          <MessageCircle className="h-[18px] w-[18px] sm:h-5 sm:w-5" strokeWidth={1.5} />
        </OrbitIcon>
        <OrbitIcon
          i={2}
          reduce={reduce}
          className="absolute z-20"
          style={{ left: '-2%', top: '44%' }}
        >
          <BookOpen className="h-4 w-4 sm:h-[18px] sm:w-[18px]" strokeWidth={1.5} />
        </OrbitIcon>
        <OrbitIcon
          i={3}
          reduce={reduce}
          className="absolute z-20"
          style={{ right: '-2%', top: '42%' }}
        >
          <Sparkles className="h-4 w-4 sm:h-[18px] sm:w-[18px]" strokeWidth={1.5} />
        </OrbitIcon>
        <div className="absolute bottom-0 left-1/2 z-20 flex w-11 -translate-x-1/2 justify-center">
          <OrbitIcon i={4} reduce={reduce} className="relative">
            <Play className="h-4 w-4 fill-current sm:h-[18px] sm:w-[18px]" />
          </OrbitIcon>
        </div>

        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex w-full justify-center"
          >
            {/* Disque type verre dépoli derrière le portrait (sans bordure nette) */}
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 h-[min(200px,55vw)] w-[min(200px,55vw)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-gradient-to-b from-white/[0.07] to-orange-500/[0.06] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)] backdrop-blur-md"
            />
            <motion.div
              animate={reduce ? {} : { y: [0, -2.5, 0] }}
              transition={reduce ? {} : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
              className="relative w-full max-w-[160px] px-1"
            >
              <ImmersiveAfricanPortrait />
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
