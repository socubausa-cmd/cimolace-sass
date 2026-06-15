import { Platform } from 'react-native';

/**
 * Thème LIRI — palette chaleureuse (Zoom × Claude), portée du portail web.
 *
 * DEUX TEINTES : crème clair (défaut, aligné back-office prorascience.org) et
 * sombre d'origine. Mêmes clés → un écran lit `useTheme().colors` (cf. src/lib/theme.tsx)
 * et bascule sans changer son code. Les accents (coral/live/emerald) sont communs.
 */
export type LiriPalette = {
  base: string;
  rail: string;
  panel: string;
  panel2: string;
  panelTint: string;
  coral: string;
  clay: string;
  live: string;
  liveSoft: string;
  ink: string;
  muted: string;
  faint: string;
  line: string;
  lineSoft: string;
  coralTint: string;
  coralTint2: string;
  liveTint: string;
  liveBorder: string;
  emeraldA: string;
  emeraldB: string;
};

export type ThemeMode = 'light' | 'dark';

/** SOMBRE — palette d'origine (inchangée). */
export const LiriColorsDark: LiriPalette = {
  base: '#262624',
  rail: '#1f1e1c',
  panel: '#30302e',
  panel2: '#3a3a37',
  panelTint: 'rgba(48,48,46,0.72)',
  coral: '#d97757',
  clay: '#c2683f',
  live: '#e2553f',
  liveSoft: '#ef6a52',
  ink: '#f5f4ee',
  muted: '#b0ada3',
  faint: '#82807a',
  line: 'rgba(245,244,238,0.09)',
  lineSoft: 'rgba(245,244,238,0.06)',
  coralTint: 'rgba(217,119,87,0.13)',
  coralTint2: 'rgba(217,119,87,0.08)',
  liveTint: 'rgba(226,85,63,0.10)',
  liveBorder: 'rgba(226,85,63,0.28)',
  emeraldA: '#5b7a52',
  emeraldB: '#6d8f60',
};

/** CLAIR — crème chaleureux (#F4EFE3 = réf), cartes blanches, texte chaud lisible AA. */
export const LiriColorsLight: LiriPalette = {
  base: '#F4EFE3',
  rail: '#EBE4D5',
  panel: '#FFFFFF',
  panel2: '#FBF8F1',
  panelTint: 'rgba(255,255,255,0.78)',
  coral: '#C2683F',
  clay: '#A9542F',
  live: '#D14430',
  liveSoft: '#E2553F',
  ink: '#2B2722',
  muted: '#6C685F',
  faint: '#9A958A',
  line: 'rgba(43,39,34,0.12)',
  lineSoft: 'rgba(43,39,34,0.07)',
  coralTint: 'rgba(194,104,63,0.13)',
  coralTint2: 'rgba(194,104,63,0.07)',
  liveTint: 'rgba(209,68,48,0.10)',
  liveBorder: 'rgba(209,68,48,0.26)',
  emeraldA: '#4C6644',
  emeraldB: '#5E7E52',
};

export const PALETTES: Record<ThemeMode, LiriPalette> = {
  light: LiriColorsLight,
  dark: LiriColorsDark,
};

/**
 * Rétrocompat : `LiriColors` = palette SOMBRE statique. Tout écran non encore migré
 * vers `useTheme()` continue de compiler et s'affiche en sombre (dégradation propre).
 */
export const LiriColors = LiriColorsDark;

/** Polices — Source Serif 4 / Inter sur le web ; substituts système fiables en natif. */
export const LiriFonts = {
  serif: Platform.select({ ios: 'Georgia', web: 'Georgia, "Source Serif 4", serif', default: 'serif' }) as string,
  sans: Platform.select({ ios: 'System', android: 'sans-serif', web: 'Inter, system-ui, sans-serif', default: 'System' }) as string,
};

/** Ombre douce réutilisable (carte). */
export const softShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.28,
  shadowRadius: 18,
  elevation: 6,
} as const;
