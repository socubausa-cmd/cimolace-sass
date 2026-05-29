import React, { useState, useRef, useEffect, useMemo } from 'react';
import AmbientAudioLayer from '@/components/live-room/AmbientAudioLayer';
import { LiveHostMobileTopBar }         from './LiveHostMobileTopBar';
import { LiveHostMobileBottomBar }       from './LiveHostMobileBottomBar';
import { LiveHostMobileParticipantStrip } from './LiveHostMobileParticipantStrip';
import { LiveHostMobileMemberFullscreen } from './LiveHostMobileMemberFullscreen';
import { LiveHostMobileSignalBadges }    from './LiveHostMobileSignalBadges';
import { LiveGuestProctorConsentModal }  from '@/features/live/host/components/LiveGuestProctorConsentModal';
import { LiveHostMobileDrawer }          from './LiveHostMobileDrawer';
import { LiveHostMobileLeftDrawer }      from './LiveHostMobileLeftDrawer';
import { LiveHostMobileFabStack }        from './LiveHostMobileFabStack';
import { LiveHostMobileChatOverlay }     from './LiveHostMobileChatOverlay';
import { LiveHostMobileViewerPipeline }  from './LiveHostMobileViewerPipeline';

/**
 * LiveHostMobileShell — Layout TikTok Live complet.
 *
 * ┌────────────────────────────────────────────┐
 * │  TopBar                     handle ▌ gauche  │
 * ├────────────────────────────────────────────┤
 * │ LeftDrawer │   SmartBoard    │ FabStack    │
 * │  (glisse)  │  (plein écran) │ (flottants) │
 * │            │  chat overlay   │             │
 * ├────────────────────────────────────────────┤
 * │        ═══ Drawer bas TikTok ═══            │
 * │    [Chat][Q&R][Script][Aparté][IA][Membres] │
 * ├────────────────────────────────────────────┤
 * │              BottomBar                      │
 * └────────────────────────────────────────────┘
 */
export function LiveHostMobileShell({
  // Session meta
  isGuestUi,
  sessionTitle,
  phase,
  liveDuration,
  onlineMemberCount,
  step,
  stepCount,
  gotoStep,
  handleStop,
  stopLiveBusy,

  // Media
  micOn, toggleMic,
  cameraOn, toggleCamera,
  isRecording, startRecording, stopRecording, recStarting,

  // Participants
  liveParticipants,
  livekitParticipantsMap,
  user,
  hostLiveKitParticipant,
  liveKitMediaEpoch,
  muteParticipant,
  kickParticipant,

  // SmartBoard
  smartBoardStageRef,
  hostSmartboardPipStream,
  smartboardSlot,
  hostCameraSlot,

  // Scènes SmartBoard
  smartboardSceneFlags,
  sbActiveScene,
  setSbActiveScene,

  // Chat
  chatMessages,
  sendChatMessage,

  // Copy invite
  copyInviteLink,
  inviteCopied,

  // Branding
  liveShell,

  // Q&A NeuronQ
  neuronqQuestions,
  markNeuronqAnswered,
  markNeuronqSkipped,

  // Script
  activeEtapes,
  curEtape,

  // Audio ambiant
  ambientTracks,
  ambientMasterVolume,
  setAmbientMasterVolume,

  // Signaux LONGIA — levées de main
  lastHandEv,
  hostAccessRequestCount,
  resolveHandRaise,
  zone3RaisedHands,

  // Salle d'attente
  waitingEntries,
  approveWaiting,
  rejectWaiting,

  // Permissions
  hostPermissionRequests,
  resolveHostPermissionSignal,
  hostJoyKitRequests,
  resolveHostJoyKitSignal,

  // Réactions flottantes
  floatingReactions,

  // Proctor consent
  guestProctorModalOpen,
  acceptGuestProctorConsent,

  // Whispers
  whisperThreads,
  sendWhisper,

  // Spotlight / focus
  spotlightOn,
  toggleSpotlight,

  // NeuronQ toggle
  neuronQActive,
  toggleNeuronQ,
}) {
  // ── PiP caméra hôte ────────────────────────────────────────────────────────
  const hostPipVideoRef = useRef(null);
  useEffect(() => {
    if (!hostPipVideoRef.current || !hostLiveKitParticipant) return;
    const camPub = Array.from(
      hostLiveKitParticipant.videoTrackPublications?.values?.() ?? [],
    ).find((pub) => pub.source === 'camera' || pub.kind === 'video');
    if (camPub?.track) {
      camPub.track.attach(hostPipVideoRef.current);
      return () => camPub.track.detach(hostPipVideoRef.current);
    }
  }, [hostLiveKitParticipant, liveKitMediaEpoch]);

  // ── Etape courante ─────────────────────────────────────────────────────────
  const etapeLabel = useMemo(() => {
    if (!curEtape) return null;
    return curEtape.titre || curEtape.title || curEtape.label || null;
  }, [curEtape]);

  // ── États locaux ───────────────────────────────────────────────────────────
  const [selectedParticipant, setSelectedParticipant] = useState(null);

  // Chat unread pour badge dans le drawer
  const prevMsgCountRef = useRef(chatMessages?.length ?? 0);
  const [chatUnread, setChatUnread] = useState(0);
  useEffect(() => {
    const cur = chatMessages?.length ?? 0;
    const diff = cur - prevMsgCountRef.current;
    if (diff > 0) setChatUnread((n) => n + diff);
    prevMsgCountRef.current = cur;
  }, [chatMessages?.length]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      data-lh-mobile-shell="1"
      style={{
        position: 'fixed',
        inset: 0,
        background: '#0f1117',
        overflow: 'hidden',
        fontFamily: 'var(--school-font-family, system-ui, -apple-system, sans-serif)',
        touchAction: 'none',
      }}
    >
      {/*
       * ── LAYER 0 : ViewerPipeline — TOUJOURS rendu comme base ──────────────
       * Affiche le flux vidéo hôte + gradients + badge LIVE + info prof/cours.
       * Visible dès que le SmartBoard est transparent (pas de scène active).
       */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' }}>
        <LiveHostMobileViewerPipeline
          hostLiveKitParticipant={hostLiveKitParticipant}
          liveKitMediaEpoch={liveKitMediaEpoch}
          cameraOn={cameraOn}
          hostCameraSlot={hostCameraSlot}
          user={user}
          sessionTitle={sessionTitle}
          liveDuration={liveDuration}
          onlineMemberCount={onlineMemberCount}
          step={step}
          stepCount={stepCount}
          etapeLabel={etapeLabel}
          liveShell={liveShell}
        />
      </div>

      {/*
       * ── LAYER 1 : SmartBoard — par-dessus le viewer, fond transparent ──────
       * Quand aucune scène n'est active, le SmartBoard est rgba(0,0,0,0)
       * → le ViewerPipeline en dessous reste entièrement visible.
       * Quand une scène est active (diapo, écran, etc.) elle couvre le viewer.
       */}
      {smartboardSlot && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 1, overflow: 'hidden' }}>
          {smartboardSlot}
        </div>
      )}

      {/*
       * ── LAYER 2 : PiP caméra hôte (bas-droite) ────────────────────────────
       * S'affiche quand une scène SmartBoard couvre le viewer plein écran.
       */}
      {cameraOn && smartboardSlot && (
        <div style={{
          position: 'absolute', bottom: 92, right: 68,
          width: 64, height: 86, borderRadius: 10, overflow: 'hidden',
          zIndex: 10, border: '1.5px solid rgba(255,255,255,0.25)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)', background: '#000',
        }}>
          {hostCameraSlot ?? (
            <video ref={hostPipVideoRef} autoPlay muted playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
        </div>
      )}

      {/* ── Audio ambiant ─────────────────────────────────────────────────── */}
      <AmbientAudioLayer
        tracks={ambientTracks}
        enabled={Boolean(ambientTracks?.length)}
        masterVolume={ambientMasterVolume ?? 0.22}
      />

      {/* ── Réactions flottantes ─────────────────────────────────────────── */}
      {floatingReactions?.map?.((r, i) => (
        <span key={r.id || i} className="lh-reaction"
          style={{ left: `${r.x ?? (12 + (i % 6) * 13)}%`, zIndex: 18 }}>
          {r.emoji || r.reaction || '👏'}
        </span>
      ))}

      {/* ── Chat overlay (messages qui remontent sur le SmartBoard) ─────────── */}
      <LiveHostMobileChatOverlay
        chatMessages={chatMessages}
        user={user}
        bottomOffset={96}
      />

      {/* ── Boutons flottants DROITE — style TikTok ──────────────────────── */}
      {!isGuestUi && (
        <LiveHostMobileFabStack
          isGuestUi={isGuestUi}
          sbActiveScene={sbActiveScene}
          setSbActiveScene={setSbActiveScene}
          smartboardSceneFlags={smartboardSceneFlags}
          hostJoyKitRequests={hostJoyKitRequests}
          copyInviteLink={copyInviteLink}
          inviteCopied={inviteCopied}
          isRecording={isRecording}
          startRecording={startRecording}
          stopRecording={stopRecording}
          recStarting={recStarting}
          spotlightOn={spotlightOn}
          toggleSpotlight={toggleSpotlight}
        />
      )}

      {/* ── TopBar ───────────────────────────────────────────────────────── */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30, pointerEvents: 'none' }}>
        <LiveHostMobileTopBar
          isGuestUi={isGuestUi}
          liveDuration={liveDuration}
          onlineMemberCount={onlineMemberCount}
          step={step}
          stepCount={stepCount}
          sessionTitle={sessionTitle}
          handleStop={handleStop}
          stopLiveBusy={stopLiveBusy}
          leftOffset={0}
        />
      </div>

      {/* ── Badges LONGIA (toujours visibles, au-dessus du SmartBoard) ──────── */}
      {!isGuestUi && (
        <LiveHostMobileSignalBadges
          lastHandEv={lastHandEv}
          hostAccessRequestCount={hostAccessRequestCount}
          resolveHandRaise={resolveHandRaise}
          zone3RaisedHands={zone3RaisedHands}
          waitingEntries={waitingEntries}
          approveWaiting={approveWaiting}
          rejectWaiting={rejectWaiting}
          hostPermissionRequests={hostPermissionRequests}
          resolveHostPermissionSignal={resolveHostPermissionSignal}
          hostJoyKitRequests={hostJoyKitRequests}
          resolveHostJoyKitSignal={resolveHostJoyKitSignal}
          liveParticipants={liveParticipants}
        />
      )}

      {/* ── Strip participants ────────────────────────────────────────────── */}
      <LiveHostMobileParticipantStrip
        liveParticipants={liveParticipants}
        onSelectParticipant={setSelectedParticipant}
        user={user}
      />

      {/* ── TIROIR BAS TikTok ─────────────────────────────────────────────── */}
      <LiveHostMobileDrawer
        isGuestUi={isGuestUi}
        user={user}
        chatMessages={chatMessages}
        sendChatMessage={sendChatMessage}
        chatUnread={chatUnread}
        onChatOpen={() => setChatUnread(0)}
        neuronqQuestions={neuronqQuestions}
        markNeuronqAnswered={markNeuronqAnswered}
        markNeuronqSkipped={markNeuronqSkipped}
        activeEtapes={activeEtapes}
        step={step}
        gotoStep={gotoStep}
        whisperThreads={whisperThreads}
        sendWhisper={sendWhisper}
        liveParticipants={liveParticipants}
        livekitParticipantsMap={livekitParticipantsMap}
        muteParticipant={muteParticipant}
        kickParticipant={kickParticipant}
        onlineMemberCount={onlineMemberCount}
      />

      {/* ── BottomBar ─────────────────────────────────────────────────────── */}
      <LiveHostMobileBottomBar
        isGuestUi={isGuestUi}
        micOn={micOn}
        toggleMic={toggleMic}
        cameraOn={cameraOn}
        toggleCamera={toggleCamera}
        step={step}
        stepCount={stepCount}
        gotoStep={gotoStep}
        isRecording={isRecording}
        startRecording={startRecording}
        stopRecording={stopRecording}
        recStarting={recStarting}
      />

      {/* ── TIROIR GAUCHE (Hub · Scènes · Contrôle · Signaux) ───────────── */}
      <LiveHostMobileLeftDrawer
        isGuestUi={isGuestUi}
        smartboardSceneFlags={smartboardSceneFlags}
        sbActiveScene={sbActiveScene}
        setSbActiveScene={setSbActiveScene}
        micOn={micOn}
        toggleMic={toggleMic}
        cameraOn={cameraOn}
        toggleCamera={toggleCamera}
        ambientMasterVolume={ambientMasterVolume}
        setAmbientMasterVolume={setAmbientMasterVolume}
        spotlightOn={spotlightOn}
        toggleSpotlight={toggleSpotlight}
        neuronQActive={neuronQActive}
        toggleNeuronQ={toggleNeuronQ}
        waitingEntries={waitingEntries}
        approveWaiting={approveWaiting}
        rejectWaiting={rejectWaiting}
        zone3RaisedHands={zone3RaisedHands}
        resolveHandRaise={resolveHandRaise}
        hostAccessRequestCount={hostAccessRequestCount}
        onlineMemberCount={onlineMemberCount}
        liveParticipants={liveParticipants}
      />

      {/* ── Membre fullscreen ─────────────────────────────────────────────── */}
      {selectedParticipant && (
        <LiveHostMobileMemberFullscreen
          participant={selectedParticipant}
          onClose={() => setSelectedParticipant(null)}
          livekitParticipantsMap={livekitParticipantsMap}
          smartBoardPipStream={hostSmartboardPipStream}
          isHost={!isGuestUi}
          onMute={(p) => muteParticipant?.(p.user_id || p.userId)}
          onKick={(p) => kickParticipant?.(p.user_id || p.userId)}
        />
      )}

      {/* ── Proctor consent ───────────────────────────────────────────────── */}
      <LiveGuestProctorConsentModal
        open={guestProctorModalOpen}
        isGuestUi={isGuestUi}
        onAccept={() => void acceptGuestProctorConsent?.()}
        onRefuse={() => window.history.back()}
      />
    </div>
  );
}
