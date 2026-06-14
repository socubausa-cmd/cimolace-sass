import React from 'react';

export default function MediaFocusSurface({ children }) {
  return (
    <div className="rounded-[26px] border border-white/12 bg-black/30 backdrop-blur-xl overflow-hidden">
      {children}
    </div>
  );
}
