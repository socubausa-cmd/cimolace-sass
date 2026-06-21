/**
 * Jetons visuels LIRI Host Live UI (maquette hôte desktop).
 */

/** Fond page / shell autour de la grille 3 colonnes */
export const LIRI_HOST_SHELL_PAD = 'p-2.5 gap-2 sm:gap-2';

/** Colonnes latérales (événements gauche, guidance / membres droite) */
export const LIRI_HOST_SIDE_COLUMN =
  'flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-white/[0.07] bg-[linear-gradient(170deg,#181613_0%,#080910_100%)] px-3 py-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]';

/** Cartes Mains levées / Salle d'attente / Notifications */
export const LIRI_HOST_EVENT_CARD =
  'rounded-[4px] border border-white/[0.08] bg-white/[0.018] shadow-none';

/** Bandeau sièges au-dessus du SmartBoard (members-dock) */
export const LIRI_HOST_MEMBERS_DOCK =
  'rounded-[18px] border border-amber-400/14 bg-[linear-gradient(170deg,#1a1816_0%,#090a18_100%)] p-2 shadow-[0_0_32px_-16px_rgba(251,191,36,0.12)]';

/** Conteneur colonne centrale (SmartBoard plein cadre, sans bandeau au-dessus) */
export const LIRI_HOST_STAGE_FRAME =
  'flex min-h-0 flex-1 flex-col overflow-hidden rounded-[20px] border border-amber-400/14 bg-[#0e0d0b]/90 shadow-[0_0_40px_-18px_rgba(212,163,106,0.2)]';

/** Zone de rendu SmartBoard (dégradés type maquette) */
export const LIRI_HOST_STAGE_CANVAS_GRADIENT =
  'pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_115%,rgba(160,50,20,0.45),rgba(100,20,70,0.22)_25%,rgba(70,60,50,0.1)_50%,transparent_70%),radial-gradient(ellipse_60%_50%_at_25%_90%,rgba(100,90,80,0.28),transparent_45%),linear-gradient(180deg,#0e0e24_0%,#130d20_40%,#1c0e1e_70%,#180c1a_100%)]';
