// Traducteur MONTAGE → FFmpeg. Fonctions PURES : aucun réseau, aucune base, aucun process.
// Entrée : le `nleProject` persisté dans `formation_day_contents.data.nleProject`
// (modèle : apps/app/src/lib/nleEngine/nleProjectModel.js) + ce que ffprobe a mesuré de la
// source. Sortie : un PLAN (segments datés) et les morceaux de filtergraph qui le réalisent.
//
// ── POURQUOI CE FICHIER EXISTE ────────────────────────────────────────────────
// Jusqu'ici le formateur coupait 3 min d'intro dans l'éditeur, posait un fondu, cliquait
// « Générer » — et recevait la source ENTIÈRE. `nleProject` n'était lu NULLE PART côté
// serveur : ni par l'API (enqueuePostprodRender ne le mettait pas dans la spec), ni par le
// worker (renderSplitScreen ne l'acceptait pas). Le fichier annoncé en commentaire dans
// applySegmentsFromNleV1Clips.js, `netlify/functions/_lib/nleProjectToFfmpeg.js`, n'a
// jamais existé dans le dépôt. C'est ce fichier-ci qui le remplace.
//
// ── LA RÈGLE QUI GOUVERNE TOUT LE FICHIER ────────────────────────────────────
// Une DIVERGENCE entre ce que l'éditeur montre et ce que le MP4 contient est PIRE que
// l'absence de montage : le formateur publie alors à sa classe une vidéo dont il n'a jamais
// vu le contenu. Donc, à chaque fois qu'un réglage n'est pas traduisible SANS INVENTER une
// intention, on ne le traduit pas, et on le DIT (tableau `notices`, remonté jusqu'à l'écran
// de post-production via la colonne `course_render_jobs.error`).
//
// ── CE QUI EST TRADUIT ────────────────────────────────────────────────────────
//   · coupes et trims           → trim / atrim + setpts / asetpts (pas de ré-encodage sélectif)
//   · enchaînement des clips    → concat (vidéo et audio, MÊME nombre de segments, même ordre)
//   · trous de la timeline      → segments NOIRS (un vide sur une piste NLE, c'est du noir)
//   · fondu au noir             → fade / afade (durée INCHANGÉE : aucun décalage d'horloge)
//   · opacité de clip           → mixage alpha sur fond noir (en RGBA, donc juste en couleur)
//   · volume de clip + master   → volume / volume=NdB
//
// ── CE QUI EST REFUSÉ, ET POURQUOI (rien n'est ignoré en silence) ─────────────
//   · FONDU ENCHAÎNÉ (crossfade) : xfade fait se CHEVAUCHER deux clips, donc il RACCOURCIT
//     la timeline de la durée du fondu (durée_totale ≠ somme des clips) et décale tout ce qui
//     suit. Or ici les clips portent une position ABSOLUE (`startOnTimeline`) que l'éditeur
//     dessine à l'écran : appliquer xfade ferait mentir le dessin ET le recalage des slides.
//     Le faire « proprement » exigerait de la matière AU-DELÀ du point de coupe (les
//     « poignées » des vraies stations de montage) — matière que `trimOut` interdit
//     justement de montrer. Verdict : la jonction est rendue en COUPE FRANCHE et on le dit.
//     (Conséquence heureuse : acrossfade, qui exige des flux audio valides des DEUX côtés et
//     casse dès qu'un clip est muet, n'a jamais à être émis.)
//   · CHANGEMENT DE VITESSE : quand `duration` (longueur du rectangle sur la timeline) et
//     `trimOut - trimIn` (longueur de matière) se contredisent, le modèle décrit un
//     ralenti/accéléré. Sur un cours PARLÉ, l'accélérer transpose la voix (atempo) : ce n'est
//     pas un réglage à appliquer au jugé. Verdict : le montage entier est REFUSÉ, avec le
//     numéro du clip fautif — c'est réparable en deux secondes dans l'éditeur.
//   · CLIPS QUI SE CHEVAUCHENT sur la piste v1 : deux clips revendiquent le même instant de
//     sortie et rien dans le modèle ne dit lequel gagne (les transitions sont des CHAMPS, pas
//     des recouvrements). Verdict : montage REFUSÉ (déplacer un clip est trivial ; publier
//     un cours amputé d'un passage ne l'est pas).
//   · MULTI-SOURCE (`sourceRef` pointant un autre fichier) : le worker ne télécharge QU'UNE
//     source. Ne rendre que les clips de la source principale amputerait le cours en silence.
//     Verdict : montage REFUSÉ.
//   · ÉTALONNAGE (`master.colorGrade`) : l'aperçu l'applique en filtre CSS
//     (`buildPreviewFilterFromNle` : brightness/contrast/saturate/sepia/hue-rotate). Les
//     équivalents ffmpeg (`eq`, `colorchannelmixer`) n'ont NI les mêmes unités NI le même
//     espace de couleur : « reproduire à peu près » donnerait deux images différentes à
//     l'écran et au rendu. Non traduit, signalé quand l'étalonnage n'est pas neutre.
//   · PISTES v2 / a1, `effects[]`, `markers`, `frameRate` du projet : le diaporama vient de
//     `renderSlideFrames` (traduire v2 poserait les slides DEUX fois), rien n'écrit
//     `effects[]` dans l'éditeur, les marqueurs n'ont pas de rendu vidéo, et la cadence de
//     sortie est celle mesurée sur la SOURCE (comportement existant, à ne pas régresser).
//     Non traduits ; signalés s'ils portent quelque chose.

/** Tolérance temporelle générale (s). Alignée sur le plancher de durée d'un clip du modèle. */
export const MONTAGE_EPSILON = 0.05;

/** En dessous de cette durée un segment ne vaut même pas une image → il n'est pas émis. */
const MIN_SEGMENT_SECONDS = 0.04;

/** `sourceRef` acceptés comme désignant LA source du job (cf. syncVideoTrackFromChapters → 'main'). */
const PRIMARY_SOURCE_REFS = new Set(['', 'main', 'source', 'primary', '0', 'principal']);

/** Arrondi d'affichage dans le filtergraph — 1 ms, très en dessous d'une image à 60 fps. */
const fmt = (n) => (Math.round(Number(n) * 1000) / 1000).toFixed(3);

/** libx264 + yuv420p exigent des dimensions PAIRES (port local du garde-fou de courseRender). */
function even(n) {
  const v = Math.floor(Number(n) || 0);
  return Math.max(2, v - (v % 2));
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : NaN);

/**
 * Clips « source principale » de la piste v1, ou null si le projet n'en porte pas.
 * MÊME lecture que applySegmentsFromNleV1Clips côté app (piste id 'v1', défaut de
 * `sourceType` à 'primary_video') — les deux doivent voir exactement les mêmes clips.
 */
function readV1PrimaryClips(nleProject) {
  if (!nleProject || typeof nleProject !== 'object') return null;
  const tracks = nleProject.tracks;
  if (!Array.isArray(tracks)) return null;
  const v1 = tracks.find((t) => t && typeof t === 'object' && t.id === 'v1');
  if (!v1 || typeof v1 !== 'object') return null;
  const clips = Array.isArray(v1.clips) ? v1.clips : [];
  const primary = clips.filter(
    (c) => c && typeof c === 'object' && String(c.sourceType || 'primary_video') === 'primary_video',
  );
  return primary.length ? primary : null;
}

/** Un plan « on ne touche à rien » — le chemin de rendu reste EXACTEMENT celui d'aujourd'hui. */
function inertPlan(reason, notices = []) {
  return {
    applied: false,
    reason,
    notices,
    timelineDuration: 0,
    segments: [],
    ranges: [],
    hasFades: false,
    hasOpacity: false,
    hasVolume: false,
    masterVolumeDb: 0,
  };
}

/**
 * Traduit `nleProject` en PLAN de segments consécutifs couvrant [0, timelineDuration].
 *
 * Le plan est la SEULE autorité sur le nouvel axe de temps : ses positions sont les sommes
 * cumulées des durées de segments, c'est-à-dire EXACTEMENT ce que produira `concat`. On ne
 * fait donc jamais confiance à `startOnTimeline` pour dater la sortie — on s'en sert pour
 * ORDONNER et pour mesurer les trous, puis on recalcule. Sans cela, un trou d'un dixième
 * d'image abandonné ici décalerait toutes les slides de la même quantité, en silence.
 *
 * @param {unknown} nleProject
 * @param {{ sourceDuration?: number, sourceMeasured?: boolean }} [options]
 * @returns {{
 *   applied: boolean, reason: string, notices: string[], timelineDuration: number,
 *   segments: Array<{kind:'clip'|'black', duration:number, timelineStart:number, timelineEnd:number,
 *                    sourceStart?:number, sourceEnd?:number, opacity:number, volume:number,
 *                    fadeIn:number, fadeOut:number, label:string}>,
 *   ranges: Array<{sourceStart:number, sourceEnd:number, timelineStart:number, timelineEnd:number}>,
 *   hasFades:boolean, hasOpacity:boolean, hasVolume:boolean, masterVolumeDb:number
 * }}
 */
export function planMontage(nleProject, options = {}) {
  const srcDur = num(options.sourceDuration) > 0 ? Number(options.sourceDuration) : 0;
  const notices = [];

  const primary = readV1PrimaryClips(nleProject);
  if (!primary) return inertPlan('aucun montage sur la piste v1');

  // ⛔ SOURCE NON MESURÉE = MONTAGE INTERDIT. Quand ffprobe échoue (téléchargement tronqué,
  // moov abîmé, conteneur exotique que ffmpeg décode pourtant encore), l'appelant ne sait plus
  // RIEN de la source — en particulier pas si elle porte du son. Le montage restait malgré
  // tout applicable grâce à la durée déclarée par l'API, `buildMontageFilters` recevait
  // `hasAudio:false`, n'émettait aucun segment audio, et le MP4 publié à la classe était MUET,
  // en statut `completed`, sans un mot. Le repli qui tient la promesse du commentaire de
  // `probeSource` (« l'appelant retombe sur l'ancien comportement ») est celui-ci : on rend la
  // source ENTIÈRE, avec sa piste audio d'origine (`-map 0:a?`), et on le dit tout haut.
  if (options.sourceMeasured === false) {
    return inertPlan(
      `mesure de la source impossible (ffprobe n'a rendu ni durée ni cadence) : le montage n'est PAS ` +
        `appliqué et la vidéo est rendue entière, avec son son. Appliquer les coupes sans savoir si la ` +
        `source porte une piste audio produirait un cours MUET. Relance le rendu : si l'erreur persiste, ` +
        `le fichier source est probablement abîmé (ré-téléverse la vidéo).`,
    );
  }

  // ── Refus AVANT toute construction : mieux vaut ne rien faire que faire à moitié ──
  const foreign = primary.filter((c) => !PRIMARY_SOURCE_REFS.has(String(c.sourceRef ?? '').trim().toLowerCase()));
  if (foreign.length) {
    return inertPlan(
      `montage multi-source non pris en charge : ${foreign.length} clip(s) pointent un autre fichier ` +
        `(sourceRef « ${String(foreign[0].sourceRef)} »). Le rendu ne télécharge que la vidéo du cours ; ` +
        `n'en rendre qu'une partie amputerait le montage sans le dire.`,
    );
  }

  /** @type {Array<{start:number,dur:number,trimIn:number,trimOut:number,opacity:number,volume:number,fadeIn:number,fadeOut:number,label:string,crossfade:boolean}>} */
  const parsed = [];
  for (let i = 0; i < primary.length; i += 1) {
    const c = primary[i];
    const label = String(c.label || `Clip ${i + 1}`);
    const start = num(c.startOnTimeline);
    const dur = num(c.duration);
    const trimIn = num(c.trimIn);
    const trimOut = num(c.trimOut);
    if (!Number.isFinite(start) || start < 0 || !Number.isFinite(dur) || dur <= MIN_SEGMENT_SECONDS) {
      return inertPlan(`clip « ${label} » illisible (position ou durée absente) : montage non appliqué.`);
    }
    if (!Number.isFinite(trimIn) || trimIn < 0 || !Number.isFinite(trimOut) || trimOut <= trimIn + 0.02) {
      return inertPlan(
        `clip « ${label} » sans point de sortie exploitable (trimOut ≤ trimIn) : impossible de savoir ` +
          `quelle portion de la vidéo il montre. Corrige Trim IN / Trim OUT dans l'éditeur, puis relance.`,
      );
    }
    // ⚠️ LE point de refus le plus important. `duration` (le rectangle dessiné) et
    // `trimOut - trimIn` (la matière) décrivent la même longueur : s'ils divergent, le
    // modèle demande un ralenti/accéléré. L'aperçu, lui, interprète l'écart comme une mise
    // à l'échelle affine (applySegmentsFromNleV1Clips, régime « étirement »). Traduire
    // ça exigerait setpts + atempo, donc une voix transposée sur un cours parlé — et
    // NE PAS le traduire ferait diverger l'aperçu du rendu. On refuse, on nomme le clip.
    const span = trimOut - trimIn;
    if (Math.abs(span - dur) > MONTAGE_EPSILON) {
      return inertPlan(
        `clip « ${label} » : la durée sur la timeline (${fmt(dur)} s) ne correspond pas à la matière ` +
          `découpée (${fmt(span)} s). Cela décrit un ralenti/accéléré, que le rendu n'applique pas ` +
          `(la voix serait transposée). Aligne la durée sur Trim OUT − Trim IN, puis relance.`,
      );
    }

    const opacity = c.opacity == null ? 1 : Math.max(0, Math.min(1, num(c.opacity) || 0));
    const volume = c.volume == null ? 1 : Math.max(0, Math.min(2, Number.isFinite(num(c.volume)) ? num(c.volume) : 1));
    const tIn = c.transitionIn && typeof c.transitionIn === 'object' ? c.transitionIn : { type: 'cut', durationSec: 0 };
    const tOut = c.transitionOut && typeof c.transitionOut === 'object' ? c.transitionOut : { type: 'cut', durationSec: 0 };
    const crossfade =
      (String(tIn.type) === 'crossfade' && num(tIn.durationSec) > 0) ||
      (String(tOut.type) === 'crossfade' && num(tOut.durationSec) > 0);
    // Un fondu ne peut pas manger plus de la moitié du clip de chaque côté, sinon les deux
    // fondus se recouvrent et l'image ne remonte jamais à pleine luminosité.
    const fadeIn = String(tIn.type) === 'dip_to_black' ? Math.max(0, Math.min(num(tIn.durationSec) || 0, dur / 2)) : 0;
    const fadeOut = String(tOut.type) === 'dip_to_black' ? Math.max(0, Math.min(num(tOut.durationSec) || 0, dur / 2)) : 0;

    parsed.push({ start, dur, trimIn, trimOut, opacity, volume, fadeIn, fadeOut, label, crossfade });
  }

  parsed.sort((a, b) => a.start - b.start || a.dur - b.dur);

  // Chevauchement : deux clips pour le même instant de sortie, sans règle d'arbitrage.
  for (let i = 1; i < parsed.length; i += 1) {
    const prevEnd = parsed[i - 1].start + parsed[i - 1].dur;
    if (parsed[i].start < prevEnd - MONTAGE_EPSILON) {
      return inertPlan(
        `les clips « ${parsed[i - 1].label} » et « ${parsed[i].label} » se chevauchent de ` +
          `${fmt(prevEnd - parsed[i].start)} s sur la piste v1. Rien ne dit lequel doit être visible : ` +
          `écarte-les dans l'éditeur, puis relance le rendu.`,
      );
    }
  }

  const crossfades = parsed.filter((p) => p.crossfade).length;
  if (crossfades > 0) {
    notices.push(
      `${crossfades} fondu(s) enchaîné(s) rendu(s) en coupe franche : un fondu enchaîné raccourcit la ` +
        `timeline et exige de la matière au-delà du point de coupe. Utilise « Fondu au noir », qui lui ` +
        `est appliqué sans décaler le cours.`,
    );
  }

  // ── Construction des segments : d'abord les DURÉES, les dates viennent après ────
  /** @type {Array<any>} */
  const segments = [];
  let cursor = 0; // position sur la timeline TELLE QUE DEMANDÉE (pour mesurer les trous)
  let blackSeconds = 0;
  let starvedClips = 0;

  const pushBlack = (duration) => {
    if (duration <= MIN_SEGMENT_SECONDS) return;
    blackSeconds += duration;
    segments.push({ kind: 'black', duration, opacity: 1, volume: 1, fadeIn: 0, fadeOut: 0, label: 'vide' });
  };

  for (const p of parsed) {
    pushBlack(p.start - cursor);
    const sourceStart = p.trimIn;
    // Ne JAMAIS demander à ffmpeg de la matière qui n'existe pas : `trim` au-delà de la fin
    // du fichier renvoie moins d'images que prévu, et `concat` décale alors TOUT ce qui suit.
    const sourceEnd = srcDur > 0 ? Math.min(sourceStart + p.dur, srcDur) : sourceStart + p.dur;
    const material = Math.max(0, sourceEnd - sourceStart);
    if (material > MIN_SEGMENT_SECONDS) {
      segments.push({
        kind: 'clip',
        duration: material,
        sourceStart,
        sourceEnd,
        opacity: p.opacity,
        volume: p.volume,
        fadeIn: Math.min(p.fadeIn, material / 2),
        fadeOut: Math.min(p.fadeOut, material / 2),
        label: p.label,
      });
    }
    // Le créneau réclamé dépasse la matière disponible (trim au-delà de la fin du fichier) :
    // le reste du créneau est du noir, JAMAIS une image gelée inventée.
    const missing = p.dur - material;
    if (missing > MIN_SEGMENT_SECONDS) {
      starvedClips += 1;
      pushBlack(missing);
    }
    cursor = p.start + p.dur;
  }

  if (!segments.length) return inertPlan('le montage ne contient aucune matière exploitable');

  if (starvedClips > 0) {
    notices.push(
      `${starvedClips} clip(s) réclament de la vidéo au-delà de la fin du fichier source : la portion ` +
        `manquante est rendue en noir (aucune image n'est inventée).`,
    );
  }

  // Dates DÉFINITIVES = sommes cumulées. C'est ce que `concat` produira, à l'image près.
  let t = 0;
  for (const s of segments) {
    s.timelineStart = t;
    t += s.duration;
    s.timelineEnd = t;
  }
  const timelineDuration = t;

  const ranges = segments
    .filter((s) => s.kind === 'clip')
    .map((s) => ({
      sourceStart: s.sourceStart,
      sourceEnd: s.sourceEnd,
      timelineStart: s.timelineStart,
      timelineEnd: s.timelineEnd,
    }));

  const masterVolumeDb = (() => {
    const raw = num(nleProject?.mix?.masterVolumeDb);
    return Number.isFinite(raw) ? Math.max(-96, Math.min(12, raw)) : 0;
  })();

  const hasFades = segments.some((s) => s.fadeIn > 0 || s.fadeOut > 0);
  const hasOpacity = segments.some((s) => s.kind === 'clip' && s.opacity < 0.999);
  const hasVolume = segments.some((s) => s.kind === 'clip' && Math.abs(s.volume - 1) > 0.001);

  // ── Le montage est-il un NON-ÉVÉNEMENT ? ─────────────────────────────────────
  // « Sync chapitres » recopie simplement les chapitres en clips (trims IDENTITÉ, bout à
  // bout, depuis 0). Si ça couvre toute la source sans rien modifier, le MP4 serait
  // rigoureusement identique à celui d'aujourd'hui : on ne prend alors AUCUN risque et on
  // laisse le chemin de rendu historique intact (c'est le cas des 2 seules lignes qui
  // portent un `nleProject` en production, toutes deux des semences).
  const identity =
    !hasFades &&
    !hasOpacity &&
    !hasVolume &&
    masterVolumeDb === 0 &&
    blackSeconds === 0 &&
    segments.every((s) => s.kind === 'clip' && Math.abs(s.sourceStart - s.timelineStart) <= MONTAGE_EPSILON);
  if (identity && (srcDur <= 0 || Math.abs(timelineDuration - srcDur) <= MONTAGE_EPSILON)) {
    return inertPlan('le montage reprend la source à l’identique (rien à couper)', notices);
  }

  // Le montage RACCOURCIT le cours : c'est légitime (c'est ce que la timeline dessine), mais
  // c'est la conséquence la plus visible d'un « Sync chapitres » sur un cours partiellement
  // chapitré — on ne laisse pas le formateur le découvrir en regardant son MP4.
  if (srcDur > 0 && srcDur - timelineDuration > 1) {
    notices.push(
      `le montage ne retient que ${fmt(timelineDuration)} s sur ${fmt(srcDur)} s de vidéo source ` +
        `(${fmt(srcDur - timelineDuration)} s hors montage).`,
    );
  }
  if (blackSeconds > MIN_SEGMENT_SECONDS) {
    notices.push(`${fmt(blackSeconds)} s de noir : ce sont les vides entre les clips de la timeline.`);
  }

  // Réglages présents dans le projet mais NON traduits — jamais ignorés en silence.
  const grade = nleProject?.master?.colorGrade;
  if (grade && typeof grade === 'object') {
    const neutral =
      Math.abs(num(grade.exposure) || 0) < 0.5 &&
      Math.abs((num(grade.contrast) ?? 100) - 100) < 0.5 &&
      Math.abs((num(grade.saturation) ?? 100) - 100) < 0.5 &&
      Math.abs(num(grade.warmth) || 0) < 0.5;
    if (!neutral) {
      notices.push(
        `l'étalonnage (exposition/contraste/saturation/chaleur) n'est PAS appliqué au rendu : ` +
          `l'aperçu l'obtient par un filtre CSS dont ffmpeg n'a pas l'équivalent exact.`,
      );
    }
  }
  const extraTracks = Array.isArray(nleProject?.tracks)
    ? nleProject.tracks.filter((tr) => tr && tr.id !== 'v1' && Array.isArray(tr.clips) && tr.clips.length)
    : [];
  if (extraTracks.length) {
    notices.push(
      `pistes « ${extraTracks.map((tr) => tr.name || tr.id).join(', ')} » ignorées : le diaporama et ` +
        `l'incrustation sont pilotés par les plans capturés, pas par ces pistes.`,
    );
  }

  return {
    applied: true,
    reason: '',
    notices,
    timelineDuration,
    segments,
    ranges,
    hasFades,
    hasOpacity,
    hasVolume,
    masterVolumeDb,
  };
}

/**
 * Morceaux de filtergraph réalisant le plan. Produit `[nle_pv]` (vidéo) et, si la source a
 * de l'audio, `[nle_pa]`.
 *
 * DEUX invariants que ce graphe tient par construction, parce que leur violation est la
 * panne classique du « cut and concat » :
 *   1. TOUS les segments vidéo sortent en W×H, même SAR, même pix_fmt, même cadence, et une
 *      durée épinglée par `trim=duration=` — sinon `concat` refuse ou dérive d'une image par
 *      segment (dérive cumulative = slides décalées à la fin du cours).
 *   2. Il y a EXACTEMENT autant de segments audio que de segments vidéo, dans le MÊME ordre,
 *      et chacun dure exactement autant (`apad` puis `atrim=duration=`). C'est ce qui règle
 *      le piège « un clip sans piste audio casse le mixage » : un trou, ou un clip dont la
 *      matière audio s'arrête avant la vidéo, devient du SILENCE de la bonne longueur.
 *
 * @param {ReturnType<typeof planMontage>} plan
 * @param {{width:number,height:number,fps:number,hasAudio:boolean,sampleRate?:number,channelLayout?:string}} opts
 * @returns {{parts:string[], videoLabel:string, audioLabel:string|null}}
 */
export function buildMontageFilters(plan, opts) {
  const W = even(opts.width);
  const H = even(opts.height);
  const F = Number(opts.fps) > 0 ? Number(opts.fps) : 25;
  const SR = Number(opts.sampleRate) > 0 ? Math.round(Number(opts.sampleRate)) : 48000;
  const CL = String(opts.channelLayout || 'stereo');
  const withAudio = Boolean(opts.hasAudio);

  const parts = [];
  const vLabels = [];
  const aLabels = [];

  const clipCount = plan.segments.filter((s) => s.kind === 'clip').length;
  // Un label de flux ne se consomme QU'UNE fois : autant de branches que de clips.
  // (`split` ne bufferise pas : chaque branche jette immédiatement ce qui est hors de son
  // `trim`, donc la mémoire ne croît pas avec la longueur du replay.)
  if (clipCount > 1) {
    parts.push(`[0:v]split=${clipCount}${Array.from({ length: clipCount }, (_, i) => `[nle_vin${i}]`).join('')}`);
    if (withAudio) {
      parts.push(`[0:a]asplit=${clipCount}${Array.from({ length: clipCount }, (_, i) => `[nle_ain${i}]`).join('')}`);
    }
  }
  const vIn = (k) => (clipCount > 1 ? `nle_vin${k}` : '0:v');
  const aIn = (k) => (clipCount > 1 ? `nle_ain${k}` : '0:a');

  let clipIdx = 0;
  plan.segments.forEach((seg, i) => {
    const D = seg.duration;
    const vOut = `nle_v${i}`;
    const aOut = `nle_a${i}`;

    if (seg.kind === 'black') {
      parts.push(
        `color=c=black:s=${W}x${H}:r=${F}:d=${fmt(D)},setsar=1,format=yuv420p,` +
          `trim=duration=${fmt(D)},setpts=PTS-STARTPTS[${vOut}]`,
      );
      if (withAudio) {
        parts.push(
          `anullsrc=r=${SR}:cl=${CL},atrim=duration=${fmt(D)},asetpts=PTS-STARTPTS,` +
            `aformat=sample_fmts=fltp:sample_rates=${SR}:channel_layouts=${CL}[${aOut}]`,
        );
      }
      vLabels.push(vOut);
      if (withAudio) aLabels.push(aOut);
      return;
    }

    const k = clipIdx++;
    // `trim` sans `setpts` laisserait des timestamps non nuls : `concat` recollerait alors les
    // segments à leur position d'ORIGINE et la sortie serait pleine de trous. D'où les deux
    // `setpts=PTS-STARTPTS` (un après la découpe source, un après l'épinglage de durée).
    const chain = [
      `[${vIn(k)}]trim=start=${fmt(seg.sourceStart)}:end=${fmt(seg.sourceEnd)}`,
      `setpts=PTS-STARTPTS`,
      `scale=${W}:${H}:force_original_aspect_ratio=decrease:flags=lanczos`,
      `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2`,
      `setsar=1`,
      `fps=${F}`,
      `trim=duration=${fmt(D)}`,
      `setpts=PTS-STARTPTS`,
    ];
    if (seg.fadeIn > 0) chain.push(`fade=t=in:st=0:d=${fmt(seg.fadeIn)}:color=black`);
    if (seg.fadeOut > 0) chain.push(`fade=t=out:st=${fmt(D - seg.fadeOut)}:d=${fmt(seg.fadeOut)}:color=black`);

    if (seg.opacity < 0.999) {
      // Opacité = mélange avec du NOIR. On le fait en RGBA et par `overlay` plutôt qu'en
      // rabotant la luma : en YUV « télé » le noir vaut 16, pas 0, et un simple facteur
      // sur Y descendrait sous le noir légal (image délavée au lieu d'atténuée).
      chain.push(`format=rgba`, `colorchannelmixer=aa=${(Math.round(seg.opacity * 1000) / 1000).toFixed(3)}`);
      parts.push(`${chain.join(',')}[${vOut}_fg]`);
      parts.push(
        `color=c=black:s=${W}x${H}:r=${F}:d=${fmt(D)},format=rgba,` +
          `trim=duration=${fmt(D)},setpts=PTS-STARTPTS[${vOut}_bg]`,
      );
      parts.push(`[${vOut}_bg][${vOut}_fg]overlay=0:0:format=auto,setsar=1,format=yuv420p[${vOut}]`);
    } else {
      chain.push('format=yuv420p');
      parts.push(`${chain.join(',')}[${vOut}]`);
    }
    vLabels.push(vOut);

    if (withAudio) {
      const a = [
        `[${aIn(k)}]atrim=start=${fmt(seg.sourceStart)}:end=${fmt(seg.sourceEnd)}`,
        `asetpts=PTS-STARTPTS`,
      ];
      if (Math.abs(seg.volume - 1) > 0.001) a.push(`volume=${(Math.round(seg.volume * 1000) / 1000).toFixed(3)}`);
      // `aformat` AVANT `apad` : le silence ajouté a alors exactement le même format que le
      // reste, condition sine qua non de `concat` sur l'audio.
      a.push(`aformat=sample_fmts=fltp:sample_rates=${SR}:channel_layouts=${CL}`);
      // `apad` seul remplirait à l'infini : il n'existe QUE pour être coupé par l'atrim qui suit.
      a.push(`apad`, `atrim=duration=${fmt(D)}`, `asetpts=PTS-STARTPTS`);
      // Un fondu au noir sans fondu sonore laisse un clac à la coupe : on accompagne l'image.
      if (seg.fadeIn > 0) a.push(`afade=t=in:st=0:d=${fmt(seg.fadeIn)}`);
      if (seg.fadeOut > 0) a.push(`afade=t=out:st=${fmt(D - seg.fadeOut)}:d=${fmt(seg.fadeOut)}`);
      parts.push(`${a.join(',')}[${aOut}]`);
      aLabels.push(aOut);
    }
  });

  if (vLabels.length === 1) parts.push(`[${vLabels[0]}]null[nle_pv]`);
  else parts.push(`${vLabels.map((l) => `[${l}]`).join('')}concat=n=${vLabels.length}:v=1:a=0[nle_pv]`);

  let audioLabel = null;
  if (withAudio && aLabels.length) {
    const mixIn = 'nle_pa_raw';
    if (aLabels.length === 1) parts.push(`[${aLabels[0]}]anull[${mixIn}]`);
    else parts.push(`${aLabels.map((l) => `[${l}]`).join('')}concat=n=${aLabels.length}:v=0:a=1[${mixIn}]`);
    if (Math.abs(plan.masterVolumeDb) > 0.01) {
      parts.push(`[${mixIn}]volume=${(Math.round(plan.masterVolumeDb * 100) / 100).toFixed(2)}dB[nle_pa]`);
    } else {
      parts.push(`[${mixIn}]anull[nle_pa]`);
    }
    audioLabel = '[nle_pa]';
  }

  return { parts, videoLabel: '[nle_pv]', audioLabel };
}

/**
 * PORT VERBATIM de `apps/app/src/lib/nleEngine/applySegmentsFromNleV1Clips.js`.
 *
 * ⚠️ NE PAS « AMÉLIORER » CETTE FONCTION ISOLÉMENT. C'est elle qui décide, dans l'APERÇU,
 * à quel instant un chapitre atterrit une fois le montage appliqué (VideoPostProductionPage
 * → applyNleProjectToChapterRows). Toute divergence ici produirait un MP4 dont les slides
 * ne tombent pas là où l'éditeur les annonce. Les deux copies doivent bouger ENSEMBLE.
 *
 * Elle renvoie le TABLEAU D'ORIGINE (même référence) quand elle refuse de se prononcer :
 * l'appelant s'en sert pour détecter ce refus.
 *
 * @param {Array<{index:number, startSeconds:number|null, endSeconds:number|null, label?:string}>} segments
 * @param {unknown} nleProject
 */
export function applySegmentsFromNleV1Clips(segments, nleProject) {
  if (!Array.isArray(segments) || segments.length === 0) return segments;
  if (!nleProject || typeof nleProject !== 'object') return segments;

  const tracks = nleProject.tracks;
  if (!Array.isArray(tracks)) return segments;

  const v1 = tracks.find((t) => t && typeof t === 'object' && t.id === 'v1');
  if (!v1 || typeof v1 !== 'object') return segments;

  const clips = v1.clips;
  if (!Array.isArray(clips) || clips.length === 0) return segments;

  const primary = clips.filter((c) => {
    if (!c || typeof c !== 'object') return false;
    const st = String(c.sourceType || 'primary_video');
    return st === 'primary_video';
  });

  if (primary.length === segments.length) {
    const sortedSeg = [...segments].sort((a, b) => (Number(a.startSeconds) || 0) - (Number(b.startSeconds) || 0));
    const sortedClips = [...primary].sort(
      (a, b) => (Number(a.startOnTimeline) || 0) - (Number(b.startOnTimeline) || 0),
    );

    const indexToTimes = new Map();
    for (let k = 0; k < sortedSeg.length; k++) {
      const seg = sortedSeg[k];
      const clip = sortedClips[k];
      const start = Number(clip.startOnTimeline);
      const dur = Number(clip.duration);
      if (!Number.isFinite(start) || !Number.isFinite(dur) || dur <= 0.05) continue;
      const end = start + dur;
      if (end <= start) continue;
      indexToTimes.set(seg.index, { startSeconds: start, endSeconds: end });
    }

    // Tout-ou-rien : si UN seul clip est inexploitable, on ne recale RIEN (un recalage
    // partiel mélangerait deux axes de temps dans la même liste).
    if (indexToTimes.size !== segments.length) return segments;

    return segments.map((s) => {
      const t = indexToTimes.get(s.index);
      if (!t) return s;
      return { ...s, startSeconds: t.startSeconds, endSeconds: t.endSeconds };
    });
  }

  if (primary.length === 1) {
    const clip = primary[0];
    const trimIn = Number(clip.trimIn);
    let trimOut = Number(clip.trimOut);
    const tl0 = Number(clip.startOnTimeline) || 0;
    const tlDur = Number(clip.duration);
    if (!Number.isFinite(trimIn) || !Number.isFinite(tlDur) || tlDur <= 0.05) return segments;
    if (!Number.isFinite(trimOut) || trimOut <= trimIn + 0.02) {
      const maxSeg = segments.reduce((m, s) => Math.max(m, Number(s.endSeconds) || 0), trimIn + 0.1);
      trimOut = Math.max(trimIn + 0.1, maxSeg);
    }
    const span = trimOut - trimIn;
    if (!Number.isFinite(span) || span <= 0.02) return segments;

    return segments.map((s) => {
      const rawS = Number(s.startSeconds);
      const rawE = Number(s.endSeconds);
      if (!Number.isFinite(rawS) || !Number.isFinite(rawE)) return s;
      const sClamped = Math.min(trimOut, Math.max(trimIn, rawS));
      const eClamped = Math.min(trimOut, Math.max(trimIn, rawE));
      const t0 = tl0 + ((sClamped - trimIn) / span) * tlDur;
      const t1 = tl0 + ((eClamped - trimIn) / span) * tlDur;
      return { ...s, startSeconds: Math.min(t0, t1), endSeconds: Math.max(t0, t1) };
    });
  }

  return segments;
}

/**
 * Projette une fenêtre exprimée en temps SOURCE sur le nouvel axe de temps du montage.
 *
 * Régime de SECOURS, employé seulement quand `applySegmentsFromNleV1Clips` refuse de se
 * prononcer (nombre de clips ≠ nombre de chapitres, ou cours non chapitré). Il ne devine
 * rien : il suit la matière. Un instant source coupé du montage n'a pas d'image d'arrivée ;
 * une fenêtre entièrement coupée renvoie donc `null` (la slide disparaît, elle ne « glisse »
 * pas ailleurs). Sur un clip unique il coïncide EXACTEMENT avec le régime « étirement » de
 * l'aperçu (la vitesse est garantie à 1× par le refus des clips étirés).
 *
 * @returns {{start:number,end:number}|null}
 */
export function projectSourceWindow(plan, startSeconds, endSeconds) {
  const s0 = num(startSeconds);
  const s1 = num(endSeconds);
  if (!Number.isFinite(s0) || !Number.isFinite(s1) || s1 <= s0) return null;
  let lo = Infinity;
  let hi = -Infinity;
  for (const r of plan.ranges) {
    const a = Math.max(s0, r.sourceStart);
    const b = Math.min(s1, r.sourceEnd);
    if (b <= a) continue;
    lo = Math.min(lo, r.timelineStart + (a - r.sourceStart));
    hi = Math.max(hi, r.timelineStart + (b - r.sourceStart));
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) return null;
  return { start: lo, end: hi };
}

/**
 * Recale les fenêtres des SLIDES sur le nouvel axe de temps.
 *
 * ⭐ C'EST LE PIÈGE CENTRAL DU CHANTIER. Le diaporama est placé en temps SOURCE par l'API
 * (chapitre → fenêtre → slide). Dès qu'un montage coupe, la sortie n'a plus le même axe :
 * laisser les slides à leur seconde d'origine, c'est les afficher pendant qu'on parle d'autre
 * chose. Deux régimes, dans cet ordre :
 *
 *   1. MIROIR DE L'APERÇU — si le payload porte les fenêtres des CHAPITRES (c'est sur elles,
 *      et sur leur NOMBRE, que l'aperçu se prononce), on leur applique le port verbatim
 *      ci-dessus, puis la fenêtre d'une slide redevient l'UNION de ses chapitres, exactement
 *      comme `windowForScene` côté API. Résultat : les instants du MP4 sont ceux affichés
 *      dans les lignes IN/OUT de l'éditeur.
 *   2. SUIVI DE LA MATIÈRE — si l'aperçu refuse de se prononcer, ou si le cours n'est pas
 *      chapitré, on projette chaque fenêtre par `projectSourceWindow`.
 *
 * Le tableau renvoyé a TOUJOURS la même longueur et le même ordre que `slides` : les indices
 * servent à retrouver le PNG téléchargé. Une slide dont le moment n'existe plus dans le
 * montage sort avec `startSeconds/endSeconds` à null — à l'appelant de la retirer AVEC son
 * fichier.
 *
 * @param {Array<any>} slides
 * @param {ReturnType<typeof planMontage>} plan
 * @param {Array<{startSeconds:number|null,endSeconds:number|null}>|undefined} chapterWindows
 * @param {unknown} nleProject
 * @returns {{slides:Array<any>, notices:string[], dropped:number, regime:'apercu'|'matiere'}}
 */
export function remapSlidesForMontage(slides, plan, chapterWindows, nleProject) {
  const notices = [];
  const list = Array.isArray(slides) ? slides : [];
  if (!plan.applied || !list.length) return { slides: list, notices, dropped: 0, regime: 'matiere' };

  /** @type {Map<number,{start:number,end:number}>|null} */
  let chapterTimeline = null;
  if (Array.isArray(chapterWindows) && chapterWindows.length) {
    const segments = chapterWindows.map((w, i) => ({
      index: i,
      startSeconds: num(w?.startSeconds),
      endSeconds: num(w?.endSeconds),
    }));
    const applied = applySegmentsFromNleV1Clips(segments, nleProject);
    // Même référence = l'aperçu a refusé de se prononcer (cf. port verbatim).
    if (applied !== segments) {
      chapterTimeline = new Map();
      applied.forEach((s) => {
        const a = num(s.startSeconds);
        const b = num(s.endSeconds);
        if (Number.isFinite(a) && Number.isFinite(b) && b > a) chapterTimeline.set(s.index, { start: a, end: b });
      });
    }
  }

  let dropped = 0;
  let viaMatiere = 0;
  const out = list.map((s) => {
    const entry = s && typeof s === 'object' ? s : { url: String(s || '') };
    const chapterIndices = Array.isArray(entry.chapterIndices) ? entry.chapterIndices : [];

    /** @type {{start:number,end:number}|null} */
    let win = null;
    if (chapterTimeline && chapterIndices.length) {
      let lo = Infinity;
      let hi = -Infinity;
      for (const ci of chapterIndices) {
        const w = chapterTimeline.get(Number(ci));
        if (!w) continue;
        lo = Math.min(lo, w.start);
        hi = Math.max(hi, w.end);
      }
      if (Number.isFinite(lo) && Number.isFinite(hi) && hi > lo) win = { start: lo, end: hi };
    }
    if (!win) {
      win = projectSourceWindow(plan, entry.startSeconds, entry.endSeconds);
      if (win) viaMatiere += 1;
    }

    if (!win) {
      dropped += 1;
      return { ...entry, startSeconds: null, endSeconds: null, durationSeconds: 0 };
    }
    const start = Math.max(0, Math.min(win.start, plan.timelineDuration));
    const end = Math.max(start, Math.min(win.end, plan.timelineDuration));
    if (end - start <= MIN_SEGMENT_SECONDS) {
      dropped += 1;
      return { ...entry, startSeconds: null, endSeconds: null, durationSeconds: 0 };
    }
    return {
      ...entry,
      startSeconds: Math.round(start * 1000) / 1000,
      endSeconds: Math.round(end * 1000) / 1000,
      durationSeconds: Math.round((end - start) * 1000) / 1000,
    };
  });

  if (dropped > 0) {
    notices.push(
      `${dropped} plan(s) retiré(s) du diaporama : le passage qu'ils illustraient n'existe plus dans le montage.`,
    );
  }
  if (!chapterTimeline && list.length) {
    notices.push(
      `plans replacés d'après la matière conservée (l'éditeur ne sait pas recaler ses lignes IN/OUT ` +
        `quand le nombre de clips diffère du nombre de chapitres) : les horaires affichés dans ` +
        `l'éditeur restent ceux de la vidéo d'origine.`,
    );
  } else if (viaMatiere > 0) {
    notices.push(`${viaMatiere} plan(s) sans chapitre de rattachement replacés d'après la matière conservée.`);
  }

  return { slides: out, notices, dropped, regime: chapterTimeline ? 'apercu' : 'matiere' };
}
