import React from 'react';
import { PHASE } from '@/features/live/host/liveHostConstants';

export const LiveHostFloatingRoomChips = ({
  phase,
  isGuestUi,
  lhStageFocusLayout,
  liveParticipants,
}) => {
  if (
    phase !== PHASE.LIVE ||
    isGuestUi ||
    !lhStageFocusLayout ||
    !liveParticipants?.length
  ) {
    return null;
  }
  return (
    <div
      style={{
        position: 'fixed',
        right: 14,
        bottom: 'calc(88px + env(safe-area-inset-bottom, 0px))',
        zIndex: 115,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        maxWidth: 'min(92vw, 440px)',
        padding: '8px 12px',
        borderRadius: 14,
        border: '1px solid rgba(255,255,255,.12)',
        background: 'rgba(10,11,15,.94)',
        boxShadow: '0 8px 28px rgba(0,0,0,.45)',
        pointerEvents: 'auto',
      }}
    >
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.08em',
          color: 'rgba(255,255,255,.45)',
          textTransform: 'uppercase',
          flexShrink: 0,
        }}
      >
        Salle
      </span>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          overflowX: 'auto',
          flex: 1,
          minWidth: 0,
          scrollbarWidth: 'none',
        }}
      >
        {liveParticipants.slice(0, 14).map((m) => (
          <div
            key={m.id}
            title={m.name}
            style={{
              flexShrink: 0,
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: `2px solid ${m.color || 'rgba(255,255,255,.2)'}`,
              background: `${m.color || '#64748b'}22`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              fontWeight: 800,
              color: '#fff',
            }}
          >
            {m.init ||
              String(m.name || '?')
                .trim()
                .slice(0, 2)
                .toUpperCase()}
          </div>
        ))}
      </div>
    </div>
  );
};

export default LiveHostFloatingRoomChips;
