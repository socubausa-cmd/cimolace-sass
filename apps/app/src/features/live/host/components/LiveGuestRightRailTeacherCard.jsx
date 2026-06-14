import React from 'react';
import { Track } from 'livekit-client';
import LiveHostVideoCell from '@/components/liri/live-room/LiveHostVideoCell';
import GuestMembersGrid from '@/components/liri/live-room/GuestMembersGrid';
import GuestNotesPanel from '@/components/liri/live-room/GuestNotesPanel';
import { LH_SIDEBAR_CARD } from '@/features/live/host/liveHostTheme';
import { PHASE } from '@/features/live/host/liveHostConstants';

/**
 * Bloc colonne droite côté élève : grande vignette du formateur, grille des
 * pairs (`GuestMembersGrid`) et `GuestNotesPanel` si l'élève a la permission
 * `canUsePersonalNotes`. Affiché uniquement pour l'invité pendant la phase LIVE.
 */
export const LiveGuestRightRailTeacherCard = ({
  isGuestUi,
  phase,
  hostLiveKitParticipant,
  liveKitMediaEpoch,
  sessionTitle,
  guestMembersGridSelf,
  guestClassmatesPeers,
  guestCapabilityCaps,
  sessionId,
  guestNotesCurrentSceneRef,
  onGuestCaptureSmartboard,
  onGuestNotesJumpToScene,
}) => {
  if (!isGuestUi || phase !== PHASE.LIVE) return null;

  const hasHostCamera = Boolean(
    hostLiveKitParticipant
    && Array.from(hostLiveKitParticipant.videoTrackPublications?.values?.() || []).some(
      (p) => p.source === Track.Source.Camera && !p.isMuted && p.track,
    ),
  );

  return (
    <>
      <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', color: '#fde68a', flexShrink: 0 }}>
        PROF. PHYSIQUE · LIVE
      </div>
      <div
        className="lh-sp-keep"
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16 / 10',
          minHeight: 260,
          maxHeight: 'min(46vh, 420px)',
          flexShrink: 0,
          borderRadius: 10,
          overflow: 'hidden',
          border: '2px solid rgba(251,191,36,.42)',
          background: 'linear-gradient(135deg,#1e1830,#2a1f40)',
        }}
      >
        {hasHostCamera ? (
          <LiveHostVideoCell
            participant={hostLiveKitParticipant}
            mediaEpoch={liveKitMediaEpoch}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          />
        ) : (
          <>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 65% 22%,rgba(255,200,140,.22),transparent 35%)' }} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle at 40% 32%,#d4a870,#8b5e3c 50%,#5c3a1e)',
                  border: '2px solid rgba(255,255,255,.18)',
                  boxShadow: '0 4px 20px rgba(0,0,0,.5)',
                }}
              />
            </div>
          </>
        )}
        <div
          style={{
            position: 'absolute',
            bottom: 6,
            left: 8,
            fontSize: '9px',
            color: 'rgba(255,255,255,.88)',
            background: 'rgba(0,0,0,.5)',
            backdropFilter: 'blur(4px)',
            padding: '2px 8px',
            borderRadius: 4,
            maxWidth: '88%',
          }}
        >
          {sessionTitle || 'Formateur'}
        </div>
      </div>
      <div
        className="lh-sp-keep"
        style={{
          flexShrink: 0,
          minHeight: 120,
          maxHeight: 440,
          borderRadius: 12,
          overflow: 'hidden',
          border: LH_SIDEBAR_CARD.border,
        }}
      >
        <GuestMembersGrid
          self={guestMembersGridSelf}
          showSelfVideoCard={false}
          peers={guestClassmatesPeers}
          showPeers={guestCapabilityCaps.showMembersGrid}
          hostParticipant={null}
        />
      </div>
      {guestCapabilityCaps.canUsePersonalNotes ? (
        <div
          className="lh-sp-keep"
          style={{
            flexShrink: 0,
            minHeight: 400,
            maxHeight: 560,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 12,
            overflow: 'hidden',
            border: '1px solid rgba(148,163,184,.2)',
          }}
        >
          <GuestNotesPanel
            sessionId={sessionId}
            sessionTitle={sessionTitle}
            currentSceneRef={guestNotesCurrentSceneRef}
            onCaptureSmartboard={onGuestCaptureSmartboard}
            onJumpToScene={onGuestNotesJumpToScene}
            capabilities={{
              canExportNotes: guestCapabilityCaps.canExportNotes,
              canSendNotesToTeacher: guestCapabilityCaps.canSendNotesToTeacher,
            }}
          />
        </div>
      ) : null}
    </>
  );
};
