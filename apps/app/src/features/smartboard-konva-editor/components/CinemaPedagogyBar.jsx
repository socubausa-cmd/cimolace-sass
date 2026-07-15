import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Film, Square, Trash2, ListVideo, Video, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { uploadSmartboardCinemaTake } from '@/lib/uploadSmartboardCinemaTake';
import { useSmartboardCanvasSrc } from '@/lib/smartboardCanvasUrl';
import { useCourseCopilotStore } from '../store/useCourseCopilotStore';
import { useSmartboardKonvaStore } from '../store/useSmartboardKonvaStore';
import { activateKonvaSceneAndSyncSlide } from '../store/smartboardWorkspaceApi';
import CinemaPedagogyTimeline from './CinemaPedagogyTimeline';

/** Lecture d'une prise cinéma : URL signée du bucket privé, repli sur l'aperçu local (blob). */
function CinemaTakeVideo({ recordingPublicUrl, previewUrl, ...rest }) {
  const signed = useSmartboardCanvasSrc(recordingPublicUrl);
  const src = signed || previewUrl || '';
  if (!src) return null;
  return <video src={src} {...rest} />;
}

function pickRecorderMime() {
  const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  if (typeof MediaRecorder === 'undefined') return '';
  for (const m of candidates) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return '';
}

/**
 * Barre cinéma pédagogique : minuteur + MediaRecorder sur le canvas Konva + liste des prises.
 *
 * @param {{ disabled?: boolean; editorRef?: React.RefObject<{ getLayerCaptureStream?: (fps?: number) => MediaStream | null } | null>; onRecordingChange?: (recording: boolean) => void }} props
 */
const CinemaPedagogyBar = forwardRef(function CinemaPedagogyBar(
  { disabled = false, editorRef = null, onRecordingChange },
  ref,
) {
  const course = useCourseCopilotStore((s) => s.course);
  const activeSlideIndex = useCourseCopilotStore((s) => s.activeSlideIndex);
  const addCinemaTake = useCourseCopilotStore((s) => s.addCinemaTake);
  const updateCinemaTake = useCourseCopilotStore((s) => s.updateCinemaTake);
  const removeCinemaTake = useCourseCopilotStore((s) => s.removeCinemaTake);
  const clearCinemaTakes = useCourseCopilotStore((s) => s.clearCinemaTakes);
  const takes = useCourseCopilotStore((s) => s.cinemaPedagogy?.takes ?? []);

  const [uploadingTakeId, setUploadingTakeId] = useState(/** @type {string | null} */ (null));
  const [uploadError, setUploadError] = useState('');

  const [recordingStart, setRecordingStart] = useState(null);
  const [, setTick] = useState(0);
  const recordingStartedAtRef = useRef(null);
  const mediaRecorderRef = useRef(/** @type {MediaRecorder | null} */ (null));
  const mediaChunksRef = useRef(/** @type {Blob[]} */ ([]));
  const captureStreamRef = useRef(/** @type {MediaStream | null} */ (null));

  useEffect(() => {
    if (recordingStart == null) return undefined;
    const id = window.setInterval(() => setTick((t) => t + 1), 250);
    return () => window.clearInterval(id);
  }, [recordingStart]);

  const elapsedSec =
    recordingStart != null && recordingStartedAtRef.current != null
      ? Math.max(0, (Date.now() - recordingStartedAtRef.current) / 1000)
      : 0;
  const mm = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
  const ss = String(Math.floor(elapsedSec % 60)).padStart(2, '0');

  const slideTitle = course?.slides?.[activeSlideIndex]?.title || `Slide ${activeSlideIndex + 1}`;
  const isRecording = recordingStart != null;

  const finalizeWithoutVideo = useCallback(
    (durationSec) => {
      const si = useCourseCopilotStore.getState().activeSlideIndex ?? 0;
      const sid = useSmartboardKonvaStore.getState().project?.activeSceneId ?? null;
      addCinemaTake({
        slideIndex: si,
        sceneId: sid,
        durationSec,
        hasRecording: false,
      });
    },
    [addCinemaTake],
  );

  const startRecording = useCallback(() => {
    if (disabled) return;
    mediaChunksRef.current = [];
    captureStreamRef.current = null;
    mediaRecorderRef.current = null;

    const stream =
      typeof editorRef?.current?.getLayerCaptureStream === 'function'
        ? editorRef.current.getLayerCaptureStream(24)
        : null;
    captureStreamRef.current = stream;

    const mime = pickRecorderMime();
    if (stream && typeof MediaRecorder !== 'undefined' && mime) {
      try {
        const mr = new MediaRecorder(stream, { mimeType: mime });
        mr.ondataavailable = (e) => {
          if (e.data && e.data.size) mediaChunksRef.current.push(e.data);
        };
        mr.onstop = () => {
          try {
            stream.getTracks().forEach((t) => t.stop());
          } catch {
            /* ignore */
          }
          captureStreamRef.current = null;
          const start = recordingStartedAtRef.current;
          const durationSec = start ? Math.max(0, (Date.now() - start) / 1000) : 0;
          const chunks = mediaChunksRef.current;
          mediaChunksRef.current = [];
          recordingStartedAtRef.current = null;
          mediaRecorderRef.current = null;

          const slideIndex = useCourseCopilotStore.getState().activeSlideIndex ?? 0;
          const sceneId = useSmartboardKonvaStore.getState().project?.activeSceneId ?? null;

          if (chunks.length) {
            const blob = new Blob(chunks, { type: mr.mimeType || 'video/webm' });
            const previewUrl = URL.createObjectURL(blob);
            const takeId = addCinemaTake({
              slideIndex,
              sceneId,
              durationSec,
              previewUrl,
              hasRecording: true,
              recordingMime: blob.type,
              recordingSizeBytes: blob.size,
            });
            setUploadError('');
            setUploadingTakeId(takeId);
            void uploadSmartboardCinemaTake(blob)
              .then(({ publicUrl, path }) => {
                updateCinemaTake(takeId, {
                  recordingPublicUrl: publicUrl,
                  recordingStoragePath: path,
                });
              })
              .catch((err) => {
                setUploadError(err instanceof Error ? err.message : String(err));
              })
              .finally(() => {
                setUploadingTakeId((cur) => (cur === takeId ? null : cur));
              });
          } else {
            addCinemaTake({
              slideIndex,
              sceneId,
              durationSec,
              hasRecording: false,
            });
          }
        };
        mr.start(250);
        mediaRecorderRef.current = mr;
      } catch {
        try {
          stream?.getTracks().forEach((t) => t.stop());
        } catch {
          /* ignore */
        }
        captureStreamRef.current = null;
      }
    }

    const now = Date.now();
    recordingStartedAtRef.current = now;
    setRecordingStart(now);
  }, [addCinemaTake, disabled, editorRef, updateCinemaTake]);

  const stopRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    const stream = captureStreamRef.current;
    const start = recordingStartedAtRef.current;
    const durationFallback = start ? Math.max(0, (Date.now() - start) / 1000) : 0;

    setRecordingStart(null);

    if (mr && mr.state !== 'inactive') {
      try {
        mr.stop();
      } catch {
        finalizeWithoutVideo(durationFallback);
      }
      return;
    }

    try {
      stream?.getTracks().forEach((t) => t.stop());
    } catch {
      /* ignore */
    }
    captureStreamRef.current = null;
    recordingStartedAtRef.current = null;
    mediaRecorderRef.current = null;
    finalizeWithoutVideo(durationFallback);
  }, [finalizeWithoutVideo]);

  useEffect(() => {
    onRecordingChange?.(isRecording);
  }, [isRecording, onRecordingChange]);

  useImperativeHandle(
    ref,
    () => ({
      toggleRecording: () => {
        if (disabled) return;
        if (!isRecording) startRecording();
        else stopRecording();
      },
      stopRecording,
      getIsRecording: () => isRecording,
    }),
    [disabled, isRecording, startRecording, stopRecording],
  );

  const onToggleRecord = () => {
    if (disabled) return;
    if (!isRecording) {
      startRecording();
      return;
    }
    stopRecording();
  };

  const handlePickTake = useCallback((takeId) => {
    const t = takes.find((x) => x.id === takeId);
    if (!t) return;
    const scenes = useSmartboardKonvaStore.getState().project?.scenes ?? [];
    let sceneIndex = Math.max(0, Math.min(t.slideIndex, scenes.length - 1));
    let sceneId = scenes[sceneIndex]?.id ?? null;
    if (t.sceneId) {
      const idx = scenes.findIndex((s) => s.id === t.sceneId);
      if (idx >= 0) {
        sceneIndex = idx;
        sceneId = t.sceneId;
      }
    }
    if (sceneId) {
      activateKonvaSceneAndSyncSlide(sceneId, sceneIndex);
    } else {
      useCourseCopilotStore.getState().setActiveSlideIndex(t.slideIndex);
    }
    window.requestAnimationFrame(() => {
      document.querySelector(`[data-cinema-take="${takeId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }, [takes]);

  return (
    <div
      className="flex flex-col gap-2 border-t border-[color-mix(in_srgb,var(--school-accent)_20%,transparent)] px-3 py-2"
      style={{ background: 'linear-gradient(180deg, rgba(212,175,55,0.06) 0%, rgba(15,17,23,0.98) 100%)' }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-[11px] text-[#f5dd8a]/90">
          <Film className="h-4 w-4 shrink-0 text-[var(--school-accent)]" />
          <span className="font-semibold">Cinéma pédagogique</span>
          <span className="text-white/35">·</span>
          <span className="truncate text-white/55" title={slideTitle}>
            {slideTitle}
          </span>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'min-w-[5.5rem] rounded-lg border px-2 py-1 text-center font-mono text-[13px] tabular-nums',
              isRecording
                ? 'border-red-500/40 bg-red-500/10 text-red-300'
                : 'border-white/10 bg-white/[0.03] text-white/50',
            )}
          >
            {mm}:{ss}
          </span>
          <button
            type="button"
            disabled={disabled}
            onClick={onToggleRecord}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-colors',
              isRecording
                ? 'border-red-500/50 bg-red-500/15 text-red-300 hover:bg-red-500/25'
                : 'border-[color-mix(in_srgb,var(--school-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--school-accent)_10%,transparent)] text-[#f5dd8a] hover:bg-[color-mix(in_srgb,var(--school-accent)_20%,transparent)]',
            )}
          >
            {isRecording ? (
              <>
                <Square className="h-3 w-3 fill-current" /> Arrêter & enregistrer la prise
              </>
            ) : (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-40" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                </span>
                Démarrer
              </>
            )}
          </button>
        </div>
      </div>

      {takes.length > 0 && (
        <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-lg border border-white/[0.06] bg-black/20 px-2 py-1.5">
          <CinemaPedagogyTimeline
            takes={takes}
            activeSlideIndex={activeSlideIndex}
            onPickTake={handlePickTake}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1 text-[10px] font-medium text-white/35">
              <ListVideo className="h-3 w-3" /> Prises ({takes.length})
            </span>
            <button
              type="button"
              onClick={() => clearCinemaTakes()}
              className="flex items-center gap-1 text-[10px] text-white/25 hover:text-red-400/90"
            >
              <Trash2 className="h-3 w-3" /> Tout effacer
            </button>
          </div>
          <ul className="space-y-1 text-[10px] text-white/55">
            {takes
              .slice()
              .reverse()
              .slice(0, 12)
              .map((t) => (
                <li
                  key={t.id}
                  data-cinema-take={t.id}
                  className="flex flex-col gap-1 rounded border border-white/[0.04] bg-white/[0.02] px-1.5 py-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1">
                      {t.hasRecording && <Video className="h-3 w-3 text-emerald-400/90" />}
                      Slide {t.slideIndex + 1} · {t.durationSec.toFixed(1)}s
                      {t.recordingSizeBytes ? (
                        <span className="text-white/25">· {(t.recordingSizeBytes / 1024).toFixed(0)} Ko</span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      className="text-white/20 hover:text-red-400"
                      title="Supprimer"
                      onClick={() => removeCinemaTake(t.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  {uploadingTakeId === t.id ? (
                    <div className="flex items-center gap-1.5 py-1 text-[9px] text-amber-400/90">
                      <Loader2 className="h-3 w-3 animate-spin" /> Envoi vers le cloud…
                    </div>
                  ) : null}
                  {t.recordingPublicUrl || t.previewUrl ? (
                    <CinemaTakeVideo
                      recordingPublicUrl={t.recordingPublicUrl}
                      previewUrl={t.previewUrl}
                      controls
                      className="max-h-24 w-full rounded border border-white/10 bg-black/40"
                      playsInline
                    />
                  ) : null}
                </li>
              ))}
          </ul>
        </div>
      )}

      {uploadError ? (
        <p className="text-[10px] text-red-400/90">{uploadError}</p>
      ) : null}

      <p className="text-[9px] leading-snug text-white/25">
        Après capture, la vidéo est envoyée vers le stockage du compte (URL publique dans l'export workspace). Connexion
        requise.
      </p>
    </div>
  );
});

export default CinemaPedagogyBar;
