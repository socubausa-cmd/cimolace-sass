import React, { useEffect, useRef } from 'react';
import { X, Mic, MicOff, Video, VideoOff, Maximize2 } from 'lucide-react';

/**
 * Overlay plein écran activé quand on tape sur un participant.
 * Affiche le flux vidéo du membre + SmartBoard en PiP dans le coin.
 */
export function LiveHostMobileMemberFullscreen({
  participant,
  onClose,
  livekitParticipantsMap,
  smartBoardPipStream,
  isHost,
  onMute,
  onKick,
}) {
  const videoRef = useRef(null);
  const pipRef = useRef(null);

  const name = participant?.displayName || participant?.name || participant?.full_name || 'Participant';

  // Attach LiveKit track to video element
  useEffect(() => {
    if (!videoRef.current || !participant) return;
    const livekitP = livekitParticipantsMap?.get(participant.user_id || participant.userId);
    if (!livekitP) return;
    const camPub = livekitP.getTrackPublications?.()?.find?.(
      (pub) => pub.kind === 'video' && pub.source === 'camera',
    );
    if (camPub?.track) {
      camPub.track.attach(videoRef.current);
      return () => camPub.track.detach(videoRef.current);
    }
  }, [participant, livekitParticipantsMap]);

  // Attach SmartBoard PiP stream
  useEffect(() => {
    if (!pipRef.current || !smartBoardPipStream) return;
    pipRef.current.srcObject = smartBoardPipStream;
  }, [smartBoardPipStream]);

  if (!participant) return null;

  const getColor = (id = '') => {
    const colors = ['#d49a5a', '#cca34a', '#ed8936', '#d4a36a', '#f6ad55', '#c8943e', '#fc8181'];
    let hash = 0;
    for (let i = 0; i < String(id).length; i++) hash += String(id).charCodeAt(i);
    return colors[hash % colors.length];
  };

  const getInitials = (n = '') => {
    const parts = n.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return (n[0] || '?').toUpperCase();
  };

  const accentColor = getColor(participant.user_id || participant.userId || name);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9500,
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Main video or avatar */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          position: 'absolute',
          inset: 0,
        }}
      />

      {/* Fallback avatar (shown if no video track) */}
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `linear-gradient(135deg, #262624, ${accentColor}20)`,
        zIndex: 1,
        pointerEvents: 'none',
      }}>
        <div style={{
          width: 100,
          height: 100,
          borderRadius: '50%',
          background: `${accentColor}30`,
          border: `3px solid ${accentColor}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 36,
          fontWeight: 700,
          color: accentColor,
        }}>
          {getInitials(name)}
        </div>
      </div>

      {/* SmartBoard PiP */}
      {smartBoardPipStream && (
        <div style={{
          position: 'absolute',
          bottom: 100,
          left: 12,
          width: 120,
          height: 68,
          borderRadius: 8,
          overflow: 'hidden',
          border: '1.5px solid rgba(255,255,255,0.2)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          zIndex: 10,
        }}>
          <video
            ref={pipRef}
            autoPlay
            muted
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div style={{
            position: 'absolute',
            bottom: 3,
            left: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            background: 'rgba(0,0,0,0.6)',
            borderRadius: 4,
            padding: '1px 5px',
          }}>
            <Maximize2 size={8} color="rgba(255,255,255,0.7)" />
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 9 }}>Board</span>
          </div>
        </div>
      )}

      {/* Gradient overlay top */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 120,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.75) 0%, transparent 100%)',
        zIndex: 5,
        pointerEvents: 'none',
      }} />

      {/* Gradient overlay bottom */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 160,
        background: 'linear-gradient(0deg, rgba(0,0,0,0.85) 0%, transparent 100%)',
        zIndex: 5,
        pointerEvents: 'none',
      }} />

      {/* Top bar */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: '16px 16px',
        paddingTop: 'calc(16px + env(safe-area-inset-top, 0px))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 10,
      }}>
        <span style={{
          color: '#fff',
          fontWeight: 700,
          fontSize: 16,
          textShadow: '0 1px 4px rgba(0,0,0,0.8)',
        }}>
          {name}
        </span>
        <button
          onClick={onClose}
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.2)',
            backdropFilter: 'blur(8px)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Bottom actions (host only) */}
      {isHost && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '16px',
          paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))',
          display: 'flex',
          gap: 10,
          justifyContent: 'center',
          zIndex: 10,
        }}>
          <button
            onClick={() => onMute?.(participant)}
            style={{
              flex: 1,
              maxWidth: 160,
              padding: '10px 16px',
              borderRadius: 24,
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.2)',
              backdropFilter: 'blur(8px)',
              color: '#fff',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <MicOff size={14} />
            Couper micro
          </button>
          <button
            onClick={() => { onClose?.(); onKick?.(participant); }}
            style={{
              flex: 1,
              maxWidth: 160,
              padding: '10px 16px',
              borderRadius: 24,
              background: 'rgba(229,62,62,0.18)',
              border: '1px solid rgba(229,62,62,0.4)',
              backdropFilter: 'blur(8px)',
              color: '#fc8181',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <VideoOff size={14} />
            Exclure
          </button>
        </div>
      )}
    </div>
  );
}
