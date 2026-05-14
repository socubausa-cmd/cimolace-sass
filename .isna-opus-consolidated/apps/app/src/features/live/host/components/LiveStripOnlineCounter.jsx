import React from 'react';

/**
 * Compteur « EN LIGNE » dans le bandeau inférieur — couleur ambre côté hôte,
 * jaune ivoire côté invité.
 */
export const LiveStripOnlineCounter = ({ count, variant = 'host' }) => {
  const color = variant === 'guest' ? '#fde68a' : '#C8960C';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '52px',
        height: '100%',
        gap: '3px',
        flexShrink: 0,
      }}
    >
      <div style={{ fontSize: '22px', fontWeight: 700, color }}>{count}</div>
      <div
        style={{
          fontSize: '8px',
          color: 'rgba(255,255,255,.4)',
          textAlign: 'center',
        }}
      >
        EN LIGNE
      </div>
    </div>
  );
};

export default LiveStripOnlineCounter;
