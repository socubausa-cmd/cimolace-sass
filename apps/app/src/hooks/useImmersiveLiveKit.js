import { useCallback, useEffect, useRef, useState } from 'react';
import { ConnectionQuality, ConnectionState, LocalAudioTrack, LocalVideoTrack, Room, RoomEvent, Track } from 'livekit-client';
import {
  createImmersiveLiveRoom,
  getImmersiveLiveKitToken,
  reportImmersiveParticipantLeave,
} from '@/services/livekitApi';
import { getStableLiveKitRoomOptions, stableLiveKitConnectOptions } from '@/lib/livekitStableClient';

// Map LiveKit ConnectionQuality enum → simple label
function mapQuality(q) {
  if (q === ConnectionQuality.Excellent) return 'excellent';
  if (q === ConnectionQuality.Good)      return 'good';
  if (q === ConnectionQuality.Poor)      return 'poor';
  if (q === ConnectionQuality.Lost)      return 'lost';
  return null;
}

function makeStream(tracks) {
  const stream = new MediaStream();
  tracks.filter(Boolean).forEach((track) => stream.addTrack(track));
  return stream;
}

export function useImmersiveLiveKit({
  enabled,
  liveSessionId,
  currentUserId,
  /** Interlocuteur 1:1 — ignore les pistes des appareils companion_* pour la vue principale. */
  primaryRemoteIdentity = null,
  localCameraStream,
  localScreenStream,
  onRemoteCameraStream,
  onRemoteScreenStream,
  onRemoteScreenStateChange,
  onParticipantDisconnected,
  onReconnecting,      // () => void — connexion perdue, tentative en cours
  onReconnected,       // () => void — reconnexion réussie
  onConnectionQuality, // (quality: 'excellent'|'good'|'poor'|'lost'|null) => void
  onError,
}) {
  const [auxiliaryParticipants, setAuxiliaryParticipants] = useState([]);
  const primaryRemoteIdentityRef = useRef(primaryRemoteIdentity);
  useEffect(() => { primaryRemoteIdentityRef.current = primaryRemoteIdentity; }, [primaryRemoteIdentity]);

  const roomRef = useRef(null);
  const localCameraStreamRef = useRef(localCameraStream);
  const localScreenStreamRef = useRef(localScreenStream);
  const onErrorRef = useRef(onError);
  const onParticipantDisconnectedRef = useRef(onParticipantDisconnected);
  const onReconnectingRef = useRef(onReconnecting);
  const onReconnectedRef = useRef(onReconnected);
  const onConnectionQualityRef = useRef(onConnectionQuality);
  const cameraTrackRef = useRef(null);
  const micTrackRef = useRef(null);
  const screenVideoTrackRef = useRef(null);
  const screenAudioTrackRef = useRef(null);
  const remoteCameraTrackRef = useRef(null);
  const remoteMicTrackRef = useRef(null);
  const remoteScreenTrackRef = useRef(null);
  const connectNonceRef = useRef(0);
  const intentionalDisconnectRef = useRef(false);
  const isReconnectingRef = useRef(false);

  useEffect(() => { localCameraStreamRef.current = localCameraStream; }, [localCameraStream]);
  useEffect(() => { localScreenStreamRef.current = localScreenStream; }, [localScreenStream]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  useEffect(() => { onParticipantDisconnectedRef.current = onParticipantDisconnected; }, [onParticipantDisconnected]);
  useEffect(() => { onReconnectingRef.current = onReconnecting; }, [onReconnecting]);
  useEffect(() => { onReconnectedRef.current = onReconnected; }, [onReconnected]);
  useEffect(() => { onConnectionQualityRef.current = onConnectionQuality; }, [onConnectionQuality]);

  const emitRemoteCameraBundle = useCallback(() => {
    const stream = makeStream([
      remoteCameraTrackRef.current?.mediaStreamTrack || null,
      remoteMicTrackRef.current?.mediaStreamTrack || null,
    ]);
    onRemoteCameraStream?.(stream.getTracks().length ? stream : null);
  }, [onRemoteCameraStream]);

  const emitRemoteScreen = useCallback(() => {
    const stream = makeStream([remoteScreenTrackRef.current?.mediaStreamTrack || null]);
    const active = stream.getTracks().length > 0;
    onRemoteScreenStream?.(active ? stream : null);
    onRemoteScreenStateChange?.(active);
  }, [onRemoteScreenStateChange, onRemoteScreenStream]);

  const clearRemoteState = useCallback(() => {
    remoteCameraTrackRef.current = null;
    remoteMicTrackRef.current = null;
    remoteScreenTrackRef.current = null;
    onRemoteCameraStream?.(null);
    onRemoteScreenStream?.(null);
    onRemoteScreenStateChange?.(false);
  }, [onRemoteCameraStream, onRemoteScreenStateChange, onRemoteScreenStream]);

  const syncAuxParticipants = useCallback((room) => {
    if (!room) {
      setAuxiliaryParticipants([]);
      return;
    }
    const list = [];
    room.remoteParticipants.forEach((p) => {
      if (String(p.identity).startsWith('companion_')) {
        list.push({
          id: String(p.identity),
          name: p.name || 'Téléphone (QR)',
          isLocal: false,
          isHost: false,
        });
      }
    });
    setAuxiliaryParticipants(list);
  }, []);

  const unpublishRefTrack = useCallback(async (room, trackRef) => {
    if (!room || !trackRef.current) return;
    try { await room.localParticipant.unpublishTrack(trackRef.current, false); } catch { /* ignore */ }
    trackRef.current = null;
  }, []);

  const syncCameraTracks = useCallback(async () => {
    const room = roomRef.current;
    if (!enabled || !room || room.state !== ConnectionState.Connected) return;
    const videoTrack = localCameraStreamRef.current?.getVideoTracks?.()[0] || null;
    const audioTrack = localCameraStreamRef.current?.getAudioTracks?.()[0] || null;

    if (!videoTrack) {
      await unpublishRefTrack(room, cameraTrackRef);
    } else if (cameraTrackRef.current?.mediaStreamTrack?.id !== videoTrack.id) {
      await unpublishRefTrack(room, cameraTrackRef);
      try {
        const lv = new LocalVideoTrack(videoTrack, undefined, true);
        await room.localParticipant.publishTrack(lv, {
          source: Track.Source.Camera,
          name: 'immersive-camera',
        });
        cameraTrackRef.current = lv;
      } catch (err) {
        console.warn('[immersive-livekit] camera publish failed:', err?.message);
        cameraTrackRef.current = null;
      }
    }

    if (!audioTrack) {
      await unpublishRefTrack(room, micTrackRef);
    } else if (micTrackRef.current?.mediaStreamTrack?.id !== audioTrack.id) {
      await unpublishRefTrack(room, micTrackRef);
      try {
        const la = new LocalAudioTrack(audioTrack, undefined, true);
        await room.localParticipant.publishTrack(la, {
          source: Track.Source.Microphone,
          name: 'immersive-microphone',
        });
        micTrackRef.current = la;
      } catch (err) {
        console.warn('[immersive-livekit] mic publish failed:', err?.message);
        micTrackRef.current = null;
      }
    }
  }, [enabled, unpublishRefTrack]);

  const syncScreenTracks = useCallback(async () => {
    const room = roomRef.current;
    if (!enabled || !room || room.state !== ConnectionState.Connected) return;
    const screenVideo = localScreenStreamRef.current?.getVideoTracks?.()[0] || null;
    const screenAudio = localScreenStreamRef.current?.getAudioTracks?.()[0] || null;

    if (!screenVideo) {
      await unpublishRefTrack(room, screenVideoTrackRef);
    } else if (screenVideoTrackRef.current?.mediaStreamTrack?.id !== screenVideo.id) {
      await unpublishRefTrack(room, screenVideoTrackRef);
      try {
        const lv = new LocalVideoTrack(screenVideo, undefined, true);
        await room.localParticipant.publishTrack(lv, {
          source: Track.Source.ScreenShare,
          name: 'immersive-screen',
        });
        screenVideoTrackRef.current = lv;
      } catch (err) {
        console.warn('[immersive-livekit] screen video publish failed:', err?.message);
        screenVideoTrackRef.current = null;
      }
    }

    if (!screenAudio) {
      await unpublishRefTrack(room, screenAudioTrackRef);
    } else if (screenAudioTrackRef.current?.mediaStreamTrack?.id !== screenAudio.id) {
      await unpublishRefTrack(room, screenAudioTrackRef);
      try {
        const la = new LocalAudioTrack(screenAudio, undefined, true);
        await room.localParticipant.publishTrack(la, {
          source: Track.Source.ScreenShareAudio,
          name: 'immersive-screen-audio',
        });
        screenAudioTrackRef.current = la;
      } catch (err) {
        console.warn('[immersive-livekit] screen audio publish failed:', err?.message);
        screenAudioTrackRef.current = null;
      }
    }
  }, [enabled, unpublishRefTrack]);

  // ── Subscribe to tracks already published by existing remote participants ──
  // Needed when we join a room where the other participant is already present.
  // Handles both already-subscribed and pending-subscription publications.
  const subscribeExistingTracks = useCallback((room) => {
    for (const participant of room.remoteParticipants.values()) {
      if (participant.identity === String(currentUserId)) continue;
      const primary = primaryRemoteIdentityRef.current;
      if (primary && String(participant.identity) !== String(primary)) continue;
      for (const publication of participant.trackPublications.values()) {
        if (publication.isSubscribed && publication.track) {
          const track = publication.track;
          if (publication.source === Track.Source.Camera && track.kind === Track.Kind.Video) {
            remoteCameraTrackRef.current = track;
          } else if (publication.source === Track.Source.Microphone && track.kind === Track.Kind.Audio) {
            remoteMicTrackRef.current = track;
          } else if (publication.source === Track.Source.ScreenShare && track.kind === Track.Kind.Video) {
            remoteScreenTrackRef.current = track;
          }
        } else if (!publication.isSubscribed) {
          publication.setSubscribed(true);
        }
      }
    }
    emitRemoteCameraBundle();
    emitRemoteScreen();
  }, [currentUserId, emitRemoteCameraBundle, emitRemoteScreen]);

  useEffect(() => {
    if (!enabled || !liveSessionId || !currentUserId) return undefined;
    let cancelled = false;
    const nonce = connectNonceRef.current + 1;
    connectNonceRef.current = nonce;
    intentionalDisconnectRef.current = false;

    const room = new Room(
      getStableLiveKitRoomOptions({
        adaptiveStream: true,
        dynacast: true,
        stopLocalTrackOnUnpublish: false,
      })
    );
    roomRef.current = room;

    const handleTrackSubscribed = (track, publication, participant) => {
      if (!track || participant?.identity === String(currentUserId)) return;
      const primary = primaryRemoteIdentityRef.current;
      if (primary && String(participant?.identity) !== String(primary)) return;
      if (publication?.source === Track.Source.Camera && track.kind === Track.Kind.Video) {
        remoteCameraTrackRef.current = track;
        emitRemoteCameraBundle();
      } else if (publication?.source === Track.Source.Microphone && track.kind === Track.Kind.Audio) {
        remoteMicTrackRef.current = track;
        emitRemoteCameraBundle();
      } else if (publication?.source === Track.Source.ScreenShare && track.kind === Track.Kind.Video) {
        remoteScreenTrackRef.current = track;
        emitRemoteScreen();
      }
    };

    const handleTrackUnsubscribed = (track, publication) => {
      if (publication?.source === Track.Source.Camera && remoteCameraTrackRef.current?.sid === track?.sid) {
        remoteCameraTrackRef.current = null;
        emitRemoteCameraBundle();
      } else if (publication?.source === Track.Source.Microphone && remoteMicTrackRef.current?.sid === track?.sid) {
        remoteMicTrackRef.current = null;
        emitRemoteCameraBundle();
      } else if (publication?.source === Track.Source.ScreenShare && remoteScreenTrackRef.current?.sid === track?.sid) {
        remoteScreenTrackRef.current = null;
        emitRemoteScreen();
      }
    };

    const handleParticipantConnected = () => {
      syncAuxParticipants(roomRef.current);
    };

    // ── 1:1 : si l'interlocuteur principal quitte → fin d'appel. Companion_* → seulement refresh liste. ──
    const handleParticipantDisconnected = (participant) => {
      const leftId = participant?.identity;
      const primary = primaryRemoteIdentityRef.current;
      const hasPrimary = primary != null && primary !== '';
      if (!hasPrimary || String(leftId) === String(primary)) {
        clearRemoteState();
        onParticipantDisconnectedRef.current?.(leftId);
      }
      syncAuxParticipants(roomRef.current);
    };

    // ── Reconnexion automatique ──────────────────────────────────────────────
    const handleReconnecting = () => {
      isReconnectingRef.current = true;
      onReconnectingRef.current?.();
    };

    const handleReconnected = () => {
      isReconnectingRef.current = false;
      onReconnectedRef.current?.();
      // Re-sync local tracks après reconnexion
      void syncCameraTracks();
      void syncScreenTracks();
    };

    // ── Qualité de connexion ─────────────────────────────────────────────────
    const handleConnectionQuality = (quality, participant) => {
      // On ne remonte que la qualité du participant local
      if (participant?.identity !== String(currentUserId)) return;
      onConnectionQualityRef.current?.(mapQuality(quality));
    };

    room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    room.on(RoomEvent.Reconnecting, handleReconnecting);
    room.on(RoomEvent.Reconnected, handleReconnected);
    room.on(RoomEvent.ConnectionQualityChanged, handleConnectionQuality);
    room.on(RoomEvent.Disconnected, () => {
      clearRemoteState();
      isReconnectingRef.current = false;
      if (!intentionalDisconnectRef.current) {
        onErrorRef.current?.(new Error('Connexion interrompue. Vérifiez votre réseau.'));
      }
    });

    const liveKitAudioGesture = { detach: null };

    void (async () => {
      try {
        await createImmersiveLiveRoom(liveSessionId);
        const tokenData = await getImmersiveLiveKitToken(liveSessionId);
        if (cancelled || connectNonceRef.current !== nonce) return;
        console.debug('[immersive-livekit] connecting to', tokenData.livekitUrl, 'room', tokenData.roomName);
        await room.connect(tokenData.livekitUrl, tokenData.token, stableLiveKitConnectOptions);
        console.debug('[immersive-livekit] connected, state:', room.state, 'remoteParticipants:', room.remoteParticipants.size);

        if (cancelled || connectNonceRef.current !== nonce) return;
        const onGestureForAudio = () => {
          liveKitAudioGesture.detach?.();
          liveKitAudioGesture.detach = null;
          room.startAudio?.().catch(() => {});
        };
        liveKitAudioGesture.detach = () => {
          window.removeEventListener('pointerdown', onGestureForAudio);
          window.removeEventListener('keydown', onGestureForAudio);
        };
        window.addEventListener('pointerdown', onGestureForAudio, { passive: true });
        window.addEventListener('keydown', onGestureForAudio, { passive: true });

        subscribeExistingTracks(room);
        syncAuxParticipants(room);

        await syncCameraTracks();
        await syncScreenTracks();
        console.debug('[immersive-livekit] local tracks synced');
      } catch (error) {
        if (cancelled) return;
        console.error('[immersive-livekit] connection error:', error?.message);
        onErrorRef.current?.(error);
      }
    })();

    return () => {
      cancelled = true;
      liveKitAudioGesture.detach?.();
      liveKitAudioGesture.detach = null;
      intentionalDisconnectRef.current = true;
      void reportImmersiveParticipantLeave(liveSessionId);
      clearRemoteState();
      setAuxiliaryParticipants([]);
      try { room.disconnect(true); } catch { /* ignore */ }
      roomRef.current = null;
      cameraTrackRef.current = null;
      micTrackRef.current = null;
      screenVideoTrackRef.current = null;
      screenAudioTrackRef.current = null;
    };
  }, [
    clearRemoteState,
    currentUserId,
    emitRemoteCameraBundle,
    emitRemoteScreen,
    enabled,
    liveSessionId,
    subscribeExistingTracks,
    syncAuxParticipants,
    syncCameraTracks,
    syncScreenTracks,
  ]);

  useEffect(() => { void syncCameraTracks(); }, [localCameraStream, syncCameraTracks]);
  useEffect(() => { void syncScreenTracks(); }, [localScreenStream, syncScreenTracks]);

  return {
    /** Référence stable vers la Room LiveKit (null hors connexion). */
    roomRef,
    /** Participants distants identity companion_* (téléphone QR) pour le sélecteur Cam 2. */
    auxiliaryParticipants,
    disconnect: () => {
      intentionalDisconnectRef.current = true;
      void reportImmersiveParticipantLeave(liveSessionId);
      try { roomRef.current?.disconnect(true); } catch { /* ignore */ }
    },
  };
}

export default useImmersiveLiveKit;
