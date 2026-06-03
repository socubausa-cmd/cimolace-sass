import { Platform } from 'react-native';

/**
 * Thème LIRI — palette sombre chaleureuse (Zoom × Claude),
 * portée fidèlement du portail web (apps/app · LiriPortal.css).
 */
export const LiriColors = {
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
} as const;

/** Polices — Source Serif 4 / Inter sur le web ; substituts système fiables en natif. */
export const LiriFonts = {
  serif: Platform.select({ ios: 'Georgia', web: 'Georgia, "Source Serif 4", serif', default: 'serif' }) as string,
  sans: Platform.select({ ios: 'System', android: 'sans-serif', web: 'Inter, system-ui, sans-serif', default: 'System' }) as string,
};

/** Ombre douce réutilisable (carte sur fond sombre). */
export const softShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.28,
  shadowRadius: 18,
  elevation: 6,
} as const;
