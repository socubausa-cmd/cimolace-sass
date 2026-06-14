import React, { useMemo } from 'react';
import LiveHostVideoCell from '@/components/liri/live-room/LiveHostVideoCell';
import LiveStudioSettingsPanel from '@/components/liri/live-room/LiveStudioSettingsPanel';
import LiveHostAsideAndMonitorBar from '@/components/liri/live-room/LiveHostAsideAndMonitorBar';
import { PHASE } from '@/features/live/host/liveHostConstants';

/**
 * Slot encapsulant `LiveStudioSettingsPanel` côté hôte : prépare le `videoPreview`
 * inline, le slot routing host (aparté + monitor), et l'objet `sessionQuickSettings`
 * (smartboard scenes, IA flags, multi-lingue, proctor) — sortis de `LiveHostPage`
 * pour réduire son indentation et son volume.
 */
export const LiveHostStudioSettingsPanelSlot = ({
  showSettings,
  setShowSettings,
  isGuestUi,
  phase,
  user,
  sessionId,
  sessionGuestPermissions,
  handleGuestPermissionsChange,
  livekitParticipantsMap,
  cameraOn,
  liveKitMediaEpoch,
  videoFxActive,
  videoFilterCSS,
  videoBeauty,
  setVideoBeauty,
  videoChromaKey,
  handleArenaChromaKeyChange,
  videoChromaColor,
  setVideoChromaColor,
  videoChromaSens,
  setVideoChromaSens,
  videoBlur,
  setVideoBlur,
  videoVbg,
  handleArenaVbgChange,
  videoCustomBgUrl,
  setVideoCustomBgUrl,
  videoBrightness,
  setVideoBrightness,
  videoContrast,
  setVideoContrast,
  videoSaturation,
  setVideoSaturation,
  videoHue,
  setVideoHue,
  micGain,
  setMicGain,
  noiseReduction,
  setNoiseReduction,
  liriAudioMode,
  setLiriAudioMode,
  liriClarity,
  setLiriClarity,
  liriReverb,
  setLiriReverb,
  liriCompression,
  setLiriCompression,
  liriGate,
  setLiriGate,
  liriLimiter,
  setLiriLimiter,
  liriAudioLevels,
  videoDevices,
  audioDevices,
  activeVideoId,
  activeAudioId,
  switchVideoDevice,
  switchAudioDevice,
  arenaHostAlertSoundOn,
  setArenaHostAlertSoundOn,
  forumTarget,
  asideMedia,
  hostMonitorBus,
  ambientTracks,
  ambientMasterVolume,
  setAmbientMasterVolume,
  smartboardSceneFlags,
  handleQuickSmartboardSceneToggle,
  sessionQuickIaFlags,
  handleQuickIaToggle,
  sessionCommFlags,
  handleQuickCommToggle,
  setShowMessagingPanel,
  openLongiaHubControlMesh,
  hostMultilang,
  setHostMultilangField,
  proctorCamHistoryRows,
  proctorCamHistoryLoading,
  fetchProctorCamHistory,
}) => {
  const videoPreview = (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 200,
        background: 'linear-gradient(135deg,#1e1830,#2a1f40)',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      {livekitParticipantsMap['local'] && cameraOn ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            filter: videoFxActive ? videoFilterCSS : undefined,
          }}
        >
          <LiveHostVideoCell
            participant={livekitParticipantsMap['local']}
            mediaEpoch={liveKitMediaEpoch}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          />
        </div>
      ) : (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            textAlign: 'center',
            fontSize: 12,
            color: 'rgba(255,255,255,.45)',
          }}
        >
          Activez la caméra pour prévisualiser maquillage et détourage en direct.
        </div>
      )}
    </div>
  );

  const hostMediaRoutingSlot =
    !isGuestUi && phase === PHASE.LIVE && user?.id ? (
      <LiveHostAsideAndMonitorBar
        embedded
        forumTarget={forumTarget}
        asideState={asideMedia.asideState}
        asideMode={asideMedia.asideMode}
        startAside={asideMedia.startAside}
        endAside={asideMedia.endAside}
        monitorBus={hostMonitorBus}
      />
    ) : null;

  const sessionQuickSettings = useMemo(() => {
    if (!(!isGuestUi && phase === PHASE.LIVE && sessionId)) return null;
    return {
      inviteUrl:
        typeof window !== 'undefined'
          ? `${window.location.origin}/live/${sessionId}`
          : `/live/${sessionId}`,
      smartboardSceneFlags,
      onToggleSmartboardScene: handleQuickSmartboardSceneToggle,
      iaFlags: sessionQuickIaFlags,
      onToggleIa: handleQuickIaToggle,
      commFlags: sessionCommFlags,
      onToggleComm: handleQuickCommToggle,
      onOpenJoyKit: () => {
        setShowSettings(false);
        setShowMessagingPanel(false);
        openLongiaHubControlMesh();
      },
      multilang: {
        enabled: hostMultilang.enabled,
        sourceLang: hostMultilang.sourceLang,
        targetsStr: hostMultilang.targetsStr,
        guestBrowserTtsOffered: hostMultilang.guestBrowserTtsOffered !== false,
        guestEdgeTtsOffered: hostMultilang.guestEdgeTtsOffered === true,
        livekitInterpreterEnabled: hostMultilang.livekitInterpreterEnabled === true,
        onChange: setHostMultilangField,
      },
      proctorCameraHistory: {
        rows: proctorCamHistoryRows,
        loading: proctorCamHistoryLoading,
        onRefresh: fetchProctorCamHistory,
      },
    };
  }, [
    isGuestUi,
    phase,
    sessionId,
    smartboardSceneFlags,
    handleQuickSmartboardSceneToggle,
    sessionQuickIaFlags,
    handleQuickIaToggle,
    sessionCommFlags,
    handleQuickCommToggle,
    setShowSettings,
    setShowMessagingPanel,
    openLongiaHubControlMesh,
    hostMultilang,
    setHostMultilangField,
    proctorCamHistoryRows,
    proctorCamHistoryLoading,
    fetchProctorCamHistory,
  ]);

  return (
    <LiveStudioSettingsPanel
      open={showSettings}
      onClose={() => setShowSettings(false)}
      participantMode={isGuestUi}
      guestPermissions={!isGuestUi ? sessionGuestPermissions : undefined}
      onGuestPermissionsChange={!isGuestUi ? handleGuestPermissionsChange : undefined}
      videoPreview={videoPreview}
      beauty={videoBeauty}
      onBeautyChange={setVideoBeauty}
      chromaKey={videoChromaKey}
      onChromaKeyChange={handleArenaChromaKeyChange}
      chromaColor={videoChromaColor}
      onChromaColorChange={setVideoChromaColor}
      chromaSensitivity={videoChromaSens}
      onChromaSensitivityChange={setVideoChromaSens}
      videoBlur={videoBlur}
      onVideoBlurChange={setVideoBlur}
      videoVbg={videoVbg}
      onVideoVbgChange={handleArenaVbgChange}
      customBgUrl={videoCustomBgUrl}
      onCustomBgChange={setVideoCustomBgUrl}
      brightness={videoBrightness}
      onBrightnessChange={setVideoBrightness}
      contrast={videoContrast}
      onContrastChange={setVideoContrast}
      saturation={videoSaturation}
      onSaturationChange={setVideoSaturation}
      hue={videoHue}
      onHueChange={setVideoHue}
      micGain={micGain}
      onMicGainChange={setMicGain}
      noiseReduction={noiseReduction}
      onNoiseReductionChange={setNoiseReduction}
      liriAudioMode={liriAudioMode}
      onLiriAudioModeChange={setLiriAudioMode}
      liriClarity={liriClarity}
      onLiriClarityChange={setLiriClarity}
      liriReverb={liriReverb}
      onLiriReverbChange={setLiriReverb}
      liriCompression={liriCompression}
      onLiriCompressionChange={setLiriCompression}
      liriGate={liriGate}
      onLiriGateChange={setLiriGate}
      liriLimiter={liriLimiter}
      onLiriLimiterChange={setLiriLimiter}
      liriAudioLevels={liriAudioLevels}
      videoDevices={videoDevices}
      audioDevices={audioDevices}
      activeVideoId={activeVideoId}
      activeAudioId={activeAudioId}
      onSwitchVideo={switchVideoDevice}
      onSwitchAudio={switchAudioDevice}
      arenaHostAlertSoundsEnabled={arenaHostAlertSoundOn}
      onArenaHostAlertSoundsChange={setArenaHostAlertSoundOn}
      hostMediaRoutingSlot={hostMediaRoutingSlot}
      ambientTracks={ambientTracks}
      ambientMasterVolume={ambientMasterVolume}
      onAmbientMasterVolumeChange={setAmbientMasterVolume}
      sessionQuickSettings={sessionQuickSettings}
    />
  );
};
