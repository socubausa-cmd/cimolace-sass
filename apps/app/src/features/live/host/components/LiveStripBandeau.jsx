import React from 'react';
import { Track } from 'livekit-client';
import { Settings, ChevronDown } from 'lucide-react';
import { LiriWordmark } from '@/components/brand/LiriWordmark';
import { LiveLocalUserVignette } from '@/features/live/host/components/LiveLocalUserVignette';
import { LiveMemberDockScroll } from '@/features/live/host/components/LiveMemberDockScroll';
import { LiveStripActionButton } from '@/features/live/host/components/LiveStripActionButton';
import { LiveStripOnlineCounter } from '@/features/live/host/components/LiveStripOnlineCounter';
import { PHASE } from '@/features/live/host/liveHostConstants';

/** Bloc chrome gauche de la barre du haut : logo + titre de la session. */
function LiveTopBarBrand({ sessionTitle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingRight: 4, height: '100%' }}>
      <LiriWordmark variant="mark" size="rail" bulbColor="#d4a36a" bulbGlow="drop-shadow(0 0 12px rgba(212,163,106,.55))" letterClassName="text-white" className="text-white drop-shadow-[0_2px_10px_rgba(212,163,106,.35)]" />
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15, minWidth: 0 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 150 }}>
          {sessionTitle || 'Salle live'}
        </span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,.5)', display: 'flex', alignItems: 'center', gap: 3 }}>
          LIRI <ChevronDown size={10} aria-hidden />
        </span>
      </div>
    </div>
  );
}

/** Bloc chrome droit : réglages + identité hôte. */
function LiveTopBarHostMenu({ user }) {
  const name = user?.full_name || (user?.email ? String(user.email).split('@')[0] : 'Hôte');
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingLeft: 4, height: '100%' }}>
      <button
        type="button"
        title="Paramètres de la salle"
        aria-label="Paramètres"
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/12 bg-white/[0.05] text-white/70 transition hover:border-white/25 hover:text-white"
      >
        <Settings size={17} aria-hidden />
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div className="flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: 'linear-gradient(135deg,#c8943e,#c8843e)' }}>
          {initials}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap' }}>{name}</span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,.45)' }}>Hôte</span>
        </div>
        <ChevronDown size={13} className="text-white/45" aria-hidden />
      </div>
    </div>
  );
}

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
    sessionTitle,
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
          <LiveTopBarBrand sessionTitle={sessionTitle} />
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
          <LiveTopBarHostMenu user={user} />
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
