import React from 'react';

export default function LiveRoomHeader({ stateLabel = '' }) {
  return (
    <div className="absolute top-4 left-4 z-30">
      <div className="h-11 px-4 rounded-full bg-white/[0.04] backdrop-blur-xl text-white border border-white/10 shadow-[0_8px_30px_-20px_rgba(120,170,255,0.6)] inline-flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        <span className="text-[13px] font-medium tracking-wide">Live-Room Immersif</span>
        {stateLabel ? <span className="text-[10px] text-[color-mix(in_srgb,var(--school-accent)_90%,transparent)]">{stateLabel}</span> : null}
      </div>
    </div>
  );
}
