import React from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ChevronLeft,
  ChevronRight,
  Circle,
  Square,
} from 'lucide-react';

/**
 * Barre de contrôle inférieure — TikTok style.
 * Micro, caméra, navigation étapes, REC.
 */
export function LiveHostMobileBottomBar({
  isGuestUi,
  micOn,
  toggleMic,
  cameraOn,
  toggleCamera,
  step,
  stepCount,
  gotoStep,
  isRecording,
  startRecording,
  stopRecording,
  recStarting,
}) {
  const CTRL_SIZE = 52;
  const hasStepper = stepCount > 1;

  const btnStyle = (active, activeColor = '#fff', inactiveColor = 'rgba(255,255,255,0.55)') => ({
    width: CTRL_SIZE,
    height: CTRL_SIZE,
    borderRadius: '50%',
    background: active ? `${activeColor}18` : 'rgba(255,255,255,0.08)',
    border: active ? `1.5px solid ${activeColor}` : '1.5px solid rgba(255,255,255,0.15)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: active ? activeColor : inactiveColor,
    boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
    transition: 'all 0.15s ease',
    WebkitTapHighlightColor: 'transparent',
    outline: 'none',
    flexShrink: 0,
  });

  const navBtnStyle = (disabled) => ({
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: disabled ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.10)',
    border: `1px solid ${disabled ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.20)'}`,
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: disabled ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.8)',
    flexShrink: 0,
    WebkitTapHighlightColor: 'transparent',
    outline: 'none',
  });

  const handleRec = () => {
    if (isRecording) stopRecording?.();
    else startRecording?.();
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 20,
        background: 'linear-gradient(0deg, rgba(0,0,0,0.85) 0%, transparent 100%)',
        paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
        paddingTop: 20,
        paddingLeft: 16,
        paddingRight: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        gap: 8,
      }}
    >
      {/* Mic */}
      <button onClick={toggleMic} style={btnStyle(micOn, '#48bb78', '#fc8181')}>
        {micOn ? <Mic size={22} /> : <MicOff size={22} />}
      </button>

      {/* Camera */}
      <button onClick={toggleCamera} style={btnStyle(cameraOn, '#4299e1', 'rgba(255,255,255,0.45)')}>
        {cameraOn ? <Video size={22} /> : <VideoOff size={22} />}
      </button>

      {/* Step navigator */}
      {hasStepper && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => gotoStep?.(step - 1)}
            disabled={step <= 0}
            style={navBtnStyle(step <= 0)}
          >
            <ChevronLeft size={18} />
          </button>
          <div style={{
            background: 'rgba(255,255,255,0.10)',
            borderRadius: 20,
            padding: '4px 12px',
            minWidth: 54,
            textAlign: 'center',
          }}>
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {step + 1} / {stepCount}
            </span>
          </div>
          <button
            onClick={() => gotoStep?.(step + 1)}
            disabled={step >= stepCount - 1}
            style={navBtnStyle(step >= stepCount - 1)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* REC — hôte uniquement */}
      {!isGuestUi && (
        <button
          onClick={handleRec}
          disabled={recStarting}
          style={{
            ...btnStyle(isRecording, '#e53e3e', 'rgba(255,255,255,0.55)'),
            position: 'relative',
          }}
        >
          {isRecording ? (
            <Square size={18} fill="#e53e3e" color="#e53e3e" />
          ) : (
            <Circle size={22} color={recStarting ? 'rgba(255,255,255,0.35)' : '#e53e3e'} />
          )}
          {isRecording && (
            <span style={{
              position: 'absolute',
              top: -2,
              right: -2,
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: '#e53e3e',
              border: '2px solid #0f1117',
              animation: 'lh-pulse 1.2s ease-in-out infinite',
            }} />
          )}
        </button>
      )}
    </div>
  );
}
