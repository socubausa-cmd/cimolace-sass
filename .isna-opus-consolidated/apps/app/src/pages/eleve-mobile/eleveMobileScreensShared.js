/**
 * Fond & surfaces — **référence branding** : accueil connexion LIRI (`/m/eleve/connexion`).
 * Fond #0B0B0F, cartes #16161E / #12121E, accent violet #7B61FF, texte secondaire #8E8E93.
 * Grille de base 8px (marges / gaps en multiples de 4px).
 */
export const EV_BG = '#0B0B0F';
export const EV_CARD = '#16161E';
export const EV_CARD_INNER = '#12121E';
export const EV_MUTED = '#8E8E93';
export const EV_ACCENT = '#7B61FF';
/** Lavande — titres type « En direct. » (accueil connexion). */
export const EV_LAVENDER = '#c4b5fd';
export const EV_LINE = 'rgba(255,255,255,0.08)';

/** Filet d’atmosphère haut d’écran (accueil, messages, agenda…) — unifier les fonds. */
export const EV_PAGE_AMBIENT =
  'radial-gradient(50% 32% at 50% 0%, rgba(123, 97, 255, 0.14), transparent 70%)';

/**
 * Fond d’atmosphère type Apple (LIRI sombre) : halos violets/bleus, profondeur, sans assets.
 * @param {string} base — ex. `EV_BG`
 */
export function evHaloAtmosphere(base = EV_BG) {
  return [
    'radial-gradient(ellipse 120% 70% at 50% -15%, rgba(99, 102, 241, 0.28) 0%, rgba(99, 102, 241, 0.06) 38%, transparent 58%)',
    'radial-gradient(ellipse 90% 55% at -5% 18%, rgba(59, 130, 246, 0.2) 0%, transparent 52%)',
    'radial-gradient(ellipse 85% 50% at 102% 22%, rgba(168, 85, 247, 0.18) 0%, transparent 52%)',
    'radial-gradient(ellipse 100% 55% at 50% 108%, rgba(15, 15, 35, 0.65) 0%, rgba(0,0,0,0.35) 40%, transparent 65%)',
    'radial-gradient(ellipse 70% 40% at 50% 48%, rgba(123, 97, 255, 0.05) 0%, transparent 65%)',
    `linear-gradient(180deg, #101018 0%, ${base} 16%, ${base} 84%, #040408 100%)`,
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

/** Pointillé de grain (très discret) — overlay sur l’atmosphère. */
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
  hero: '0 24px 50px -20px rgba(40, 20, 80, 0.45), inset 0 1px 0 rgba(255,255,255,0.1)',
  tab: '0 4px 18px -4px rgba(123, 97, 255, 0.4)',
  cta: '0 8px 28px -6px rgba(123, 97, 255, 0.42)',
};

function readMessagesTabBadgeFromEnv() {
  try {
    const v = import.meta.env?.VITE_ELEVE_MESSAGES_TAB_BADGE;
    if (v === undefined || v === '') return 0;
    const n = parseInt(String(v), 10);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.min(99, n);
  } catch {
    return 0;
  }
}

/**
 * Badge rouge onglet Messages. Défaut 0. Pour retrouver la maquette (ex. « 2 ») :
 * `VITE_ELEVE_MESSAGES_TAB_BADGE=2` dans `.env` local.
 */
export const EV_MSG_TAB_BADGE = readMessagesTabBadgeFromEnv();

export function firstNameFromUser(user) {
  return (
    user?.user_metadata?.full_name?.split?.(' ')?.[0] ||
    user?.email?.split?.('@')?.[0] ||
    'Élève'
  );
}
