import React from 'react';
import LiveHostVideoCell from '@/components/liri/live-room/LiveHostVideoCell';

const VARIANTS = {
  host: {
    testId: 'live-host-local-preview',
    label: 'HOTE',
    labelBg: 'rgba(168,118,58,.85)',
    labelColor: '#fff',
    nameFallback: 'Prof. LIRI',
  },
  guest: {
    testId: 'live-guest-self-strip-preview',
    label: 'MOI',
    labelBg: 'rgba(56,189,248,.9)',
    labelColor: '#0c1624',
    nameFallback: 'Moi',
  },
};

/**
 * Vignette de l'utilisateur local (hôte ou invité) dans la bande inférieure :
 * vidéo si caméra active, sinon un disque "avatar". Reçoit `cameraVisible` calculé
 * par le parent (host: simple `cameraOn`; guest: vérifie aussi les tracks vidéo réels).
 */
export const LiveLocalUserVignette = ({
  variant = 'host',
  participant,
  cameraVisible,
  liveKitMediaEpoch,
  displayName,
}) => {
  const v = VARIANTS[variant] || VARIANTS.host;
  return (
    <div
      data-testid={v.testId}
      style={{
        position: 'relative',
        minWidth: '136px',
        width: '136px',
        height: '100%',
        borderRadius: '4px',
        border: '2px solid rgba(251,191,36,.5)',
        overflow: 'hidden',
        flexShrink: 0,
        background: 'linear-gradient(135deg,#2a2218,#15102a)',
      }}
    >
      {cameraVisible && participant ? (
        <LiveHostVideoCell
          participant={participant}
          mediaEpoch={liveKitMediaEpoch}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />
      ) : (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              background: 'radial-gradient(circle at 38% 32%,#d4a870,#8b5e3c 50%,#5c3a1e)',
              border: '2px solid rgba(255,255,255,.18)',
            }}
          />
        </div>
      )}
      <div
        style={{
          position: 'absolute',
          left: '5px',
          bottom: '18px',
          background: v.labelBg,
          borderRadius: '3px',
          padding: '1px 5px',
          fontSize: '8px',
          fontWeight: 700,
          color: v.labelColor,
        }}
      >
        {v.label}
      </div>
      <div
        style={{
          position: 'absolute',
          left: '5px',
          bottom: '5px',
          fontSize: '9px',
          color: '#fff',
          maxWidth: '112px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {displayName || v.nameFallback}
      </div>
      <div
        style={{
          position: 'absolute',
          right: '5px',
          bottom: '8px',
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: '#fbbf24',
          boxShadow: '0 0 6px rgba(251,191,36,.85)',
        }}
      />
    </div>
  );
};

export default LiveLocalUserVignette;
