import { cn } from '@/lib/utils';

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
