import React, { useState } from 'react';
import { Track } from 'livekit-client';
import { ChevronDown } from 'lucide-react';
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
    sessionTitle,
    arenaLayoutMode,
  },
  ref,
) {
  // Mode conférence : le panneau membres vit dans la colonne de gauche → on retire
  // le dock membres (+ vignette locale + compteur) de la bande du haut, qui devient
  // une simple barre de contrôle (marque + STOP + menu hôte).
  const stripConference = arenaLayoutMode === 'conference';
  // Déclutter : par défaut les tuiles membres sont repliées derrière la pastille
  // « en ligne » ; un clic sur le compteur les déroule (barre plus lisible).
  const [membersExpanded, setMembersExpanded] = useState(false);
  // Bandeau épuré façon rail latéral : fond commun (pas de carte),
  // séparé de la scène par un simple liseré en bas — ni bordure complète,
  // ni radius, ni ombre. La marque LIRI vit désormais sur le rail latéral.
  const wrapperStyle = {
    position: 'relative',
    zIndex: 95,
    background: 'transparent',
    borderRadius: 0,
    borderBottom: '1px solid rgba(245,244,238,0.09)',
    padding: stripConference ? '8px 10px' : '10px',
    height: stripConference ? 'auto' : '132px',
    flexShrink: 0,
    boxShadow: 'none',
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
          {!stripConference && showStripLocalHost ? (
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
          {!stripConference ? (
            <button
              type="button"
              onClick={() => setMembersExpanded((v) => !v)}
              title={membersExpanded ? 'Replier les membres' : 'Voir les membres en ligne'}
              aria-expanded={membersExpanded}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}
            >
              <LiveStripOnlineCounter count={onlineMemberCount} variant="host" />
              <ChevronDown
                size={12}
                aria-hidden
                style={{ color: 'rgba(255,255,255,.5)', transform: membersExpanded ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}
              />
            </button>
          ) : null}
          {!stripConference ? (
            <>
              {/* Dock toujours monté (ref préservée) mais masqué quand replié → barre allégée par défaut. */}
              <div style={{ display: membersExpanded ? 'flex' : 'none', flex: 1, minWidth: 0, height: '100%', alignItems: 'center', overflow: 'hidden' }}>
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
              {!membersExpanded ? <div style={{ flex: 1 }} /> : null}
            </>
          ) : (
            <div style={{ flex: 1 }} />
          )}
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
