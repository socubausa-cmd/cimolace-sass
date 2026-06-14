import React from 'react';
import LivesLibraryContent from '@/components/liri/lives/LivesLibraryContent';
import { LiriMobileScreenShell } from '@/components/liri/mobile-liri/LiriMobileScreenShell';

/**
 * Live LIRI mobile : même données que /lives, présentation compacte (sans quitter /m/liri/live).
 */
export default function MobileLiveScreen() {
  return (
    <LiriMobileScreenShell contentClassName="overflow-y-auto pb-8 pt-1">
      <LivesLibraryContent variant="liriMobile" />
    </LiriMobileScreenShell>
  );
}
