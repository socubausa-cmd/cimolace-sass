import React, { useMemo } from 'react';
import { getLiveHostSessionRootStyle } from '@/features/live/host/liveHostSessionRootStyle';

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
  const rootStyle = useMemo(
    () => getLiveHostSessionRootStyle({ liveShell, lhLayoutCompact }),
    [liveShell, lhLayoutCompact],
  );

  return (
    <div
      className={isGuestUi ? 'liri-live-shell--guest' : 'liri-live-shell--host'}
      data-lh-mobile-preview={!isGuestUi && previewMobileMaquette ? '1' : undefined}
      style={rootStyle}
    >
      {children}
    </div>
  );
}
