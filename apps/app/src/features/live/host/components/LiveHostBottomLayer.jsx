import React from 'react';
import AmbientAudioLayer from '@/components/liri/live-room/AmbientAudioLayer';
import DebateVoteStrip from '@/components/liri/live-room/DebateVoteStrip';
import LiveAsidePip from '@/components/liri/live-room/LiveAsidePip';
import LiveGuestNeuronqPanel from '@/components/liri/live-room/LiveGuestNeuronqPanel';
import LiveHostLongiaHubDrawer from '@/components/liri/live-room/LiveHostLongiaHubDrawer';
import { LiveCompactRailToggles } from '@/features/live/host/components/LiveCompactRailToggles';
import { LiveDebateVoteOverlay } from '@/features/live/host/components/LiveDebateVoteOverlay';
import { LiveGuestProctorConsentModal } from '@/features/live/host/components/LiveGuestProctorConsentModal';
import { LiveGuestProctorHistoryFloating } from '@/features/live/host/components/LiveGuestProctorHistoryFloating';
import { LiveHostFloatingRoomChips } from '@/features/live/host/components/LiveHostFloatingRoomChips';
import { LiveHostMemberVideoModalSlot } from '@/features/live/host/components/LiveHostMemberVideoModalSlot';
import { LiveHostMobileCameraQrModal } from '@/features/live/host/components/LiveHostMobileCameraQrModal';
import { LiveLiriAudioSceneSlot } from '@/features/live/host/components/LiveLiriAudioSceneSlot';
import { PHASE } from '@/features/live/host/liveHostConstants';

/**
 * Couche basse / "floating" du `LiveHostPage` : regroupe tous les overlays
 * absolus (rail toggles, audio ambient, scènes LIRI, proctor, debate, mobile
 * camera QR, neuronQ invité, aparté PiP, room chips, drawer LONGIA hub).
 * Sortie en un seul slot pour soulager le JSX de la page hôte.
 */
export const LiveHostBottomLayer = ({
  phase,
  isGuestUi,
  lhStageFocusLayout,
  lhLayoutCompact,
  liveLeftRailOpen,
  liveRightRailOpen,
  setLiveLeftRailOpen,
  setLiveRightRailOpen,
  ambientTracks,
  ambientMasterVolume,
  micOn,
  liriAudioScenes,
  guestLiriAudioSmartboard,
  guestLiriAudioSceneName,
  user,
  sessionCommFlags,
  guestProctorHistoryOpen,
  setGuestProctorHistoryOpen,
  guestProctorOwnLoading,
  guestProctorOwnRows,
  fetchGuestProctorOwnHistory,
  debateArena,
  debateVoteBusy,
  setDebateVoteBusy,
  refreshDebateRounds,
  debateLiveVoteCounts,
  guestProctorModalOpen,
  setGuestProctorModalOpen,
  acceptGuestProctorConsent,
  navigate,
  mobileCameraLinkOpen,
  setMobileCameraLinkOpen,
  mobileCameraLinkLoading,
  mobileCameraLinkErr,
  mobileCameraJoinUrl,
  mobileCameraLinkExpires,
  toast,
  modal,
  setModal,
  roomRef,
  promotedId,
  setPromotedId,
  setAntennaSoloMode,
  applyHostArenaLayoutMode,
  memberModalAllowSchoolLife,
  muteParticipant,
  kickParticipant,
  broadcastHostCameraCommand,
  sessionId,
  whisperThreads,
  sendWhisper,
  memberModalWhisperPickable,
  liveParticipants,
  guestNeuronqPanelOpen,
  setGuestNeuronqPanelOpen,
  debateNeuronqEnabled,
  sessionQuickIaFlags,
  guestNeuronqVolets,
  setGuestNeuronqVolets,
  guestNeuronqReformulated,
  setGuestNeuronqReformulated,
  neuronqReformulating,
  neuronqReformulateGuest,
  guestNeuronqCombinedRaw,
  submitGuestNeuronq,
  neuronqGuestSubmitting,
  asideMedia,
  isHostUser,
  forumTarget,
  longiaHubOpen,
  setLongiaHubOpen,
  liveHostLongiaSignalHub,
  longiaHubDrawerWidthPx,
  toggleLayoutPreviewHubPanel,
  longiaSignalSubDrawer,
}) => {
  return (
    <>
      <LiveCompactRailToggles
        phase={phase}
        lhStageFocusLayout={lhStageFocusLayout}
        lhLayoutCompact={lhLayoutCompact}
        liveLeftRailOpen={liveLeftRailOpen}
        liveRightRailOpen={liveRightRailOpen}
        onOpenLeft={() => setLiveLeftRailOpen(true)}
        onOpenRight={() => setLiveRightRailOpen(true)}
      />

      <AmbientAudioLayer
        tracks={ambientTracks}
        enabled={phase === PHASE.LIVE && ambientTracks.length > 0}
        masterVolume={ambientMasterVolume}
      />

      <LiveLiriAudioSceneSlot
        phase={phase}
        isGuestUi={isGuestUi}
        micOn={micOn}
        liriAudioScenesLength={liriAudioScenes.length}
        guestLiriAudioSmartboard={guestLiriAudioSmartboard}
        guestLiriAudioSceneName={guestLiriAudioSceneName}
      />

      <LiveGuestProctorHistoryFloating
        phase={phase}
        isGuestUi={isGuestUi}
        hasUser={Boolean(user?.id)}
        proctoringConsentRequired={sessionCommFlags.proctoring_camera_consent_required === true}
        open={guestProctorHistoryOpen}
        setOpen={setGuestProctorHistoryOpen}
        loading={guestProctorOwnLoading}
        rows={guestProctorOwnRows}
        onRefresh={fetchGuestProctorOwnHistory}
      />

      {debateArena && user?.id ? (
        <DebateVoteStrip
          debate={debateArena}
          userId={user.id}
          isHost={!isGuestUi}
          voteBusy={debateVoteBusy}
          setVoteBusy={setDebateVoteBusy}
          onAfterVote={() => {
            const id = debateArena?.debateId;
            if (id) void refreshDebateRounds(id);
          }}
          liveVoteCounts={debateLiveVoteCounts}
          compact={lhLayoutCompact}
        />
      ) : null}

      {/* DebateVoteStrip (participants / non-hôtes uniquement — retourne null pour l'hôte) */}
      <LiveDebateVoteOverlay
        phase={phase}
        debateArena={debateArena}
        debateLiveVoteCounts={debateLiveVoteCounts}
      />

      <LiveGuestProctorConsentModal
        open={guestProctorModalOpen}
        isGuestUi={isGuestUi}
        onAccept={() => void acceptGuestProctorConsent()}
        onRefuse={() => {
          setGuestProctorModalOpen(false);
          navigate(-1);
        }}
      />

      {/* MODALS */}
      <LiveHostMobileCameraQrModal
        open={mobileCameraLinkOpen}
        isGuestUi={isGuestUi}
        loading={mobileCameraLinkLoading}
        errorMsg={mobileCameraLinkErr}
        joinUrl={mobileCameraJoinUrl}
        expiresAt={mobileCameraLinkExpires}
        onClose={() => setMobileCameraLinkOpen(false)}
        onCopy={() => {
          void navigator.clipboard?.writeText?.(mobileCameraJoinUrl);
          toast({
            title: 'Lien copié',
            description: 'Collez-le sur le téléphone si le QR ne convient pas.',
          });
        }}
      />

      <LiveHostMemberVideoModalSlot
        modal={modal}
        setModal={setModal}
        roomRef={roomRef}
        isGuestUi={isGuestUi}
        promotedId={promotedId}
        setPromotedId={setPromotedId}
        setAntennaSoloMode={setAntennaSoloMode}
        applyHostArenaLayoutMode={applyHostArenaLayoutMode}
        memberModalAllowSchoolLife={memberModalAllowSchoolLife}
        muteParticipant={muteParticipant}
        kickParticipant={kickParticipant}
        sessionCommFlags={sessionCommFlags}
        broadcastHostCameraCommand={broadcastHostCameraCommand}
        sessionId={sessionId}
        user={user}
        whisperThreads={whisperThreads}
        sendWhisper={sendWhisper}
        toast={toast}
        memberModalWhisperPickable={memberModalWhisperPickable}
        liveParticipants={liveParticipants}
      />

      <LiveGuestNeuronqPanel
        open={Boolean(
          isGuestUi &&
            guestNeuronqPanelOpen &&
            debateNeuronqEnabled &&
            sessionQuickIaFlags.neuronq_enabled !== false &&
            user?.id,
        )}
        onClose={() => setGuestNeuronqPanelOpen(false)}
        volets={guestNeuronqVolets}
        onVoletsChange={setGuestNeuronqVolets}
        guestNeuronqReformulated={guestNeuronqReformulated}
        onReformulatedChange={setGuestNeuronqReformulated}
        neuronqReformulating={neuronqReformulating}
        onReformulate={() => void neuronqReformulateGuest(guestNeuronqCombinedRaw)}
        onSubmit={() => void submitGuestNeuronq()}
        neuronqGuestSubmitting={neuronqGuestSubmitting}
        combinedRawTrimmed={guestNeuronqCombinedRaw.trim()}
      />

      {phase === PHASE.LIVE && user?.id && asideMedia.asideState === 'connected' && asideMedia.remoteStream ? (
        <LiveAsidePip
          stream={asideMedia.remoteStream}
          label={isHostUser ? `Aparté — ${forumTarget?.name || 'Membre'}` : 'Formateur'}
          onClose={() => void asideMedia.endAside()}
        />
      ) : null}

      <LiveHostFloatingRoomChips
        phase={phase}
        isGuestUi={isGuestUi}
        lhStageFocusLayout={lhStageFocusLayout}
        liveParticipants={liveParticipants}
      />

      {phase === PHASE.LIVE && !isGuestUi ? (
        <LiveHostLongiaHubDrawer
          open={longiaHubOpen}
          onClose={() => {
            setLongiaHubOpen(false);
          }}
          centralFocusMode={lhStageFocusLayout}
          signalHubSlot={liveHostLongiaSignalHub}
          drawerWidthPx={longiaHubDrawerWidthPx}
          onOpenLayoutPreview={toggleLayoutPreviewHubPanel}
          layoutPreviewHubActive={longiaSignalSubDrawer === 'layout_preview'}
        />
      ) : null}
    </>
  );
};
