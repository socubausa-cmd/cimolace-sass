/**
 * Studio Pro — jetons de design (palette CHAUDE LIRI)
 *
 * ── Pourquoi cette réécriture ────────────────────────────────────────────────
 * Ce module était calqué sur DaVinci Resolve / Premiere : charbon BLEUTÉ
 * (#0B0C0E → #323842), texte slate froid (#9BA1AC), accent or ISNA (#D4AF37)
 * et un `info` bleu Tailwind (#3B82F6). Trois problèmes :
 *   1. la charte LIRI bannit explicitement le froid (bleu/indigo/violet/cyan/
 *      teal/slate) et l'or froid #D4AF37 ;
 *   2. dès qu'une page « pro » entre dans la coque du portail (fond #262624),
 *      ses panneaux bleutés se détachaient comme une pièce rapportée ;
 *   3. plusieurs valeurs de texte tombaient sous 4,5:1 une fois posées sur les
 *      surfaces réellement utilisées.
 *
 * ── Comment la nouvelle échelle est construite ───────────────────────────────
 * Elle est ANCRÉE sur les trois valeurs de la charte plutôt qu'inventée :
 *   surface1 = #1f1e1c (rail sombre) · surface2 = #262624 (fond) ·
 *   surface4 = #30302e (panneau). Les trois autres marches (0/3/5) sont
 *   interpolées dans la même famille chaude, ce qui garde la lisibilité de
 *   l'empilement « pro » sans réintroduire de bleu.
 *
 * ── Contrastes vérifiés (WCAG, calculés sur les surfaces réelles) ────────────
 *   textPrimary   #f5f4ee  → 13,8:1 sur base · 15,1:1 sur rail · 12,0:1 panneau
 *   textSecondary #c9c5bb  →  8,8:1 sur base ·  9,7:1 sur rail ·  7,7:1 panneau
 *   textMuted     #a8a29a  →  6,0:1 sur base ·  6,6:1 sur rail ·  5,2:1 panneau
 *   accent        #d97757  →  4,9:1 sur base ·  5,3:1 sur rail ·  4,2:1 panneau
 *   ok / warn / error      →  5,9 · 6,9 · 5,0 sur base (tous ≥ 4,5:1)
 * `textDisabled` reste volontairement bas (3,3:1) : WCAG exempte le texte
 * désactivé, et le sur-éclaircir ferait passer un champ inactif pour actif.
 *
 * ── Qui consomme ce fichier ─────────────────────────────────────────────────
 *   · studio-creator/studio-pro/tokens.js le ré-exporte tel quel
 *     → ProShell / ProTopBar / ProSideRail / ProPanel / ProStatusBar
 *     → pages StudioEntryPage et LivePreparationStudioPage.
 *   · liri/live-room/liveGuestProTokens.js l'importe puis SURCHARGE les
 *     surfaces, le texte et l'accent. Il n'héritait donc du froid que par les
 *     clés qu'il ne redéfinit pas : `border`, `borderStrong`, `ok/warn/error/
 *     info/rec`. Ces cinq-là sont désormais chaudes elles aussi — le `info`
 *     bleu #3B82F6 qui fuyait jusque dans la vue élève a disparu.
 */

export const proColors = {
  // ── Surfaces empilées (du plus profond au plus proche de l'utilisateur) ────
  surface0: '#1a1917',     // canvas absolu, un cran SOUS le rail
  surface1: '#1f1e1c',     // grands panneaux (sidebar, inspecteur) — charte « rail sombre »
  surface2: '#262624',     // panneau actif / en-tête de panneau — charte « fond »
  surface3: '#2b2a28',     // champ, carte, bouton secondaire
  surface4: '#30302e',     // survol, focus — charte « panneau »
  surface5: '#3a3835',     // overlay, infobulle, sélection
  // ── Texte ─────────────────────────────────────────────────────────────────
  textPrimary: '#f5f4ee',   // encre de la charte
  textSecondary: '#c9c5bb', // équivalent opaque de rgba(245,244,238,.78)
  textMuted: '#a8a29a',     // plancher du texte courant : ≥ 4,5:1 sur TOUTES les surfaces
  textDisabled: '#7a7469',  // inactif assumé (exempté WCAG)
  // ── Filets ────────────────────────────────────────────────────────────────
  border: 'rgba(245,244,238,0.09)',        // valeur de ligne de la charte
  borderStrong: 'rgba(245,244,238,0.16)',
  borderAccent: 'rgba(217,119,87,0.35)',
  // ── Accent primaire = CORAL (les actions) ─────────────────────────────────
  accent: '#d97757',
  accentSoft: 'rgba(217,119,87,0.14)',
  accentOutline: 'rgba(217,119,87,0.45)',
  accentGlow: 'rgba(217,119,87,0.60)',
  // ── Accent secondaire = OR CHAUD (mise en valeur non-actionnable) ──────────
  gold: '#e6cc92',
  goldSoft: 'rgba(230,204,146,0.12)',
  // ── États ─────────────────────────────────────────────────────────────────
  ok: '#8aab6b',      // olive chaud (l'émeraude #22C55E jurait sur fond terre)
  warn: '#e0a341',
  error: '#ef6a52',
  info: '#e6cc92',    // ex-#3B82F6 : l'information passe par l'or, pas par le bleu
  // ── Pastille d'enregistrement (diffusion en direct) ────────────────────────
  rec: '#e2553f',     // = teinte « en direct » du portail ; usage pastille/filet,
                      // pas texte courant (4,1:1) — pour du texte, viser `error`.
};

export const proRadii = {
  sharp: '2px',
  xs: '3px',
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  pill: '999px',
};

export const proShadow = {
  panel: '0 1px 0 rgba(245,244,238,0.03), 0 8px 24px rgba(0,0,0,0.35)',
  inspector: 'inset 1px 0 0 rgba(245,244,238,0.04)',
  toolbar: '0 1px 0 rgba(0,0,0,0.4)',
  flyout: '0 12px 48px rgba(0,0,0,0.55), 0 2px 0 rgba(0,0,0,0.3)',
  // Sélection : anneau coral, plus l'or froid.
  selected: '0 0 0 1px rgba(217,119,87,0.55), 0 0 18px rgba(217,119,87,0.20)',
  // Halo d'ambiance réutilisable par les coques immersives.
  ambient: '0 34px 100px -34px rgba(0,0,0,0.85), 0 0 130px -42px rgba(217,119,87,0.34)',
};

// Volontairement INCHANGÉ : LivePreparationStudioPage aligne des panneaux au
// pixel sur ces hauteurs. Élargir la chrome ferait perdre de la place au
// contenu — l'inverse de l'objectif.
export const proSize = {
  topBarHeight: 40,      // pro apps use 36-44
  sideRailWidth: 56,
  statusBarHeight: 26,
  panelHeaderHeight: 30,
  rowHeight: 28,
  inputHeight: 28,
  tinyButtonHeight: 22,
};

export const proType = {
  // Piles de polices — celles RÉELLEMENT chargées par index.html
  // (Fraunces / Inter / JetBrains Mono).
  ui: 'Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
  mono: '"JetBrains Mono", "SF Mono", Menlo, Consolas, monospace',
  // Serif éditoriale : réservée aux TITRES de coque, jamais au texte d'outil.
  display: "'Fraunces','Source Serif 4',Georgia,serif",
  // Tailles (l'outillage pro reste serré)
  xxs: '10px',
  xs: '11px',
  sm: '12px',
  base: '13px',
  md: '14px',
  lg: '16px',
  // Titres fluides : ils GRANDISSENT sur grand écran au lieu de rester figés.
  title: 'clamp(15px, 1.15vw, 22px)',
  hero: 'clamp(22px, 2.1vw, 38px)',
  // Interlettrage des étiquettes
  tracking: {
    label: '0.01em',   // en-têtes de panneau (plus de faux petites-capitales)
    caps: '0.14em',    // conservé pour les rares vrais sigles
  },
};

// Utilitaires inline-style (alternative à Tailwind pour les composants pro)
export const proStyles = {
  panel: {
    background: proColors.surface1,
    border: `1px solid ${proColors.border}`,
    borderRadius: proRadii.md,
    color: proColors.textPrimary,
    fontFamily: proType.ui,
    fontSize: proType.base,
    boxShadow: proShadow.panel,
  },
  panelHeader: {
    height: proSize.panelHeaderHeight,
    background: proColors.surface2,
    borderBottom: `1px solid ${proColors.border}`,
    display: 'flex',
    alignItems: 'center',
    padding: '0 10px',
    fontSize: proType.sm,
    fontWeight: 600,
    letterSpacing: proType.tracking.label,
    // Plus de `textTransform: uppercase` : un intitulé en majuscules espacées
    // au-dessus de chaque panneau est un tic décoratif qui coûte en lisibilité
    // sans rien hiérarchiser. La casse normale + la graisse suffisent.
    textTransform: 'none',
    color: proColors.textSecondary,
    userSelect: 'none',
  },
  input: {
    height: proSize.inputHeight,
    background: proColors.surface3,
    border: `1px solid ${proColors.border}`,
    borderRadius: proRadii.sm,
    padding: '0 8px',
    color: proColors.textPrimary,
    fontSize: proType.sm,
    fontFamily: proType.ui,
    outline: 'none',
  },
};
