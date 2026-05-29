import { useCallback, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Track } from 'livekit-client';
import { normalizeLiriAudioScenes, demoLiriAudioScenes } from '@/lib/liriAudioScene';

/**
 * Paramètres Studio : VBG/chroma/FX vidéo, scènes LIRI Audio, sélecteur périphériques,
 * ouverture paramètres/messagerie, canvas VideoProcessor.
 */
export function useLiveHostStudioSettings({
  sessionId,
  roomRef,
  vbgBeforeChromaRef,
  liriPersistTimeoutRef,
  setVideoVbg,
  setVideoChromaKey,
  setLiriAudioScenes,
  setLiriAudioInitialSceneIndex,
  setVideoDevices,
  setAudioDevices,
  setActiveVideoId,
  setActiveAudioId,
  setShowMessagingPanel,
  setShowSettings,
  setForumTarget,
  setPipStreamFromCanvas,
}) {
  const handleArenaVbgChange = useCallback((v) => {
    setVideoVbg(v);
    if (v !== 'none') setVideoChromaKey(false);
  }, [setVideoVbg, setVideoChromaKey]);

  const handleArenaChromaKeyChange = useCallback((on) => {
    if (on) {
      setVideoVbg(prev => { vbgBeforeChromaRef.current = prev; return 'none'; });
      setVideoChromaKey(true);
    } else {
      setVideoChromaKey(false);
      setVideoVbg(vbgBeforeChromaRef.current ?? 'none');
    }
  }, [setVideoVbg, setVideoChromaKey, vbgBeforeChromaRef]);

  const applyLiriAudioFromConfig = useCallback((cfg, { devDemo = false } = {}) => {
    const normalizedLiri = normalizeLiriAudioScenes(cfg?.liri_audio_scenes);
    if (normalizedLiri.length > 0) {
      setLiriAudioScenes(normalizedLiri);
      const st = cfg?.liri_audio_state;
      let idx = 0;
      if (st && typeof st === 'object' && st !== null) {
        const n = Number(st.current_index);
        if (Number.isFinite(n)) idx = Math.max(0, Math.floor(n));
      }
      setLiriAudioInitialSceneIndex(Math.min(idx, normalizedLiri.length - 1));
    } else if (devDemo && import.meta.env.DEV) {
      setLiriAudioScenes(demoLiriAudioScenes);
      setLiriAudioInitialSceneIndex(0);
    } else {
      setLiriAudioScenes([]);
      setLiriAudioInitialSceneIndex(0);
    }
  }, [setLiriAudioScenes, setLiriAudioInitialSceneIndex]);

  const persistLiriSceneIndex = useCallback((index) => {
    if (!sessionId) return;
    if (liriPersistTimeoutRef.current) clearTimeout(liriPersistTimeoutRef.current);
    liriPersistTimeoutRef.current = setTimeout(async () => {
      liriPersistTimeoutRef.current = null;
      try {
        const { data: row, error: fetchErr } = await supabase
          .from('live_sessions')
          .select('config')
          .eq('id', sessionId)
          .maybeSingle();
        if (fetchErr) {
          console.warn('[LiveHost] liri_audio_state read', fetchErr.message);
          return;
        }
        let c = {};
        try {
          const raw = row?.config;
          c = typeof raw === 'string' ? JSON.parse(raw) : (raw && typeof raw === 'object' ? { ...raw } : {});
        } catch { c = {}; }
        const next = {
          ...c,
          liri_audio_state: {
            ...(typeof c.liri_audio_state === 'object' && c.liri_audio_state != null ? c.liri_audio_state : {}),
            current_index: index,
          },
        };
        const { error } = await supabase
          .from('live_sessions')
          .update({ config: next, updated_at: new Date().toISOString() })
          .eq('id', sessionId);
        if (error) {
          console.warn('[LiveHost] liri_audio_state write', error.message);
        }
      } catch (e) {
        console.warn('[LiveHost] liri persist', e);
      }
    }, 900);
  }, [sessionId, liriPersistTimeoutRef]);

  useEffect(() => () => {
    if (liriPersistTimeoutRef.current) clearTimeout(liriPersistTimeoutRef.current);
  }, [liriPersistTimeoutRef]);

  const openSettings = useCallback(async () => {
    try { await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); } catch { /* already granted */ }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setVideoDevices(devices.filter(d => d.kind === 'videoinput'));
      setAudioDevices(devices.filter(d => d.kind === 'audioinput'));
      const room = roomRef.current;
      if (room) {
        const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
        const micPub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
        setActiveVideoId(camPub?.track?.mediaStreamTrack?.getSettings()?.deviceId || '');
        setActiveAudioId(micPub?.track?.mediaStreamTrack?.getSettings()?.deviceId || '');
      }
    } catch (e) { console.warn('[LiveHost] enumerateDevices:', e?.message); }
    setShowMessagingPanel(false);
    setShowSettings(true);
  }, [roomRef, setVideoDevices, setAudioDevices, setActiveVideoId, setActiveAudioId, setShowMessagingPanel, setShowSettings]);

  const openMessagingPanel = useCallback(() => {
    setShowSettings(false);
    setForumTarget(null);
    setShowMessagingPanel(true);
  }, [setShowSettings, setForumTarget, setShowMessagingPanel]);

  const switchVideoDevice = useCallback(async (deviceId) => {
    const room = roomRef.current;
    if (!room) return;
    try { await room.switchActiveDevice('videoinput', deviceId); setActiveVideoId(deviceId); }
    catch (e) { console.warn('[LiveHost] switchVideoDevice:', e?.message); }
  }, [roomRef, setActiveVideoId]);

  const switchAudioDevice = useCallback(async (deviceId) => {
    const room = roomRef.current;
    if (!room) return;
    try { await room.switchActiveDevice('audioinput', deviceId); setActiveAudioId(deviceId); }
    catch (e) { console.warn('[LiveHost] switchAudioDevice:', e?.message); }
  }, [roomRef, setActiveAudioId]);

  const onVpCanvasReady = useCallback((canvas) => {
    if (!canvas) {
      setPipStreamFromCanvas((prev) => {
        prev?.getTracks?.().forEach((t) => t.stop());
        return null;
      });
      return;
    }
    try {
      const stream = canvas.captureStream(25);
      setPipStreamFromCanvas((prev) => {
        prev?.getTracks?.().forEach((t) => t.stop());
        return stream;
      });
    } catch {
      setPipStreamFromCanvas(null);
    }
  }, [setPipStreamFromCanvas]);

  return {
    handleArenaVbgChange,
    handleArenaChromaKeyChange,
    applyLiriAudioFromConfig,
    persistLiriSceneIndex,
    openSettings,
    openMessagingPanel,
    switchVideoDevice,
    switchAudioDevice,
    onVpCanvasReady,
  };
}
