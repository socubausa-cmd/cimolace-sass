/**
 * JETONS DE LA CONSOLE CIMOLACE.
 *
 * Avant ce fichier, chaque page admin recopiait sa propre ligne de onze
 * hexadécimaux : trois palettes étrangères cohabitaient dans une même barre
 * latérale (slate-navy pour la coque, GitHub-dark + violet pour le corps, clair
 * pour six pages), et rien n'était corrigeable en un seul endroit.
 *
 * La source est la directive artistique du produit (docs/LIRI_DIRECTIVE_ARTISTIQUE.md) :
 * fond chaud #262624, corail #d97757 pour l'action et la sélection.
 * ⛔ Bannis : navy, violet, teal, or, dégradés décoratifs.
 */

export const T = {
  // Surfaces, de la plus profonde à la plus haute
  bg: '#262624',
  panel: '#2b2926',
  panel2: '#33322e',
  rail: '#211f1d',

  // Encre — `muted` reste au-dessus de 4,5:1 sur les trois surfaces
  ink: '#f5f4ee',
  muted: '#a8a49a',
  faint: '#807c74',

  line: 'rgba(245,244,238,.09)',
  line2: 'rgba(245,244,238,.16)',

  /** Action et sélection. Jamais décoratif, jamais sur un état inactif. */
  coral: '#d97757',
  coralSoft: 'rgba(217,119,87,.14)',

  /** Sémantique — un sens et un seul par couleur. */
  ok: '#6f9e6f',      // statut « réussi », jamais un bouton
  warn: '#d99a5b',    // « attention, action requise »
  danger: '#b3372f',  // irréversible ; encre claire dessus, contraste vérifié
};

/**
 * TABLE DE CORRESPONDANCE HÉRITÉE.
 *
 * Quatre pages admin déclaraient chacune leur propre `const C = { bg:'#0d1117',
 * violet:'#7c3aed', … }` — mêmes noms de clés, mêmes valeurs recopiées à la
 * main. Elles importent maintenant cet objet : un seul endroit à corriger, et
 * les couleurs bannies (violet, bleu) sont ramenées sur le corail d'action sans
 * qu'il faille toucher une ligne de JSX dans chaque page.
 *
 * ⚠️ Ce n'est PAS un jeu de jetons à étendre : c'est un pont, à faire
 * disparaître au fur et à mesure que les pages passent aux jetons `T`.
 */
export const C_LEGACY = {
  bg: T.bg,
  panel: T.panel,
  panel2: T.panel2,
  border: T.line,
  border2: T.line2,
  text: T.ink,
  muted: T.muted,
  muted2: T.faint,
  // Bannis par la charte → ramenés sur l'accent unique.
  violet: T.coral,
  violetLt: '#e08663',
  blue: T.coral,
  // Sémantiques conservées, mais désaturées pour tenir sur un fond chaud.
  green: T.ok,
  orange: T.warn,
  red: T.danger,
};

/** Échelle typographique fermée — pas de 12,5 px décidé à l'œil. */
export const FS = { xs: 11, sm: 12, base: 13, md: 14, lg: 16, xl: 20, hero: 26, mega: 46 };

/** Un rayon par famille : cliquable, carte, pilule. */
export const R = { control: 8, card: 12, pill: 999 };

/** Tous les chiffres s'alignent verticalement — l'écran est chiffré de bout en bout. */
export const NUM = { fontVariantNumeric: 'tabular-nums' };

/**
 * Les styles en ligne ne peuvent PAS exprimer :hover / :focus-visible / :disabled.
 * C'était la cause racine de l'absence totale d'états sur ces écrans — et d'un
 * `outline:none` posé sur sept champs sans remplaçant, qui rendait le formulaire
 * de retrait inutilisable au clavier. Une feuille unique, injectée une fois.
 */
export const CONSOLE_CSS = `
.cml-focus:focus-visible { outline: 2px solid ${T.coral}; outline-offset: 2px; }
.cml-btn { display:inline-flex; align-items:center; gap:7px; border-radius:${R.control}px;
  font-size:${FS.base}px; font-weight:600; cursor:pointer; border:1px solid transparent;
  padding:9px 16px; transition:background-color .15s ease, border-color .15s ease, color .15s ease; }
.cml-btn:focus-visible { outline: 2px solid ${T.coral}; outline-offset: 2px; }
.cml-btn-sm { padding:5px 12px; font-size:${FS.sm}px; }
.cml-btn-primary { background:${T.coral}; color:#20140f; }
.cml-btn-primary:hover:not(:disabled) { background:#e08663; }
.cml-btn-ghost { background:transparent; color:${T.ink}; border-color:${T.line2}; }
.cml-btn-ghost:hover:not(:disabled) { background:rgba(245,244,238,.06); border-color:${T.line2}; }
.cml-btn-danger { background:${T.danger}; color:${T.ink}; }
.cml-btn-danger:hover:not(:disabled) { background:#c53f36; }
.cml-btn:disabled { cursor:not-allowed; opacity:.42; }
.cml-input { width:100%; box-sizing:border-box; background:${T.bg}; color:${T.ink};
  border:1px solid ${T.line2}; border-radius:${R.control}px; padding:10px 12px;
  font-size:${FS.md}px; font-family:inherit; }
.cml-input:focus-visible { outline:2px solid ${T.coral}; outline-offset:1px; border-color:transparent; }
.cml-input::placeholder { color:${T.faint}; }
.cml-tab { background:transparent; border:none; border-bottom:2px solid transparent;
  color:${T.muted}; font-size:${FS.md}px; font-weight:600; padding:10px 2px; cursor:pointer;
  font-family:inherit; transition:color .15s ease, border-color .15s ease; }
.cml-tab:hover { color:${T.ink}; }
.cml-tab[aria-selected="true"] { color:${T.coral}; border-bottom-color:${T.coral}; }
.cml-tab:focus-visible { outline:2px solid ${T.coral}; outline-offset:2px; border-radius:4px; }
.cml-row:hover { background:rgba(245,244,238,.03); }
@keyframes cml-pulse { 0%,100% { opacity:.35 } 50% { opacity:.18 } }
.cml-skeleton { background:${T.panel2}; border-radius:6px; animation:cml-pulse 1.4s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .cml-skeleton { animation:none; opacity:.28 }
  .cml-btn, .cml-tab { transition:none }
}
`;

/** Injecte la feuille une seule fois, quel que soit le nombre d'écrans montés. */
export function useConsoleCss() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('cml-console-css')) return;
  const el = document.createElement('style');
  el.id = 'cml-console-css';
  el.textContent = CONSOLE_CSS;
  document.head.appendChild(el);
}
