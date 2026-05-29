/**
 * useSegmentedVideo
 * Real-time person/background segmentation using MediaPipe Selfie Segmentation.
 * The WASM models are loaded from the jsDelivr CDN to avoid bundling them.
 *
 * Usage:
 *   const canvasRef = useRef(null);
 *   useSegmentedVideo({ videoRef, canvasRef, blur, beauty, vbg, active });
 *   // Then render <canvas ref={canvasRef}> instead of the <video> when active
 */

import { useEffect, useRef, useState } from 'react';

/** Même version que package.json — fichiers wasm / .tflite alignés avec le JS bundlé */
const CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1.1675465747';

/** Dégradés pour préréglages messagerie + Arena (LiveStudioSettingsPanel). */
const VBG_COLORS = {
  studio: ['#0f1419', '#1a2d4a'],
  space: ['#0b0b2b', '#1a0a3a'],
  nature: ['#0a2a0a', '#1a4a1a'],
  beach: ['#1a3a5a', '#4a8a6a'],
  /** Bureau — neutre froid / vitré */
  office: ['#1a1f28', '#2d3a4a'],
  /** Bibliothèque — bois, papier */
  library: ['#1c1410', '#3d2e24'],
  /** Temple / pierre chaude */
  temple: ['#2a2216', '#4a3824'],
  /** Scène / projecteurs */
  stage: ['#0a0612', '#1f0a28'],
};

function isVbgCustomImageUrl(vbg) {
  if (typeof vbg !== 'string' || !vbg) return false;
  if (vbg === 'none' || vbg === 'blur' || vbg === 'immersive') return false;
  if (VBG_COLORS[vbg]) return false;
  return /^blob:|^https?:\/\/|^data:image\//i.test(vbg);
}

function drawImageCover(ctx, img, W, H) {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  if (!iw || !ih) return;
  const scale = Math.max(W / iw, H / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = (W - dw) / 2;
  const dy = (H - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
}

/**
 * Réduit le spill vert (fond vert / réflexions) sur les pixels déjà découpés par le masque.
 * N'agit que là où le vert domine nettement sur R et B — limite l'auréole cheveux / contours.
 * @param {ImageData} imageData
 * @param {number} strength 0.25–0.55 recommandé
 */
function applyGreenSpillRemovalToImageData(imageData, strength = 0.42) {
  const d = imageData.data;
  const s = Math.max(0.2, Math.min(0.6, strength));
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 12) continue;
    let r = d[i];
    let g = d[i + 1];
    let b = d[i + 2];
    const mb = r > b ? r : b;
    const excess = g - mb;
    if (excess < 20) continue;
    const k = Math.min(1, excess / 100) * s;
    const fix = excess * k;
    g = Math.max(0, Math.round(g - fix));
    r = Math.min(255, Math.round(r + fix * 0.48));
    b = Math.min(255, Math.round(b + fix * 0.48));
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
  }
}

export function useSegmentedVideo({ videoRef, canvasRef, blur, beauty, vbg, active }) {
  const [segmentationReady, setSegmentationReady] = useState(false);
  const [segmentationFailed, setSegmentationFailed] = useState(false);
  const [hasFrame, setHasFrame] = useState(false);

  // Use refs for mutable options so the segmentation loop picks up changes
  // without needing to restart the whole pipeline.
  const blurRef   = useRef(blur);
  const beautyRef = useRef(beauty);
  const vbgRef    = useRef(vbg);

  useEffect(() => { blurRef.current   = blur;   }, [blur]);
  useEffect(() => { beautyRef.current = beauty; }, [beauty]);
  useEffect(() => { vbgRef.current    = vbg;    }, [vbg]);

  /** Image de fond personnalisée (blob / data URL / http avec CORS si besoin). */
  const customBgRef = useRef({ img: null, url: null, failed: false });

  useEffect(() => {
    if (!isVbgCustomImageUrl(vbg)) {
      customBgRef.current = { img: null, url: null, failed: false };
      return undefined;
    }
    let cancelled = false;
    const urlToLoad = vbg;
    customBgRef.current = { img: null, url: urlToLoad, failed: false };

    const img = new Image();
    if (/^https?:\/\//i.test(urlToLoad)) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      if (cancelled || vbgRef.current !== urlToLoad) return;
      customBgRef.current = { img, url: urlToLoad, failed: false };
    };
    img.onerror = () => {
      if (cancelled || vbgRef.current !== urlToLoad) return;
      customBgRef.current = { img: null, url: urlToLoad, failed: true };
      console.warn('[useSegmentedVideo] Fond image introuvable ou CORS refusé:', urlToLoad.slice(0, 80));
    };
    img.src = urlToLoad;

    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
      img.removeAttribute('src');
    };
  }, [vbg]);

  useEffect(() => {
    if (!active) return;

    let destroyed = false;
    let rafId = null;
    let seg = null;
    let gotFirstFrame = false;
    setSegmentationReady(false);
    setSegmentationFailed(false);
    setHasFrame(false);

    const init = async () => {
      try {
        // Package ships an IIFE that registers on globalThis; Vite may not re-export the class.
        await import('@mediapipe/selfie_segmentation');
        if (destroyed) return;

        const SelfieSegmentation =
          typeof globalThis.SelfieSegmentation === 'function'
            ? globalThis.SelfieSegmentation
            : null;
        if (!SelfieSegmentation) {
          throw new Error('SelfieSegmentation not available after mediapipe load');
        }

        seg = new SelfieSegmentation({
          locateFile: (file) => `${CDN}/${file}`,
        });
        setSegmentationReady(true);

        // modelSelection 1 = "Landscape" model — higher quality, good for webcams
        seg.setOptions({ modelSelection: 1, selfieMode: true });

        seg.onResults((results) => {
          if (destroyed) return;
          const canvas = canvasRef.current;
          const video  = videoRef.current;
          if (!canvas || !video) return;

          const ctx = canvas.getContext('2d');
          const W   = video.videoWidth  || canvas.offsetWidth  || 640;
          const H   = video.videoHeight || canvas.offsetHeight || 360;

          if (canvas.width !== W)  canvas.width  = W;
          if (canvas.height !== H) canvas.height = H;

          const currentBlur   = blurRef.current;
          const currentBeauty = beautyRef.current;
          const currentVbg    = vbgRef.current;

          ctx.clearRect(0, 0, W, H);

          // ── 1. Draw background ────────────────────────────────────────────
          if (currentBlur || currentVbg === 'blur') {
            // Flou arrière-plan (bouton dédié OU préréglage « Flou » du fond virtuel)
            ctx.save();
            ctx.filter = 'blur(22px) saturate(1.08)';
            ctx.drawImage(results.image, -18, -18, W + 36, H + 36);
            ctx.restore();
          } else if (currentVbg !== 'none' && currentVbg !== 'blur' && currentVbg !== 'immersive' && VBG_COLORS[currentVbg]) {
            const [c1, c2] = VBG_COLORS[currentVbg];
            const grad = ctx.createLinearGradient(0, 0, W, H);
            grad.addColorStop(0, c1);
            grad.addColorStop(1, c2);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);
          } else if (isVbgCustomImageUrl(currentVbg)) {
            const bg = customBgRef.current;
            const img = bg?.img;
            if (img && img.complete && img.naturalWidth > 0 && bg.url === currentVbg && !bg.failed) {
              drawImageCover(ctx, img, W, H);
            } else {
              ctx.fillStyle = bg?.failed ? '#1a1520' : '#0a0e14';
              ctx.fillRect(0, 0, W, H);
            }
          }
          // immersive : pas de remplissage — le canvas reste transparent sous la silhouette

          // ── 2. Build person layer (segmented foreground) ─────────────────
          // We draw the video frame on a temp canvas, then mask it using the
          // segmentation mask (white = person, black = background).
          const tmp    = document.createElement('canvas');
          tmp.width    = W;
          tmp.height   = H;
          const tc     = tmp.getContext('2d');

          // Optional beauty/skin filter on the person only
          if (currentBeauty) {
            tc.filter = 'saturate(1.32) brightness(1.12) contrast(0.9)';
          }
          tc.drawImage(results.image, 0, 0, W, H);
          tc.filter = 'none';

          // Mask: keep pixels where the segmentation mask is white (person)
          tc.globalCompositeOperation = 'destination-in';
          tc.drawImage(results.segmentationMask, 0, 0, W, H);

          // Spill vert (studio / mur vert) : l'IA garde ces pixels comme « personne » — on atténue G en post.
          tc.globalCompositeOperation = 'source-over';
          try {
            const id = tc.getImageData(0, 0, W, H);
            applyGreenSpillRemovalToImageData(id, 0.42);
            tc.putImageData(id, 0, 0);
          } catch {
            /* getImageData peut échouer (tainted canvas) — rare ici */
          }

          // ── 3. Composite person over background ───────────────────────────
          ctx.globalCompositeOperation = 'source-over';
          ctx.drawImage(tmp, 0, 0);

          if (!gotFirstFrame) {
            gotFirstFrame = true;
            setHasFrame(true);
          }
        });

        // ── Animation loop ────────────────────────────────────────────────
        const loop = async () => {
          if (destroyed) return;
          const video = videoRef.current;
          if (video && video.readyState >= 2 && !video.paused) {
            try {
              await seg.send({ image: video });
            } catch {
              // Frame skipped — not fatal
            }
          }
          rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);
      } catch (err) {
        // MediaPipe failed to load (no network, blocked CDN, etc.)
        console.warn('[useSegmentedVideo] MediaPipe load failed:', err);
        setSegmentationFailed(true);
      }
    };

    init();

    return () => {
      destroyed = true;
      cancelAnimationFrame(rafId);
      seg?.close?.();
      seg = null;
    };
  }, [active, videoRef, canvasRef]);

  useEffect(() => {
    if (!active) return undefined;
    const resumeVideo = () => {
      const video = videoRef.current;
      if (!video) return;
      video.play?.().catch(() => {});
    };
    window.addEventListener('focus', resumeVideo);
    window.addEventListener('pageshow', resumeVideo);
    document.addEventListener('visibilitychange', resumeVideo);
    return () => {
      window.removeEventListener('focus', resumeVideo);
      window.removeEventListener('pageshow', resumeVideo);
      document.removeEventListener('visibilitychange', resumeVideo);
    };
  }, [active, videoRef]);

  return {
    segmentationReady,
    segmentationFailed,
    hasFrame,
  };
}
