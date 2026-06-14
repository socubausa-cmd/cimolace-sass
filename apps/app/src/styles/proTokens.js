/**
 * Studio Pro — Design Tokens (DaVinci Resolve / Premiere Pro inspiration)
 *
 * Philosophie :
 *   - Fond très sombre (matte black + gris charbon), pas de couleur saturée dominante
 *   - Accent doré ISNA (#D4AF37) utilisé UNIQUEMENT sur l'action primaire / l'élément actif
 *   - Hiérarchie de profondeur par bg stepping (0 → 5) et borders très fines
 *   - Typographie ultra-compacte (11/12/13 px), majuscules sur labels de panel
 *   - Coins légèrement arrondis (4/6 px), pas de glow sauf selected state
 */

export const proColors = {
  // Surfaces empilées (du plus profond au plus proche de l'utilisateur)
  surface0: '#0B0C0E',     // fond absolu (canvas derrière tout)
  surface1: '#111317',     // grands panneaux (sidebar, inspector)
  surface2: '#171A1F',     // panneau actif / header de panneau
  surface3: '#1D2127',     // input, carte, bouton secondaire
  surface4: '#252A31',     // bouton hover, input focus
  surface5: '#323842',     // overlay, tooltip, sélection
  // Text
  textPrimary: '#E8EAEE',
  textSecondary: '#9BA1AC',
  textMuted: '#61656D',
  textDisabled: '#3E424A',
  // Borders
  border: 'rgba(255,255,255,0.06)',
  borderStrong: 'rgba(255,255,255,0.10)',
  borderAccent: 'rgba(212,175,55,0.35)',
  // Accent primaire (ISNA gold)
  accent: '#D4AF37',
  accentSoft: 'rgba(212,175,55,0.14)',
  accentOutline: 'rgba(212,175,55,0.45)',
  accentGlow: 'rgba(212,175,55,0.65)',
  // Status
  ok: '#22C55E',
  warn: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  // Rec dot (broadcast live)
  rec: '#E04B3F',
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
  panel: '0 1px 0 rgba(255,255,255,0.03), 0 8px 24px rgba(0,0,0,0.35)',
  inspector: 'inset 1px 0 0 rgba(255,255,255,0.03)',
  toolbar: '0 1px 0 rgba(0,0,0,0.4)',
  flyout: '0 12px 48px rgba(0,0,0,0.55), 0 2px 0 rgba(0,0,0,0.3)',
  selected: '0 0 0 1px rgba(212,175,55,0.55), 0 0 18px rgba(212,175,55,0.18)',
};

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
  // Font stacks (reuse app's existing stack)
  ui: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif',
  mono: '"JetBrains Mono", "SF Mono", Menlo, Consolas, monospace',
  // Sizes (pro apps are tight)
  xxs: '10px',
  xs: '11px',
  sm: '12px',
  base: '13px',
  md: '14px',
  lg: '16px',
  // Letter spacing for labels
  tracking: {
    label: '0.06em',   // panel headers
    caps: '0.14em',    // caps labels
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
    fontSize: proType.xs,
    fontWeight: 600,
    letterSpacing: proType.tracking.label,
    textTransform: 'uppercase',
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
