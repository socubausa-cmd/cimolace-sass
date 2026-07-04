/**
 * useMicProcessor — Micro LiveKit + moteur LIRI Audio (Web Audio API)
 *
 * - Mode `off` : chaîne légère (gain ± réduction bruit) comme avant
 * - Modes LIRI : pipeline structuré (HPF → EQ → comp → limiteur ; réverb en « Chant »)
 */
import { useEffect, useRef } from 'react';
import { Track, ConnectionState } from 'livekit-client';
import { buildLiriProcessingGraph, getLiriMicConstraints } from '@/lib/liriAudioEngine/buildProcessingGraph';

/**
 * @param {React.MutableRefObject<import('livekit-client').Room | null>} roomRef
 * @param {object} opts
 * @param {number} opts.micGain
 * @param {boolean} opts.noiseReduction
 * @param {string} [opts.activeAudioId]
 * @param {string} [opts.liriMode='off'] off | speech | multi | music | sing
 * @param {number} [opts.liriClarity]
 * @param {number} [opts.liriReverb]
 * @param {number} [opts.liriCompression]
 * @param {number} [opts.liriGate]
 * @param {number} [opts.liriLimiter]
 * @param {(levels: { in: number, out: number, clip: boolean }) => void} [opts.onLevels]
 */
export function useMicProcessor(roomRef, opts = {}) {
  const {
    micOn = true,
    micGain,
    noiseReduction,
    activeAudioId,
    liriMode = 'off',
    liriClarity = 55,
    liriReverb = 12,
    liriCompression = 58,
    liriGate = 35,
    liriLimiter = 72,
    onLevels,
  } = opts;

  // Dernière valeur de micOn lisible depuis les cleanups (mise à jour au render) —
  // pour ne JAMAIS ré-ouvrir le micro SDK d'un hôte qui l'avait coupé.
  const micOnRef = useRef(micOn);
  micOnRef.current = micOn;

  const onLevelsRef = useRef(onLevels);
  useEffect(() => {
    onLevelsRef.current = onLevels;
  }, [onLevels]);

  const gainNodeRef = useRef(null);
  const liriOutGainRef = useRef(null);
  const audioCtxRef = useRef(null);
  const processedTrackRef = useRef(null);
  const rawStreamRef = useRef(null);
  const levelsRafRef = useRef(null);
  const inputAnRef = useRef(null);
  const outputAnRef = useRef(null);

  const useLiriChain = liriMode && liriMode !== 'off';
  // P0 : la chaîne traitée ne se publie QUE micro ouvert — régler le moteur audio
  // micro coupé ne doit jamais mettre la voix de l'hôte à l'antenne.
  const needsProcessing = (useLiriChain || micGain !== 100 || noiseReduction) && micOn;

  useEffect(() => {
    if (gainNodeRef.current && audioCtxRef.current && !useLiriChain) {
      gainNodeRef.current.gain.setTargetAtTime(micGain / 100, audioCtxRef.current.currentTime, 0.05);
    }
    if (liriOutGainRef.current && audioCtxRef.current && useLiriChain) {
      liriOutGainRef.current.gain.setTargetAtTime(
        Math.max(0, Math.min(2, micGain / 100)),
        audioCtxRef.current.currentTime,
        0.05,
      );
    }
  }, [micGain, useLiriChain]);

  useEffect(() => {
    if (!needsProcessing) return;

    let cancelled = false;

    async function start() {
      const room = roomRef.current;
      if (!room || room.state !== ConnectionState.Connected) return;

      await room.localParticipant.setMicrophoneEnabled(false).catch(() => {});
      if (cancelled) return;

      const constraints = useLiriChain
        ? getLiriMicConstraints(liriMode, noiseReduction, activeAudioId)
        : {
            audio: {
              noiseSuppression: noiseReduction,
              echoCancellation: noiseReduction,
              autoGainControl: false,
              ...(activeAudioId ? { deviceId: { exact: activeAudioId } } : {}),
            },
          };

      let rawStream;
      try {
        rawStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch {
        try {
          rawStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (e) {
          console.warn('[MicP] getUserMedia failed:', e?.message);
          await room.localParticipant.setMicrophoneEnabled(Boolean(micOnRef.current)).catch(() => {});
          return;
        }
      }
      if (cancelled) {
        rawStream.getTracks().forEach((t) => t.stop());
        return;
      }
      rawStreamRef.current = rawStream;

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      await audioCtx.resume().catch(() => {});

      if (useLiriChain) {
        const graph = buildLiriProcessingGraph(audioCtx, rawStream, {
          mode: liriMode,
          micGainPct: micGain,
          clarity: liriClarity,
          reverb: liriReverb,
          compression: liriCompression,
          gate: liriGate,
          limiter: liriLimiter,
        });
        liriOutGainRef.current = graph.nodes.outGain;
        inputAnRef.current = graph.inputAnalyser;
        outputAnRef.current = graph.outputAnalyser;
        processedTrackRef.current = graph.destinationStream.getAudioTracks()[0];

        const sample = () => {
          if (cancelled) return;
          const ia = inputAnRef.current;
          const oa = outputAnRef.current;
          if (!ia || !oa) {
            levelsRafRef.current = requestAnimationFrame(sample);
            return;
          }
          const bufIn = new Uint8Array(ia.frequencyBinCount);
          const bufOut = new Uint8Array(oa.frequencyBinCount);
          ia.getByteFrequencyData(bufIn);
          oa.getByteFrequencyData(bufOut);
          const avg = (buf) => buf.reduce((a, b) => a + b, 0) / (buf.length * 255) || 0;
          const vin = avg(bufIn);
          const vout = avg(bufOut);
          const clip = vout > 0.92;
          onLevelsRef.current?.({ in: vin, out: vout, clip });
          levelsRafRef.current = requestAnimationFrame(sample);
        };
        levelsRafRef.current = requestAnimationFrame(sample);
      } else {
        const source = audioCtx.createMediaStreamSource(rawStream);
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = micGain / 100;
        gainNodeRef.current = gainNode;
        const dest = audioCtx.createMediaStreamDestination();
        source.connect(gainNode);
        gainNode.connect(dest);
        processedTrackRef.current = dest.stream.getAudioTracks()[0];
        liriOutGainRef.current = null;
        inputAnRef.current = null;
        outputAnRef.current = null;
      }

      try {
        await room.localParticipant.publishTrack(processedTrackRef.current, {
          source: Track.Source.Microphone,
        });
      } catch (e) {
        console.warn('[MicP] publishTrack:', e?.message);
      }
    }

    start().catch((e) => console.warn('[MicP] start:', e?.message));

    return () => {
      cancelled = true;
      if (levelsRafRef.current) {
        cancelAnimationFrame(levelsRafRef.current);
        levelsRafRef.current = null;
      }
      (async () => {
        const room = roomRef.current;
        if (processedTrackRef.current) {
          try {
            if (room) await room.localParticipant.unpublishTrack(processedTrackRef.current);
            processedTrackRef.current.stop();
          } catch {}
          processedTrackRef.current = null;
        }
        rawStreamRef.current?.getTracks().forEach((t) => t.stop());
        rawStreamRef.current = null;
        if (audioCtxRef.current) {
          audioCtxRef.current.close().catch(() => {});
          audioCtxRef.current = null;
        }
        gainNodeRef.current = null;
        liriOutGainRef.current = null;
        inputAnRef.current = null;
        outputAnRef.current = null;
        if (room && room.state === ConnectionState.Connected) {
          // Restaure l'état VOULU du micro (pas un unmute aveugle).
          room.localParticipant.setMicrophoneEnabled(Boolean(micOnRef.current)).catch(() => {});
        }
      })();
    };
  }, [
    needsProcessing,
    noiseReduction,
    useLiriChain,
    liriMode,
    liriClarity,
    liriReverb,
    liriCompression,
    liriGate,
    liriLimiter,
    activeAudioId,
  ]);
}
