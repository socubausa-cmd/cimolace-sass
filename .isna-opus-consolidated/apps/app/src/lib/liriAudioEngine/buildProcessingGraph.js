/**
 * Construit la chaîne Web Audio LIRI (un micro → MediaStreamDestination).
 * Réduit clics / saturation via compresseur + limiteur, modes adaptés au contenu.
 */

/** @param {AudioContext} ctx */
function makeReverbIR(ctx, durationSec = 2.1, decay = 2.4) {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * durationSec);
  const buf = ctx.createBuffer(2, len, rate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

/**
 * @param {object} p
 * @param {import('./constants.js').LiriAudioMode | string} p.mode
 * @param {number} p.micGainPct 0–200
 * @param {number} p.clarity 0–100
 * @param {number} p.reverb 0–100 wet
 * @param {number} p.compression 0–100
 * @param {number} p.gate 0–100
 * @param {number} p.limiter 0–100
 */
export function buildLiriProcessingGraph(audioCtx, mediaStream, p) {
  const mode = p.mode || 'speech';
  const gainLinear = Math.max(0, Math.min(2, (p.micGainPct ?? 100) / 100));

  const source = audioCtx.createMediaStreamSource(mediaStream);
  const dest = audioCtx.createMediaStreamDestination();

  const inputAnalyser = audioCtx.createAnalyser();
  inputAnalyser.fftSize = 512;
  inputAnalyser.smoothingTimeConstant = 0.65;

  const outputAnalyser = audioCtx.createAnalyser();
  outputAnalyser.fftSize = 512;
  outputAnalyser.smoothingTimeConstant = 0.75;

  const highpass = audioCtx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = mode === 'music' ? 35 : 70 + (p.gate ?? 35) * 0.15;

  const peakClarity = audioCtx.createBiquadFilter();
  peakClarity.type = 'peaking';
  peakClarity.frequency.value = 3200;
  peakClarity.Q.value = 0.85;
  const clarityGainDb = -6 + ((p.clarity ?? 50) / 100) * 14;
  peakClarity.gain.value = mode === 'music' ? 0 : clarityGainDb;

  const comp = audioCtx.createDynamicsCompressor();
  const compAmt = (p.compression ?? 50) / 100;
  if (mode === 'multi') {
    comp.threshold.value = -22 - compAmt * 10;
    comp.knee.value = 12 + compAmt * 8;
    comp.ratio.value = 3 + compAmt * 4;
    comp.attack.value = 0.006;
    comp.release.value = 0.18;
  } else if (mode === 'sing') {
    comp.threshold.value = -26 - compAmt * 8;
    comp.knee.value = 18;
    comp.ratio.value = 2.5 + compAmt * 3;
    comp.attack.value = 0.012;
    comp.release.value = 0.22;
  } else {
    // speech / default
    comp.threshold.value = -24 - compAmt * 12;
    comp.knee.value = 14 + compAmt * 10;
    comp.ratio.value = 3.5 + compAmt * 5;
    comp.attack.value = 0.004;
    comp.release.value = 0.12;
  }

  const makeup = audioCtx.createGain();
  makeup.gain.value = 1 + compAmt * 0.08;

  const limiter = audioCtx.createDynamicsCompressor();
  const limAmt = (p.limiter ?? 70) / 100;
  limiter.threshold.value = mode === 'music' ? -4 - limAmt * 4 : -8 - limAmt * 6;
  limiter.knee.value = mode === 'music' ? 6 : 0;
  limiter.ratio.value = mode === 'music' ? 12 : 18;
  limiter.attack.value = 0.001;
  limiter.release.value = mode === 'music' ? 0.12 : 0.08;

  const outGain = audioCtx.createGain();
  outGain.gain.value = gainLinear;

  /** Branche dry/wet réverb (chant) */
  const dryGain = audioCtx.createGain();
  const wetGain = audioCtx.createGain();
  const convolver = audioCtx.createConvolver();
  convolver.buffer = makeReverbIR(audioCtx);
  const revMix = audioCtx.createGain();
  revMix.gain.value = 1;

  const wet = Math.max(0, Math.min(1, (p.reverb ?? 0) / 100));
  if (mode === 'sing') {
    dryGain.gain.value = 1 - wet * 0.45;
    wetGain.gain.value = wet * 0.5;
  } else {
    dryGain.gain.value = 1;
    wetGain.gain.value = 0;
  }

  // --- Wiring ---
  source.connect(inputAnalyser);

  if (mode === 'music') {
    // Musique : HPF très léger → gain → limiteur (pas de comp/EQ voix)
    source.connect(highpass);
    highpass.connect(outGain);
    outGain.connect(limiter);
    limiter.connect(outputAnalyser);
    limiter.connect(dest);
    return {
      destinationStream: dest.stream,
      inputAnalyser,
      outputAnalyser,
      nodes: { source, highpass, peakClarity: null, comp: null, makeup: null, limiter, outGain, convolver, dryGain, wetGain },
    };
  }

  source.connect(highpass);
  highpass.connect(peakClarity);
  peakClarity.connect(comp);
  comp.connect(makeup);
  makeup.connect(limiter);
  if (mode === 'sing' && wet > 0.02) {
    limiter.connect(dryGain);
    limiter.connect(convolver);
    convolver.connect(wetGain);
    dryGain.connect(revMix);
    wetGain.connect(revMix);
    revMix.connect(outGain);
  } else {
    limiter.connect(outGain);
  }

  outGain.connect(outputAnalyser);
  outGain.connect(dest);

  return {
    destinationStream: dest.stream,
    inputAnalyser,
    outputAnalyser,
    nodes: { source, highpass, peakClarity, comp, makeup, limiter, outGain, convolver, dryGain, wetGain },
  };
}

/**
 * Contraintes getUserMedia selon le mode (musique = pas de NR/AGC/echo si possible).
 */
export function getLiriMicConstraints(mode, noiseReduction, activeAudioId) {
  const base = activeAudioId ? { deviceId: { exact: activeAudioId } } : {};
  if (mode === 'music') {
    return {
      audio: {
        ...base,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    };
  }
  if (mode === 'sing') {
    return {
      audio: {
        ...base,
        echoCancellation: true,
        noiseSuppression: Boolean(noiseReduction),
        autoGainControl: false,
      },
    };
  }
  return {
    audio: {
      ...base,
      echoCancellation: true,
      noiseSuppression: Boolean(noiseReduction),
      autoGainControl: false,
    },
  };
}
