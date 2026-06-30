/**
 * useVideoProcessor — Canvas video processing pour LiveKit hôte
 *
 * Modes :
 *  - Chroma key (chromaKey=true, pas de seg) : suppression couleur par pixel via canvas 2D
 *  - Fond virtuel / flou (videoVbg!='none' ou videoBlur) : segmentation MediaPipe selfie
 *
 * Quand actif : publie un canvas captureStream(30) comme track Camera dans LiveKit.
 * Quand inactif : restaure la caméra d'origine.
 *
 * Paramètres fins (chromaColor, chromaSens) mis à jour via ref sans redémarrage.
 * Restart uniquement sur changement de mode (chroma ↔ segmentation) ou activation/désactivation.
 */
import { useEffect, useRef } from 'react';
import { Track, ConnectionState } from 'livekit-client';

const MEDIAPIPE_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1';

const VBG_URLS = {
  space:   'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1280&q=80',
  office:  'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1280&q=80',
  nature:  'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1280&q=80',
  library: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=1280&q=80',
  temple:  'https://images.unsplash.com/photo-1568377210220-5b5c25a3a0f4?w=1280&q=80',
  stage:   'https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=1280&q=80',
};

function chromaMatch(r, g, b, hex, threshold) {
  const tr = parseInt(hex.slice(1, 3), 16);
  const tg = parseInt(hex.slice(3, 5), 16);
  const tb = parseInt(hex.slice(5, 7), 16);
  return (r - tr) ** 2 + (g - tg) ** 2 + (b - tb) ** 2 < threshold * threshold;
}

const BEAUTY_FILTER = 'saturate(1.32) brightness(1.12) contrast(0.9)';

export function useVideoProcessor(roomRef, {
  chromaKey,
  chromaColor,
  chromaSens,
  videoVbg,
  videoBlur,
  customBgUrl,
  /** Maquillage (retouche) : filtre beauty sur la personne (seg) ou le cadre. */
  beauty,
  /** Optionnel : canvas de sortie (chroma / fond / flou) pour PiP SmartBoard — appelé avec `null` au nettoyage */
  onCanvasReady,
}) {
  // Ref toujours à jour — lue dans la boucle de rendu sans redémarrage
  const sRef = useRef({ chromaKey, chromaColor, chromaSens, videoVbg, videoBlur, customBgUrl, beauty });
  useEffect(() => {
    sRef.current = { chromaKey, chromaColor, chromaSens, videoVbg, videoBlur, customBgUrl, beauty };
  }, [chromaKey, chromaColor, chromaSens, videoVbg, videoBlur, customBgUrl, beauty]);

  // Cache image de fond — rechargé quand le preset VBG change
  const bgImgRef = useRef(null);
  useEffect(() => {
    const url =
      VBG_URLS[videoVbg] ??
      (videoVbg?.startsWith('blob:') ? videoVbg : null) ??
      (customBgUrl || null);
    if (!url) { bgImgRef.current = null; return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { bgImgRef.current = img; };
    img.onerror = () => { bgImgRef.current = null; };
    img.src = url;
  }, [videoVbg, customBgUrl]);

  const needsCanvas = chromaKey || (videoVbg && videoVbg !== 'none') || videoBlur || beauty;
  const needsSeg    = (videoVbg && videoVbg !== 'none') || videoBlur;

  useEffect(() => {
    if (!needsCanvas) return;

    let cancelled  = false;
    let animId     = null;
    let sending    = false;
    let hiddenVideo = null;
    let seg         = null;
    let canvasTrack = null;

    async function start() {
      const room = roomRef.current;
      if (!room || room.state !== ConnectionState.Connected) return;

      // Récupérer le track caméra brut LiveKit
      const camPub   = room.localParticipant.getTrackPublication(Track.Source.Camera);
      const rawTrack = camPub?.track?.mediaStreamTrack;
      if (!rawTrack) return;

      const { width = 640, height = 480 } = rawTrack.getSettings();

      // Vidéo cachée alimentée par le stream caméra d'origine
      hiddenVideo = document.createElement('video');
      Object.assign(hiddenVideo, { autoplay: true, muted: true, playsInline: true });
      Object.assign(hiddenVideo.style, {
        position: 'fixed', left: '-9999px', top: '-9999px', width: '1px', height: '1px',
      });
      hiddenVideo.srcObject = new MediaStream([rawTrack]);
      document.body.appendChild(hiddenVideo);
      await hiddenVideo.play().catch(() => {});

      // Canvas de sortie
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      onCanvasReady?.(canvas);

      // Canvas temporaire pour la composition du masque personne
      const tmp  = document.createElement('canvas');
      tmp.width  = width; tmp.height = height;
      const tCtx = tmp.getContext('2d');

      // Charger MediaPipe si on a besoin de segmentation
      if (needsSeg) {
        try {
          const { SelfieSegmentation } = await import('@mediapipe/selfie_segmentation');
          seg = new SelfieSegmentation({ locateFile: f => `${MEDIAPIPE_CDN}/${f}` });
          seg.setOptions({ modelSelection: 1, selfieMode: true });

          seg.onResults((res) => {
            if (cancelled) return;
            const s = sRef.current;
            ctx.clearRect(0, 0, width, height);

            // ── Couche arrière-plan ──────────────────────────────────────────
            if (s.videoBlur) {
              ctx.filter = 'blur(14px)';
              ctx.drawImage(res.image, 0, 0, width, height);
              ctx.filter = 'none';
            } else if (bgImgRef.current) {
              ctx.drawImage(bgImgRef.current, 0, 0, width, height);
            } else if (s.videoVbg === 'immersive') {
              const g = ctx.createLinearGradient(0, 0, width, height);
              g.addColorStop(0, 'rgba(212,175,55,0.4)');
              g.addColorStop(1, 'rgba(9,13,20,0.9)');
              ctx.fillStyle = g;
              ctx.fillRect(0, 0, width, height);
            } else {
              ctx.fillStyle = '#0d0f22';
              ctx.fillRect(0, 0, width, height);
            }

            // ── Couche personne via masque de segmentation ───────────────────
            tCtx.clearRect(0, 0, width, height);
            tCtx.filter = s.beauty ? BEAUTY_FILTER : 'none';
            tCtx.drawImage(res.image, 0, 0, width, height);
            tCtx.filter = 'none';
            tCtx.globalCompositeOperation = 'destination-in';
            tCtx.drawImage(res.segmentationMask, 0, 0, width, height);
            tCtx.globalCompositeOperation = 'source-over';
            ctx.drawImage(tmp, 0, 0, width, height);
          });

          await seg.initialize();
        } catch (e) {
          console.warn('[VP] MediaPipe init:', e?.message);
          seg = null;
        }
      }

      // Publier le stream canvas comme track Camera dans LiveKit
      const canvasStream = canvas.captureStream(30);
      canvasTrack = canvasStream.getVideoTracks()[0];
      try {
        await room.localParticipant.setCameraEnabled(false);
        await room.localParticipant.publishTrack(canvasTrack, {
          source: Track.Source.Camera,
          simulcast: false,
        });
      } catch (e) {
        console.warn('[VP] publishTrack:', e?.message);
      }

      // ── Boucle de rendu ────────────────────────────────────────────────────
      const loop = () => {
        if (cancelled) return;
        if (hiddenVideo.readyState >= 2) {
          if (seg) {
            // Mode segmentation : envoyer le frame et laisser onResults dessiner
            if (!sending) {
              sending = true;
              seg.send({ image: hiddenVideo })
                .then(() => { sending = false; })
                .catch(() => { sending = false; });
            }
          } else if (sRef.current.chromaKey) {
            // Chroma : remplacer la couleur clé par un fond opaque studio (WebRTC n'encode pas l'alpha —
            // l'ancien alpha=0 pouvait donner une image entièrement noire / invisible selon le pipeline).
            ctx.drawImage(hiddenVideo, 0, 0, width, height);
            const imgData = ctx.getImageData(0, 0, width, height);
            const d = imgData.data;
            const threshold = (sRef.current.chromaSens || 80) * 0.55;
            const color = sRef.current.chromaColor || '#00B140';
            const bgR = 13;
            const bgG = 15;
            const bgB = 34;
            for (let i = 0; i < d.length; i += 4) {
              if (chromaMatch(d[i], d[i + 1], d[i + 2], color, threshold)) {
                d[i] = bgR;
                d[i + 1] = bgG;
                d[i + 2] = bgB;
                d[i + 3] = 255;
              }
            }
            ctx.putImageData(imgData, 0, 0);
          } else {
            // Passthrough (maquillage seul, sans détourage) : filtre beauty sur le cadre.
            ctx.filter = sRef.current.beauty ? BEAUTY_FILTER : 'none';
            ctx.drawImage(hiddenVideo, 0, 0, width, height);
            ctx.filter = 'none';
          }
        }
        animId = requestAnimationFrame(loop);
      };
      loop();
    }

    start().catch(e => console.warn('[VP] start error:', e?.message));

    // ── Nettoyage ──────────────────────────────────────────────────────────
    return () => {
      cancelled = true;
      onCanvasReady?.(null);
      if (animId) cancelAnimationFrame(animId);
      if (hiddenVideo) { hiddenVideo.srcObject = null; hiddenVideo.remove(); }
      if (seg) { try { seg.close(); } catch {} }
      const room = roomRef.current;
      if (!room) return;
      (async () => {
        try {
          if (canvasTrack) {
            await room.localParticipant.unpublishTrack(canvasTrack);
            canvasTrack.stop();
          }
          if (room.state === ConnectionState.Connected) {
            await room.localParticipant.setCameraEnabled(true);
          }
        } catch (e) { console.warn('[VP] cleanup:', e?.message); }
      })();
    };
  // needsCanvas et needsSeg contrôlent le démarrage/arrêt/restart du pipeline
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsCanvas, needsSeg, onCanvasReady]);
}
