import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Settings } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import supabase from '@/lib/customSupabaseClient';
import {
  courseBuilderApi,
  isAbsoluteMediaUrl,
  renderJobPlayableUrl,
  renderJobStorageKey,
} from '@/lib/api-v2';

const signedUrlCache = new Map();

// URLs de montage déjà résolues, gardées le temps de la session d'onglet : le
// même cours réouvert deux fois ne rappelle pas l'API. TTL court volontaire —
// une URL R2 présignée expire (≈1 h côté API), on préfère re-signer trop tôt
// que servir un lien mort à une classe entière.
const renderedUrlCache = new Map();
const RENDERED_URL_TTL_MS = 30 * 60 * 1000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Ce que le contenu dit de son MONTAGE post-production, normalisé.
 *
 * Trois générations de champs cohabitent dans `formation_day_contents.data` et on
 * doit toutes les lire, sans quoi un cours rendu avant/après un déploiement
 * disparaît de la classe :
 *   - `renderedStorageKey` (CANONIQUE, écrit par le worker) = CLÉ R2 ;
 *   - `renderedJobId`      = identifiant exact du job, le plus fiable pour retrouver
 *     l'URL présignée quand plusieurs rendus se sont succédé ;
 *   - `renderedUrl`        = héritage AMBIGU : ancien miroir de la clé (worker d'avant
 *     le correctif) MAIS AUSSI, côté CoursePlayerInterface, l'URL déjà signée de la
 *     vidéo SOURCE pour un contenu hébergé.
 *
 * D'où l'ordre : la clé canonique PRIME. Servir `renderedUrl` quand il est absolu alors
 * qu'une clé existe ferait jouer l'ORIGINAL à la place du montage. On conserve cette URL
 * comme `fallbackUrl` : c'est elle qui sauve la séance si le montage reste irrésoluble.
 */
function readRenderedRef(video) {
  const legacy = String(video?.renderedUrl || '').trim();
  const legacyIsUrl = isAbsoluteMediaUrl(legacy);
  const storageKey = String(video?.renderedStorageKey || (legacyIsUrl ? '' : legacy) || '').trim();
  const jobId = String(video?.renderedJobId || '').trim();
  if (storageKey || jobId) {
    return { directUrl: '', storageKey, jobId, fallbackUrl: legacyIsUrl ? legacy : '' };
  }
  // Aucune clé : une valeur ABSOLUE est déjà lisible, on la sert telle quelle (rétro-compat).
  if (legacyIsUrl) return { directUrl: legacy, storageKey: '', jobId: '', fallbackUrl: '' };
  return { directUrl: '', storageKey: '', jobId: '', fallbackUrl: '' };
}

/**
 * Résout la référence de montage d'un contenu en URL RÉELLEMENT lisible.
 *
 * POURQUOI : le worker (apps/worker/src/jobs/courseRender.js) stocke dans
 * `course_render_jobs.output_url` — puis recopie dans `formation_day_contents.data`
 * — la CLÉ R2 du MP4, pas une URL. Le bucket est PRIVÉ. Mise telle quelle dans un
 * <video src>, cette clé est interprétée comme un chemin RELATIF de l'application :
 * le navigateur télécharge le index.html du SPA et le lecteur reste noir. On applique
 * donc le même motif que les replays (présignature À LA LECTURE, cf.
 * replay.service.generatePlaybackUrl) en demandant l'URL du job de rendu à l'API.
 *
 * Renvoie '' si aucune URL exploitable n'est disponible — l'appelant retombe alors sur la
 * vidéo SOURCE, et n'affiche un message qu'en dernier recours ; il ne sert JAMAIS la clé brute.
 *
 * Deux routes, dans cet ordre :
 *   1. `render-playback` — route de LECTURE, ouverte à tout membre du tenant, ÉLÈVES
 *      COMPRIS. C'est le chemin normal en classe.
 *   2. `render-status` — route de SUIVI, réservée à owner/admin/teacher (403 pour un
 *      élève). Conservée en repli : elle couvre l'écran de post-production et la fenêtre
 *      pendant laquelle l'API déployée n'expose pas encore (1).
 */
async function resolveRenderedPlaybackUrl(contentId, ref) {
  const cacheKey = ref.jobId || ref.storageKey;
  const cached = renderedUrlCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const remember = (url) => {
    if (url && cacheKey) renderedUrlCache.set(cacheKey, { url, expiresAt: Date.now() + RENDERED_URL_TTL_MS });
    return url;
  };

  // 1) Route de lecture (élèves inclus) : l'API a déjà choisi le bon job et présigné.
  let firstError = null;
  try {
    const body = await courseBuilderApi.renderPlayback(contentId);
    const direct = String(body?.url || '').trim();
    if (isAbsoluteMediaUrl(direct)) return remember(direct);
  } catch (e) {
    firstError = e;
  }

  // 2) Repli encadrement : on refait le choix du job côté client.
  try {
    const body = await courseBuilderApi.renderStatus(contentId);
    const jobs = Array.isArray(body?.jobs) ? body.jobs : [];
    // a) Le job EXACT référencé par le contenu (id, sinon clé de stockage) : le contenu
    //    peut pointer un rendu volontairement plus ancien qu'un rendu plus récent.
    const exact =
      (ref.jobId && jobs.find((j) => String(j?.id) === ref.jobId)) ||
      (ref.storageKey && jobs.find((j) => renderJobStorageKey(j) === ref.storageKey)) ||
      null;
    // b) À défaut, le dernier rendu terminé qui expose une URL exploitable (l'API
    //    renvoie les jobs du plus récent au plus ancien).
    const latestDone = jobs.find((j) => String(j?.status) === 'completed' && renderJobPlayableUrl(j));
    const url = renderJobPlayableUrl(exact) || renderJobPlayableUrl(latestDone) || '';
    if (url) return remember(url);
  } catch (e) {
    firstError = firstError || e;
  }

  // Les deux routes ont échoué (et non « répondu sans URL ») : on le fait remonter pour
  // que l'appelant distingue « rendu pas encore prêt » de « lecture refusée/injoignable ».
  if (firstError) throw firstError;
  return '';
}

const VideoPlayer = forwardRef(({ video, onEnded, onTimeUpdate, overlay = null }, ref) => {
  const inferredType = useMemo(() => {
    // Le MONTAGE post-prod (MP4 rendu par le worker) PRIME sur la source brute :
    // c'est la version éditée que la classe doit voir. C'est un FICHIER MP4 → on le
    // joue dans la balise <video> native (timeline, chapitres, seekTo, SmartBoard
    // superposé) et surtout PAS dans une <iframe>, qui perdait tous ces contrôles.
    if (video?.renderedUrl || video?.renderedStorageKey || video?.renderedJobId) return 'file';
    if (video?.type) return video.type;
    if (video?.storagePath) return 'upload';
    const url = String(video?.url || '');
    if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube';
    if (/vimeo\.com/i.test(url)) return 'vimeo';
    if (url) return 'custom_url';
    return '';
  }, [video?.renderedJobId, video?.renderedStorageKey, video?.renderedUrl, video?.storagePath, video?.type, video?.url]);

  const videoRef = useRef(null);
  const lastResolvedKeyRef = useRef('');
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  // Amorce : UNIQUEMENT une valeur déjà absolue. Semer l'état avec `renderedUrl`
  // sans contrôle réinjectait la clé R2 brute dans <video src> le temps d'un rendu.
  const [playableUrl, setPlayableUrl] = useState(() => {
    const seed = video?.renderedUrl || video?.url || '';
    return isAbsoluteMediaUrl(seed) ? String(seed).trim() : '';
  });
  // Message français affiché À LA PLACE du lecteur quand le montage existe mais que
  // son lien de lecture n'a pas pu être obtenu (API refusée, rendu non présigné…).
  const [renderedNotice, setRenderedNotice] = useState('');
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
        setRenderedNotice('');
        return;
      }
      // Montage post-prod en priorité, puis storagePath (upload signé), puis url brute.
      const rendered = readRenderedRef(video);
      // `jobId` compte autant que la clé : il suffit à identifier le montage côté API.
      const hasRendered = Boolean(rendered.directUrl || rendered.storageKey || rendered.jobId);
      const storagePath = hasRendered ? null : video?.storagePath;
      const rawUrl = rendered.directUrl || video?.url || '';
      const cacheKey = storagePath
        ? `${inferredType}:${storagePath}`
        : `${inferredType}::${rendered.storageKey || rendered.jobId || rawUrl || ''}`;

      // Avoid resetting src when nothing meaningful changed.
      if (lastResolvedKeyRef.current === cacheKey) return;
      lastResolvedKeyRef.current = cacheKey;
      setRenderedNotice('');

      // ── MONTAGE post-production ─────────────────────────────────────────────
      if (hasRendered) {
        // REPLI de séance : si le montage reste irrésoluble, la classe doit AU MOINS
        // garder la vidéo d'origine. `fallbackUrl` = l'URL signée par l'API gatée que
        // CoursePlayerInterface dépose dans `renderedUrl` pour un contenu hébergé ; à
        // défaut, l'URL brute du contenu si elle est directement jouable. On EXCLUT
        // YouTube/Vimeo : ces pages ne se lisent pas dans une balise <video>.
        const candidate = String(rendered.fallbackUrl || video?.url || '').trim();
        const fallbackSource =
          isAbsoluteMediaUrl(candidate) && !/youtube\.com|youtu\.be|vimeo\.com/i.test(candidate)
            ? candidate
            : '';
        // RÉTRO-COMPAT : CoursePlayerInterface passe déjà, pour une vidéo hébergée,
        // une URL signée côté serveur via `renderedUrl`. Absolue → on n'y touche pas.
        if (rendered.directUrl) {
          setPlayableUrl(rendered.directUrl);
          return;
        }
        // Sinon c'est une CLÉ R2 : elle doit être présignée par l'API, jamais servie
        // telle quelle. Il faut l'identifiant du contenu (formation_day_contents.id)
        // pour retrouver le job de rendu correspondant.
        const contentId = String(video?.contentId || video?.id || '').trim();
        if (!UUID_RE.test(contentId)) {
          if (fallbackSource) {
            setPlayableUrl(fallbackSource);
            return;
          }
          setPlayableUrl('');
          setRenderedNotice("Le montage de ce cours est archivé, mais l'identifiant du contenu manque pour en obtenir le lien de lecture.");
          return;
        }
        try {
          const resolved = await resolveRenderedPlaybackUrl(contentId, rendered);
          if (!alive) return;
          if (resolved) {
            setPlayableUrl(resolved);
          } else if (fallbackSource) {
            // Rendu pas encore délivré : la version NON montée vaut mieux qu'un écran vide.
            setPlayableUrl(fallbackSource);
          } else {
            setPlayableUrl('');
            setRenderedNotice("Le montage est bien archivé, mais son lien de lecture n'a pas encore été délivré. Réessaie dans un instant.");
          }
        } catch {
          if (!alive) return;
          // Refus ou API injoignable : on NE retombe JAMAIS sur la clé brute (elle
          // chargerait l'application elle-même dans le lecteur). On sert la source si on
          // en a une, sinon on explique — message FIXE et en français, le texte remonté
          // par l'API (« Forbidden resource »…) n'a aucun sens pour un élève en classe.
          if (fallbackSource) {
            setPlayableUrl(fallbackSource);
            return;
          }
          setPlayableUrl('');
          setRenderedNotice(
            "Lecture du montage indisponible pour le moment. Réessaie dans un instant, ou préviens l'encadrement si cela persiste.",
          );
        }
        return;
      }

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
    // `video?.id` / `video?.contentId` font partie des dépendances : c'est la clé qui
    // permet de présigner le montage, sa disparition change le résultat de l'effet.
  }, [
    inferredType,
    video?.contentId,
    video?.id,
    video?.renderedJobId,
    video?.renderedStorageKey,
    video?.renderedUrl,
    video?.storagePath,
    video?.url,
  ]);

  // Render based on type
  if (!video) {
    return (
      <div className="aspect-video bg-[#262624] flex items-center justify-center text-[#b0ada3] border border-white/10 rounded-lg">
        Vidéo indisponible
      </div>
    );
  }

  // Le montage existe mais n'est pas lisible : on explique, en français et en palette
  // chaude, plutôt que de laisser un lecteur noir sans aucune indication.
  if (renderedNotice && !playableUrl) {
    return (
      <div className="aspect-video w-full rounded-lg border border-[#d97757]/45 bg-[#262624] flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#e08a6b]">Montage indisponible</p>
          <p className="mt-2 text-sm text-[#f5f4ee]">{renderedNotice}</p>
        </div>
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
        <div className="absolute bottom-2 left-2 right-2 text-[10px] text-[#f5f4ee] bg-black/60 border border-white/10 rounded px-2 py-1">
          Navigation précise (timeline) disponible sur les vidéos uploadées.
        </div>
      </div>
    );
  }

  if (inferredType === 'upload' || inferredType === 'file') {
    // Lecteur HTML5 natif : c'est ici que passe aussi le MONTAGE post-prod (MP4 R2
    // présigné plus haut), ce qui lui rend la timeline, les chapitres et le SmartBoard.
    // Fonds en palette chaude LIRI (#262624 / #1f1e1c) — plus aucun bleu-nuit.
    return (
      <div className="relative group bg-[#262624] overflow-hidden">
        <div className="relative">
          {/* Voile retiré dès que la vidéo peut jouer — couvre le gris natif Chrome pendant le chargement */}
          {!videoCanPlay && (
            <div className="absolute inset-0 z-10 pointer-events-none" style={{ background: '#262624' }} />
          )}
          <video
            ref={videoRef}
            src={playableUrl}
            poster="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAABjE+ibYAAAAASUVORK5CYII="
            className="w-full aspect-video block"
            style={{ background: '#262624' }}
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

        <div className="px-3 py-2 bg-[#1f1e1c] border-t border-white/10">
          <div className="flex items-center justify-between text-xs text-[#f5f4ee] mb-2">
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
              <div className="px-3 py-2 text-xs text-[#b0ada3] bg-black/30 border-b border-white/10">Horodatages</div>
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
                    <div className="text-sm text-[#f5f4ee] truncate">{c.label}</div>
                    <div className="text-xs text-[#b0ada3] shrink-0">{formatTime(c.timeSeconds)}</div>
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
    <div className="aspect-video bg-[#262624] flex items-center justify-center text-[#b0ada3] border border-white/10 rounded-lg">
      Format vidéo non supporté
    </div>
  );
});

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;