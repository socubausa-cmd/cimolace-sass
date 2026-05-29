import React from 'react';
import { LH_SIDEBAR_CARD } from '@/features/live/host/liveHostTheme';

/**
 * Bandeau d'indication d'enregistrement (hôte uniquement). Visible quand
 * `recording === true` ou quand une erreur d'enregistrement est en cours.
 */
export const LiveHostRecordingIndicator = ({
  recording,
  recError,
  isGuestUi,
  onStop,
  onDismissError,
}) => {
  if (isGuestUi || (!recording && !recError)) return null;
  return (
    <div
      className="lh-premium-card"
      style={{
        ...LH_SIDEBAR_CARD,
        border: `1px solid ${recording ? 'rgba(239,68,68,.38)' : 'rgba(239,68,68,.22)'}`,
        background: recording
          ? 'radial-gradient(110% 80% at 8% -6%, rgba(239,68,68,.16), transparent 52%), rgba(239,68,68,.07)'
          : 'rgba(239,68,68,.04)',
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      {recording ? (
        <span
          style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: '#ef4444',
            boxShadow: '0 0 6px rgba(239,68,68,.9)',
            animation: 'lhPulse 1.2s infinite',
            flexShrink: 0,
          }}
        />
      ) : null}
      <span
        style={{
          fontSize: '10px',
          fontWeight: 700,
          color: recording ? '#ef4444' : 'rgba(239,68,68,.7)',
          flex: 1,
        }}
      >
        {recording ? 'ENREGISTREMENT EN COURS' : recError}
      </span>
      {recording ? (
        <button
          onClick={onStop}
          style={{
            borderRadius: '3px',
            border: '1px solid rgba(239,68,68,.4)',
            background: 'rgba(239,68,68,.12)',
            padding: '3px 8px',
            color: '#ef4444',
            fontSize: '9px',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Arrêter
        </button>
      ) : null}
      {recError ? (
        <button
          onClick={onDismissError}
          style={{
            borderRadius: '3px',
            border: 'none',
            background: 'transparent',
            padding: '2px 5px',
            color: 'rgba(255,255,255,.4)',
            fontSize: '11px',
            cursor: 'pointer',
          }}
        >
          ✕
        </button>
      ) : null}
    </div>
  );
};

export default LiveHostRecordingIndicator;
