/**
 * Tokens « pro » RÉCHAUFFÉS pour la coque live INVITÉ (charte LIRI chaude).
 *
 * `@/styles/proTokens` est une palette froide (charbon bleuté + slate #9BA1AC)
 * façon DaVinci/Premiere, et elle est PARTAGÉE avec l'éditeur studio-pro
 * (studio-creator/studio-pro/tokens.js re-exporte proTokens). On ne la touche
 * donc pas : on surcharge seulement les couleurs ici, côté live invité, pour
 * que la vue élève soit alignée sur le redesign chaud de la coque hôte.
 *
 * Base #262624, panneaux #211f1c/#1f1e1c, accent ambre #d4a36a — plus de bleu.
 */
import { proColors as coldColors, proRadii, proShadow, proSize, proType, proStyles } from '@/styles/proTokens';

export const proColors = {
  ...coldColors,
  // Surfaces empilées — variantes chaudes des #0B0C0E→#323842 froids.
  surface0: '#141210',
  surface1: '#1a1815',
  surface2: '#211f1c',
  surface3: '#262624',
  surface4: '#30302e',
  surface5: '#3a3733',
  // Texte — blanc chaud + gris ambrés (fin du slate #9BA1AC).
  textPrimary: '#F1EEE7',
  textSecondary: '#A8A096',
  textMuted: '#7A736A',
  textDisabled: '#4A443C',
  // Accent — ambre LIRI (au lieu du gold #D4AF37) pour matcher la coque live.
  accent: '#d4a36a',
  accentSoft: 'rgba(212,163,106,0.14)',
  accentOutline: 'rgba(212,163,106,0.45)',
  accentGlow: 'rgba(212,163,106,0.55)',
  borderAccent: 'rgba(212,163,106,0.35)',
};

export { proRadii, proShadow, proSize, proType, proStyles };
