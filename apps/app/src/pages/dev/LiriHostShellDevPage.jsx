import React, { useCallback, useMemo, useRef, useState } from 'react';
import LiveRoomShell from '@/components/liri/live-room/LiveRoomShell';
import LiveControlsBar from '@/components/liri/live-room/LiveControlsBar';
import { cn } from '@/lib/utils';

/**
 * Prévisualisation locale de la vue hôte LIRI (3 colonnes, bandeau, dock bas)
 * sans session Supabase ni LiveKit. Uniquement via la route /dev/liri-host-shell en `npm run dev`.
 */
export default function LiriHostShellDevPage() {
  const mainVideoRef = useRef(null);
  const miniVideoRef = useRef(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [activeScene, setActiveScene] = useState('smartboard');
  const [cinemaMode, setCinemaMode] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [lockedHostMembersColumn, setLockedHostMembersColumn] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const devSlides = useMemo(
    () => [
      {
        id: 'dev-slide-1',
        title: 'Slide démo (local)',
        elements: [],
      },
      {
        id: 'dev-slide-2',
        title: 'Deuxième slide',
        elements: [],
      },
      {
        id: 'dev-slide-3',
        title: 'Troisième slide',
        elements: [],
      },
      {
        id: 'dev-slide-4',
        title: 'Quatrième slide',
        elements: [],
      },
    ],
    [],
  );

  const parallaxSlide = devSlides[Math.min(slideIndex, devSlides.length - 1)];

  const participants = useMemo(
    () => [{ id: 'local-dev', name: 'Prof. LIRI', isLocal: true }],
    [],
  );

  const hostParticipant = participants[0];
  const displayParticipant = {
    name: 'Prof. LIRI',
    panelLabel: 'Vous',
    panelSubtitle: 'Prévisualisation hors session',
  };

  const noop = useCallback(() => {}, []);

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-[#0a0908] select-none">
      <div className="pointer-events-auto absolute left-3 top-3 z-[200] max-w-[min(100%,20rem)] rounded-lg border border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] bg-black/70 px-2.5 py-1.5 text-[10px] text-[#E8D5A3] backdrop-blur-md">
        <span className="pointer-events-none">Dev — </span>
        <span className="font-mono text-white/90">/dev/liri-host-shell</span>
        {' · '}
        <a href="/dev/liri-host-ui" className="text-sky-300 underline-offset-2 hover:underline">
          maquette statique
        </a>
      </div>

      <LiveRoomShell
        active
        mainVideoRef={mainVideoRef}
        miniVideoRef={miniVideoRef}
        mainDisplayParticipant={displayParticipant}
        miniDisplayParticipant={displayParticipant}
        participants={participants}
        zone3Members={[]}
        hostParticipant={hostParticipant}
        promotedParticipantId={null}
        onPromoteParticipant={noop}
        remoteWaiting={false}
        slides={devSlides}
        slideIndex={slideIndex}
        slideRailCount={devSlides.length}
        onPrevSlide={() => setSlideIndex((i) => Math.max(0, i - 1))}
        onNextSlide={() => setSlideIndex((i) => Math.min(devSlides.length - 1, i + 1))}
        onSetSlideIndex={setSlideIndex}
        parallaxSlide={parallaxSlide}
        slideParallaxKey={null}
        activeScene={activeScene}
        onChangeScene={setActiveScene}
        sceneFlags={null}
        spotlight={false}
        onToggleSpotlight={noop}
        progressivePlayback
        tacticalSyncRole="host"
        remoteTacticalSync={null}
        onTacticalSyncChange={undefined}
        onSmartboardImageExpand={undefined}
        onMasterScriptNavigateToSlide={undefined}
        drawerOpen={drawerOpen}
        unreadCount={0}
        onToggleDrawer={() => setDrawerOpen((v) => !v)}
        drawerMessages={[]}
        onSendForumMessage={async () => {}}
        forumSending={false}
        currentUserId="dev-local"
        muted={muted}
        cameraOff={cameraOff}
        sharingScreen={false}
        screenShareVideoRef={undefined}
        camera2VideoRef={undefined}
        camera2Active={false}
        onStartCamera2={undefined}
        camera2FluxParticipants={[]}
        camera2Placeholder={null}
        camera2WaitingRemote={false}
        sharedImageSrc=""
        sharedGalleryLength={0}
        sharedImageIndex={0}
        onSharedImagePrev={noop}
        onSharedImageNext={noop}
        sharedImageLoop={false}
        onToggleSharedImageLoop={noop}
        onToggleMuted={() => setMuted((m) => !m)}
        onToggleCamera={() => setCameraOff((c) => !c)}
        onToggleShare={noop}
        onStopLive={noop}
        onOpenLiveSettings={noop}
        isHost
        zone3RaisedHands={[]}
        scriptSections={[]}
        scriptCurrentSection={null}
        zone3PrivilegedSeats={[]}
        zone3MyHandRaised={false}
        onZone3RaiseHand={noop}
        onZone3LowerHand={noop}
        onZone3GrantSeat={noop}
        onZone3RevokeSeat={noop}
        neuronqFeatureEnabled={false}
        neuronqQuestions={[]}
        videoBlur={false}
        videoBeauty={false}
        videoVbg="none"
        videoFilterCSS=""
        videoChromaKey={false}
        videoChromaColor="#00B140"
        videoChromaSens={80}
        pipStream={null}
        onPipCanvasRef={undefined}
        immersiveVideoGlass
        cinemaMode={cinemaMode}
        onToggleCinema={() => setCinemaMode((v) => !v)}
        liveKitRoomRef={null}
        liveWhisperSessionKey={null}
        liveSessionWhisperBridge={null}
        stripOpensMemberPreview
        annotationStrokes={[]}
        onAnnotationStrokesChange={undefined}
        messagingImmersiveFaceToFace={false}
        liriMobileMaquette={false}
        liveArenaMotherboardFrame
        immersiveBackdropVariant="liriHost"
        arenaWaitingEntries={[]}
        onArenaApproveWaiting={noop}
        onArenaRejectWaiting={noop}
        arenaHostActivityFeed={[]}
        onArenaHostActivityFeedClear={noop}
        lockedHostMembersColumn={lockedHostMembersColumn}
        onLockedHostMembersColumnChange={setLockedHostMembersColumn}
        ambientTracks={[]}
        ambientAudioEnabled={false}
        sceneTransitionSoundEnabled={false}
        shopProducts={[]}
        onShopProductClick={undefined}
        uxState="focus-video"
        actionsOpen={false}
        onToggleActions={noop}
        isReconnecting={false}
        connectionQuality={null}
        coursePlanSplit={null}
        onPickCoursePlanSlide={null}
      />

      <div
        className={cn(
          'transition-opacity duration-300',
          cinemaMode && 'opacity-0 hover:opacity-100 focus-within:opacity-100',
        )}
      >
        <LiveControlsBar
          muted={muted}
          cameraOff={cameraOff}
          sharingScreen={false}
          spotlight={false}
          isHost
          onToggleMuted={() => setMuted((m) => !m)}
          onToggleCamera={() => setCameraOff((c) => !c)}
          onToggleShare={noop}
          onToggleSpotlight={noop}
          progressivePlayback
          onToggleProgressiveReading={undefined}
          slideCurrent={slideIndex + 1}
          slideTotal={devSlides.length}
          onPrevSlide={() => setSlideIndex((i) => Math.max(0, i - 1))}
          onNextSlide={() => setSlideIndex((i) => Math.min(devSlides.length - 1, i + 1))}
          onStopLive={noop}
          onOpenSettings={noop}
          premiumHostDock
          onHostInstructionSubmit={async () => {}}
          instructionSending={false}
          inviteUrl=""
          handRaised={false}
          onRaiseHand={noop}
          onLowerHand={noop}
          onSendReaction={noop}
          onLeave={noop}
          cinemaMode={cinemaMode}
          onToggleCinema={() => setCinemaMode((v) => !v)}
          forumDrawerOpen={drawerOpen}
          forumUnreadCount={0}
          onToggleForum={() => setDrawerOpen((v) => !v)}
          participantsOpen={lockedHostMembersColumn}
          onToggleParticipants={() => setLockedHostMembersColumn((v) => !v)}
        />
      </div>
    </div>
  );
}
