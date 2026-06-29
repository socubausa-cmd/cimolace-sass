import React from 'react';
import { LiriPortalShell } from '@/components/liri/LiriPortalShell';
import LivesLibraryContent from '@/components/liri/lives/LivesLibraryContent';
import LiriFreeTierBanner from '@/components/liri/LiriFreeTierBanner';

// Bibliothèque des Lives = APP du portail LIRI (rail « Lives » actif). Enveloppée dans
// LiriPortalShell pour rester DANS le portail chaud — sans ça, /lives retombait sur le
// Header global (menu vitrine/école) = fuite hors-portail.
const LivesLibraryPage = () => (
  <LiriPortalShell active="lives">
    <div className="h-full min-h-0 overflow-auto p-6 pb-20">
      <LiriFreeTierBanner className="mb-6" />
      <LivesLibraryContent variant="default" />
    </div>
  </LiriPortalShell>
);

export default LivesLibraryPage;
