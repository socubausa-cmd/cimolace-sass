import React from 'react';
import { ChevronRight, ChevronLeft, NotebookPen } from 'lucide-react';
import HostSharedGuestNotesInbox from '@/components/liri/live-room/HostSharedGuestNotesInbox';
import { AudioScenePanel } from '@/lib/liriAudioScene';
import { LiveRightRailCollapsedStrip } from '@/features/live/host/components/LiveRightRailCollapsedStrip';
import { LiveGuestRightRailTeacherCard } from '@/features/live/host/components/LiveGuestRightRailTeacherCard';
import { LiveMediaCheckPanel } from '@/features/live/host/components/LiveMediaCheckPanel';
import { LiveHostRightRailVideoCard } from '@/features/live/host/components/LiveHostRightRailVideoCard';
import { LiveHostDebateModeratorPanel } from '@/features/live/host/components/LiveHostDebateModeratorPanel';
import { LiveHostRecordingIndicator } from '@/features/live/host/components/LiveHostRecordingIndicator';
import { LiveHostMindmapOrWhiteboardSlot } from '@/features/live/host/components/LiveHostMindmapOrWhiteboardSlot';
import { LiveGuestLongiaSidebar } from '@/features/live/host/components/LiveGuestLongiaSidebar';
import { LiveHostMasterScriptDock } from '@/features/live/host/components/LiveHostMasterScriptDock';
import { LH_SIDEBAR_CARD } from '@/features/live/host/liveHostTheme';
import { PHASE } from '@/features/live/host/liveHostConstants';

/**
 * Colonne droite du LiveHostPage : empile la vidéo formateur, les panneaux
 * (notes invité, débat, enregistrement, mindmap, LONGIA invité) puis la dock
 * MasterScript ancrée en bas. Gère les modes "collapsed" (host & invité).
 */
export const LiveHostRightColumn = React.forwardRef(function LiveHostRightColumn(
  {
    isGuestUi,
    lhLayoutCompact,
    hostCompactColOrder,
    liveShell,
    liveRightRailCollapsedStrip,
    liveRightGuestCollapsedStrip,
    lhStageFocusLayout,
    liveRightRailOpen,
    setLiveRightRailOpen,
    phase,
    guestCapabilityCaps,
    onRightScroll,
    hostLiveKitParticipant,
    liveKitMediaEpoch,
    sessionTitle,
    guestMembersGridSelf,
    guestClassmatesPeers,
    sessionId,
    guestNotesCurrentSceneRef,
    onGuestCaptureSmartboard,
    onGuestNotesJumpToScene,
    liveMediaCheck,
    liveMediaDiagTick,
    roomRef,
    guestJoyKitDrive,
    tryStartLiveKitPlayback,
    antennaSoloMode,
    liveParticipants,
    setAntennaSoloMode,
    setPromotedId,
    liveDuration,
    arenaHostCameraCenter,
    lhHostShowsRemoteMain,
    rightRailShowsLocalHost,
    setHostRightRailLocalVideoOpen,
    showHostRightRailVideoFrame,
    hostVidHeight,
    videoFxActive,
    videoFilterCSS,
    arenaLayoutMode,
    applyHostArenaLayoutMode,
    lhMainRemoteParticipant,
    livekitParticipantsMap,
    cameraOn,
    promotedId,
    user,
    hostRightRailVideoIsCenterCameraOnly,
    guestMicLocked,
    toggleMic,
    micOn,
    guestCamLocked,
    toggleCamera,
    guestScreenShareLocked,
    toggleScreenShare,
    sharingScreen,
    debateArena,
    liriAudioScenes,
    liriAudioInitialSceneIndex,
    persistLiriSceneIndex,
    debateModBusy,
    debatePatch,
    debateAiWeightPctDisplay,
    onDebateAiWeightRangeChange,
    debateCurrentRoundStatus,
    debateOpenVoting,
    debateCloseVoting,
    debateLiveVoteCounts,
    debateAiJudgeBusy,
    debateRunAiJudge,
    debateAiReportPreview,
    recording,
    recError,
    stopRecording,
    setRecError,
    hostBoardRightRailTools,
    hostWbToolsRail,
    hostWhiteboardPagingForRail,
    mmCardVisible,
    setMmCardVisible,
    mmView,
    setMmView,
    step,
    stepCount,
    activeEtapes,
    gotoStep,
    sessionCommFlags,
    guestMultilangConfig,
    guestLivekitInterpreterParticipants,
    guestLivekitInterpreterVolume,
    setGuestLivekitInterpreterVolume,
    guestMultilangViewLang,
    setGuestMultilangViewLang,
    guestMultilangRolling,
    guestTeacherTranscript,
    guestTeacherTranscriptPartial,
    supabase,
    curEtape,
    chatMessages,
    publishGuestLongiaBusEvent,
    guestLongiaSessionDigests,
    toast,
    guestMultilangBrowserTtsOn,
    setGuestMultilangBrowserTtsOnPersist,
    guestMultilangEdgeTtsOn,
    setGuestMultilangEdgeTtsOnPersist,
    assertGuestLongiaSignal,
    guestMeshGrant,
    guestMeshRemainSec,
    guestMediaDrive,
    sessionFormationId,
    msMode,
    setMsMode,
    nqAnalysis,
    msBody,
    msTyped,
  },
  ref,
) {
  // Mode formation (focus) hôte : panneau RÉTRACTABLE en languette d'extension
  // (chevron sur le bord droit) plutôt que masqué. Fermé = languette, ouvert = panneau.
  const focusHost = !isGuestUi && phase === PHASE.LIVE; // poignée rétractable par défaut (hôte live — maquette)
  const collapsed = liveRightRailCollapsedStrip || liveRightGuestCollapsedStrip || (focusHost && !liveRightRailOpen);
  const hidden = focusHost ? false : (lhStageFocusLayout || (lhLayoutCompact && !liveRightRailOpen));

  return (
    <div
      ref={ref}
      className="lh-sy"
      style={{
        order: isGuestUi && lhLayoutCompact ? 2 : hostCompactColOrder.right,
        background: collapsed ? liveShell.panelBg : 'var(--lh-page-bg, #262624)',
        borderRadius: collapsed ? liveShell.panelRadius : 0,
        border: collapsed ? liveShell.panelBorder : 'none',
        padding: collapsed ? '10px 6px' : '14px',
        display: hidden ? 'none' : 'flex',
        flexDirection: 'column',
        gap: collapsed ? '8px' : '11px',
        alignItems: collapsed ? 'center' : undefined,
        overflow: 'hidden',
        transition: 'opacity .2s, padding .2s ease',
        opacity: hidden ? 0 : 1,
        pointerEvents: hidden ? 'none' : 'auto',
        position: 'relative',
        zIndex: 25,
        minHeight: 0,
        minWidth: 0,
        alignSelf: 'stretch',
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,.04), 0 18px 42px rgba(0,0,0,.34), 0 0 0 1px rgba(255,255,255,.02) inset',
        // Languette repliée : centrée verticalement dans la fine colonne in-flow.
        justifyContent: collapsed ? 'center' : undefined,
      }}
    >
      {collapsed ? (
        focusHost ? (
          <button
            type="button"
            onClick={() => setLiveRightRailOpen(true)}
            title="Ouvrir le panneau droit"
            aria-label="Ouvrir le panneau droit"
            className="flex items-center justify-center rounded-l-xl border border-r-0 border-white/12 bg-[#15131f]/95 px-1.5 py-6 text-white/70 shadow-[0_12px_30px_rgba(0,0,0,.4)] transition hover:border-amber-400/45 hover:text-white"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>
        ) : (
        <LiveRightRailCollapsedStrip
          liveRightRailCollapsedStrip={liveRightRailCollapsedStrip}
          liveRightGuestCollapsedStrip={liveRightGuestCollapsedStrip}
          setLiveRightRailOpen={setLiveRightRailOpen}
          phase={phase}
          canUsePersonalNotes={guestCapabilityCaps.canUsePersonalNotes}
        />
        )
      ) : (
        <>
          {((isGuestUi && !lhStageFocusLayout) || focusHost) && phase === PHASE.LIVE ? (
            <button
              type="button"
              onClick={() => setLiveRightRailOpen(false)}
              title="Fermer le panneau droit"
              className="pointer-events-auto absolute right-2 top-2 z-[32] flex h-8 w-8 items-center justify-center rounded-lg border border-white/12 bg-[#262624]/90 text-white/65 shadow-sm backdrop-blur-sm transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white/90"
              aria-label="Fermer le panneau droit"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
          <div
            className="lh-right-rail-scroll"
            onScroll={onRightScroll}
            style={{
              flex: isGuestUi ? 1 : '0 1 auto',
              flexShrink: isGuestUi ? undefined : 1,
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              gap: '11px',
              ...(isGuestUi && phase === PHASE.LIVE && !lhStageFocusLayout
                ? { paddingTop: 4, paddingRight: 40 }
                : {}),
            }}
          >
            <LiveGuestRightRailTeacherCard
              isGuestUi={isGuestUi}
              phase={phase}
              hostLiveKitParticipant={hostLiveKitParticipant}
              liveKitMediaEpoch={liveKitMediaEpoch}
              sessionTitle={sessionTitle}
              guestMembersGridSelf={guestMembersGridSelf}
              guestClassmatesPeers={guestClassmatesPeers}
              guestCapabilityCaps={guestCapabilityCaps}
              sessionId={sessionId}
              guestNotesCurrentSceneRef={guestNotesCurrentSceneRef}
              onGuestCaptureSmartboard={onGuestCaptureSmartboard}
              onGuestNotesJumpToScene={onGuestNotesJumpToScene}
            />
            <LiveMediaCheckPanel
              phase={phase}
              liveMediaCheck={liveMediaCheck}
              liveMediaDiagTick={liveMediaDiagTick}
              roomRef={roomRef}
              isGuestUi={isGuestUi}
              guestJoyKitDrive={guestJoyKitDrive}
              tryStartLiveKitPlayback={tryStartLiveKitPlayback}
            />

            {/* Formateur (grand) + vous (mini) — hôte pilote uniquement (invité : vidéo colonne droite + barre bas) */}
            <LiveHostRightRailVideoCard
              isGuestUi={isGuestUi}
              phase={phase}
              antennaSoloMode={antennaSoloMode}
              liveParticipants={liveParticipants}
              setAntennaSoloMode={setAntennaSoloMode}
              setPromotedId={setPromotedId}
              liveDuration={liveDuration}
              lhStageFocusLayout={lhStageFocusLayout}
              arenaHostCameraCenter={arenaHostCameraCenter}
              lhHostShowsRemoteMain={lhHostShowsRemoteMain}
              rightRailShowsLocalHost={rightRailShowsLocalHost}
              setHostRightRailLocalVideoOpen={setHostRightRailLocalVideoOpen}
              setLiveRightRailOpen={setLiveRightRailOpen}
              showHostRightRailVideoFrame={showHostRightRailVideoFrame}
              hostVidHeight={hostVidHeight}
              videoFxActive={videoFxActive}
              videoFilterCSS={videoFilterCSS}
              arenaLayoutMode={arenaLayoutMode}
              applyHostArenaLayoutMode={applyHostArenaLayoutMode}
              lhMainRemoteParticipant={lhMainRemoteParticipant}
              liveKitMediaEpoch={liveKitMediaEpoch}
              livekitParticipantsMap={livekitParticipantsMap}
              cameraOn={cameraOn}
              promotedId={promotedId}
              user={user}
              hostRightRailVideoIsCenterCameraOnly={hostRightRailVideoIsCenterCameraOnly}
              guestMicLocked={guestMicLocked}
              toggleMic={toggleMic}
              micOn={micOn}
              guestCamLocked={guestCamLocked}
              toggleCamera={toggleCamera}
              guestScreenShareLocked={guestScreenShareLocked}
              toggleScreenShare={toggleScreenShare}
              sharingScreen={sharingScreen}
              debateArena={debateArena}
            />

            {!isGuestUi && phase === PHASE.LIVE && sessionId ? (
              <HostSharedGuestNotesInbox sessionId={sessionId} />
            ) : null}

            {/* ── LIRI Audio Scenes — panneau Jocker ── */}
            {phase === PHASE.LIVE && liriAudioScenes.length > 0 && (
              <div
                className="lh-premium-card"
                style={{
                  ...LH_SIDEBAR_CARD,
                  border: '1px solid rgba(212,163,106,.28)',
                  background:
                    'radial-gradient(120% 90% at 10% -10%, rgba(212,163,106,.1), transparent 52%), linear-gradient(160deg, rgba(168,118,58,.05), rgba(255,255,255,.012))',
                  overflow: 'hidden',
                  padding: '10px',
                }}
              >
                <AudioScenePanel
                  scenes={liriAudioScenes}
                  defaultCollapsed
                  initialSceneIndex={liriAudioInitialSceneIndex}
                  sessionKey={sessionId ?? null}
                  onSceneIndexChange={persistLiriSceneIndex}
                />
              </div>
            )}

            {/* DebateCore — pilotage modérateur (hôte uniquement) */}
            <LiveHostDebateModeratorPanel
              debateArena={debateArena}
              isGuestUi={isGuestUi}
              debateModBusy={debateModBusy}
              debatePatch={debatePatch}
              debateAiWeightPctDisplay={debateAiWeightPctDisplay}
              onDebateAiWeightRangeChange={onDebateAiWeightRangeChange}
              debateCurrentRoundStatus={debateCurrentRoundStatus}
              debateOpenVoting={debateOpenVoting}
              debateCloseVoting={debateCloseVoting}
              debateLiveVoteCounts={debateLiveVoteCounts}
              debateAiJudgeBusy={debateAiJudgeBusy}
              debateRunAiJudge={debateRunAiJudge}
              debateAiReportPreview={debateAiReportPreview}
            />

            {/* Indicateur enregistrement (hôte) */}
            <LiveHostRecordingIndicator
              recording={recording}
              recError={recError}
              isGuestUi={isGuestUi}
              onStop={stopRecording}
              onDismissError={() => setRecError(null)}
            />

            {/* Mindmap / fil d'étapes — ou outils tableau blanc (scène Crayon) dans le même emplacement */}
            <LiveHostMindmapOrWhiteboardSlot
              isGuestUi={isGuestUi}
              hostBoardRightRailTools={hostBoardRightRailTools}
              hostWbToolsRailStrokes={hostWbToolsRail.strokes}
              hostWhiteboardPagingForRail={hostWhiteboardPagingForRail}
              mmCardVisible={mmCardVisible}
              setMmCardVisible={setMmCardVisible}
              mmView={mmView}
              setMmView={setMmView}
              step={step}
              stepCount={stepCount}
              activeEtapes={activeEtapes}
              gotoStep={gotoStep}
            />

            {/* MasterScript — hôte ; invité : vidéo formateur + LONGIA (pas de MasterScript ni PiP local) */}
            <LiveGuestLongiaSidebar
              isGuestUi={isGuestUi}
              phase={phase}
              sessionCommFlags={sessionCommFlags}
              guestMultilangConfig={guestMultilangConfig}
              guestLivekitInterpreterParticipants={guestLivekitInterpreterParticipants}
              guestLivekitInterpreterVolume={guestLivekitInterpreterVolume}
              setGuestLivekitInterpreterVolume={setGuestLivekitInterpreterVolume}
              liveKitMediaEpoch={liveKitMediaEpoch}
              guestMultilangViewLang={guestMultilangViewLang}
              setGuestMultilangViewLang={setGuestMultilangViewLang}
              guestMultilangRolling={guestMultilangRolling}
              guestTeacherTranscript={guestTeacherTranscript}
              guestTeacherTranscriptPartial={guestTeacherTranscriptPartial}
              sessionId={sessionId}
              user={user}
              supabase={supabase}
              sessionTitle={sessionTitle}
              curEtape={curEtape}
              chatMessages={chatMessages}
              publishGuestLongiaBusEvent={publishGuestLongiaBusEvent}
              guestLongiaSessionDigests={guestLongiaSessionDigests}
              toast={toast}
              guestMultilangBrowserTtsOn={guestMultilangBrowserTtsOn}
              setGuestMultilangBrowserTtsOnPersist={setGuestMultilangBrowserTtsOnPersist}
              guestMultilangEdgeTtsOn={guestMultilangEdgeTtsOn}
              setGuestMultilangEdgeTtsOnPersist={setGuestMultilangEdgeTtsOnPersist}
              assertGuestLongiaSignal={assertGuestLongiaSignal}
              guestMeshGrant={guestMeshGrant}
              guestMeshRemainSec={guestMeshRemainSec}
              guestMediaDrive={guestMediaDrive}
              sessionFormationId={sessionFormationId}
            />
          </div>
          <LiveHostMasterScriptDock
            isGuestUi={isGuestUi}
            hostBoardRightRailTools={hostBoardRightRailTools}
            msMode={msMode}
            setMsMode={setMsMode}
            curEtape={curEtape}
            nqAnalysis={nqAnalysis}
            msBody={msBody}
            msTyped={msTyped}
          />
        </>
      )}
    </div>
  );
});
