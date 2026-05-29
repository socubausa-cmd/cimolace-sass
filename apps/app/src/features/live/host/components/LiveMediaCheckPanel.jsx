import React from 'react';
import { Track } from 'livekit-client';
import { PHASE } from '@/features/live/host/liveHostConstants';

/**
 * Panneau de diagnostic LiveKit affiché uniquement quand `?liveMediaCheck=1`
 * est présent dans l'URL. Utile pour vérifier l'état des pistes locales et
 * distantes pendant le live.
 */
export const LiveMediaCheckPanel = ({
  phase,
  liveMediaCheck,
  liveMediaDiagTick,
  roomRef,
  isGuestUi,
  guestJoyKitDrive,
  tryStartLiveKitPlayback,
}) => {
  if (phase !== PHASE.LIVE || !liveMediaCheck) return null;

  void liveMediaDiagTick;
  const r = roomRef.current;
  const lp = r?.localParticipant;
  const micPub = lp?.getTrackPublication?.(Track.Source.Microphone);
  const camPub = lp?.getTrackPublication?.(Track.Source.Camera);
  const scrPub = lp?.getTrackPublication?.(Track.Source.ScreenShare);
  const remoteN = r?.remoteParticipants?.size ?? 0;
  const lkAudioN = typeof document !== 'undefined'
    ? document.querySelectorAll('[data-lk-audio="1"]').length
    : 0;

  return (
    <div
      className="lh-premium-card"
      style={{
        borderRadius: '12px',
        border: '1px solid rgba(56,189,248,.35)',
        background: 'radial-gradient(120% 90% at 8% -8%, rgba(56,189,248,.14), transparent 56%), rgba(8,47,73,.35)',
        padding: '12px',
        fontSize: '10px',
        color: 'rgba(224,242,254,.92)',
        lineHeight: 1.5,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.08)',
      }}
    >
      <div style={{ fontWeight: 800, letterSpacing: '.06em', marginBottom: '6px', color: '#7dd3fc' }}>TEST MÉDIA (?liveMediaCheck=1)</div>
      <div>LiveKit : {r ? String(r.state ?? 'room') : 'non connecté'}</div>
      <div>Micro local : {micPub && !micPub.isMuted ? 'ON' : 'off'} · Caméra : {camPub && !camPub.isMuted ? 'ON' : 'off'} · Écran : {scrPub && !scrPub.isMuted ? 'ON' : 'off'}</div>
      <div>Participants distants : {remoteN} · Pistes audio distantes (éléments) : {lkAudioN}</div>
      <div>
        SmartBoard : {isGuestUi ? (guestJoyKitDrive ? 'invité JoyKit (pilotage)' : 'invité (sync hôte)') : 'hôte'}
      </div>
      <button
        className="lh-premium-btn"
        type="button"
        onClick={tryStartLiveKitPlayback}
        style={{
          marginTop: '8px',
          borderRadius: '8px',
          border: '1px solid rgba(125,211,252,.4)',
          background: 'rgba(14,116,144,.25)',
          padding: '6px 10px',
          fontSize: '9px',
          fontWeight: 700,
          color: '#e0f2fe',
          cursor: 'pointer',
        }}
      >
        Relancer lecture audio (autoplay)
      </button>
    </div>
  );
};
