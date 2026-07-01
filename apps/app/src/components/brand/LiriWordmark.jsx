import { useId } from 'react';
import { cn } from '@/lib/utils';

/** Ampoule — lavande (#c4b5fd), alignée maquette logo LIRI définitif */
export const LIRI_WORDMARK_BULB = '#c4b5fd';

/** Couleurs du dégradé officiel (violet → bleu → cyan), partagées avec `LiriBrandIcon`. */
export const LIRI_GRADIENT_STOPS = ['#7C3AED', '#3B82F6', '#00E5FF'];

/**
 * Icône LIRI (R en arc + I + point) — version SVG « mark » officielle.
 * - Couleur : dégradé violet → bleu → cyan, comme le wordmark.
 * - `size` (px ou string CSS) ou `className` (`h-/w-`) pour le dimensionner.
 * - Hérite de `currentColor` si `monochrome` est vrai (utile en navigation discrète).
 */
export function LiriBrandIcon({
  size,
  className,
  monochrome = false,
  title = 'LIRI',
  ...rest
}) {
  const gid = useId();
  const fillRef = monochrome ? 'currentColor' : `url(#${gid})`;
  const dim = size != null ? { width: size, height: size } : undefined;
  return (
    <svg
      role="img"
      aria-label={title}
      viewBox="0 0 300 300"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
      {...dim}
      {...rest}
    >
      <title>{title}</title>
      {monochrome ? null : (
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="300" y2="300" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={LIRI_GRADIENT_STOPS[0]} />
            <stop offset="50%" stopColor={LIRI_GRADIENT_STOPS[1]} />
            <stop offset="100%" stopColor={LIRI_GRADIENT_STOPS[2]} />
          </linearGradient>
        </defs>
      )}
      {/* Arc « R » */}
      <path
        d="M70 200 A80 80 0 1 1 230 200"
        stroke={fillRef}
        strokeWidth={10}
        strokeLinecap="round"
        fill="none"
      />
      {/* Barre du « i » */}
      <rect x={145} y={130} width={10} height={60} rx={5} fill={fillRef} />
      {/* Point du « i » */}
      <circle cx={150} cy={110} r={10} fill={fillRef} />
    </svg>
  );
}

/**
 * Wordmark LIRI 100% vectoriel (fond transparent).
 * Baseline optionnelle : « INTELLIGENCE LIVE AUGMENTEE ».
 */
export function LiriOfficialWordmarkSvg({
  className,
  showBaseline = true,
  subtleGlow = false,
  title = 'LIRI',
  ...rest
}) {
  const gid = useId();
  const glow = subtleGlow ? 'drop-shadow(0 2px 12px rgba(76, 29, 149, .35))' : undefined;
  const viewBox = showBaseline ? '0 0 760 280' : '0 0 760 220';
  return (
    <svg
      role="img"
      aria-label={showBaseline ? 'LIRI — Intelligence live augmentee' : 'LIRI'}
      viewBox={viewBox}
      xmlns="http://www.w3.org/2000/svg"
      className={cn('w-auto shrink-0', className)}
      style={{ filter: glow }}
      {...rest}
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={gid} x1="70" y1="40" x2="650" y2="210" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={LIRI_GRADIENT_STOPS[0]} />
          <stop offset="50%" stopColor={LIRI_GRADIENT_STOPS[1]} />
          <stop offset="100%" stopColor={LIRI_GRADIENT_STOPS[2]} />
        </linearGradient>
      </defs>

      {/* Mot-symbole */}
      <text
        x="90"
        y="175"
        fill={`url(#${gid})`}
        fontFamily="Inter, Montserrat, Poppins, system-ui, sans-serif"
        fontSize="120"
        fontWeight="800"
        letterSpacing="6"
      >
        LIRI
      </text>

      {/* Arc signature */}
      <path
        d="M340 150 A118 118 0 0 1 575 150"
        stroke={`url(#${gid})`}
        strokeWidth="10"
        strokeLinecap="round"
        fill="none"
      />
      {/* Point sur le dernier I */}
      <circle cx="596" cy="124" r="10" fill={`url(#${gid})`} />

      {showBaseline ? (
        <g fontFamily="Inter, Montserrat, system-ui, sans-serif" fontSize="24" fontWeight="500" letterSpacing="9">
          <text x="95" y="246" fill="rgba(255,255,255,.92)">INTELLIGENCE</text>
          <text x="378" y="246" fill={`url(#${gid})`}>LIVE</text>
          <text x="455" y="246" fill="rgba(255,255,255,.92)">AUGMENTEE</text>
        </g>
      ) : null}
    </svg>
  );
}

const BULB_GLOW = 'drop-shadow(0 0 14px rgba(167, 139, 250, 0.85))';

/** Hauteurs du wordmark vectoriel officiel (transparent). */
const OFFICIAL_IMG = {
  kicker: 'h-6 max-w-[160px] object-left sm:h-7',
  footer: 'h-5 max-w-[130px] object-left',
  compact: 'h-9 max-w-[200px] object-left sm:h-10',
  rail: 'h-[3.5rem] max-w-[min(100%,220px)] object-left sm:h-14 sm:max-w-[240px]',
  header: 'h-16 max-w-[280px] object-contain object-left sm:h-[4.5rem]',
  hero: 'h-28 max-w-[min(92vw,400px)] object-contain object-center sm:h-32 md:h-36',
  stage:
    'h-[clamp(6.5rem,15vw,11rem)] max-w-[min(94vw,540px)] object-contain object-center',
  billboard:
    'h-[clamp(9rem,24vw,15rem)] max-w-[min(96vw,760px)] object-contain object-center',
};

/** Tailles utiles pour `variant="icon"` (carré, dégradé). */
const ICON_SIZE = {
  kicker: 'h-4 w-4',
  footer: 'h-3.5 w-3.5',
  compact: 'h-5 w-5',
  rail: 'h-9 w-9 sm:h-10 sm:w-10',
  header: 'h-10 w-10 sm:h-11 sm:w-11',
  hero: 'h-16 w-16 sm:h-20 sm:w-20',
  stage: 'h-24 w-24 sm:h-28 sm:w-28',
  billboard: 'h-32 w-32 sm:h-40 sm:w-40',
};

/**
 * Logo typographique LIRI : **L** + ampoule (remplace le premier I) + **R** + **I**.
 * Utiliser `className="text-white/40"` etc. pour la couleur des lettres (`text-current` sur les glyphes).
 *
 * **`variant="official"`** — wordmark SVG officiel (fond transparent).
 * **`officialBaseline={false}`** — mot-symbole sans baseline (compact rails / headers).
 */

const SIZES = {
  /** Sous-titre d'écran (ex. accueil, profil) */
  kicker: {
    row: 'items-end gap-px',
    letter: 'text-[10px] font-semibold tracking-wide text-current',
    bulbWrap: 'relative -mb-px flex h-3 w-3 items-center justify-center',
    bulb: 'h-2.5 w-2.5',
  },
  /** Pied de page « LIRI · … » */
  footer: {
    row: 'items-end gap-0.5',
    letter: 'text-[9px] font-semibold tracking-wide text-current',
    bulbWrap: 'relative -mb-px flex h-3.5 w-3.5 items-center justify-center',
    bulb: 'h-3 w-3',
  },
  /** Barre fine (Reels, écosystème) */
  compact: {
    row: 'items-end gap-0',
    letter: 'text-[12px] font-semibold leading-none tracking-[-0.02em] text-current sm:text-[13px]',
    bulbWrap: 'relative -mb-0.5 flex h-5 w-5 items-center justify-center',
    bulb: 'h-4 w-4',
  },
  /** Rail live — panneau gauche session (plus lisible que compact, tient dans colonne étroite) */
  rail: {
    row: 'items-end gap-0',
    letter:
      'text-[1.1875rem] font-extrabold leading-none tracking-[-0.03em] text-current sm:text-[1.375rem]',
    bulbWrap:
      'relative -mb-0.5 flex h-[1.75rem] w-[1.75rem] items-center justify-center sm:h-9 sm:w-9',
    bulb: 'h-[1.45rem] w-[1.45rem] sm:h-[1.65rem] sm:w-[1.65rem]',
  },
  /** Barre du shell `EleveMobileShell` */
  header: {
    row: 'items-end gap-0',
    letter: 'text-[28px] font-extrabold leading-none tracking-[-0.04em] text-white sm:text-[30px]',
    bulbWrap: 'relative -mb-0.5 flex h-8 w-8 items-center justify-center sm:h-9 sm:w-9',
    bulb: 'h-7 w-7 sm:h-8 sm:w-8',
  },
  /** Écran connexion / héros */
  hero: {
    row: 'items-end justify-center gap-0',
    letter: 'text-[32px] font-extrabold leading-none tracking-[-0.04em] text-white sm:text-[36px]',
    bulbWrap: 'relative -mb-0.5 flex h-9 w-9 items-center justify-center sm:h-10 sm:w-10',
    bulb: 'h-8 w-8 sm:h-9 sm:w-9',
  },
  /** Bandeau large (démo hôte, maquettes) */
  stage: {
    row: 'items-end gap-0.5',
    letter:
      'text-[clamp(1.75rem,4.5vw,3.25rem)] font-extrabold leading-none tracking-[-0.03em] text-current',
    bulbWrap:
      'relative -mb-1 flex h-[clamp(2.25rem,5.5vw,3.75rem)] w-[clamp(2.25rem,5.5vw,3.75rem)] items-center justify-center',
    bulb: 'h-[clamp(1.85rem,4.5vw,3.25rem)] w-[clamp(1.85rem,4.5vw,3.25rem)]',
  },
  /** Très grand (mock hôte, vitrine) */
  billboard: {
    row: 'items-end gap-0',
    letter:
      'text-[52px] font-extrabold leading-none tracking-[-0.03em] text-current sm:text-[64px] md:text-[76px]',
    bulbWrap:
      'relative -mb-1.5 flex h-[4.25rem] w-[4.25rem] items-center justify-center sm:h-[5rem] sm:w-[5rem] md:h-[5.75rem] md:w-[5.75rem]',
    bulb: 'h-[3.5rem] w-[3.5rem] sm:h-16 sm:w-16 md:h-[4.5rem] md:w-[4.5rem]',
  },
};

export function LiriWordmark({
  size = 'header',
  /**
   * `icon` = marque officielle SEULE ; sinon (`mark`/`official`) = marque + « LIRI ».
   * L'ancien wordmark « L + ampoule + RI » (froid, dégradé violet/bleu/cyan) est RETIRÉ :
   * on affiche partout le logo officiel `/lirilogo.png` (chaud). Les props `bulbColor`,
   * `bulbGlow`, `officialBaseline`, `subtleGlow` sont conservées pour compat API (ignorées).
   */
  variant = 'mark',
  officialBaseline = true, // eslint-disable-line no-unused-vars
  className,
  letterClassName,
  subtleGlow = false, // eslint-disable-line no-unused-vars
  bulbColor, // eslint-disable-line no-unused-vars
  bulbGlow, // eslint-disable-line no-unused-vars
}) {
  const s = SIZES[size] || SIZES.header;
  const iconClass = ICON_SIZE[size] || ICON_SIZE.compact;

  const Mark = (
    <img
      src="/lirilogo.png"
      alt="LIRI"
      draggable={false}
      className={cn('shrink-0 select-none object-contain', iconClass)}
    />
  );

  // Marque officielle seule (ex-`variant="icon"`).
  if (variant === 'icon') {
    return <span className={cn('inline-flex shrink-0 select-none', className)}>{Mark}</span>;
  }

  // Marque + mot « LIRI » (wordmark officiel).
  return (
    <span className={cn('inline-flex select-none items-center gap-1.5', className)} aria-label="LIRI">
      {Mark}
      <span className={cn(s.letter, 'leading-none', letterClassName)}>LIRI</span>
    </span>
  );
}

/** Ligne de pied « [logo] · Suffixe » (maquette mobile élève / connexion). */
export function LiriPageFooterLine({ suffix, className, marginClass = 'mt-6' }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-1.5 text-[9px] text-white/20',
        marginClass,
        className,
      )}
    >
      <LiriWordmark variant="official" officialBaseline={false} size="footer" subtleGlow className="opacity-90" />
      <span className="uppercase tracking-[0.2em]">· {suffix}</span>
    </div>
  );
}
