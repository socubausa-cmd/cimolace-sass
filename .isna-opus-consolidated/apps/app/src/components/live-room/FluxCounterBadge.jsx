import React from 'react';

export default function FluxCounterBadge({ count = 0 }) {
  if (!count) return null;
  return (
    <span className="inline-flex items-center justify-center h-6 min-w-6 px-1.5 rounded-full bg-white/10 border border-white/15 text-[10px] text-white/85">
      +{count}
    </span>
  );
}
