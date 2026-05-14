import { useCallback, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

function buildRtcConfig() {
  const rawTurnUrls = String(
    import.meta.env.VITE_WEBRTC_TURN_URLS ||
    import.meta.env.VITE_WEBRTC_TURN_URL ||
    ''
  );
  const turnUrls = rawTurnUrls
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const username = String(import.meta.env.VITE_WEBRTC_TURN_USERNAME || '');
  const credential = String(import.meta.env.VITE_WEBRTC_TURN_CREDENTIAL || '');

  const iceServers = [...DEFAULT_ICE_SERVERS];
  if (turnUrls.length > 0) {
    iceServers.push({
      urls: turnUrls.length === 1 ? turnUrls[0] : turnUrls,
      username,
      credential,
    });
  }

  return { iceServers };
}

function makeStreamWithTrack(track) {
  const stream = new MediaStream();
  if (track) stream.addTrack(track);
  return stream;
}

function makeStreamWithTracks(tracks) {
  const stream = new MediaStream();
  tracks.filter(Boolean).forEach((track) => stream.addTrack(track));
  return stream;
}

export function useLiveWebRTC({
  enabled,
  liveSessionId,
  conversationKey,
  currentUserId,
  remoteUserId,
  localCameraStream,
  localScreenStream,
  onRemoteCameraStream,
  onRemoteScreenStream,
  onRemoteScreenStateChange,
  onRemoteHangup,
}) {
  const pcRef = useRef(null);
  const makingOfferRef = useRef(false);
  const ignoreOfferRef = useRef(false);
  const signalSeenRef = useRef(new Set());
  const pendingIceRef = useRef([]);
  const cameraSenderRef = useRef(null);
  const audioSenderRef = useRef(null);
  const screenSenderRef = useRef(null);
  const remoteCameraTrackRef = useRef(null);
  const remoteAudioTrackRef = useRef(null);
  const remoteScreenTrackRef = useRef(null);
  const remoteScreenAnnouncedRef = useRef(false);

  const polite = useMemo(() => {
    if (!currentUserId || !remoteUserId) return false;
    return String(currentUserId) > String(remoteUserId);
  }, [currentUserId, remoteUserId]);

  const emitSignal = useCallback(async (kind, payload = {}) => {
    if (!enabled || !liveSessionId || !currentUserId || !remoteUserId) return;
    await supabase.from('immersive_live_signals').insert({
      live_session_id: liveSessionId,
      conversation_key: conversationKey,
      sender_id: currentUserId,
      target_id: remoteUserId,
      kind,
      payload,
    });
  }, [conversationKey, currentUserId, enabled, liveSessionId, remoteUserId]);

  const deleteSignal = useCallback(async (signalId) => {
    if (!signalId) return;
    try {
      await supabase.from('immersive_live_signals').delete().eq('id', signalId);
    } catch {
      // ignore cleanup failures
    }
  }, []);

  const syncSenders = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;
    const camTrack = localCameraStream?.getVideoTracks?.()[0] || null;
    const micTrack = localCameraStream?.getAudioTracks?.()[0] || null;
    const screenTrack = localScreenStream?.getVideoTracks?.()[0] || null;

    try {
      await cameraSenderRef.current.replaceTrack(camTrack);
    } catch {}
    try {
      await audioSenderRef.current.replaceTrack(micTrack);
    } catch {}
    try {
      await screenSenderRef.current.replaceTrack(screenTrack);
    } catch {}
  }, [localCameraStream, localScreenStream]);

  const negotiatePeer = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || makingOfferRef.current || pc.signalingState !== 'stable') return;
    try {
      makingOfferRef.current = true;
      await syncSenders();
      const offer = await pc.createOffer();
      if (pc.signalingState !== 'stable') return;
      await pc.setLocalDescription(offer);
      await emitSignal('offer', pc.localDescription?.toJSON?.() || pc.localDescription);
    } catch {
      // ignore negotiation blips
    } finally {
      makingOfferRef.current = false;
    }
  }, [emitSignal, syncSenders]);

  const applyQueuedIce = useCallback(async (pc) => {
    while (pendingIceRef.current.length) {
      const candidate = pendingIceRef.current.shift();
      if (candidate) {
        try {
          await pc.addIceCandidate(candidate);
        } catch {
          // ignore invalid/late candidates
        }
      }
    }
  }, []);

  const processSignal = useCallback(async (pc, row) => {
    if (!row || row.sender_id === currentUserId) return;
    if (row.target_id && row.target_id !== currentUserId) return;
    if (signalSeenRef.current.has(row.id)) return;
    signalSeenRef.current.add(row.id);

    try {
      if (row.kind === 'hangup') {
        onRemoteHangup?.();
        return;
      }
      if (row.kind === 'screen-start') {
        remoteScreenAnnouncedRef.current = true;
        onRemoteScreenStateChange?.(true);
        return;
      }
      if (row.kind === 'screen-stop') {
        remoteScreenAnnouncedRef.current = false;
        remoteScreenTrackRef.current = null;
        onRemoteScreenStateChange?.(false);
        onRemoteScreenStream?.(null);
        return;
      }
      if (row.kind === 'ice') {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(row.payload);
        } else {
          pendingIceRef.current.push(row.payload);
        }
        return;
      }

      const offerCollision =
        row.kind === 'offer' &&
        (makingOfferRef.current || pc.signalingState !== 'stable');

      ignoreOfferRef.current = !polite && offerCollision;
      if (ignoreOfferRef.current) return;

      if (row.kind === 'offer') {
        if (offerCollision) {
          await Promise.all([
            pc.setLocalDescription({ type: 'rollback' }),
            pc.setRemoteDescription(row.payload),
          ]);
        } else {
          await pc.setRemoteDescription(row.payload);
        }
        await applyQueuedIce(pc);
        await syncSenders();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await emitSignal('answer', pc.localDescription?.toJSON?.() || pc.localDescription);
        return;
      }

      if (row.kind === 'answer') {
        await pc.setRemoteDescription(row.payload);
        await applyQueuedIce(pc);
      }
    } catch {
      // ignore signal handling errors for resilience
    } finally {
      await deleteSignal(row.id);
    }
  }, [
    currentUserId,
    deleteSignal,
    emitSignal,
    applyQueuedIce,
    onRemoteHangup,
    onRemoteScreenStateChange,
    onRemoteScreenStream,
    polite,
    syncSenders,
  ]);

  useEffect(() => {
    if (!enabled || !liveSessionId || !currentUserId || !remoteUserId) return undefined;

    const pc = new RTCPeerConnection(buildRtcConfig());
    pcRef.current = pc;

    cameraSenderRef.current = pc.addTransceiver('video', { direction: 'sendrecv' }).sender;
    audioSenderRef.current = pc.addTransceiver('audio', { direction: 'sendrecv' }).sender;
    screenSenderRef.current = pc.addTransceiver('video', { direction: 'sendrecv' }).sender;

    const emitRemoteCameraBundle = () => {
      const stream = makeStreamWithTracks([
        remoteCameraTrackRef.current,
        remoteAudioTrackRef.current,
      ]);
      onRemoteCameraStream?.(
        stream.getTracks().length ? stream : null
      );
    };

    const wireTrack = (event) => {
      const track = event.track;
      if (!track) return;
      if (track.kind === 'audio') {
        remoteAudioTrackRef.current = track;
        emitRemoteCameraBundle();
      } else if (track.kind === 'video') {
        const shouldUseAsScreen =
          (
            remoteScreenAnnouncedRef.current ||
            (
              remoteCameraTrackRef.current &&
              remoteCameraTrackRef.current.id !== track.id &&
              !remoteScreenTrackRef.current
            )
          ) &&
          (!remoteScreenTrackRef.current || remoteScreenTrackRef.current.id !== track.id) &&
          (!remoteCameraTrackRef.current || remoteCameraTrackRef.current.id !== track.id);

        if (shouldUseAsScreen) {
          remoteScreenTrackRef.current = track;
          onRemoteScreenStream?.(makeStreamWithTrack(track));
          onRemoteScreenStateChange?.(true);
        } else {
          remoteCameraTrackRef.current = track;
          emitRemoteCameraBundle();
        }
      }

      track.addEventListener?.('ended', () => {
        if (remoteScreenTrackRef.current?.id === track.id) {
          remoteScreenTrackRef.current = null;
          onRemoteScreenStream?.(null);
          onRemoteScreenStateChange?.(false);
        }
        if (remoteCameraTrackRef.current?.id === track.id) {
          remoteCameraTrackRef.current = null;
          emitRemoteCameraBundle();
        }
        if (remoteAudioTrackRef.current?.id === track.id) {
          remoteAudioTrackRef.current = null;
          emitRemoteCameraBundle();
        }
      });
    };

    pc.ontrack = wireTrack;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        void emitSignal('ice', event.candidate.toJSON());
      }
    };

    pc.onnegotiationneeded = async () => {
      await negotiatePeer();
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        try {
          pc.restartIce();
        } catch {
          // ignore ice restart failures
        }
        void negotiatePeer();
      }
    };

    void syncSenders();

    void (async () => {
      try {
        const { data } = await supabase
          .from('immersive_live_signals')
          .select('*')
          .eq('live_session_id', liveSessionId)
          .neq('sender_id', currentUserId)
          .or(`target_id.eq.${currentUserId},target_id.is.null`)
          .order('created_at', { ascending: true })
          .limit(100);
        for (const row of data || []) {
          // Process existing signals first so late subscribers still connect.
          await processSignal(pc, row);
        }
      } catch {
        // ignore bootstrap fetch failures
      }
    })();

    const channel = supabase
      .channel(`immersive-live-signals-${liveSessionId}-${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'immersive_live_signals',
          filter: `live_session_id=eq.${liveSessionId}`,
        },
        async (payload) => {
          await processSignal(pc, payload.new);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      try { pc.close(); } catch {}
      pcRef.current = null;
      cameraSenderRef.current = null;
      audioSenderRef.current = null;
      screenSenderRef.current = null;
      remoteCameraTrackRef.current = null;
      remoteAudioTrackRef.current = null;
      remoteScreenTrackRef.current = null;
      remoteScreenAnnouncedRef.current = false;
      pendingIceRef.current = [];
      onRemoteCameraStream?.(null);
      onRemoteScreenStream?.(null);
      onRemoteScreenStateChange?.(false);
    };
  }, [
    currentUserId,
    emitSignal,
    enabled,
    liveSessionId,
    onRemoteCameraStream,
    onRemoteHangup,
    onRemoteScreenStateChange,
    onRemoteScreenStream,
    polite,
    processSignal,
    negotiatePeer,
    remoteUserId,
    syncSenders,
  ]);

  useEffect(() => {
    if (!enabled || !pcRef.current) return;
    void syncSenders();
    void negotiatePeer();
  }, [enabled, localCameraStream, localScreenStream, negotiatePeer, syncSenders]);

  useEffect(() => {
    if (!enabled) return undefined;
    if (localScreenStream?.getVideoTracks?.()[0]) {
      void emitSignal('screen-start', {});
      return () => {
        void emitSignal('screen-stop', {});
      };
    }
    return undefined;
  }, [emitSignal, enabled, localScreenStream]);

  const sendHangup = useCallback(() => {
    void emitSignal('hangup', {});
  }, [emitSignal]);

  return {
    sendHangup,
  };
}

export default useLiveWebRTC;
