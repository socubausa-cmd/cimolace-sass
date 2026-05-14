/**
 * Moteur NLE — modèle de projet (pistes vidéo/audio, clips, transitions, marqueurs, mixage).
 * Sérialisable dans `formation_day_contents.data.nleProject`.
 */

export const NLE_ENGINE_VERSION = 1;

/** @returns {import('./nleProjectTypes').NleTransition} */
export function cutTransition() {
  return { type: 'cut', durationSec: 0 };
}

/** @returns {import('./nleProjectTypes').NleTransition} */
export function crossfadeTransition(durationSec = 0.4) {
  return { type: 'crossfade', durationSec: Math.max(0, Number(durationSec) || 0) };
}

/** @returns {import('./nleProjectTypes').NleTransition} */
export function dipToBlackTransition(durationSec = 0.4) {
  return { type: 'dip_to_black', durationSec: Math.max(0, Number(durationSec) || 0) };
}

/**
 * @param {Partial<import('./nleProjectTypes').NleClip> & { id?: string }} partial
 * @returns {import('./nleProjectTypes').NleClip}
 */
export function createClip(partial = {}) {
  const id = partial.id || `clip-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return {
    id,
    label: String(partial.label || 'Clip'),
    sourceType: partial.sourceType || 'primary_video',
    sourceRef: partial.sourceRef != null ? String(partial.sourceRef) : '',
    startOnTimeline: Math.max(0, Number(partial.startOnTimeline) || 0),
    duration: Math.max(0.05, Number(partial.duration) || 1),
    trimIn: Math.max(0, Number(partial.trimIn) || 0),
    trimOut: Math.max(0, Number(partial.trimOut) || 0),
    opacity: partial.opacity != null ? Math.max(0, Math.min(1, Number(partial.opacity))) : 1,
    volume: partial.volume != null ? Math.max(0, Math.min(2, Number(partial.volume))) : 1,
    effects: Array.isArray(partial.effects) ? partial.effects : [],
    transitionIn: partial.transitionIn || cutTransition(),
    transitionOut: partial.transitionOut || cutTransition(),
  };
}

/**
 * @returns {import('./nleProjectTypes').NleProject}
 */
export function createEmptyNleProject() {
  return {
    version: NLE_ENGINE_VERSION,
    name: 'Montage',
    frameRate: 30,
    timebase: 'seconds',
    duration: 0,
    tracks: [
      {
        id: 'v1',
        type: 'video',
        lane: 0,
        name: 'Caméra / source',
        muted: false,
        locked: false,
        solo: false,
        clips: [],
      },
      {
        id: 'v2',
        type: 'video',
        lane: 1,
        name: 'Slides & incrustations',
        muted: false,
        locked: false,
        solo: false,
        clips: [],
      },
      {
        id: 'a1',
        type: 'audio',
        lane: 0,
        name: 'Audio',
        muted: false,
        locked: false,
        solo: false,
        clips: [],
      },
    ],
    markers: [],
    master: {
      colorGrade: {
        exposure: 0,
        contrast: 100,
        saturation: 100,
        warmth: 0,
      },
    },
    mix: {
      masterVolumeDb: 0,
    },
  };
}

/**
 * @param {unknown} raw
 * @returns {import('./nleProjectTypes').NleProject}
 */
export function parseNleProject(raw) {
  const base = createEmptyNleProject();
  if (!raw || typeof raw !== 'object') return base;
  const o = /** @type {Record<string, unknown>} */ (raw);
  if (Number(o.version) === NLE_ENGINE_VERSION || o.version == null) {
    base.name = typeof o.name === 'string' ? o.name : base.name;
    base.frameRate = Number.isFinite(Number(o.frameRate)) ? Math.max(1, Number(o.frameRate)) : base.frameRate;
    base.duration = Math.max(0, Number(o.duration) || 0);
    if (Array.isArray(o.tracks) && o.tracks.length) {
      base.tracks = o.tracks.map((t, i) => normalizeTrack(t, i)).filter(Boolean);
    }
    if (Array.isArray(o.markers)) {
      base.markers = o.markers
        .map((m) => {
          if (!m || typeof m !== 'object') return null;
          const x = /** @type {Record<string, unknown>} */ (m);
          return {
            id: String(x.id || `m-${Math.random()}`),
            timeSec: Math.max(0, Number(x.timeSec) || 0),
            label: String(x.label || ''),
            color: typeof x.color === 'string' ? x.color : undefined,
          };
        })
        .filter(Boolean);
    }
    if (o.master && typeof o.master === 'object') {
      const mg = /** @type {Record<string, unknown>} */ (o.master).colorGrade;
      if (mg && typeof mg === 'object') {
        const g = /** @type {Record<string, unknown>} */ (mg);
        base.master.colorGrade = {
          exposure: Math.max(-100, Math.min(100, Number(g.exposure) || 0)),
          contrast: Math.max(0, Math.min(200, Number(g.contrast) ?? 100)),
          saturation: Math.max(0, Math.min(200, Number(g.saturation) ?? 100)),
          warmth: Math.max(-100, Math.min(100, Number(g.warmth) || 0)),
        };
      }
    }
    if (o.mix && typeof o.mix === 'object') {
      const mx = /** @type {Record<string, unknown>} */ (o.mix);
      base.mix.masterVolumeDb = Math.max(-96, Math.min(12, Number(mx.masterVolumeDb) || 0));
    }
  }
  return base;
}

/**
 * @param {unknown} t
 * @param {number} fallbackIndex
 */
function normalizeTrack(t, fallbackIndex) {
  if (!t || typeof t !== 'object') return null;
  const x = /** @type {Record<string, unknown>} */ (t);
  const clips = Array.isArray(x.clips)
    ? x.clips.map((c) => (c && typeof c === 'object' ? createClip({ .../** @type {object} */ (c) }) : null)).filter(Boolean)
    : [];
  return {
    id: String(x.id || `track-${fallbackIndex}`),
    type: x.type === 'audio' ? 'audio' : 'video',
    lane: Number.isFinite(Number(x.lane)) ? Number(x.lane) : fallbackIndex,
    name: String(x.name || `Piste ${fallbackIndex + 1}`),
    muted: Boolean(x.muted),
    locked: Boolean(x.locked),
    solo: Boolean(x.solo),
    clips,
  };
}

/**
 * @param {import('./nleProjectTypes').NleProject} project
 * @param {Array<{ startText?: string; endText?: string; label?: string }>} chapters
 * @param {number} durationFallback
 */
export function syncVideoTrackFromChapters(project, chapters, durationFallback = 600) {
  const next = /** @type {import('./nleProjectTypes').NleProject} */ (
    JSON.parse(JSON.stringify(project))
  );
  const v1 = next.tracks.find((tr) => tr.id === 'v1');
  if (!v1) return next;

  const parse = (txt) => {
    const v = String(txt || '').trim();
    if (!v) return null;
    const m = /^(\d+):(\d{1,2})$/.exec(v);
    if (m) return Number(m[1]) * 60 + Number(m[2]);
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const clips = [];
  let maxEnd = 0;
  (chapters || []).forEach((ch, idx) => {
    const start = parse(ch?.startText);
    const end = parse(ch?.endText);
    if (start == null || end == null || end <= start) return;
    const dur = end - start;
    maxEnd = Math.max(maxEnd, end);
    clips.push(
      createClip({
        label: String(ch?.label || '').trim() || `Chapitre ${idx + 1}`,
        sourceType: 'primary_video',
        sourceRef: 'main',
        startOnTimeline: start,
        duration: dur,
        trimIn: start,
        trimOut: end,
      })
    );
  });

  v1.clips = clips.sort((a, b) => a.startOnTimeline - b.startOnTimeline);
  next.duration = Math.max(durationFallback, maxEnd, next.duration || 0);
  return next;
}

/**
 * @param {import('./nleProjectTypes').NleProject} project
 */
export function recomputeDuration(project) {
  let d = 0;
  for (const tr of project.tracks) {
    for (const c of tr.clips) {
      d = Math.max(d, c.startOnTimeline + c.duration);
    }
  }
  project.duration = d;
  return project;
}
