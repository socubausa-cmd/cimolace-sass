import React from 'react';

export default function UnreadBadge({ count = 0 }) {
  if (!count) return null;
  const label = count > 9 ? '9+' : String(count);
  return (
    <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-[var(--school-accent)] text-[9px] font-bold text-black flex items-center justify-center shadow-[0_0_18px_rgba(212,175,55,0.55)]">
      {label}
    </span>
  );
}
