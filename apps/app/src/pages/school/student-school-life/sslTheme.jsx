/**
 * sslTheme — Thème host-aware de l'espace ÉLÈVE WEB (/student-school-life).
 *
 * POURQUOI : les pages élève (Dashboard, Notes, Absences, Forum…) sont partagées
 * avec le PORTAIL PROFESSEUR (TeacherPortalPage), qui doit RESTER SOMBRE. On ne
 * peut donc pas « flipper » les couleurs en dur dans les pages. À la place :
 *
 *   - défaut = SOMBRE (T_DARK) → le portail prof et tout consommateur sans
 *     Provider gardent EXACTEMENT le rendu actuel (zéro régression) ;
 *   - le shell ÉLÈVE (StudentSchoolLifePage) enveloppe son contenu dans
 *     <SslThemeProvider mode="light"> + className "ssl-light" → passage au CLAIR.
 *
 * Deux familles de pages, deux leviers (même source de vérité = `mode`) :
 *   1. Pages à objet-tokens JS `T` (styles inline) → `useSslTheme().T` renvoie
 *      T_LIGHT ou T_DARK. (cf. usage dans StudentNotesPage, StudentDashboardPage…)
 *   2. Pages en utilitaires Tailwind/shadcn en dur (bg-[#192734], text-white…) →
 *      remap CSS scopé `.ssl-light` ci-dessous (sslLightStyles), injecté une fois.
 *
 * Palette claire = charte « Wix Studio » : canvas #F4F5F7, cartes #FFFFFF,
 * texte #18181B / #52525B / #71717A, accent or #D4AF37 (déco) / #8A6D1A (texte-lien
 * lisible AA), violet #7C3AED discret. Badges/icônes colorés CONSERVÉS.
 */
import React, { createContext, useContext, useMemo } from 'react';

const MONO = "'JetBrains Mono','Fira Code',monospace";

/* ─────────────────────────── TOKENS SOMBRES (référence actuelle) ───────────────────────────
 * Superset de tous les `const T` des pages élève — défaut, identique à l'existant. */
export const T_DARK = {
  bg:         '#0b0b0f',
  surface:    '#12111a',
  surface2:   '#192734',
  surface3:   '#1e2840',
  border:     'rgba(255,255,255,0.07)',
  borderMid:  'rgba(255,255,255,0.12)',
  gold:       '#D4AF37',
  goldText:   '#D4AF37', // texte/lien doré sur fond sombre (lisible tel quel)
  goldDim:    'rgba(212,175,55,0.12)',
  goldMid:    'rgba(212,175,55,0.28)',
  violet:     '#7C3AED',
  violetDim:  'rgba(124,58,237,0.12)',
  violetMid:  'rgba(124,58,237,0.28)',
  cyan:       '#00E5FF',
  cyanDim:    'rgba(0,229,255,0.08)',
  teal:       '#14B8A6',
  success:    '#22C55E',
  successDim: 'rgba(34,197,94,0.10)',
  warning:    '#F59E0B',
  warningDim: 'rgba(245,158,11,0.10)',
  danger:     '#EF4444',
  dangerDim:  'rgba(239,68,68,0.10)',
  t1: '#F5F5F7',
  t2: 'rgba(245,245,247,0.65)',
  t3: 'rgba(245,245,247,0.38)',
  t4: 'rgba(245,245,247,0.16)',
  mono: MONO,
};

/* ─────────────────────────── TOKENS CLAIRS (Wix Studio) ───────────────────────────
 * Même forme que T_DARK. Contraste AA garanti sur cartes blanches. */
export const T_LIGHT = {
  bg:         '#F4F5F7', // canvas zone contenu
  surface:    '#FFFFFF', // cartes / surfaces
  surface2:   '#FFFFFF',
  surface3:   '#F4F5F7', // état hover de ligne (légèrement creusé)
  border:     'rgba(0,0,0,0.08)',
  borderMid:  'rgba(0,0,0,0.14)',
  gold:       '#D4AF37', // accent décoratif (barres, halos, points)
  goldText:   '#8A6D1A', // texte / lien doré LISIBLE (AA ≥ 4.5:1 sur blanc)
  goldDim:    'rgba(212,175,55,0.14)',
  goldMid:    'rgba(212,175,55,0.40)',
  violet:     '#7C3AED',
  violetDim:  'rgba(124,58,237,0.10)',
  violetMid:  'rgba(124,58,237,0.30)',
  cyan:       '#0E7490', // cyan lisible sur blanc (le #00E5FF natif est illisible)
  cyanDim:    'rgba(14,116,144,0.08)',
  teal:       '#0F766E',
  success:    '#15803D', // vert lisible sur blanc
  successDim: 'rgba(34,197,94,0.12)',
  warning:    '#B45309', // ambre lisible sur blanc
  warningDim: 'rgba(245,158,11,0.14)',
  danger:     '#DC2626',
  dangerDim:  'rgba(239,68,68,0.10)',
  t1: '#18181B', // texte primaire
  t2: '#52525B', // texte secondaire
  t3: '#71717A', // texte atténué
  t4: 'rgba(0,0,0,0.18)',
  mono: MONO,
};

const SslThemeContext = createContext('dark');

/** Fournit le mode de thème à l'arbre élève. Défaut = 'dark' (= existant). */
export function SslThemeProvider({ mode = 'dark', children }) {
  return <SslThemeContext.Provider value={mode}>{children}</SslThemeContext.Provider>;
}

/**
 * Hook de thème. Renvoie { mode, isLight, T }.
 * - Sans Provider (ex. portail prof) → mode 'dark' → T_DARK → rendu inchangé.
 * - Sous le shell élève → mode 'light' → T_LIGHT.
 */
export function useSslTheme() {
  const mode = useContext(SslThemeContext);
  return useMemo(
    () => ({ mode, isLight: mode === 'light', T: mode === 'light' ? T_LIGHT : T_DARK }),
    [mode],
  );
}

/* ─────────────────────────── REMAP CSS CLAIR (pages Tailwind/shadcn) ───────────────────────────
 * Scopé `.ssl-light` : ne touche QUE le contenu du shell élève. Remappe les
 * utilitaires sombres en dur (bg-[#192734], text-white, bg-black/20, gray-*…)
 * vers la palette claire. Les badges colorés (green/red/amber/violet) sont
 * laissés tels quels — ils ressortent sur blanc.
 *
 * NB : on neutralise aussi `.ssl-light .forum-dark` car les pages Forum
 * (thread / nouvelle question) ont été écrites EN CLAIR à l'origine puis
 * re-sombrées via `.forum-dark`. Côté élève on veut donc le rendu clair natif. */
export const SSL_LIGHT_CLASS = 'ssl-light';

const sslLightStyles = `
/* ===== Espace élève — thème clair (scopé .ssl-light) ===== */
.ssl-light { color: #18181B; }

/* — Surfaces sombres en dur → cartes blanches — */
.ssl-light .bg-\\[\\#192734\\],
.ssl-light .bg-\\[\\#12111a\\],
.ssl-light .bg-\\[\\#151a21\\],
.ssl-light .bg-\\[\\#151a21\\]\\/80,
.ssl-light .bg-\\[\\#1e2840\\],
.ssl-light .bg-slate-900,
.ssl-light .bg-slate-800,
.ssl-light .bg-gray-900,
.ssl-light .bg-gray-800 { background-color: #FFFFFF !important; }

.ssl-light .bg-black\\/20,
.ssl-light .bg-black\\/30,
.ssl-light .bg-black\\/40,
.ssl-light .bg-white\\/5,
.ssl-light .bg-white\\/10 { background-color: #F4F5F7 !important; }

.ssl-light .bg-black\\/50,
.ssl-light .bg-black\\/60 { background-color: rgba(0,0,0,0.06) !important; }

/* — Texte clair en dur → texte sombre lisible — */
.ssl-light .text-white { color: #18181B !important; }
.ssl-light .text-gray-300,
.ssl-light .text-gray-400,
.ssl-light .text-slate-300,
.ssl-light .text-slate-400 { color: #52525B !important; }
.ssl-light .text-gray-500,
.ssl-light .text-slate-500 { color: #71717A !important; }

/* Lien / accent doré : le #D4AF37 est illisible sur blanc → teinte AA */
.ssl-light .text-\\[var\\(--school-accent\\)\\] { color: #8A6D1A !important; }

/* — Bordures « verre » invisibles sur blanc → bordures grises nettes — */
.ssl-light .border-white\\/5,
.ssl-light .border-white\\/10,
.ssl-light .border-white\\/20,
.ssl-light .border-gray-700,
.ssl-light .border-gray-800,
.ssl-light .border-slate-700,
.ssl-light .border-slate-800 { border-color: rgba(0,0,0,0.08) !important; }

/* — Survols sombres → survols clairs discrets — */
.ssl-light .hover\\:bg-white\\/5:hover,
.ssl-light .hover\\:bg-white\\/10:hover { background-color: rgba(0,0,0,0.04) !important; }

/* — Dégradés d'overlay d'image (from-#192734) → s'estompe en blanc — */
.ssl-light .from-\\[\\#192734\\] { --tw-gradient-from: #FFFFFF var(--tw-gradient-from-position) !important;
  --tw-gradient-to: rgba(255,255,255,0) var(--tw-gradient-to-position) !important;
  --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to) !important; }

/* — Ombres : plus discrètes en clair — */
.ssl-light .shadow-lg,
.ssl-light .shadow-xl,
.ssl-light .shadow-2xl { box-shadow: 0 1px 3px rgba(0,0,0,0.06) !important; }

/* ===== Pages Forum (écrites en clair, re-sombrées via .forum-dark) =====
 * Sous l'espace élève on RÉTABLIT le clair natif en annulant le remap sombre.
 * On EXCLUT la vue conversation immersive (.forum-immersive) : elle garde son
 * fond aurore sombre volontaire (et reste partagée telle quelle avec le portail prof). */
.ssl-light .forum-dark:not(.forum-immersive) { color: #18181B; }
.ssl-light .forum-dark:not(.forum-immersive) .bg-white { background-color: #FFFFFF !important; }
.ssl-light .forum-dark:not(.forum-immersive) .bg-gray-50 { background-color: #F4F5F7 !important; }
.ssl-light .forum-dark:not(.forum-immersive) .bg-gray-100,
.ssl-light .forum-dark:not(.forum-immersive) .hover\\:bg-gray-100:hover { background-color: #EFF0F3 !important; }
.ssl-light .forum-dark:not(.forum-immersive) .hover\\:bg-gray-200:hover { background-color: #E4E5E9 !important; }
.ssl-light .forum-dark:not(.forum-immersive) .bg-green-50 { background-color: rgba(34,197,94,0.10) !important; }
.ssl-light .forum-dark:not(.forum-immersive) .bg-green-100,
.ssl-light .forum-dark:not(.forum-immersive) .hover\\:bg-green-100:hover { background-color: rgba(34,197,94,0.16) !important; }
.ssl-light .forum-dark:not(.forum-immersive) .bg-red-50 { background-color: rgba(239,68,68,0.08) !important; }
.ssl-light .forum-dark:not(.forum-immersive) .bg-red-100,
.ssl-light .forum-dark:not(.forum-immersive) .hover\\:bg-red-100:hover { background-color: rgba(239,68,68,0.14) !important; }
/* Indigo natif → accent or de l'école (déco) ; CTA reste doré */
.ssl-light .forum-dark:not(.forum-immersive) .bg-indigo-50 { background-color: rgba(212,175,55,0.10) !important; }
.ssl-light .forum-dark:not(.forum-immersive) .bg-indigo-100 { background-color: rgba(212,175,55,0.18) !important; }
.ssl-light .forum-dark:not(.forum-immersive) .bg-indigo-600 { background-color: var(--school-accent) !important; }
.ssl-light .forum-dark:not(.forum-immersive) .hover\\:bg-indigo-700:hover { background-color: #b8902b !important; }
.ssl-light .forum-dark:not(.forum-immersive) .bg-\\[\\#0a0a0f\\] { background-color: var(--school-accent) !important; color: #18181B !important; }
.ssl-light .forum-dark:not(.forum-immersive) .hover\\:bg-\\[\\#5b3df5\\]:hover { background-color: #b8902b !important; }
/* Texte forum → échelle sombre-sur-clair */
.ssl-light .forum-dark:not(.forum-immersive) .text-gray-900 { color: #18181B !important; }
.ssl-light .forum-dark:not(.forum-immersive) .text-gray-700 { color: #3F3F46 !important; }
.ssl-light .forum-dark:not(.forum-immersive) .text-gray-600 { color: #52525B !important; }
.ssl-light .forum-dark:not(.forum-immersive) .text-gray-500 { color: #71717A !important; }
.ssl-light .forum-dark:not(.forum-immersive) .text-gray-400 { color: #71717A !important; }
.ssl-light .forum-dark:not(.forum-immersive) .text-gray-300 { color: #A1A1AA !important; }
.ssl-light .forum-dark:not(.forum-immersive) .text-indigo-600,
.ssl-light .forum-dark:not(.forum-immersive) .text-indigo-700,
.ssl-light .forum-dark:not(.forum-immersive) .text-indigo-500 { color: #8A6D1A !important; }
.ssl-light .forum-dark:not(.forum-immersive) .hover\\:text-gray-900:hover { color: #18181B !important; }
.ssl-light .forum-dark:not(.forum-immersive) .hover\\:text-gray-700:hover { color: #3F3F46 !important; }
.ssl-light .forum-dark:not(.forum-immersive) .hover\\:text-indigo-700:hover { color: #6B540F !important; }
.ssl-light .forum-dark:not(.forum-immersive) .text-green-600 { color: #15803D !important; }
.ssl-light .forum-dark:not(.forum-immersive) .text-green-700 { color: #166534 !important; }
/* Bordures forum */
.ssl-light .forum-dark:not(.forum-immersive) .border-gray-200 { border-color: rgba(0,0,0,0.08) !important; }
.ssl-light .forum-dark:not(.forum-immersive) .border-gray-300 { border-color: rgba(0,0,0,0.14) !important; }
.ssl-light .forum-dark:not(.forum-immersive) .border-green-200,
.ssl-light .forum-dark:not(.forum-immersive) .border-green-300 { border-color: rgba(34,197,94,0.30) !important; }
.ssl-light .forum-dark:not(.forum-immersive) .border-red-200 { border-color: rgba(239,68,68,0.30) !important; }
.ssl-light .forum-dark:not(.forum-immersive) .border-t { border-top-color: rgba(0,0,0,0.08) !important; }
.ssl-light .forum-dark:not(.forum-immersive) .border-b { border-bottom-color: rgba(0,0,0,0.08) !important; }
/* Champs forum */
.ssl-light .forum-dark:not(.forum-immersive) select,
.ssl-light .forum-dark:not(.forum-immersive) input[type="text"],
.ssl-light .forum-dark:not(.forum-immersive) input[type="number"],
.ssl-light .forum-dark:not(.forum-immersive) textarea {
  background-color: #FFFFFF !important;
  color: #18181B !important;
  border-color: rgba(0,0,0,0.14) !important;
}
.ssl-light .forum-dark:not(.forum-immersive) textarea::placeholder,
.ssl-light .forum-dark:not(.forum-immersive) input::placeholder { color: #A1A1AA !important; }
.ssl-light .forum-dark:not(.forum-immersive) option { background-color: #FFFFFF; color: #18181B; }
/* Avatars dégradés → restent colorés (violet→cyan d'origine), on annule le navy→or */
.ssl-light .forum-dark:not(.forum-immersive) .from-indigo-500 {
  --tw-gradient-from: #7C3AED var(--tw-gradient-from-position) !important;
  --tw-gradient-to: rgba(124,58,237,0) var(--tw-gradient-to-position) !important;
  --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to) !important;
}
.ssl-light .forum-dark:not(.forum-immersive) .to-purple-600 { --tw-gradient-to: #9333EA var(--tw-gradient-to-position) !important; }
`;

/* ─────────────────────────── PONT POUR LES OBJETS-TOKENS `T` AU SCOPE MODULE ───────────────────────────
 * Beaucoup de pages définissent `const T = {...}` AU SCOPE MODULE et le référencent
 * depuis des sous-composants (StatCard, TYPE_META…) qui ne peuvent pas appeler de hook.
 * Pour migrer sans réécrire ces sous-composants, on expose un `T` "vivant" : un Proxy
 * qui lit le mode courant. Le composant PARENT publie le mode via `useSslThemeMode()`
 * (qui appelle `setSslThemeMode`) AVANT que ses enfants ne soient rendus — même passe
 * de rendu synchrone, donc fiable. Une page = un seul hôte (clair OU sombre), pas de mélange.
 */
let _sslMode = 'dark';
/** Publie le mode courant pour le pont Proxy. À appeler en tête du composant parent. */
export function setSslThemeMode(mode) { _sslMode = mode === 'light' ? 'light' : 'dark'; }
/** Hook combiné : renvoie le mode ET le publie pour `themeProxy`. */
export function useSslThemeMode() {
  const mode = useContext(SslThemeContext);
  setSslThemeMode(mode);
  return mode;
}
/** Objet-tokens "vivant" à utiliser à la place de `const T = {...}`. Lit T_LIGHT/T_DARK selon le mode publié. */
export const themeProxy = new Proxy(
  {},
  {
    get(_t, key) { return (_sslMode === 'light' ? T_LIGHT : T_DARK)[key]; },
    has(_t, key) { return key in (_sslMode === 'light' ? T_LIGHT : T_DARK); },
    ownKeys() { return Reflect.ownKeys(_sslMode === 'light' ? T_LIGHT : T_DARK); },
    getOwnPropertyDescriptor(_t, key) {
      return Reflect.getOwnPropertyDescriptor(_sslMode === 'light' ? T_LIGHT : T_DARK, key);
    },
  },
);

/** Injecte le remap clair une seule fois (id unique, idempotent). */
export function ensureSslLightStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('ssl-light-theme-styles')) return;
  const el = document.createElement('style');
  el.id = 'ssl-light-theme-styles';
  el.textContent = sslLightStyles;
  document.head.appendChild(el);
}
