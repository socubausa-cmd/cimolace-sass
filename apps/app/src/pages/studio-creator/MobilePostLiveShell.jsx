import React from 'react';
import LivePostIntelligencePage from '@/pages/studio-creator/studio/LivePostIntelligencePage';
import { LiriMobileScreenShell } from '@/components/liri/mobile-liri/LiriMobileScreenShell';

/** Fiche post-live / NeuroRecall dans le shell LIRI mobile (même logique que le studio). */
export default function MobilePostLiveShell() {
  return (
    <LiriMobileScreenShell
      contentClassName="overflow-y-auto overflow-x-hidden pb-[max(1.5rem,env(safe-area-inset-bottom))]"
    >
      <LivePostIntelligencePage mobileLiriShell />
    </LiriMobileScreenShell>
  );
}
