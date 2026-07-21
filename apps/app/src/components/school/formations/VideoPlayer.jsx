import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Settings } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import supabase from '@/lib/customSupabaseClient';

const signedUrlCache = new Map();


const VideoPlayer = forwardRef(({ video, onEnded, onTimeUpdate, overlay = null }, ref) => {
  const inferredType = useMemo(() => {
    // Le MONTAGE post-prod (renderedUrl = MP4 rendu en R2 par le worker) PRIME sur la source
    // brute : c'est la version éditée que la classe doit voir. URL directe → lecture custom_url.
    if (video?.renderedUrl) return 'custom_url';
    if (video?.type) return video.type;
    if (video?.storagePath) return 'upload';
    const url = String(video?.url || '');
    if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube';
    if (/vimeo\.com/i.test(url)) return 'vimeo';
    if (url) return 'custom_url';
    return '';
  }, [video?.renderedUrl, video?.storagePath, video?.type, video?.url]);

  const videoRef = useRef(null);
  const lastResolvedKeyRef = useRef('');
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playableUrl, setPlayableUrl] = useState(video?.renderedUrl || video?.url || '');
  const [videoCanPlay, setVideoCanPlay] = useState(false);
  const draggingRef = useRef(false);

  useImperativeHandle(
    ref,
    () => ({
      seekTo: (timeSeconds) => {
        if (!videoRef.current) return;
        const t = Math.max(0, Number(timeSeconds ?? 0));
        videoRef.current.currentTime = t;
        setCurrentTime(t);
        onTimeUpdate?.(t);
      },
      getCurrentTime: () => (videoRef.current ? Number(videoRef.current.currentTime || 0) : 0),
      pause: () => { try { videoRef.current?.pause(); } catch { /* */ } },
      play: () => { try { void videoRef.current?.play?.()?.catch?.(() => {}); } catch { /* */ } },
    }),
    [onTimeUpdate]
  );

  const chapters = useMemo(() => {
    const raw = video?.timestamps || video?.chapters || [];
    if (!Array.isArray(raw)) return [];
    return raw
      .map((c) => ({
        timeSeconds: Number(c?.timeSeconds ?? c?.time ?? c?.seconds ?? 0),
        label: String(c?.label ?? c?.title ?? '').trim(),
      }))
      .filter((c) => Number.isFinite(c.timeSeconds) && c.timeSeconds >= 0 && c.label)
      .sort((a, b) => a.timeSeconds - b.timeSeconds);
  }, [video?.chapters, video?.timestamps]);

  const formatTime = (seconds) => {
    const s = Number(seconds);
    if (!Number.isFinite(s) || s < 0) return '0:00';
    const mm = Math.floor(s / 60);
    const ss = Math.floor(s % 60);
    return `${mm}:${String(ss).padStart(2, '0')}`;
  };

  useEffect(() => { setVideoCanPlay(false); }, [playableUrl]);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      if (!video) {
        setPlayableUrl('');
        return;
      }
      // renderedUrl (montage) en priorité, puis storagePath (upload signé), puis url brute.
      const storagePath = video?.renderedUrl ? null : video?.storagePath;
      const rawUrl = video?.renderedUrl || video?.url || '';
      const cacheKey = storagePath ? `${inferredType}:${storagePath}` : `${inferredType}::${rawUrl || ''}`;

      // Avoid resetting src when nothing meaningful changed.
      if (lastResolvedKeyRef.current === cacheKey) return;
      lastResolvedKeyRef.current = cacheKey;

      const derivePublicUrl = () => {
        if (!storagePath) return '';
        try {
          const { data } = supabase.storage.from('videos').getPublicUrl(storagePath);
          return data?.publicUrl || '';
        } catch {
          return '';
        }
      };

      if (inferredType !== 'upload' && inferredType !== 'file') {
        setPlayableUrl((prev) => (prev === rawUrl ? prev : rawUrl));
        return;
      }

      const baseUrl = rawUrl || derivePublicUrl();
      if (!storagePath) {
        setPlayableUrl((prev) => (prev === baseUrl ? prev : baseUrl));
        return;
      }

      try {
        const cached = signedUrlCache.get(storagePath);
        if (cached?.url && cached?.expiresAt && cached.expiresAt > Date.now() + 30_000) {
          setPlayableUrl((prev) => (prev === cached.url ? prev : cached.url));
          return;
        }
        const { data, error } = await supabase.storage.from('videos').createSignedUrl(storagePath, 60 * 60);
        if (!alive) return;
        if (error) {
          setPlayableUrl((prev) => (prev === baseUrl ? prev : baseUrl));
          return;
        }
        const nextUrl = data?.signedUrl || baseUrl;
        signedUrlCache.set(storagePath, { url: nextUrl, expiresAt: Date.now() + 60 * 60 * 1000 });
        setPlayableUrl((prev) => (prev === nextUrl ? prev : nextUrl));
      } catch {
        if (!alive) return;
        setPlayableUrl((prev) => (prev === baseUrl ? prev : baseUrl));
      }
    };

    run();
    return () => {
      alive = false;
    };
  }, [inferredType, video?.renderedUrl, video?.storagePath, video?.url]);

  // Render based on type
  if (!video) {
    return (
      <div className="aspect-video bg-gray-900 flex items-center justify-center text-gray-500">
        Vidéo indisponible
      </div>
    );
  }

  if (inferredType === 'youtube' || inferredType === 'vimeo' || inferredType === 'custom_url') {
    return (
      <div className="aspect-video w-full bg-black rounded-lg overflow-hidden border border-white/10 relative">
        <iframe
          src={playableUrl}
          title={video?.title || 'Video'}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
        <div className="absolute bottom-2 left-2 right-2 text-[10px] text-gray-300 bg-black/40 border border-white/10 rounded px-2 py-1">
          Navigation précise (timeline) disponible sur les vidéos uploadées.
        </div>
      </div>
    );
  }

  if (inferredType === 'upload' || inferredType === 'file') {
    // Basic HTML5 Video Player styling placeholder
    // In a real app, you would wire up the custom controls to the video ref
    return (
      <div className="relative group bg-[#0b0b0f] overflow-hidden">
        <div className="relative">
          {/* Overlay noir retiré dès que la vidéo peut jouer — couvre le gris natif Chrome pendant le chargement */}
          {!videoCanPlay && (
            <div className="absolute inset-0 z-10 pointer-events-none" style={{ background: '#0b0b0f' }} />
          )}
          <video
            ref={videoRef}
            src={playableUrl}
            poster="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAABjE+ibYAAAAASUVORK5CYII="
            className="w-full aspect-video block"
            style={{ background: '#0b0b0f' }}
            controls
            onCanPlay={() => setVideoCanPlay(true)}
            onError={() => setVideoCanPlay(true)}
            onEnded={onEnded}
            onLoadedMetadata={(e) => {
              const d = Number(e?.currentTarget?.duration);
              if (Number.isFinite(d) && d > 0) setDuration(d);
            }}
            onTimeUpdate={(e) => {
              if (draggingRef.current) return;
              const t = Number(e?.currentTarget?.currentTime);
              if (Number.isFinite(t)) setCurrentTime(t);
              onTimeUpdate?.(t);
            }}
          />
          {/* Tableau interactif superposé (moitié droite, desktop) — laisse le bas libre pour les contrôles natifs */}
          {overlay ? (
            <div className="hidden md:block absolute top-2 right-2 bottom-12 w-[44%] z-10">
              {overlay}
            </div>
          ) : null}
        </div>

        <div className="px-3 py-2 bg-[#0B0F14] border-t border-white/10">
          <div className="flex items-center justify-between text-xs text-gray-300 mb-2">
            <div>{formatTime(currentTime)}</div>
            <div>{formatTime(duration)}</div>
          </div>
          <Slider
            value={[Math.min(currentTime, duration || 0)]}
            min={0}
            max={Math.max(0, duration || 0)}
            step={0.5}
            onValueChange={(val) => {
              draggingRef.current = true;
              const next = Array.isArray(val) ? Number(val[0]) : 0;
              if (Number.isFinite(next)) setCurrentTime(next);
            }}
            onValueCommit={(val) => {
              const next = Array.isArray(val) ? Number(val[0]) : 0;
              if (videoRef.current && Number.isFinite(next)) {
                videoRef.current.currentTime = next;
              }
              onTimeUpdate?.(next);
              draggingRef.current = false;
            }}
          />

          {chapters.length > 0 ? (
            <div className="mt-3 border border-white/10 rounded-lg overflow-hidden">
              <div className="px-3 py-2 text-xs text-gray-400 bg-black/30 border-b border-white/10">Horodatages</div>
              <div className="max-h-[160px] overflow-y-auto">
                {chapters.map((c) => (
                  <button
                    key={`${c.timeSeconds}-${c.label}`}
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-white/5 flex items-center justify-between gap-3"
                    onClick={() => {
                      if (!videoRef.current) return;
                      const t = Math.max(0, Math.min(c.timeSeconds, duration || c.timeSeconds));
                      videoRef.current.currentTime = t;
                      setCurrentTime(t);
                    }}
                  >
                    <div className="text-sm text-white truncate">{c.label}</div>
                    <div className="text-xs text-gray-400 shrink-0">{formatTime(c.timeSeconds)}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="aspect-video bg-gray-900 flex items-center justify-center text-gray-500">
      Format vidéo non supporté
    </div>
  );
});

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;