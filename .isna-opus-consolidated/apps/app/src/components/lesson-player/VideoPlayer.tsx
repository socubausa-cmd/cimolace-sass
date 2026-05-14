import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Slider } from '@/components/ui/slider';
import supabaseClient from '@/lib/customSupabaseClient';
import { formatTime } from './types';

export type LessonVideoPlayerHandle = {
  getCurrentTime: () => number;
  seekTo: (timeSeconds: number) => void;
  play: () => void;
  pause: () => void;
};

type ChapterMarker = { timeSeconds: number; label: string };

type NoteMarker = { id: string; timeSeconds: number };

type Props = {
  video: {
    url?: string;
    storagePath?: string;
    type?: string;
    title?: string;
  };
  chapters?: ChapterMarker[];
  notes?: NoteMarker[];
  onTimeUpdate?: (timeSeconds: number) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
};

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

const LessonVideoPlayer = forwardRef<LessonVideoPlayerHandle, Props>(
  ({ video, chapters = [], notes = [], onTimeUpdate, onPlay, onPause, onEnded }, ref) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const lastResolvedKeyRef = useRef<string>('');
    const [playableUrl, setPlayableUrl] = useState<string>(video?.url || '');
    const [duration, setDuration] = useState<number>(0);
    const [currentTime, setCurrentTime] = useState<number>(0);
    const draggingRef = useRef(false);

    const inferredType = useMemo(() => {
      if (video?.type) return video.type;
      if (video?.storagePath) return 'upload';
      const url = String(video?.url || '');
      if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube';
      if (/vimeo\.com/i.test(url)) return 'vimeo';
      if (url) return 'custom_url';
      return '';
    }, [video?.storagePath, video?.type, video?.url]);

    useEffect(() => {
      let alive = true;
      const run = async () => {
        const storagePath = video?.storagePath;
        const rawUrl = video?.url || '';
        const cacheKey = storagePath ? `${inferredType}:${storagePath}` : `${inferredType}::${rawUrl || ''}`;
        if (lastResolvedKeyRef.current === cacheKey) return;
        lastResolvedKeyRef.current = cacheKey;

        if (inferredType !== 'upload' && inferredType !== 'file') {
          setPlayableUrl(rawUrl);
          return;
        }

        if (!storagePath) {
          setPlayableUrl(rawUrl);
          return;
        }

        try {
          const cached = signedUrlCache.get(storagePath);
          if (cached?.url && cached?.expiresAt && cached.expiresAt > Date.now() + 30_000) {
            setPlayableUrl(cached.url);
            return;
          }

          const { data, error } = await supabaseClient.storage.from('videos').createSignedUrl(storagePath, 60 * 60);
          if (!alive) return;
          if (error) {
            setPlayableUrl(rawUrl);
            return;
          }
          const nextUrl = data?.signedUrl || rawUrl;
          signedUrlCache.set(storagePath, { url: nextUrl, expiresAt: Date.now() + 60 * 60 * 1000 });
          setPlayableUrl(nextUrl);
        } catch {
          if (!alive) return;
          setPlayableUrl(rawUrl);
        }
      };

      run();
      return () => {
        alive = false;
      };
    }, [inferredType, video?.storagePath, video?.url]);

    useImperativeHandle(
      ref,
      () => ({
        getCurrentTime: () => (videoRef.current ? Number(videoRef.current.currentTime || 0) : 0),
        seekTo: (timeSeconds: number) => {
          if (!videoRef.current) return;
          const t = Math.max(0, Number(timeSeconds ?? 0));
          videoRef.current.currentTime = t;
          setCurrentTime(t);
        },
        play: () => {
          videoRef.current?.play();
        },
        pause: () => {
          videoRef.current?.pause();
        },
      }),
      []
    );

    const markers = useMemo(() => {
      const base = chapters.map((c) => ({ kind: 'chapter' as const, timeSeconds: c.timeSeconds }));
      const ns = notes.map((n) => ({ kind: 'note' as const, timeSeconds: n.timeSeconds }));
      return [...base, ...ns]
        .filter((m) => Number.isFinite(m.timeSeconds) && m.timeSeconds >= 0)
        .sort((a, b) => a.timeSeconds - b.timeSeconds);
    }, [chapters, notes]);

    const seek = (t: number) => {
      if (!videoRef.current) return;
      const next = Math.max(0, Math.min(t, duration || t));
      videoRef.current.currentTime = next;
      setCurrentTime(next);
      onTimeUpdate?.(next);
    };

    return (
      <div className="bg-black rounded-lg overflow-hidden border border-white/10">
        {inferredType === 'youtube' || inferredType === 'vimeo' || inferredType === 'custom_url' ? (
          <div className="aspect-video w-full bg-black">
            <iframe
              src={playableUrl}
              title={video?.title || 'Video'}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <video
            ref={videoRef}
            src={playableUrl}
            className="w-full aspect-video"
            controls
            onPlay={onPlay}
            onPause={onPause}
            onEnded={onEnded}
            onLoadedMetadata={(e) => {
              const d = Number(e.currentTarget.duration);
              if (Number.isFinite(d) && d > 0) setDuration(d);
            }}
            onTimeUpdate={(e) => {
              if (draggingRef.current) return;
              const t = Number(e.currentTarget.currentTime);
              if (!Number.isFinite(t)) return;
              setCurrentTime(t);
              onTimeUpdate?.(t);
            }}
          />
        )}

        <div className="px-3 py-2 bg-[#0B0F14] border-t border-white/10">
          <div className="flex items-center justify-between text-xs text-gray-300 mb-2">
            <div>{formatTime(currentTime)}</div>
            <div>{formatTime(duration)}</div>
          </div>

          <div className="relative">
            <Slider
              value={[Math.min(currentTime, duration || 0)]}
              min={0}
              max={Math.max(0, duration || 0)}
              step={0.25}
              onValueChange={(val) => {
                draggingRef.current = true;
                const next = Array.isArray(val) ? Number(val[0]) : 0;
                if (Number.isFinite(next)) setCurrentTime(next);
              }}
              onValueCommit={(val) => {
                const next = Array.isArray(val) ? Number(val[0]) : 0;
                seek(next);
                draggingRef.current = false;
              }}
            />

            {duration > 0 ? (
              <div className="absolute left-0 right-0 top-[10px] h-2 pointer-events-none">
                {markers.map((m, idx) => {
                  const left = `${(m.timeSeconds / duration) * 100}%`;
                  return (
                    <div
                      key={`${m.kind}-${m.timeSeconds}-${idx}`}
                      className={m.kind === 'chapter' ? 'absolute w-0.5 h-2 bg-[#D4AF37]' : 'absolute w-1.5 h-1.5 rounded-full bg-blue-400'}
                      style={{ left }}
                    />
                  );
                })}
              </div>
            ) : null}
          </div>

          {chapters.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {chapters.slice(0, 6).map((c) => (
                <button
                  key={`${c.timeSeconds}-${c.label}`}
                  type="button"
                  className="px-2 py-1 rounded bg-white/5 border border-white/10 text-xs text-gray-200 hover:bg-white/10"
                  onClick={() => seek(c.timeSeconds)}
                >
                  {formatTime(c.timeSeconds)} • {c.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    );
  }
);

LessonVideoPlayer.displayName = 'LessonVideoPlayer';

export default LessonVideoPlayer;
