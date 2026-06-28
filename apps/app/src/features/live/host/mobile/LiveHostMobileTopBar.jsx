import React, { useState } from 'react';
import { Users, ChevronRight, StopCircle } from 'lucide-react';

/**
 * Barre supérieure du mode mobile TikTok — EN DIRECT badge, timer, participants, étape, STOP.
 * Overlay semi-transparent fixé en haut de l'écran.
 */
export function LiveHostMobileTopBar({
  isGuestUi,
  liveDuration,
  freeTierRemainingSeconds,
  onlineMemberCount,
  step,
  stepCount,
  sessionTitle,
  handleStop,
  stopLiveBusy,
}) {
  const [confirmStop, setConfirmStop] = useState(false);

  const handleStopPress = () => {
    if (!confirmStop) {
      setConfirmStop(true);
      setTimeout(() => setConfirmStop(false), 3000);
      return;
    }
    handleStop?.();
    setConfirmStop(false);
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 12px',
        paddingTop: 'calc(10px + env(safe-area-inset-top, 0px))',
        background: 'linear-gradient(180deg, rgba(0,0,0,0.75) 0%, transparent 100%)',
        pointerEvents: 'none',
      }}
    >
      {/* EN DIRECT badge */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        background: '#e53e3e',
        borderRadius: 6,
        padding: '3px 8px',
        pointerEvents: 'none',
        flexShrink: 0,
      }}>
        <div style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: '#fff',
          animation: 'lh-pulse 1.2s ease-in-out infinite',
        }} />
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 11, letterSpacing: 0.5 }}>
          EN DIRECT
        </span>
      </div>

      {/* Timer — palier gratuit : compte à rebours 3 min (ambre, rouge <30s) */}
      <span
        title={typeof freeTierRemainingSeconds === 'number' ? 'Forfait gratuit : lives limités à 3 min — passez à un forfait LIRI.' : undefined}
        style={{
          color: typeof freeTierRemainingSeconds === 'number' ? (freeTierRemainingSeconds <= 30 ? '#f87171' : '#fbbf24') : '#fff',
          fontWeight: typeof freeTierRemainingSeconds === 'number' ? 700 : 600,
          fontSize: 13,
          fontVariantNumeric: 'tabular-nums',
          textShadow: '0 1px 3px rgba(0,0,0,0.8)',
          flexShrink: 0,
        }}>
        {typeof freeTierRemainingSeconds === 'number'
          ? `Gratuit · ${Math.floor(freeTierRemainingSeconds / 60)}:${String(freeTierRemainingSeconds % 60).padStart(2, '0')}`
          : (liveDuration || '00:00')}
      </span>

      {/* Participants count */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        background: 'rgba(255,255,255,0.12)',
        borderRadius: 20,
        padding: '3px 8px',
        flexShrink: 0,
      }}>
        <Users size={12} color="rgba(255,255,255,0.85)" />
        <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: 600 }}>
          {onlineMemberCount ?? 0}
        </span>
      </div>

      {/* Étape indicator */}
      {stepCount > 1 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          background: 'rgba(255,255,255,0.10)',
          borderRadius: 20,
          padding: '3px 10px',
          flexShrink: 0,
        }}>
          <ChevronRight size={12} color="rgba(255,255,255,0.7)" />
          <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: 500 }}>
            {step + 1} / {stepCount}
          </span>
        </div>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* STOP button — hôte uniquement */}
      {!isGuestUi && (
        <button
          onClick={handleStopPress}
          disabled={stopLiveBusy}
          style={{
            pointerEvents: 'all',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            background: confirmStop ? '#e53e3e' : 'rgba(229,62,62,0.22)',
            border: `1.5px solid ${confirmStop ? '#e53e3e' : 'rgba(229,62,62,0.6)'}`,
            borderRadius: 20,
            padding: '5px 12px',
            cursor: 'pointer',
            color: confirmStop ? '#fff' : '#fc8181',
            fontSize: 12,
            fontWeight: 700,
            transition: 'all 0.2s ease',
            backdropFilter: 'blur(4px)',
          }}
        >
          <StopCircle size={14} />
          {confirmStop ? 'Confirmer ?' : 'Arrêter'}
        </button>
      )}

      {/* Pulse animation */}
      <style>{`
        @keyframes lh-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.75); }
        }
      `}</style>
    </div>
  );
}
