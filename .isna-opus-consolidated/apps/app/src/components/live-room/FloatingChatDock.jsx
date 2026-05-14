import React from 'react';

export default function FloatingChatDock({ children }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0d1420]/80 backdrop-blur-xl">
      {children}
    </div>
  );
}
