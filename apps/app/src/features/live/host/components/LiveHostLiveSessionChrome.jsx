import React, { useMemo } from 'react';
import { getLiveHostSessionRootStyle } from '@/features/live/host/liveHostSessionRootStyle';
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
  const { branding, cssVars, shellTheme } = useTenantBranding();
  const rootStyle = useMemo(
    () => ({
      ...getLiveHostSessionRootStyle({ liveShell, lhLayoutCompact }),
      ...cssVars,
      background: 'var(--school-background, #0F1117)',
      backgroundImage: shellTheme.gridBackground?.backgroundImage,
      backgroundSize: shellTheme.gridBackground?.backgroundSize,
      fontFamily: 'var(--school-font-family, system-ui, -apple-system, sans-serif)',
    }),
    [liveShell, lhLayoutCompact, cssVars, shellTheme],
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
