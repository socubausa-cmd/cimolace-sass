import React from 'react';
import LivesLibraryContent from '@/components/liri/lives/LivesLibraryContent';
import LiriFreeTierBanner from '@/components/liri/LiriFreeTierBanner';

const LivesLibraryPage = () => (
  <div className="min-h-screen bg-[#0F1419] p-8 pb-20">
    <LiriFreeTierBanner className="mb-6" />
    <LivesLibraryContent variant="default" />
  </div>
);

export default LivesLibraryPage;
