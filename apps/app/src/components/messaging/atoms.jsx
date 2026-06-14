/**
 * Atomic UI primitives shared across messaging sub-components.
 * Extracted from MessagingPage.jsx (REQ-FE-004).
 */
import React from 'react';
import { cn } from '@/lib/utils';
import { statusColors } from '@/lib/messagingUtils';

// ─── UserAvatar ───────────────────────────────────────────────────────────────

export function UserAvatar({ user, size = 'md' }) {
  const s = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-14 h-14 text-lg' : 'w-10 h-10 text-sm';
  if (user?.avatar_url || user?.avatar) {
    return (
      <img
        src={user.avatar_url || user.avatar}
        alt={user.name}
        className={cn(s, 'rounded-full object-cover ring-1 ring-white/10')}
      />
    );
  }
  const initials = (user?.name || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      className={cn(
        s,
        'rounded-full bg-gradient-to-br from-[color-mix(in_srgb,var(--school-accent)_50%,transparent)] to-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] flex items-center justify-center font-semibold text-white ring-1 ring-white/10'
      )}
    >
      {initials}
    </div>
  );
}

// ─── OnlineDot ────────────────────────────────────────────────────────────────

export function OnlineDot({ status, className }) {
  return (
    <span
      className={cn(
        'block w-2.5 h-2.5 rounded-full ring-2 ring-[#0c1118]',
        statusColors[status] || statusColors.offline,
        className
      )}
    />
  );
}
