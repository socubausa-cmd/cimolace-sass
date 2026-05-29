import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { broadcastRealtime } from '@/lib/realtimeBroadcast';

const SIG_EVENT = 'aside_sig';

function iceServersFromEnv() {
  const raw = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_WEBRTC_ICE_SERVERS : '';
  if (raw && typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch {
      /* ignore */
    }
  }
  return [{ urls: 'stun:stun.l.google.com:19302' }];
}

/**
 * Aparté audio / vidéo hôte ↔ membre (WebRTC + signalisation Realtime).
 * Le flux public LiveKit est coupé pendant l'aparté (micro/cam salle), médias privés passent uniquement par la PeerConnection.
 *
 * @param {{ onToast?: (o: { title: string; description?: string }) => void }} p
 */
export function useLiveAsideChannel({
  sessionId,
  userId,
  teacherId,
  isHost,
  roomRef,
  enabled,
  onToast,
}) {
  const [asideState, setAsideState] = useState('idle');
  const [asideMode, setAsideMode] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const chRef = useRef(null);
  const pendingIceRef = useRef([]);
  const liveKitBackupRef = useRef({ mic: true, cam: true });
  const targetIdRef = useRef(null);
  const busyRef = useRef(false);
  const handlerRef = useRef(async () => {});

  const cleanupMedia = useCallback(() => {
    try {
      localStreamRef.current?.getTracks?.().forEach((t) => {
        try {
          t.stop();
        } catch {
          /* ignore */
        }
      });
    } catch {
      /* ignore */
    }
    localStreamRef.current = null;
    try {
      pcRef.current?.close();
    } catch {
      /* ignore */
    }
    pcRef.current = null;
    pendingIceRef.current = [];
    setRemoteStream(null);
  }, []);

  const restoreLiveKit = useCallback(async () => {
    const room = roomRef?.current;
    const lp = room?.localParticipant;
    if (!lp) return;
    const b = liveKitBackupRef.current;
    try {
      await lp.setMicrophoneEnabled(!!b.mic);
    } catch {
      /* ignore */
    }
    try {
      await lp.setCameraEnabled(!!b.cam);
    } catch {
      /* ignore */
    }
  }, [roomRef]);

  const endAside = useCallback(
    async (notifyPeer = true) => {
      const peer = targetIdRef.current;
      targetIdRef.current = null;
      if (notifyPeer && sessionId && userId && peer && chRef.current) {
        void broadcastRealtime(chRef.current, SIG_EVENT, {
          type: 'aside_hangup',
          sessionId,
          fromUserId: userId,
          toUserId: peer,
        });
      }
      cleanupMedia();
      await restoreLiveKit();
      setAsideState('idle');
      setAsideMode(null);
      setErrorMsg('');
      busyRef.current = false;
    },
    [sessionId, userId, cleanupMedia, restoreLiveKit],
  );

  const flushIce = useCallback(async (pc) => {
    const q = pendingIceRef.current.splice(0);
    for (const c of q) {
      try {
        await pc.addIceCandidate(c);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const handleRemoteSignal = useCallback(
    async (payload) => {
      if (!payload || !userId || !sessionId) return;
      const { type, fromUserId, toUserId, sdp, candidate, mode } = payload;
      if (String(payload.sessionId || '') !== String(sessionId)) return;
      if (String(fromUserId) === String(userId)) return;

      if (type === 'aside_hangup') {
        if (String(toUserId) === String(userId)) {
          onToast?.({
            title: 'Aparté terminé',
            description: 'Le canal privé a été fermé.',
          });
          await endAside(false);
        }
        return;
      }

      if (isHost) {
        if (type === 'aside_answer' && sdp && String(toUserId) === String(userId)) {
          if (String(fromUserId) !== String(targetIdRef.current)) return;
          const pc = pcRef.current;
          if (!pc) return;
          try {
            await pc.setRemoteDescription({ type: 'answer', sdp: sdp.sdp });
            await flushIce(pc);
            setAsideState('connected');
          } catch (e) {
            setErrorMsg(e?.message || String(e));
            await endAside(false);
          }
          return;
        }
        if (type === 'aside_ice' && candidate && String(toUserId) === String(userId)) {
          if (String(fromUserId) !== String(targetIdRef.current)) return;
          const pc = pcRef.current;
          if (!pc?.remoteDescription) {
            pendingIceRef.current.push(candidate);
            return;
          }
          try {
            await pc.addIceCandidate(candidate);
          } catch {
            /* ignore */
          }
        }
        return;
      }

      if (!isHost && teacherId && String(fromUserId) !== String(teacherId)) return;

      if (!isHost && type === 'aside_offer' && sdp && String(toUserId) === String(userId)) {
        if (busyRef.current) return;
        busyRef.current = true;
        setAsideState('connecting');
        setAsideMode(mode === 'av' ? 'av' : 'audio');
        targetIdRef.current = String(fromUserId);
        try {
          const room = roomRef?.current;
          const lp = room?.localParticipant;
          if (lp) {
            liveKitBackupRef.current = {
              mic: lp.isMicrophoneEnabled,
              cam: lp.isCameraEnabled,
            };
            await lp.setMicrophoneEnabled(false);
            await lp.setCameraEnabled(false);
          }
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: mode === 'av',
          });
          localStreamRef.current = stream;
          const pc = new RTCPeerConnection({ iceServers: iceServersFromEnv() });
          pcRef.current = pc;
          stream.getTracks().forEach((t) => pc.addTrack(t, stream));
          pc.ontrack = (ev) => {
            if (ev.streams?.[0]) setRemoteStream(ev.streams[0]);
          };
          pc.onicecandidate = (ev) => {
            if (!ev.candidate || !sessionId || !chRef.current) return;
            void broadcastRealtime(chRef.current, SIG_EVENT, {
              type: 'aside_ice',
              sessionId,
              fromUserId: userId,
              toUserId: fromUserId,
              candidate: ev.candidate,
            });
          };
          await pc.setRemoteDescription({ type: 'offer', sdp: sdp.sdp });
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await flushIce(pc);
          void broadcastRealtime(chRef.current, SIG_EVENT, {
            type: 'aside_answer',
            sessionId,
            fromUserId: userId,
            toUserId: fromUserId,
            sdp: { type: answer.type, sdp: answer.sdp },
          });
          setAsideState('connected');
          onToast?.({ title: 'Aparté', description: 'Canal privé avec le formateur.' });
        } catch (e) {
          setErrorMsg(e?.message || String(e));
          setAsideState('error');
          await endAside(false);
        } finally {
          busyRef.current = false;
        }
        return;
      }

      if (!isHost && type === 'aside_ice' && candidate && String(toUserId) === String(userId)) {
        if (String(fromUserId) !== String(teacherId)) return;
        const pc = pcRef.current;
        if (!pc?.remoteDescription) {
          pendingIceRef.current.push(candidate);
          return;
        }
        try {
          await pc.addIceCandidate(candidate);
        } catch {
          /* ignore */
        }
      }
    },
    [userId, sessionId, isHost, teacherId, roomRef, endAside, flushIce, onToast],
  );

  useEffect(() => {
    handlerRef.current = handleRemoteSignal;
  }, [handleRemoteSignal]);

  useEffect(() => {
    if (!enabled || !sessionId || !userId) {
      chRef.current = null;
      return undefined;
    }
    const ch = supabase.channel(`live-aside-${sessionId}`, {
      config: { broadcast: { self: true } },
    });
    ch.on('broadcast', { event: SIG_EVENT }, ({ payload }) => {
      void handlerRef.current(payload);
    });
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') chRef.current = ch;
    });
    return () => {
      supabase.removeChannel(ch);
      chRef.current = null;
    };
  }, [enabled, sessionId, userId]);

  const startAside = useCallback(
    async (targetUserId, mode) => {
      const tid = String(targetUserId || '').trim();
      if (!tid || !isHost || !sessionId || !userId || !chRef.current) return;
      if (!teacherId || String(userId) !== String(teacherId)) return;
      if (busyRef.current || asideState === 'connecting' || asideState === 'connected') return;
      busyRef.current = true;
      setErrorMsg('');
      setAsideState('connecting');
      setAsideMode(mode === 'av' ? 'av' : 'audio');
      targetIdRef.current = tid;
      try {
        const room = roomRef?.current;
        const lp = room?.localParticipant;
        if (lp) {
          liveKitBackupRef.current = {
            mic: lp.isMicrophoneEnabled,
            cam: lp.isCameraEnabled,
          };
          await lp.setMicrophoneEnabled(false);
          await lp.setCameraEnabled(false);
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: mode === 'av',
        });
        localStreamRef.current = stream;
        const pc = new RTCPeerConnection({ iceServers: iceServersFromEnv() });
        pcRef.current = pc;
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        pc.ontrack = (ev) => {
          if (ev.streams?.[0]) setRemoteStream(ev.streams[0]);
        };
        pc.onicecandidate = (ev) => {
          if (!ev.candidate || !chRef.current) return;
          void broadcastRealtime(chRef.current, SIG_EVENT, {
            type: 'aside_ice',
            sessionId,
            fromUserId: userId,
            toUserId: tid,
            candidate: ev.candidate,
          });
        };
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        void broadcastRealtime(chRef.current, SIG_EVENT, {
          type: 'aside_offer',
          sessionId,
          fromUserId: userId,
          toUserId: tid,
          mode: mode === 'av' ? 'av' : 'audio',
          sdp: { type: offer.type, sdp: offer.sdp },
        });
      } catch (e) {
        setErrorMsg(e?.message || String(e));
        setAsideState('error');
        await endAside(false);
      } finally {
        busyRef.current = false;
      }
    },
    [isHost, sessionId, userId, teacherId, roomRef, asideState, endAside],
  );

  return {
    asideState,
    asideMode,
    remoteStream,
    errorMsg,
    startAside,
    endAside,
  };
}
