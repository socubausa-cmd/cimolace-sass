import React from 'react';
import { Track } from 'livekit-client';
import { LiveLocalUserVignette } from '@/features/live/host/components/LiveLocalUserVignette';
import { LiveMemberDockScroll } from '@/features/live/host/components/LiveMemberDockScroll';
import { LiveStripActionButton } from '@/features/live/host/components/LiveStripActionButton';
import { LiveStripOnlineCounter } from '@/features/live/host/components/LiveStripOnlineCounter';
import { PHASE } from '@/features/live/host/liveHostConstants';

/**
 * Bandeau membres en haut de la zone centrale : vignette locale + bouton STOP/QUITTER
 * + compteur participants + dock scroll horizontal des cartes membres.
 *
 * Variantes :
 * - hôte : vignette locale `host`, bouton STOP, compteur `host`.
 * - invité : vignette locale `guest` (sauf si caméra hôte au centre / mode JoyKit
 *   mobile authority), bouton QUITTER, compteur `guest`.
 */
export const LiveStripBandeau = React.forwardRef(function LiveStripBandeau(
  {
    isGuestUi,
    liveShell,
    phase,
    showStripLocalHost,
    livekitParticipantsMap,
    cameraOn,
    liveKitMediaEpoch,
    user,
    stopLiveBusy,
    handleStop,
    handleGuestLeave,
    onlineMemberCount,
    liveStripDockMembers,
    promotedId,
    setForumTarget,
    setMemberVideoPreview,
    setModal,
    arenaHostCameraCenter,
    guestMobileAuthorityUi,
  },
  ref,
) {
  const wrapperStyle = {
    position: 'relative',
    zIndex: 95,
    background: liveShell.stripBg,
    borderRadius: liveShell.panelRadius,
    border: liveShell.stripBorder,
    padding: '10px',
    height: '132px',
    flexShrink: 0,
    boxShadow: '0 12px 40px rgba(0,0,0,.2)',
  };

  const innerStyle = {
    display: 'flex',
    gap: '8px',
    height: '100%',
    alignItems: 'center',
    minWidth: 0,
    overflow: 'hidden',
  };

  const memberClickHandler = (m) => {
    if (!m?.id) return;
    setForumTarget({ id: m.id, name: m.name || 'Membre' });
    setMemberVideoPreview(m);
  };

  const plusClickHandler = (m) => setModal({ type: 'member', data: m });

  if (!isGuestUi) {
    return (
      <div className="lh-sp-dim" style={wrapperStyle}>
        <div style={innerStyle}>
          {showStripLocalHost ? (
            <LiveLocalUserVignette
              variant="host"
              participant={livekitParticipantsMap['local']}
              cameraVisible={Boolean(livekitParticipantsMap['local'] && cameraOn)}
              liveKitMediaEpoch={liveKitMediaEpoch}
              displayName={user?.full_name}
            />
          ) : null}
          <LiveStripActionButton
            variant="stop"
            busy={stopLiveBusy}
            onClick={() => void handleStop()}
            title={phase === PHASE.LIVE ? 'Arrêter la session live' : 'Quitter'}
          />
          <LiveStripOnlineCounter count={onlineMemberCount} variant="host" />
          <LiveMemberDockScroll
            ref={ref}
            liveStripDockMembers={liveStripDockMembers}
            livekitParticipantsMap={livekitParticipantsMap}
            liveKitMediaEpoch={liveKitMediaEpoch}
            promotedId={promotedId}
            isGuestUi={isGuestUi}
            onMemberClick={memberClickHandler}
            onPlusClick={plusClickHandler}
            emptySlotKeyPrefix="strip-empty"
            trailingSpacerKey="strip-dock-trail-spacer"
          />
        </div>
      </div>
    );
  }

  const guestPrimary = livekitParticipantsMap['local'];
  const guestShowVid = Boolean(
    guestPrimary
    && cameraOn
    && Array.from(guestPrimary.videoTrackPublications?.values?.() || []).some(
      (p) => p.source === Track.Source.Camera && !p.isMuted && p.track,
    ),
  );
  const guestName = user?.full_name || (user?.email ? String(user.email).split('@')[0] : '');

  return (
    <div className="lh-sp-dim" style={wrapperStyle}>
      <div style={innerStyle}>
        {!arenaHostCameraCenter && !guestMobileAuthorityUi ? (
          <LiveLocalUserVignette
            variant="guest"
            participant={guestPrimary}
            cameraVisible={guestShowVid}
            liveKitMediaEpoch={liveKitMediaEpoch}
            displayName={guestName}
          />
        ) : null}
        <LiveStripActionButton
          variant="leave"
          busy={stopLiveBusy}
          onClick={() => void handleGuestLeave()}
          title="Quitter la salle (le live continue pour les autres)"
        />
        <LiveStripOnlineCounter count={onlineMemberCount} variant="guest" />
        <LiveMemberDockScroll
          ref={ref}
          liveStripDockMembers={liveStripDockMembers}
          livekitParticipantsMap={livekitParticipantsMap}
          liveKitMediaEpoch={liveKitMediaEpoch}
          promotedId={promotedId}
          isGuestUi={isGuestUi}
          onMemberClick={memberClickHandler}
          onPlusClick={plusClickHandler}
          emptySlotKeyPrefix="strip-empty-guest"
          trailingSpacerKey="strip-dock-trail-spacer-guest"
        />
      </div>
    </div>
  );
});
