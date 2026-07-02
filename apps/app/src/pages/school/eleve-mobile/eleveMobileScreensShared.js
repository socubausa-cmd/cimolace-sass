/**
 * Fond & surfaces — **référence branding** : accueil connexion LIRI (`/m/eleve/connexion`).
 * Fond #0b0b0a, cartes #16161E / #151210, accent violet #d97757, texte secondaire #8E8E93.
 * Grille de base 8px (marges / gaps en multiples de 4px).
 */
export const EV_BG = '#0b0b0a';
export const EV_CARD = '#16161E';
export const EV_CARD_INNER = '#151210';
export const EV_MUTED = '#8E8E93';
// Directive LIRI : accent CORAL chaud (fini le violet #d97757). Token partagé → re-skin
// tout l'élève-mobile d'un coup (boutons, halos, titres…).
export const EV_ACCENT = '#d97757';
/** Coral clair — titres type « En direct. » (accueil connexion). */
export const EV_LAVENDER = '#eab89a';
export const EV_LINE = 'rgba(255,247,240,0.08)';

/** Filet d'atmosphère haut d'écran (accueil, messages, agenda…) — CORAL chaud. */
export const EV_PAGE_AMBIENT =
  'radial-gradient(50% 32% at 50% 0%, rgba(217, 119, 87, 0.13), transparent 70%)';

/**
 * Fond d'atmosphère type Apple (LIRI sombre) : halos CORAL/ambre chauds (fini indigo/bleu/violet).
 * @param {string} base — ex. `EV_BG`
 */
export function evHaloAtmosphere(base = EV_BG) {
  return [
    'radial-gradient(ellipse 120% 70% at 50% -15%, rgba(217, 119, 87, 0.24) 0%, rgba(217, 119, 87, 0.06) 38%, transparent 58%)',
    'radial-gradient(ellipse 90% 55% at -5% 18%, rgba(226, 133, 79, 0.16) 0%, transparent 52%)',
    'radial-gradient(ellipse 85% 50% at 102% 22%, rgba(224, 146, 106, 0.16) 0%, transparent 52%)',
    'radial-gradient(ellipse 100% 55% at 50% 108%, rgba(28, 20, 14, 0.65) 0%, rgba(0,0,0,0.35) 40%, transparent 65%)',
    'radial-gradient(ellipse 70% 40% at 50% 48%, rgba(217, 119, 87, 0.05) 0%, transparent 65%)',
    `linear-gradient(180deg, #17130f 0%, ${base} 16%, ${base} 84%, #050403 100%)`,
  ].join(',\n          ');
}

/** Bordure intérieure + vignette légère (perçu « verre / premium »). */
export const EV_HALO_INSET_SPECULAR = {
  boxShadow: [
    'inset 0 1px 0 rgba(255,255,255,0.1)',
    'inset 0 0 0 1px rgba(255,255,255,0.04)',
    'inset 0 -1px 0 rgba(0,0,0,0.25)',
    'inset 0 0 100px 20px rgba(0,0,0,0.2)',
  ].join(',\n    '),
};

/** Pointillé de grain (très discret) — overlay sur l'atmosphère. */
export const EV_HALO_NOISE = {
  backgroundImage:
    'radial-gradient(circle, rgba(255,255,255,0.06) 0.4px, transparent 0.45px), radial-gradient(circle, rgba(255,255,255,0.03) 0.3px, transparent 0.35px)',
  backgroundSize: '4px 4px, 3px 3px',
  backgroundPosition: '0 0, 1px 2px',
};

/** Rayons (px) — alignés maquette cartes 16–20px. */
export const EV_R = { sm: 14, md: 18, lg: 20, xl: 24 };

/** Élévations (ombres) — cohérentes sur les 4 écrans. */
export const EV_SH = {
  sm: '0 4px 16px -4px rgba(0,0,0,0.4)',
  md: '0 8px 24px -8px rgba(0,0,0,0.48)',
  lg: '0 16px 40px -16px rgba(0,0,0,0.55)',
  hero: '0 24px 50px -20px rgba(70,35,22,0.45), inset 0 1px 0 rgba(255,255,255,0.1)',
  tab: '0 4px 18px -4px rgba(217, 119, 87, 0.4)',
  cta: '0 8px 28px -6px rgba(217, 119, 87, 0.42)',
};

/**
 * NB : le badge rouge de l'onglet Messages n'est plus piloté par une variable d'env
 * (ancien `VITE_ELEVE_MESSAGES_TAB_BADGE` / `EV_MSG_TAB_BADGE`). Il est désormais branché
 * sur le vrai compteur de non‑lus de `EleveMobileShell` (même source que la cloche header,
 * via `useDataSync().notifications`). Voir P5(e).
 */

export function firstNameFromUser(user) {
  return (
    user?.user_metadata?.full_name?.split?.(' ')?.[0] ||
    user?.email?.split?.('@')?.[0] ||
    'Élève'
  );
}
