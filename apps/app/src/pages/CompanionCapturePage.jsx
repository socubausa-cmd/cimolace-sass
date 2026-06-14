/**
 * CompanionCapturePage — /companion-capture?session=XXX
 *
 * Mobile companion page for the phone camera source.
 * The phone user scans the QR code generated on the PC, lands here,
 * then either:
 *   - streams live to the PC via WebRTC (mode=stream)
 *   - records a clip and uploads it to Supabase Storage (mode=upload, default)
 *
 * Signaling for WebRTC uses Supabase Realtime channels.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { broadcastRealtime } from '@/lib/realtimeBroadcast';
import { Camera, Mic, MicOff, Square, Play, Loader2, Check, AlertCircle, Upload, Wifi } from 'lucide-react';

const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function CompanionCapturePage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session') || '';
  const mode = searchParams.get('mode') || 'upload'; // 'stream' | 'upload'

  // Common
  const [phase, setPhase] = useState('init'); // init | camera | recording | uploading | done | error
  const [errorMsg, setErrorMsg] = useState('');
  const [audioMuted, setAudioMuted] = useState(false);
  const streamRef = useRef(null);
  const videoRef = useRef(null);

  // Upload mode
  const [recordingTime, setRecordingTime] = useState(0);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState('');

  // Stream mode (WebRTC)
  const [connStatus, setConnStatus] = useState('waiting'); // waiting | connecting | connected
  const pcRef = useRef(null);
  const channelRef = useRef(null);

  // ── Open camera ───────────────────────────────────────────────────────────
  const openCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setPhase('camera');
    } catch (e) {
      setErrorMsg(`Caméra inaccessible : ${e.message}. Vérifie que tu as autorisé la caméra.`);
      setPhase('error');
    }
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setErrorMsg('Paramètre "session" manquant dans l\'URL.');
      setPhase('error');
      return;
    }
    openCamera();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      pcRef.current?.close();
      channelRef.current?.unsubscribe();
      clearInterval(timerRef.current);
    };
  }, [sessionId, openCamera]);

  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((t) => { t.enabled = !audioMuted; });
    }
  }, [audioMuted]);

  // ── UPLOAD mode ───────────────────────────────────────────────────────────
  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm';
    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = uploadRecording;
    recorder.start(1000);
    recorderRef.current = recorder;
    timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    setPhase('recording');
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setPhase('uploading');
  };

  const uploadRecording = async () => {
    const blob = new Blob(chunksRef.current, { type: 'video/webm' });
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      // Anon upload — signed URL approach
      const fileName = `companion-${sessionId}-${Date.now()}.webm`;
      const path = `companion-uploads/${fileName}`;

      const { data: publicData } = supabase.storage.from('videos').getPublicUrl(path);
      const publicUrl = publicData?.publicUrl || '';

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/videos/${path}`);
        xhr.setRequestHeader('apikey', supabaseAnonKey);
        xhr.setRequestHeader('content-type', 'video/webm');
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
        };
        xhr.onerror = () => reject(new Error('Erreur réseau'));
        xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Erreur ${xhr.status}`));
        xhr.send(blob);
      });

      // Notify the PC via Supabase Realtime
      const channel = supabase.channel(`capture-signal-${sessionId}`);
      await new Promise((res) => channel.subscribe((s) => s === 'SUBSCRIBED' && res()));
      await broadcastRealtime(channel, 'phone-upload-ready', { url: publicUrl, path, sessionId });
      channel.unsubscribe();

      setDownloadUrl(publicUrl);
      setPhase('done');
    } catch (e) {
      setErrorMsg(`Upload échoué : ${e.message}`);
      setPhase('error');
    }
  };

  // ── STREAM mode (WebRTC) ──────────────────────────────────────────────────
  const startWebRTCStream = useCallback(async () => {
    if (!streamRef.current || !sessionId) return;
    setConnStatus('connecting');

    const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });
    pcRef.current = pc;

    // Add all tracks to the connection
    streamRef.current.getTracks().forEach((track) => pc.addTrack(track, streamRef.current));

    // Subscribe to signaling channel
    const channel = supabase.channel(`capture-signal-${sessionId}`, { config: { broadcast: { self: false } } });
    channelRef.current = channel;

    channel.on('broadcast', { event: 'pc-offer' }, async ({ payload }) => {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await broadcastRealtime(channel, 'phone-answer', { sdp: answer });
      } catch (e) {
        console.error('[Companion] WebRTC answer error', e);
      }
    });

    channel.on('broadcast', { event: 'pc-ice' }, async ({ payload }) => {
      try {
        if (payload.candidate) await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } catch {}
    });

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        void broadcastRealtime(channel, 'phone-ice', { candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') setConnStatus('connected');
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) setConnStatus('waiting');
    };

    await new Promise((res) => channel.subscribe((s) => s === 'SUBSCRIBED' && res()));
    // Announce phone is ready
    await broadcastRealtime(channel, 'phone-ready', { sessionId });
  }, [sessionId]);

  // ── Render ────────────────────────────────────────────────────────────────
  const isUpload = mode !== 'stream';

  return (
    <div className="min-h-screen bg-[#050b14] text-white flex flex-col items-center">
      {/* Header */}
      <div className="w-full max-w-sm px-4 pt-6 pb-3">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-xl bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] flex items-center justify-center text-base">📱</div>
          <div>
            <h1 className="text-sm font-bold">Caméra Compagnon</h1>
            <p className="text-[10px] text-gray-500">Session : {sessionId.slice(0, 8)}…</p>
          </div>
        </div>
      </div>

      {/* Error state */}
      {phase === 'error' && (
        <div className="w-full max-w-sm px-4">
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-300">Erreur</p>
              <p className="text-xs text-red-200 mt-1">{errorMsg}</p>
            </div>
          </div>
        </div>
      )}

      {/* Camera preview */}
      {(phase === 'camera' || phase === 'recording') && (
        <div className="w-full max-w-sm px-4 space-y-4">
          <div className="relative rounded-2xl overflow-hidden bg-black border border-white/10 aspect-[9/16]">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />
            {/* Overlay when recording */}
            {phase === 'recording' && (
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <span className="flex items-center gap-1.5 bg-red-600 rounded-full px-3 py-1 text-xs font-bold animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-white" /> REC {formatTime(recordingTime)}
                </span>
              </div>
            )}
            {/* Safety frame */}
            <div className="absolute inset-[5%] border border-dashed border-white/20 rounded-xl pointer-events-none" />
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => setAudioMuted((v) => !v)}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${audioMuted ? 'bg-red-500' : 'bg-white/10'}`}
            >
              {audioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {isUpload ? (
              phase === 'camera' ? (
                <button
                  type="button"
                  onClick={startRecording}
                  className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-colors shadow-lg"
                >
                  <div className="w-5 h-5 rounded-full bg-white" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="w-16 h-16 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center transition-colors shadow-lg"
                >
                  <Square className="w-6 h-6" />
                </button>
              )
            ) : (
              /* Stream mode */
              connStatus === 'waiting' ? (
                <button
                  type="button"
                  onClick={startWebRTCStream}
                  className="w-16 h-16 rounded-full bg-[var(--school-accent)] hover:bg-amber-400 flex items-center justify-center transition-colors shadow-lg"
                >
                  <Wifi className="w-6 h-6 text-black" />
                </button>
              ) : (
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${connStatus === 'connected' ? 'bg-emerald-500' : 'bg-blue-500 animate-pulse'}`}>
                  {connStatus === 'connected' ? <Check className="w-6 h-6" /> : <Loader2 className="w-6 h-6 animate-spin" />}
                </div>
              )
            )}
          </div>

          {/* Status text */}
          <p className="text-center text-xs text-gray-500">
            {isUpload
              ? phase === 'camera' ? 'Appuie sur le bouton rouge pour commencer à filmer' : `Enregistrement en cours — appuie sur le carré pour arrêter`
              : connStatus === 'waiting' ? 'Appuie sur le bouton WiFi pour connecter au PC'
              : connStatus === 'connecting' ? 'Connexion au PC en cours…'
              : '✓ Connecté au PC — flux en direct actif'
            }
          </p>
        </div>
      )}

      {/* Uploading */}
      {phase === 'uploading' && (
        <div className="w-full max-w-sm px-4 py-8 flex flex-col items-center gap-6">
          <Loader2 className="w-12 h-12 text-[var(--school-accent)] animate-spin" />
          <div className="text-center">
            <p className="font-semibold">Envoi en cours…</p>
            <p className="text-xs text-gray-400 mt-1">{uploadProgress}%</p>
          </div>
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-[var(--school-accent)] transition-all" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      )}

      {/* Done */}
      {phase === 'done' && (
        <div className="w-full max-w-sm px-4 py-8 flex flex-col items-center gap-6 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <Check className="w-8 h-8 text-emerald-400" />
          </div>
          <div>
            <p className="text-lg font-bold text-emerald-300">Vidéo envoyée !</p>
            <p className="text-xs text-gray-400 mt-2">
              Retourne sur ton PC — la vidéo a été reçue dans le studio et est prête à être montée.
            </p>
          </div>
        </div>
      )}

      {/* Init */}
      {phase === 'init' && (
        <div className="w-full max-w-sm px-4 py-12 flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-[var(--school-accent)] animate-spin" />
          <p className="text-sm text-gray-400">Accès à la caméra…</p>
        </div>
      )}
    </div>
  );
}
