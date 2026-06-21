import React, { useMemo } from 'react';
import { getLiveHostSessionRootStyle } from '@/features/live/host/liveHostSessionRootStyle';
import { buildLiveShellCssVars } from '@/features/live/host/liveHostTheme';
import { useTenantBranding } from '@/hooks/useTenantBranding';

/**
 * Conteneur racine session live (phase principale) : style shell + `children` (aperçus, grille, slots).
 */
export function LiveHostLiveSessionChrome({
  isGuestUi,
  previewMobileMaquette,
  liveShell,
  lhLayoutCompact,
  children,
}) {
  const { branding, cssVars } = useTenantBranding();
  const liveShellVars = useMemo(() => buildLiveShellCssVars(liveShell, branding), [liveShell, branding]);
  const rootStyle = useMemo(
    () => ({
      ...getLiveHostSessionRootStyle({ liveShell, lhLayoutCompact }),
      ...cssVars,
      ...liveShellVars,
      // Neutralise l'accent tenant (--school-*) sur l'ambre LIRI → plus de grille/accent violet froid.
      '--school-accent': 'var(--lh-accent, #d4a36a)',
      '--school-accent-rgb': '212, 163, 106',
      '--school-primary': 'var(--lh-accent, #d4a36a)',
      backgroundColor: 'var(--lh-page-bg, #262624)',
      backgroundImage: liveShell.pageMesh,
      fontFamily: 'var(--school-font-family, system-ui, -apple-system, sans-serif)',
    }),
    [liveShell, lhLayoutCompact, cssVars, liveShellVars],
  );

  return (
    <div
      className={isGuestUi ? 'liri-live-shell--guest' : 'liri-live-shell--host'}
      data-lh-mobile-preview={!isGuestUi && previewMobileMaquette ? '1' : undefined}
      data-school-shell="liri-live-room"
      data-tenant-brand={branding.name}
      style={rootStyle}
    >
      {children}
    </div>
  );
}
