import React from 'react';
import LiveGuestMobileAuthorityShell from '@/components/liri/live-room/LiveGuestMobileAuthorityShell';
import LiveHostSmartBoardStage from '@/components/liri/live-room/LiveHostSmartBoardStage';
import LiveHostArenaLiveBar from '@/components/liri/live-room/LiveHostArenaLiveBar';
import { DebateModeBanner } from '@/features/live/host/components/DebateModeBanner';
import { LiveArenaLayoutOverlays } from '@/features/live/host/components/LiveArenaLayoutOverlays';
import { LiveSceneSlide } from '@/features/live/host/components/LiveSceneSlide';
import { LiveStageFloatingOverlays } from '@/features/live/host/components/LiveStageFloatingOverlays';
import { getSlide } from '@/features/live/host/liveSmartboardLegacySlides';
import { PHASE } from '@/features/live/host/liveHostConstants';

/**
 * Bloc central de la grille hôte : Le SmartBoard (ou un overlay arène / NeuronQ)
 * encapsulé dans `LiveGuestMobileAuthorityShell` (mode invité mobile JoyKit) +
 * footer LiveBar. Affiché dans la branche desktop / bureau / large-mobile (≠
 * `LiriMobileMaquetteLayout`).
 */
export const LiveCenterStageSmartBoard = ({
  phase,
  isGuestUi,
  liveShell,
  lhStageFocusLayout,
  longiaHubPushesLayout,
  longiaHubOpen,
  longiaSignalSubDrawer,
  guestMobileAuthorityUi,
  sessionTitle,
  step,
  stepCount,
  displaySlidesHost,
  hostLiveKitParticipant,
  liveKitMediaEpoch,
  setLiveLeftRailOpen,
  setLiveRightRailOpen,
  addMeshRequest,
  guestCapabilityCaps,
  joyKitSignalGrant,
  guestMeshStatusLine,
  arenaHostCameraCenter,
  arenaGuestFocusCenter,
  arenaPanelCenter,
  arenaMembersWallCenter,
  arenaLayoutMode,
  hostId,
  arenaGuestFocusUserId,
  arenaPanelUserIds,
  promotedId,
  liveParticipants,
  livekitParticipantsMap,
  cameraOn,
  toggleNeuronQ,
  neuronQActive,
  debateArena,
  debateLiveVoteCounts,
  liveScenes,
  neuronQResponses,
  activeEtapes,
  activeMembers,
  smartBoardStageRef,
  smartboardSceneFlags,
  sharedImageGallery,
  sharedImageLoop,
  shopProducts,
  spotlightOn,
  sharingScreen,
  roomRef,
  guestJoyKitDrive,
  onSmartboardBroadcast,
  liveKitScreenEpoch,
  camera2FluxParticipants,
  guestCommAllowed,
  toggleScreenShare,
  progressivePlayback,
  hostSmartboardPipStream,
  sessionId,
  setSbActiveScene,
  onHostWhiteboardToolsRailSync,
  floatingReactions,
  openLongiaHubCoachPanel,
  setMemberVideoPreview,
  guestFooterBarBg,
  hostArenaLiveBarProps,
}) => {
  const showHubScale = phase === PHASE.LIVE && !isGuestUi && !lhStageFocusLayout && !longiaHubPushesLayout
    && (longiaHubOpen || longiaSignalSubDrawer);

  return (
    <>
      <div
        style={{
          flex: 1,
          borderRadius: liveShell.panelRadius,
          border: liveShell.stripBorder,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          boxShadow: '0 16px 48px rgba(0,0,0,.28)',
          ...(showHubScale
            ? {
                transform: longiaSignalSubDrawer ? 'scale(0.972)' : 'scale(0.99)',
                transformOrigin: '96% 50%',
                transition: 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
              }
            : {}),
        }}
      >
        <LiveGuestMobileAuthorityShell
          active={guestMobileAuthorityUi}
          sessionTitle={sessionTitle}
          currentSlide={step + 1}
          totalSlides={Math.max(1, displaySlidesHost.length || 1, stepCount || 1)}
          hostLiveKitParticipant={hostLiveKitParticipant}
          liveKitMediaEpoch={liveKitMediaEpoch}
          onOpenSessionMenu={() => setLiveLeftRailOpen(true)}
          onOpenLongiaPanel={() => setLiveRightRailOpen(true)}
          onMeshRequestControl={() => void addMeshRequest('control')}
          onMeshRequestJoykit={() => void addMeshRequest('joykit')}
          canUseJoyKit={guestCapabilityCaps.canUseJoyKit}
          joyKitGrant={joyKitSignalGrant}
          meshStatusLine={guestMeshStatusLine}
        >
          <div
            className="lh-sp-keep lh-sp-glow"
            style={{
              flex: 1,
              position: 'relative',
              overflow: 'hidden',
              minHeight: 0,
              backgroundColor: 'var(--lh-stage-bg, #1f1e1c)',
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
              backgroundSize: '44px 44px',
            }}
          >
            {phase === PHASE.LIVE && !isGuestUi && !arenaHostCameraCenter && !arenaGuestFocusCenter && !arenaPanelCenter && !arenaMembersWallCenter && (
              <button
                type="button"
                onClick={() => toggleNeuronQ()}
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  zIndex: 25,
                  borderRadius: '10px',
                  border: `1px solid ${neuronQActive ? 'rgba(6,182,212,.5)' : 'rgba(255,255,255,.12)'}`,
                  background: neuronQActive ? 'rgba(6,182,212,.18)' : 'rgba(0,0,0,.5)',
                  backdropFilter: 'blur(8px)',
                  padding: '6px 12px',
                  fontSize: '10px',
                  fontWeight: 700,
                  color: neuronQActive ? '#22d3ee' : 'rgba(255,255,255,.78)',
                  cursor: 'pointer',
                  letterSpacing: '.04em',
                }}
              >
                {neuronQActive ? '← SmartBoard' : 'NeuronQ'}
              </button>
            )}
            <DebateModeBanner debate={debateArena} liveVoteCounts={debateLiveVoteCounts} />
            {arenaHostCameraCenter || arenaGuestFocusCenter || arenaPanelCenter || arenaMembersWallCenter ? (
              <LiveArenaLayoutOverlays
                arenaHostCameraCenter={arenaHostCameraCenter}
                arenaGuestFocusCenter={arenaGuestFocusCenter}
                arenaPanelCenter={arenaPanelCenter}
                arenaMembersWallCenter={arenaMembersWallCenter}
                arenaLayoutMode={arenaLayoutMode}
                hostId={hostId}
                sharingScreen={sharingScreen}
                openLongiaHubCoachPanel={openLongiaHubCoachPanel}
                setMemberVideoPreview={setMemberVideoPreview}
                isGuestUi={isGuestUi}
                hostLiveKitParticipant={hostLiveKitParticipant}
                livekitParticipantsMap={livekitParticipantsMap}
                cameraOn={cameraOn}
                liveKitMediaEpoch={liveKitMediaEpoch}
                arenaGuestFocusUserId={arenaGuestFocusUserId}
                promotedId={promotedId}
                liveParticipants={liveParticipants}
                arenaPanelUserIds={arenaPanelUserIds}
              />
            ) : neuronQActive ? (
              liveScenes.length > 0
                ? <div key={`scene-${step}`} style={{position:'absolute',inset:0,animation:'lhFadeUp .3s ease'}}><LiveSceneSlide slide={liveScenes[step] || liveScenes[0]} /></div>
                : <div key={`${step}-${neuronQActive}`} style={{position:'absolute',inset:0,animation:'lhFadeUp .3s ease'}} dangerouslySetInnerHTML={{__html:getSlide(step, neuronQActive, neuronQResponses, activeEtapes, activeMembers)}}/>
            ) : (
              <div style={{ position: 'absolute', inset: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <LiveHostSmartBoardStage
                  ref={smartBoardStageRef}
                  displaySlides={displaySlidesHost}
                  sceneFlags={smartboardSceneFlags}
                  sharedImageGallery={sharedImageGallery}
                  sharedImageLoop={sharedImageLoop}
                  shopProducts={shopProducts}
                  spotlight={spotlightOn}
                  sharingScreen={sharingScreen}
                  roomRef={roomRef}
                  phaseLive={phase === PHASE.LIVE}
                  onBroadcast={isGuestUi ? (guestJoyKitDrive ? onSmartboardBroadcast : undefined) : onSmartboardBroadcast}
                  liveKitScreenEpoch={liveKitScreenEpoch}
                  camera2FluxParticipants={camera2FluxParticipants}
                  onShareScreenRequest={
                    isGuestUi && (!guestJoyKitDrive || !guestCommAllowed.screenShare)
                      ? undefined
                      : () => toggleScreenShare()
                  }
                  progressivePlayback={progressivePlayback}
                  pipStream={hostSmartboardPipStream}
                  sessionId={sessionId}
                  viewerMode={isGuestUi && !guestJoyKitDrive}
                  sceneDockPlacement={!isGuestUi ? 'footer' : 'right'}
                  onSceneChange={!isGuestUi ? setSbActiveScene : undefined}
                  hideEmbeddedWhiteboardToolsRail={!isGuestUi}
                  onHostWhiteboardToolsRailSync={!isGuestUi ? onHostWhiteboardToolsRailSync : undefined}
                />
              </div>
            )}
            <LiveStageFloatingOverlays
              phase={phase}
              isGuestUi={isGuestUi}
              longiaHubOpen={longiaHubOpen}
              longiaSignalSubDrawer={longiaSignalSubDrawer}
              floatingReactions={floatingReactions}
              onOpenLongiaCoach={openLongiaHubCoachPanel}
            />
          </div>
        </LiveGuestMobileAuthorityShell>
      </div>
      <div
        style={{
          width: '100%',
          minWidth: 0,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'stretch',
          overflow: 'hidden',
        }}
      >
        <div className="lh-sp-keep" style={{
          width: '100%',
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          flexWrap: 'nowrap',
          overflow: 'hidden',
          background: guestFooterBarBg,
          borderRadius: '4px',
          border: '1px solid rgba(255,255,255,.09)',
          padding: '8px 14px',
          position: 'relative',
          zIndex: 1,
        }}>
          <LiveHostArenaLiveBar variant="footer" {...hostArenaLiveBarProps} />
        </div>
      </div>
    </>
  );
};
