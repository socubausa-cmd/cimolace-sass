import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { PHASE } from '@/features/live/host/liveHostConstants';
import { assertGuestLiveAction } from '@/lib/liriLive/assertGuestPermissionServer';
import { describeLiveKitMediaError } from '@/lib/liveKitParticipantVideo';

/**
 * Contrôles média LiveKit : micro, caméra, partage d'écran, main levée.
 * Gère les restrictions de communication côté invité (sessionCommFlags + guestCapabilities).
 */
export function useLiveHostMediaControls({
  sessionId,
  userId,
  userFullName,
  isGuestUi,
  phase,
  roomRef,
  sharingScreenRef,
  guestHostCameraUnlockRef,
  myHandRaised,
  /** Faux tant que la room LiveKit n’est pas connectée (évite le toast trompeur « token / réseau » si la room n’existe tout simplement pas). */
  liveKitMediaAvailable = true,
  /** Message serveur ou phase (ex. erreur livekit-get-token). */
  liveKitConnectHint = '',
  setMyHandRaised,
  broadcastHandRaise,
  sendSmartboardHostPayload,
  debateArenaMyRole,
  guestJoyKitDrive,
  sessionCommFlags,
  guestCapabilityCaps,
  permCtxOptional,
  toast,
}) {
  const [micOn, setMicOn] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [sharingScreen, setSharingScreen] = useState(false);
  const [pipStreamFromCanvas, setPipStreamFromCanvas] = useState(null);

  useEffect(() => { sharingScreenRef.current = sharingScreen; }, [sharingScreenRef, sharingScreen]);

  const guestCommAllowed = useMemo(() => {
    const base = {
      chat: sessionCommFlags.chat_enabled !== false,
      handRaise: sessionCommFlags.hand_raise_enabled !== false,
      screenShare: sessionCommFlags.screen_share_enabled !== false,
      mic: sessionCommFlags.student_audio_enabled !== false,
      cam: sessionCommFlags.student_video_enabled !== false,
    };
    if (!isGuestUi) return base;
    return {
      ...base,
      handRaise: base.handRaise && guestCapabilityCaps.canRaiseHand,
      screenShare: base.screenShare && guestCapabilityCaps.canRequestScreenshare,
    };
  }, [sessionCommFlags, isGuestUi, guestCapabilityCaps]);

  const raiseHand = useCallback(async () => {
    if (!userId || !sessionId || !isGuestUi) return;
    if (!guestCommAllowed.handRaise) {
      toast({ title: 'Mains levées désactivées', description: 'Le formateur a désactivé le signal main levée pour cette session.', variant: 'destructive' });
      return;
    }
    if (myHandRaised) return;
    setMyHandRaised(true);
    await supabase.from('live_session_signals').insert({
      live_session_id: sessionId,
      user_id: userId,
      type: 'hand_raise',
    });
    broadcastHandRaise(true, { userId, userName: userFullName || 'Participant' });
  }, [userId, userFullName, sessionId, isGuestUi, guestCommAllowed.handRaise, myHandRaised, setMyHandRaised, broadcastHandRaise, toast]);

  const lowerHand = useCallback(async () => {
    if (!userId || !sessionId) return;
    setMyHandRaised(false);
    const userName = userFullName || 'Participant';
    await supabase
      .from('live_session_signals')
      .update({ resolved: true })
      .eq('live_session_id', sessionId)
      .eq('user_id', userId)
      .eq('type', 'hand_raise')
      .eq('resolved', false);
    broadcastHandRaise(false, { userId, userName });
  }, [userId, userFullName, sessionId, setMyHandRaised, broadcastHandRaise]);

  useEffect(() => {
    if (!isGuestUi || guestCommAllowed.handRaise || !myHandRaised) return;
    void lowerHand();
  }, [isGuestUi, guestCommAllowed.handRaise, myHandRaised, lowerHand]);

  const tryStartLiveKitPlayback = useCallback(() => {
    try { roomRef.current?.startAudio?.().catch(() => {}); } catch { /* ignore */ }
  }, [roomRef]);

  const liveKitUnavailableDescription = useCallback(() => {
    const hint = String(liveKitConnectHint || '').trim();
    if (hint) return hint;
    return "La salle LiveKit n'est pas connectée. Vérifiez les variables LIVEKIT_URL, LIVEKIT_API_KEY et LIVEKIT_API_SECRET (netlify dev), l’appel réseau « livekit-get-token », puis rechargez la page.";
  }, [liveKitConnectHint]);

  const toggleMic = useCallback(() => {
    const next = !micOn;
    if (isGuestUi && !guestCommAllowed.mic && next) {
      toast({ title: 'Micro indisponible', description: 'Le formateur a désactivé le micro des participants pour cette session.', variant: 'destructive' });
      return;
    }
    if (!liveKitMediaAvailable) {
      toast({
        title: 'Micro indisponible',
        description: liveKitUnavailableDescription(),
        variant: 'destructive',
      });
      return;
    }
    if (!roomRef.current?.localParticipant) {
      toast({
        title: 'Micro indisponible',
        description: liveKitUnavailableDescription(),
        variant: 'destructive',
      });
      return;
    }
    setMicOn(next);
    roomRef.current?.localParticipant?.setMicrophoneEnabled(next)
      .then(() => { tryStartLiveKitPlayback(); })
      .catch((err) => {
        setMicOn(!next);
        toast({ title: 'Micro', description: describeLiveKitMediaError(err), variant: 'destructive' });
      });
  }, [micOn, isGuestUi, guestCommAllowed.mic, liveKitMediaAvailable, liveKitUnavailableDescription, roomRef, toast, tryStartLiveKitPlayback]);

  const toggleCamera = useCallback(() => {
    const next = !cameraOn;
    if (isGuestUi && !guestCommAllowed.cam && next) {
      toast({ title: 'Caméra indisponible', description: 'Le formateur a désactivé la caméra des participants pour cette session.', variant: 'destructive' });
      return;
    }
    if (isGuestUi && !next) {
      guestHostCameraUnlockRef.current = false;
    }
    if (!liveKitMediaAvailable) {
      toast({
        title: 'Caméra indisponible',
        description: liveKitUnavailableDescription(),
        variant: 'destructive',
      });
      return;
    }
    if (!roomRef.current?.localParticipant) {
      toast({
        title: 'Caméra indisponible',
        description: liveKitUnavailableDescription(),
        variant: 'destructive',
      });
      return;
    }
    setCameraOn(next);
    roomRef.current?.localParticipant?.setCameraEnabled(next)
      .then(() => { tryStartLiveKitPlayback(); })
      .catch((err) => {
        setCameraOn(!next);
        toast({ title: 'Caméra', description: describeLiveKitMediaError(err), variant: 'destructive' });
      });
  }, [cameraOn, isGuestUi, guestCommAllowed.cam, guestHostCameraUnlockRef, liveKitMediaAvailable, liveKitUnavailableDescription, roomRef, toast, tryStartLiveKitPlayback]);

  const toggleScreenShare = useCallback(async () => {
    const next = !sharingScreen;
    if (isGuestUi && debateArenaMyRole === 'viewer' && next) {
      toast({
        title: "Partage d'écran indisponible",
        description: "En mode spectateur du débat, le partage d'écran est désactivé.",
        variant: 'destructive',
      });
      return;
    }
    if (isGuestUi && !guestCommAllowed.screenShare && next) {
      toast({
        title: "Partage d'écran désactivé",
        description: "Le formateur a restreint le partage d'écran pour les participants.",
        variant: 'destructive',
      });
      return;
    }
    if (isGuestUi && next && guestJoyKitDrive && sessionId && userId && permCtxOptional) {
      const ok = await assertGuestLiveAction(supabase, permCtxOptional, {
        liveSessionId: sessionId,
        userId,
        action: 'canDrawSmartboard',
      });
      if (!ok) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.warn('[LiriLive Phase6] Partage écran invité : refusé (RPC / permissions)', { sessionId });
        }
        return;
      }
    }
    if (!liveKitMediaAvailable) {
      toast({
        title: "Partage d'écran indisponible",
        description: liveKitUnavailableDescription(),
        variant: 'destructive',
      });
      return;
    }
    sharingScreenRef.current = next;
    setSharingScreen(next);
    roomRef.current?.localParticipant?.setScreenShareEnabled(next)
      .then(() => {
        tryStartLiveKitPlayback();
        queueMicrotask(() => sendSmartboardHostPayload());
      })
      .catch((err) => {
        sharingScreenRef.current = !next;
        setSharingScreen(!next);
        toast({ title: "Partage d'écran", description: describeLiveKitMediaError(err), variant: 'destructive' });
        queueMicrotask(() => sendSmartboardHostPayload());
      });
  }, [sharingScreen, sendSmartboardHostPayload, isGuestUi, guestCommAllowed.screenShare, debateArenaMyRole, toast, tryStartLiveKitPlayback, guestJoyKitDrive, sessionId, userId, permCtxOptional, sharingScreenRef, roomRef, liveKitMediaAvailable, liveKitUnavailableDescription]);

  // Couper micro invité quand la salle désactive le micro
  useEffect(() => {
    if (!isGuestUi || phase !== PHASE.LIVE) return;
    if (sessionCommFlags.student_audio_enabled !== false || !micOn) return;
    setMicOn(false);
    roomRef.current?.localParticipant?.setMicrophoneEnabled(false).catch(() => {});
  }, [isGuestUi, phase, sessionCommFlags.student_audio_enabled, micOn, roomRef]);

  // Couper caméra invité quand la salle désactive la caméra
  useEffect(() => {
    if (!isGuestUi || phase !== PHASE.LIVE) return;
    if (sessionCommFlags.host_remote_camera_enabled && guestHostCameraUnlockRef.current) return;
    if (sessionCommFlags.student_video_enabled !== false || !cameraOn) return;
    setCameraOn(false);
    roomRef.current?.localParticipant?.setCameraEnabled(false).catch(() => {});
  }, [isGuestUi, phase, sessionCommFlags.student_video_enabled, sessionCommFlags.host_remote_camera_enabled, cameraOn, guestHostCameraUnlockRef, roomRef]);

  useEffect(() => {
    if (!isGuestUi) return;
    if (!sessionCommFlags.host_remote_camera_enabled) {
      guestHostCameraUnlockRef.current = false;
    }
  }, [isGuestUi, sessionCommFlags.host_remote_camera_enabled, guestHostCameraUnlockRef]);

  // Couper partage d'écran invité quand la salle le désactive
  useEffect(() => {
    if (!isGuestUi || phase !== PHASE.LIVE) return;
    if (sessionCommFlags.screen_share_enabled !== false || !sharingScreen) return;
    sharingScreenRef.current = false;
    setSharingScreen(false);
    roomRef.current?.localParticipant?.setScreenShareEnabled(false).catch(() => {});
    queueMicrotask(() => sendSmartboardHostPayload());
  }, [isGuestUi, phase, sessionCommFlags.screen_share_enabled, sharingScreen, sendSmartboardHostPayload, sharingScreenRef, roomRef]);

  return {
    micOn,
    setMicOn,
    cameraOn,
    setCameraOn,
    sharingScreen,
    setSharingScreen,
    pipStreamFromCanvas,
    setPipStreamFromCanvas,
    guestCommAllowed,
    toggleMic,
    toggleCamera,
    toggleScreenShare,
    raiseHand,
    lowerHand,
    tryStartLiveKitPlayback,
  };
}
