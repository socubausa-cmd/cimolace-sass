import React from 'react';
import { cn } from '@/lib/utils';

export default function ParticipantFluxCard({ participant, active, depth = 1, onClick }) {
  const initials = (participant?.name || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative h-14 w-28 rounded-2xl border overflow-hidden backdrop-blur-xl transition-all',
        active
          ? 'border-[#D4AF37]/55 bg-[#D4AF37]/20 shadow-[0_0_24px_rgba(212,175,55,0.3)] scale-[1.02]'
          : 'border-white/15 bg-black/35 hover:bg-black/45'
      )}
      style={{
        opacity: Math.max(0.55, depth),
        transform: `translateZ(${Math.round(depth * 8)}px) scale(${0.95 + depth * 0.08})`,
      }}
      title={`Mettre ${participant?.name || 'ce participant'} au premier plan`}
    >
      {participant?.avatar_url ? (
        <img src={participant.avatar_url} alt={participant.name} className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-[#D4AF37]/35 to-[#1f2d41] flex items-center justify-center text-sm font-semibold text-white">
          {initials}
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 px-2 py-1 bg-gradient-to-t from-black/70 to-transparent text-[10px] text-left text-white truncate">
        {participant?.name || 'Participant'}
      </div>
      {participant?.isHost ? (
        <span className="absolute top-1 left-1 h-4 px-1.5 rounded-full bg-black/60 border border-white/20 text-[9px] text-white/90">
          HOST
        </span>
      ) : null}
    </button>
  );
}
