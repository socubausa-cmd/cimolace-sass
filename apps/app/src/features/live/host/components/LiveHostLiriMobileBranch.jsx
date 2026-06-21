import React from 'react';
import LiveHostLiriMobileColumn from '@/components/liri/live-room/LiveHostLiriMobileColumn';
import LiveHostSmartBoardStage from '@/components/liri/live-room/LiveHostSmartBoardStage';
import LiveHostArenaLiveBar from '@/components/liri/live-room/LiveHostArenaLiveBar';
import { DebateModeBanner } from '@/features/live/host/components/DebateModeBanner';
import { LiveSceneSlide } from '@/features/live/host/components/LiveSceneSlide';
import { LiveStageFloatingOverlays } from '@/features/live/host/components/LiveStageFloatingOverlays';
import { getSlide } from '@/features/live/host/liveSmartboardLegacySlides';
import { PHASE } from '@/features/live/host/liveHostConstants';

/**
 * Branche maquette mobile LIRI côté hôte : `LiveHostLiriMobileColumn` qui héberge
 * le SmartBoard et la live-bar dans la disposition compacte (mobile / projecteur
 * désactivé). N'est rendu que si `hostLiriMobileHostBranch === true && !isGuestUi`.
 */
export const LiveHostLiriMobileBranch = ({
  handleStop,
  stopLiveBusy,
  onlineMemberCount,
  user,
  lhMaquetteMainVideoRef,
  lhMaquetteMiniVideoRef,
  lhMaquettePipCanvasMainRef,
  lhMaquettePipCanvasMiniRef,
  lhMaquetteMainDisplay,
  lhMaquetteMiniDisplay,
  lhMaquetteRemoteWaiting,
  videoBlur,
  videoBeauty,
  videoVbg,
  videoChromaKey,
  videoChromaColor,
  videoChromaSens,
  videoFilterCSS,
  lhMaquetteCompositorSlide,
  step,
  stepCount,
  displaySlidesHost,
  sbActiveScene,
  promotedId,
  zone3PrivilegedSeats,
  lhMaquetteSlideAreaRef,
  liveShell,
  phase,
  lhStageFocusLayout,
  longiaHubPushesLayout,
  longiaHubOpen,
  longiaSignalSubDrawer,
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
  onSmartboardBroadcast,
  liveKitScreenEpoch,
  camera2FluxParticipants,
  toggleScreenShare,
  progressivePlayback,
  hostSmartboardPipStream,
  sessionId,
  setSbActiveScene,
  onHostWhiteboardToolsRailSync,
  isGuestUi,
  floatingReactions,
  openLongiaHubCoachPanel,
  guestFooterBarBg,
  hostArenaLiveBarProps,
}) => {
  const showHubScale = phase === PHASE.LIVE && !lhStageFocusLayout && !longiaHubPushesLayout
    && (longiaHubOpen || longiaSignalSubDrawer);

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col" style={{ minHeight: 0, flex: 1 }}>
      <LiveHostLiriMobileColumn
        onStop={() => void handleStop()}
        stopLiveBusy={stopLiveBusy}
        onlineMemberCount={onlineMemberCount}
        hostDisplayName={user?.full_name || user?.email || 'Hôte'}
        mainVideoRef={lhMaquetteMainVideoRef}
        miniVideoRef={lhMaquetteMiniVideoRef}
        pipCanvasRefMain={lhMaquettePipCanvasMainRef}
        pipCanvasRefMini={lhMaquettePipCanvasMiniRef}
        mainDisplayParticipant={lhMaquetteMainDisplay}
        miniDisplayParticipant={lhMaquetteMiniDisplay}
        remoteWaiting={lhMaquetteRemoteWaiting}
        videoBlur={videoBlur}
        videoBeauty={videoBeauty}
        videoVbg={videoVbg}
        videoChromaKey={videoChromaKey}
        videoChromaColor={videoChromaColor}
        videoChromaSens={videoChromaSens}
        videoFilterCSS={videoFilterCSS}
        compositorSlide={lhMaquetteCompositorSlide}
        slideIndex={step}
        totalSlides={Math.max(1, displaySlidesHost.length || 1, stepCount || 1)}
        coursePlanSplit={null}
        activeScene={sbActiveScene}
        scriptSections={[]}
        scriptCurrentSection={null}
        promotedParticipantId={promotedId}
        zone3PrivilegedSeats={zone3PrivilegedSeats}
        currentUserId={user?.id}
        connectionQuality="good"
        isReconnecting={false}
        onSwapVideoLayout={undefined}
        slideAreaRef={lhMaquetteSlideAreaRef}
        smartboardFull={false}
        hostNotificationsRail={null}
        messageDrawer={null}
        smartBoardSlot={(
          <div
            style={{
              flex: 1,
              borderRadius: liveShell.panelRadius,
              border: liveShell.stripBorder,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              minWidth: 0,
              width: '100%',
              height: '100%',
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
              {phase === PHASE.LIVE && (
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
              {neuronQActive ? (
                liveScenes.length > 0
                  ? <div key={`scene-${step}`} style={{ position: 'absolute', inset: 0, animation: 'lhFadeUp .3s ease' }}><LiveSceneSlide slide={liveScenes[step] || liveScenes[0]} /></div>
                  : <div key={`${step}-${neuronQActive}`} style={{ position: 'absolute', inset: 0, animation: 'lhFadeUp .3s ease' }} dangerouslySetInnerHTML={{ __html: getSlide(step, neuronQActive, neuronQResponses, activeEtapes, activeMembers) }} />
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
                    onBroadcast={onSmartboardBroadcast}
                    liveKitScreenEpoch={liveKitScreenEpoch}
                    camera2FluxParticipants={camera2FluxParticipants}
                    onShareScreenRequest={() => toggleScreenShare()}
                    progressivePlayback={progressivePlayback}
                    pipStream={hostSmartboardPipStream}
                    sessionId={sessionId}
                    viewerMode={false}
                    sceneDockPlacement="footer"
                    onSceneChange={setSbActiveScene}
                    hideEmbeddedWhiteboardToolsRail
                    onHostWhiteboardToolsRailSync={onHostWhiteboardToolsRailSync}
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
          </div>
        )}
        footerSlot={(
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
            <div
              className="lh-sp-keep"
              style={{
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
              }}
            >
              <LiveHostArenaLiveBar variant="footer" {...hostArenaLiveBarProps} />
            </div>
          </div>
        )}
      />
    </div>
  );
};
