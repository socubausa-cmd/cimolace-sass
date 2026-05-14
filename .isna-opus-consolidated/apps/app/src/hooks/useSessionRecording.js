/**
 * useSessionRecording — Enregistrement de session live
 *
 * Stratégie dual :
 * 1. Tente LiveKit Egress (serveur) → stockage Cloudflare R2
 * 2. Si indisponible, fallback MediaRecorder (client) → upload Supabase Storage
 *
 * Usage:
 *   const { recording, startRecording, stopRecording, recordingUrl, error } = useSessionRecording({
 *     liveSessionId,
 *     userId,
 *     streamToRecord,   // MediaStream combiné local (optionnel pour MediaRecorder)
 *   });
 */
import { useCallback, useRef, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

const getOrigin = () => (typeof window !== 'undefined' ? window.location.origin : '');

async function callApi(endpoint, body) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(`${getOrigin()}/.netlify/functions/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

function getSupportedMimeType() {
  const types = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) || '';
}

export function useSessionRecording({ liveSessionId, userId, streamToRecord }) {
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState(null);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState(null); // 'server' | 'client'

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const startRecording = useCallback(async () => {
    if (recording || !liveSessionId) return;
    setError(null);

    // ── Tentative 1 : LiveKit Egress → R2 (serveur) ───────────────────────
    const { ok, data } = await callApi('livekit-start-recording', { liveSessionId });

    if (ok && data?.ok) {
      setMode(data.fallback === 'client_side' ? 'client' : 'server');
      setRecording(true);
      if (data.fallback !== 'client_side') return;
    }

    // ── Tentative 2 : MediaRecorder côté client (fallback) ────────────────
    const stream = streamToRecord;
    if (!stream) {
      setError("Aucun flux vidéo disponible pour l'enregistrement");
      return;
    }

    const mimeType = getSupportedMimeType();
    const mr = new MediaRecorder(stream, mimeType ? { mimeType } : {});
    chunksRef.current = [];

    mr.ondataavailable = (e) => {
      if (e.data?.size > 0) chunksRef.current.push(e.data);
    };

    mr.onerror = (e) => {
      setError(`Erreur MediaRecorder : ${e?.error?.message || 'inconnue'}`);
      setRecording(false);
    };

    mr.start(2000);
    mediaRecorderRef.current = mr;
    setMode('client');
    setRecording(true);
  }, [liveSessionId, recording, streamToRecord]);

  const stopRecording = useCallback(async () => {
    if (!recording) return;
    setRecording(false);

    // Arrêter côté serveur
    await callApi('livekit-stop-recording', { liveSessionId });

    // Arrêter MediaRecorder côté client si actif
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') {
      await new Promise((resolve) => {
        mr.onstop = resolve;
        mr.stop();
      });
    }
    mediaRecorderRef.current = null;

    // Upload chunks si mode client (fallback Supabase Storage)
    const chunks = chunksRef.current;
    if (chunks.length === 0) return;

    setUploading(true);
    const mimeType = chunks[0]?.type || 'video/webm';
    const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
    const blob = new Blob(chunks, { type: mimeType });
    chunksRef.current = [];

    const path = `${userId}/${liveSessionId}-${Date.now()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from('live-recordings')
      .upload(path, blob, { contentType: mimeType, upsert: false });

    if (upErr) {
      setError(`Upload échoué : ${upErr.message}`);
      setUploading(false);
      return;
    }

    const { data: pub } = supabase.storage.from('live-recordings').getPublicUrl(path);
    const url = pub?.publicUrl || null;

    if (url) {
      await supabase.from('live_recordings').insert({
        live_session_id: liveSessionId,
        egress_id: null,
        status: 'completed',
        output_url: url,
        completed_at: new Date().toISOString(),
        raw_response: { mode: 'client_mediarecorder', mimeType },
      });
      await supabase.from('live_sessions').update({
        recording_status: 'completed',
        recording_url: url,
        replay_available: true,
      }).eq('id', liveSessionId);
      setRecordingUrl(url);
    }

    setUploading(false);
  }, [liveSessionId, recording, userId]);

  return { recording, uploading, recordingUrl, error, mode, startRecording, stopRecording };
}

export default useSessionRecording;
