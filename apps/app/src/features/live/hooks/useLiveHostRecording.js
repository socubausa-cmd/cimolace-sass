import { useCallback, useEffect, useRef, useState } from 'react';
import { Track } from 'livekit-client';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * Enregistrement live (MediaRecorder) : onglet + pistes LiveKit, upload Storage,
 * ligne `live_recordings`. Expose les refs pour STOP (attente `onstop`) et
 * `recordingRef` pour le payload SmartBoard.
 */
export function useLiveHostRecording({ sessionId, roomRef, toast }) {
  const [recording, setRecording] = useState(false);
  const [recStarting, setRecStarting] = useState(false);
  const [recError, setRecError] = useState(null);
  const mediaRecRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const recordingRef = useRef(false);
  const recFinalizeResolveRef = useRef(null);

  useEffect(() => {
    recordingRef.current = recording;
  }, [recording]);

  const startRecording = useCallback(async () => {
    if (recording || recStarting) return;
    setRecStarting(true);
    setRecError(null);
    try {
      const room = roomRef.current;
      const tracks = [];

      const tabStream = await navigator.mediaDevices
        .getDisplayMedia({
          video: { frameRate: 30 },
          audio: false,
          preferCurrentTab: true,
          selfBrowserSurface: 'include',
        })
        .catch((err) => {
          // Feedback explicite au lieu d'un échec silencieux.
          if (err?.name === 'NotAllowedError') setRecError('Partage annulé.');
          else if (err?.name === 'NotSupportedError') setRecError("Navigateur incompatible avec l'enregistrement.");
          else setRecError(err?.message || "Échec du partage d'écran.");
          return null;
        });
      if (tabStream) {
        tabStream.getVideoTracks().forEach((t) => {
          t.addEventListener('ended', () => {
            if (mediaRecRef.current?.state === 'recording') {
              toast({
                title: 'Flux vidéo enregistré interrompu',
                description:
                  'Le partage d\'écran ou d\'onglet a été arrêté — l\'enregistrement se finalise. Pour un enregistrement long, gardez l\'onglet partagé actif.',
              });
              try {
                mediaRecRef.current.requestData();
              } catch {
                /* ignore */
              }
              try {
                mediaRecRef.current.stop();
              } catch {
                /* ignore */
              }
            }
          });
          tracks.push(t);
        });
      }

      if (room) {
        const localMic = room.localParticipant?.getTrackPublication(Track.Source.Microphone);
        if (localMic?.track?.mediaStreamTrack) tracks.push(localMic.track.mediaStreamTrack);
        room.remoteParticipants.forEach((p) => {
          p.getTrackPublications().forEach((pub) => {
            if (pub.kind === 'audio' && pub.track?.mediaStreamTrack) {
              tracks.push(pub.track.mediaStreamTrack);
            }
          });
        });
      }

      if (!tracks.some((t) => t.kind === 'video')) {
        setRecStarting(false);
        setRecError("Aucune vidéo disponible. Autorisez le partage d'onglet.");
        return;
      }

      const stream = new MediaStream(tracks);
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
          ? 'video/webm;codecs=vp8,opus'
          : 'video/webm';

      const mr = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_500_000 });
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const { data: authData } = await supabase.auth.getUser();
        const uid = authData?.user?.id;
        if (!uid) {
          setRecError('Session expirée.');
          return;
        }
        const bucket = import.meta.env.VITE_SUPABASE_LIVE_RECORDINGS_BUCKET || 'live-recordings';
        const fileName = `${uid}/${sessionId}/${Date.now()}.webm`;
        try {
          const { error: upErr } = await supabase.storage
            .from(bucket)
            .upload(fileName, blob, { contentType: 'video/webm', upsert: false });
          if (!upErr) {
            await supabase.from('live_recordings').insert({
              live_session_id: sessionId,
              file_path: fileName,
              file_size: blob.size,
              recorded_at: new Date().toISOString(),
              created_by: uid,
            });
          } else {
            setRecError(`Upload impossible : ${upErr.message}`);
          }
        } catch (err) {
          setRecError(err.message || 'Erreur upload');
        }
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        try {
          const r = recFinalizeResolveRef.current;
          recFinalizeResolveRef.current = null;
          r?.();
        } catch {
          /* ignore */
        }
      };

      mr.start(1000);
      mediaRecRef.current = mr;
      setRecording(true);
      setRecStarting(false);
    } catch (err) {
      setRecError('Enregistrement refusé : ' + err.message);
      setRecStarting(false);
    }
  }, [recording, recStarting, sessionId, toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecRef.current && recordingRef.current) {
      try {
        mediaRecRef.current.requestData();
      } catch {
        /* ignore */
      }
      try {
        mediaRecRef.current.stop();
      } catch {
        const r = recFinalizeResolveRef.current;
        recFinalizeResolveRef.current = null;
        r?.();
      }
    } else {
      const r = recFinalizeResolveRef.current;
      recFinalizeResolveRef.current = null;
      r?.();
    }
  }, []);

  return {
    recording,
    recStarting,
    recError,
    setRecError,
    recordingRef,
    recFinalizeResolveRef,
    mediaRecRef,
    startRecording,
    stopRecording,
  };
}
