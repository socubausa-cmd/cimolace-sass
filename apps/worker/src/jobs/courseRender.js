// Course render — compose le MP4 de post-production d'un cours pour la classe numérique.
// Lit la file `course_render_jobs`.
//
// ── POURQUOI CE FICHIER A CHANGÉ DE MISE EN PAGE ──────────────────────────────
// L'ancien montage était un hstack de deux DEMI-CADRES (960×1080 en sortie 1080p).
// Deux sources 16:9 enfermées dans des colonnes 8:9 : chacune n'occupait que
// 960×540, soit 270 px de NOIR PUR en haut ET en bas de CHAQUE colonne — la moitié
// du cadre était noire (YAVG mesuré 16,0 sur les bandes contre 147,1 au centre).
// Conséquence pédagogique : une slide SmartBoard 1920×1080 était servie en 960×540,
// le texte des puces devenant illisible pour l'élève. C'était LE défaut principal.
//
// Nouvelle mise en page : la SLIDE occupe le cadre ENTIER (1920×1080 = 100 % des
// pixels au lieu de 25 %) et le formateur est INCRUSTÉ en médaillon (PiP) dans le
// coin bas-droit. Quand aucune slide n'est active, le formateur reprend le plein
// cadre — le montage suit donc le cours au lieu de figer un pavé noir.
//
// ── POURQUOI LE DIAPORAMA N'EST PLUS UN `concat` NU ───────────────────────────
// L'ancien code empilait les slides bout à bout DEPUIS t=0, sans jamais lire le
// moindre `startSeconds` : dès que le premier chapitre ne commençait pas à 0, ou
// qu'un trou séparait deux chapitres, TOUTES les slides suivantes glissaient de la
// somme des trous — aucun instant du montage n'était juste par construction.
// Désormais la timeline est ABSOLUE : chaque slide porte sa fenêtre
// [startSeconds, endSeconds] et le diaporama est un concat de segments qui couvre
// exactement [0, durée_source], les silences étant des segments TRANSPARENTS
// (le formateur y est visible plein cadre).
//
// ── POURQUOI `-shortest` A DISPARU AU PROFIT DE `-t` ──────────────────────────
// `-shortest` bornait le muxage sur la piste la plus courte, en pratique l'AUDIO :
// un diaporama plus long que la source était TRONQUÉ EN SILENCE (les dernières
// slides n'étaient jamais encodées) et le job passait quand même 'completed' ;
// à l'inverse, sur une source muette, la sortie DÉPASSAIT la durée du cours avec
// une image gelée. La durée de sortie est maintenant celle de la SOURCE, mesurée
// par ffprobe : déterministe, avec ou sans audio.
//
// ── POURQUOI LE MONTAGE ARRIVE *AVANT* LA MISE EN PAGE ────────────────────────
// `nleProject` (coupes, trims, fondus, opacité, volume) n'était lu NULLE PART côté
// serveur : le formateur coupait son intro et recevait la source entière. Le traducteur
// vit dans `nleToFfmpeg.js` et se branche ICI en PRÉFIXE de filtergraph : il produit
// `[nle_pv]` / `[nle_pa]`, qui se substituent à `[0:v]` / `0:a` en entrée de la mise en
// page. Le reste du graphe (slide plein cadre, incrustation, diaporama RGBA, faststart)
// n'a pas bougé d'une virgule — un montage absent ou inerte redonne le graphe historique,
// à l'argument près.
import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { planMontage, buildMontageFilters, remapSlidesForMontage } from './nleToFfmpeg.js';
import { spawn } from 'child_process';
import { writeFile, unlink, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

const R2_ACCOUNT = process.env.CF_R2_ACCOUNT_ID;
const R2_KEY = process.env.CF_R2_ACCESS_KEY_ID;
const R2_SECRET = process.env.CF_R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.CF_R2_BUCKET || 'cimolace-media';
function r2Configured() { return Boolean(R2_ACCOUNT && R2_KEY && R2_SECRET && R2_BUCKET); }

// ── Buckets Supabase Storage impliqués dans un rendu ────────────────────────────
// `smartboard-canvas` est PRIVÉ depuis la migration 20260715160000 : les URLs
// `.../storage/v1/object/public/smartboard-canvas/...` renvoient 403. Or c'est
// exactement ce que le front persiste (uploadSmartboardCanvasImage → getPublicUrl).
// Un `fetch` anonyme sur ces URLs échouait donc en 403 et faisait tomber en `failed`
// TOUT rendu comportant des slides (panne B1). Le worker porte la clé service_role :
// il SIGNE lui-même, juste avant le téléchargement. L'URL signée n'est jamais
// persistée (donc jamais périmée dans un job qui a attendu en file).
const SMARTBOARD_CANVAS_BUCKET = 'smartboard-canvas';
const VIDEOS_BUCKET = 'videos';
// TTL court : l'URL ne sert qu'au `fetch` qui suit immédiatement.
const ASSET_SIGN_TTL_SECONDS = 900;

function r2Client() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_KEY, secretAccessKey: R2_SECRET },
    forcePathStyle: true,
  });
}

// R2 est S3-compatible : l'upload EXIGE une signature AWS SigV4 (@aws-sdk/client-s3),
// PAS du Basic auth (rejeté par R2 → 403 → l'upload du rendu de cours échouait, audit
// P0 #6). On stocke la CLÉ R2 (même convention que replay-postprod / short-generator) ;
// le bucket est privé → la lecture se fait par URL présignée côté API/front (presign-
// on-read du rendered course = suivi, comme replay.service.generatePlaybackUrl).
async function uploadToR2(filePath, key) {
  if (!r2Configured()) return null;
  const body = await readFile(filePath);
  await r2Client().send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: body,
    ContentType: 'video/mp4',
  }));
  return key;
}

/**
 * Extrait le chemin Storage d'une valeur persistée, pour un bucket donné.
 *
 * PORT SERVEUR de `apps/app/src/lib/smartboardCanvasUrl.js#smartboardCanvasStoragePath`
 * (garder les deux en phase). Accepte :
 *   - URL publique  `.../object/public/<bucket>/<path>`
 *   - URL signée    `.../object/sign/<bucket>/<path>?token=…`
 *   - chemin nu     `<uid>/<fichier>`
 * Renvoie `null` pour tout ce qui n'appartient pas au bucket (URL externe, data:, blob:).
 *
 * C'est CE découpage qui assure la RÉTRO-COMPATIBILITÉ : les jobs déjà en file ne
 * portent qu'une URL publique (pas de `storagePath`) — on la reconvertit ici.
 *
 * @param {unknown} value
 * @param {string} bucket
 * @returns {string | null}
 */
function storagePathFromValue(value, bucket) {
  if (!value || typeof value !== 'string' || !bucket) return null;
  const v = value.trim();
  if (!v) return null;

  // URL (publique ou signée) pointant vers le bucket → portion après le marqueur.
  const marker = `/${bucket}/`;
  const idx = v.indexOf(marker);
  if (idx !== -1) {
    let path = v.slice(idx + marker.length);
    const q = path.indexOf('?');
    if (q !== -1) path = path.slice(0, q);
    path = path.replace(/^\/+/, '');
    try {
      path = decodeURIComponent(path);
    } catch { /* garde la forme brute si non décodable */ }
    return path || null;
  }

  // URL externe / data / blob / chemin absolu → pas un asset du bucket.
  if (/^(https?:|data:|blob:|ftp:)/i.test(v) || v.startsWith('/')) return null;

  // Chemin nu de type `{uid}/{fichier}`.
  if (v.includes('/') && !/\s/.test(v)) return v;

  return null;
}

/**
 * Rend une entrée d'asset TÉLÉCHARGEABLE (URL signée si l'asset vit dans un bucket privé).
 *
 * Ordre de résolution :
 *   1. `data:` → rien à signer (capture canvas inline).
 *   2. `storagePath` fourni par l'API (chemin nominal depuis le correctif B1).
 *   3. RÉTRO-COMPAT : pas de `storagePath` → on le redérive de l'URL par le même découpage.
 *   4. sinon → l'URL telle quelle (asset externe légitime).
 *
 * Fail-soft : si la signature échoue alors qu'on a une URL, on retombe sur l'URL (un asset
 * public légitime continue de marcher, et l'échec éventuel sera un 403 explicite). Sans URL
 * de repli, on lève une erreur PARLANTE (elle atterrit dans course_render_jobs.error).
 *
 * @param {{url?:string, storagePath?:string, storageBucket?:string}|string} asset
 * @param {string} defaultBucket bucket supposé quand l'entrée ne le précise pas
 * @returns {Promise<string>}
 */
async function resolveAssetUrl(asset, defaultBucket) {
  const entry = typeof asset === 'string' ? { url: asset } : (asset || {});
  const url = String(entry.url || '');
  if (url.startsWith('data:')) return url;

  const bucket = String(entry.storageBucket || defaultBucket || '');
  const path = String(entry.storagePath || '') || storagePathFromValue(url, bucket) || '';
  if (!path || !bucket) return url;

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, ASSET_SIGN_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    const why = error?.message || 'URL signée vide';
    if (url) {
      console.warn(`[course-render] signature ${bucket}/${path} échouée (${why}) → repli sur l'URL persistée`);
      return url;
    }
    throw new Error(`Signature impossible pour ${bucket}/${path} : ${why}`);
  }
  return data.signedUrl;
}

// Récupère un asset (http(s) OU data: URL) vers un fichier local.
async function materialize(url, destPath) {
  const u = String(url || '');
  if (u.startsWith('data:')) {
    await writeFile(destPath, Buffer.from(u.slice(u.indexOf(',') + 1), 'base64'));
    return;
  }
  const res = await fetch(u);
  if (!res.ok) throw new Error(`Download failed ${res.status} (${u.slice(0, 60)})`);
  await writeFile(destPath, Buffer.from(await res.arrayBuffer()));
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(-300)}`))));
    proc.on('error', reject);
  });
}

function runFfprobe(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffprobe', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => (code === 0 ? resolve(stdout) : reject(new Error(`ffprobe exit ${code}: ${stderr.slice(-200)}`))));
    proc.on('error', reject);
  });
}

/** '30000/1001' → 29.97 ; '25/1' → 25 ; valeur illisible → 0. */
function parseFrameRate(raw) {
  const s = String(raw || '').trim();
  if (!s || s === '0/0') return 0;
  const [n, d] = s.split('/');
  const num = Number(n);
  const den = d === undefined ? 1 : Number(d);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return 0;
  const v = num / den;
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/**
 * Mesure la SOURCE avant de composer.
 *
 * POURQUOI c'est indispensable : la durée de sortie, la cadence et le sort de la
 * piste audio étaient jusqu'ici DEVINÉS. La durée venait de `-shortest` (donc de
 * l'audio, donc absente sur une source muette), la cadence était forcée à 25 fps
 * dans la branche « avec slides » et laissée native dans l'autre (deux rendus du
 * MÊME cours n'avaient pas la même cadence, et une source 30 fps perdait 1 image
 * sur 6 sans raison), et l'audio était TOUJOURS réencodé en AAC même quand il
 * l'était déjà. Une seule mesure règle les trois.
 *
 * Fail-soft : si ffprobe manque ou échoue, on renvoie des zéros et l'appelant
 * retombe sur l'ancien comportement (borne `-shortest`, cadence par défaut).
 *
 * ⚠️ `measured` DIT SI CE FAIL-SOFT S'EST DÉCLENCHÉ, et il n'est pas décoratif. Sans lui,
 * `hasAudio:false` était indiscernable de « la source est réellement muette » : le montage
 * s'appliquait quand même (grâce à `payload.sourceDurationSeconds`), `buildMontageFilters`
 * n'émettait aucun segment audio, aucun `-map` audio n'était ajouté, et le cours entier
 * partait à la classe SANS SON, statut `completed`, sans une ligne de message. La même
 * source, sans montage, gardait son audio via `-map 0:a?`.
 *
 * `sampleRate` / `channelLayout` ne servent QU'AU montage : quand on recolle des
 * segments audio, le silence des trous doit avoir EXACTEMENT le même format que le son
 * des clips, sinon `concat` refuse le graphe (cf. nleToFfmpeg.buildMontageFilters).
 *
 * @returns {Promise<{measured:boolean, duration:number, fps:number, hasAudio:boolean, audioCodec:string, sampleRate:number, channelLayout:string}>}
 */
async function probeSource(filePath) {
  try {
    const out = await runFfprobe(['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', filePath]);
    const j = JSON.parse(out);
    const streams = Array.isArray(j?.streams) ? j.streams : [];
    const v = streams.find((s) => s?.codec_type === 'video');
    const a = streams.find((s) => s?.codec_type === 'audio');
    const candidates = [Number(j?.format?.duration), Number(v?.duration)].filter((n) => Number.isFinite(n) && n > 0);
    const channels = Number(a?.channels);
    return {
      measured: true,
      duration: candidates.length ? Math.max(...candidates) : 0,
      // avg_frame_rate décrit la cadence RÉELLE ; r_frame_rate n'est qu'une borne.
      fps: parseFrameRate(v?.avg_frame_rate) || parseFrameRate(v?.r_frame_rate) || 0,
      hasAudio: Boolean(a),
      audioCodec: String(a?.codec_name || ''),
      sampleRate: Number.isFinite(Number(a?.sample_rate)) && Number(a?.sample_rate) > 0 ? Number(a.sample_rate) : 48000,
      channelLayout: Number.isFinite(channels) && channels === 1 ? 'mono' : 'stereo',
    };
  } catch (e) {
    console.warn(`[course-render] ffprobe indisponible/échoué (${e.message}) — durée et cadence non mesurées`);
    return { measured: false, duration: 0, fps: 0, hasAudio: false, audioCodec: '', sampleRate: 48000, channelLayout: 'stereo' };
  }
}

/** libx264 + yuv420p exigent des dimensions PAIRES (une hauteur impaire était corrigée en silence). */
function even(n) {
  const v = Math.floor(Number(n) || 0);
  return Math.max(2, v - (v % 2));
}

/** Durée en dessous de laquelle un segment ne vaut même pas une image → on le jette. */
const MIN_SEGMENT_SECONDS = 0.04;

/**
 * Timeline ABSOLUE du diaporama : liste ordonnée et disjointe de fenêtres
 * `{ index, start, end }` en secondes, bornées par la durée de la source.
 *
 * Deux régimes :
 *   1. NOMINAL — les slides portent `startSeconds` (posé par l'API depuis les
 *      chapitres). On trie, on borne à [0, durée_source] et on désempile les
 *      chevauchements (une slide dont la fenêtre est entièrement avalée par la
 *      précédente disparaît : elle n'aurait de toute façon aucun instant à elle).
 *   2. RÉTRO-COMPAT — jobs anciens, sans placement temporel : on enchaîne les
 *      slides depuis 0 en respectant leurs proportions, mais on met le TOTAL à
 *      l'échelle de la durée source. C'est ce qui empêche la régression mesurée
 *      (12 slides × 3 s = 36 s de diaporama sur une source de 30 s → les slides
 *      11 et 12 n'étaient JAMAIS encodées). Mieux vaut des slides un peu courtes
 *      que des slides invisibles.
 *
 * ⛔ LE RÉGIME 2 EST INTERDIT APRÈS UN RECALAGE DE MONTAGE. Il ne vaut QUE pour un job
 * ancien dont AUCUNE slide n'a jamais porté d'horodatage. Après `remapSlidesForMontage`,
 * une liste vide (ou entièrement dépourvue de fenêtres) signifie « le montage a coupé tous
 * ces passages » — y répondre par une répartition uniforme republierait en plein cadre,
 * formateur réduit au médaillon, EXACTEMENT les plans que le moteur annonce avoir retirés.
 * D'où `allowUniformFallback:false`, posé par l'appelant dès qu'un recalage a eu lieu.
 *
 * @param {Array<{startSeconds?:number, endSeconds?:number, durationSeconds?:number}>} slides
 * @param {number} srcDur durée de la source en secondes (0 = inconnue)
 * @param {{allowUniformFallback?:boolean}} [options]
 */
export function buildDeckTimeline(slides, srcDur, options = {}) {
  const list = Array.isArray(slides) ? slides : [];
  if (!list.length) return [];
  const total = Number.isFinite(srcDur) && srcDur > 0 ? srcDur : 0;
  // Défaut `true` : les appelants historiques (et le harnais de preuve) gardent le
  // comportement d'hier à la virgule près.
  const allowUniformFallback = options?.allowUniformFallback !== false;

  const absolute = [];
  list.forEach((s, i) => {
    const start = Number(s?.startSeconds);
    if (!Number.isFinite(start)) return;
    let end = Number(s?.endSeconds);
    if (!Number.isFinite(end) || end <= start) end = start + (Number(s?.durationSeconds) || 0);
    if (!(end > start)) return;
    absolute.push({ index: i, start: Math.max(0, start), end });
  });

  if (absolute.length) {
    absolute.sort((a, b) => a.start - b.start || a.end - b.end);
    const out = [];
    let cursor = 0;
    for (const it of absolute) {
      let start = Math.max(it.start, cursor);
      let end = it.end;
      if (total > 0) { start = Math.min(start, total); end = Math.min(end, total); }
      if (end - start <= MIN_SEGMENT_SECONDS) continue;
      out.push({ index: it.index, start, end });
      cursor = end;
    }
    if (out.length) return out;
  }

  if (!allowUniformFallback) return [];

  // Régime de repli : durées relatives, total mis à l'échelle de la source.
  const durs = list.map((s) => {
    const d = Number(s?.durationSeconds);
    return Number.isFinite(d) && d > 0 ? d : 1;
  });
  const sum = durs.reduce((a, b) => a + b, 0);
  const scale = total > 0 && sum > 0 ? total / sum : 1;
  const out = [];
  let t = 0;
  for (let i = 0; i < list.length; i += 1) {
    let end = t + durs[i] * scale;
    if (total > 0) end = Math.min(end, total);
    if (end - t > MIN_SEGMENT_SECONDS) out.push({ index: i, start: t, end });
    t = end;
    if (total > 0 && t >= total) break;
  }
  return out;
}

/** Part de la LARGEUR occupée par le médaillon formateur incrusté sur la slide. */
const PIP_WIDTH_RATIO = 0.26;
/** Marge du médaillon par rapport au bord du cadre, en part de la largeur. */
const PIP_MARGIN_RATIO = 0.02;
/** Cadence de repli quand ffprobe n'a pas su mesurer la source. */
const FALLBACK_FPS = 25;

/**
 * payload = {
 *   sourceVideoUrl, sourceVideoStoragePath?, sourceVideoStorageBucket?,
 *   sourceDurationSeconds?,
 *   slides:[{ url, storagePath?, storageBucket?, durationSeconds, startSeconds?, endSeconds?, chapterIndices? }],
 *   width?, height?, renderMode?,
 *   nleProject?, montageChapterWindows?
 * }
 * Les champs `storagePath` sont ceux posés par l'API (course-builder.service). Un job
 * ANCIEN, qui ne porte que des URLs et aucun `startSeconds`, reste valide :
 * `resolveAssetUrl` redérive le chemin et `buildDeckTimeline` bascule en régime de repli.
 * `nleProject` / `montageChapterWindows` / `slides[].chapterIndices` sont eux aussi
 * facultatifs : sans eux, aucun montage n'est appliqué et le rendu est celui d'hier.
 * Renvoie le chemin du MP4 produit. Les fichiers temporaires sont listés dans `tmpFiles`.
 *
 * @param {Array<string>} [diagnostics] rempli avec ce que le moteur a REFUSÉ de traduire ou
 *   a dû ajuster. Paramètre de SORTIE (comme `tmpFiles`) pour ne pas changer le type de
 *   retour, dont dépendent l'appelant et le harnais de preuve.
 */
export async function renderSplitScreen(payload, jobId, tmpFiles, diagnostics) {
  const notes = Array.isArray(diagnostics) ? diagnostics : [];
  // Dimensions PAIRES : une hauteur impaire (1280×721) était silencieusement corrigée
  // par ffmpeg — on la corrige nous-mêmes pour que la sortie soit celle qu'on annonce.
  const W = even(Number(payload?.width) || 1280);
  const H = even(Number(payload?.height) || 720);
  const dir = tmpdir();
  // `raw` = « publier la source telle quelle » : c'est le SEUL mode, avec `pedagogical`,
  // que ce moteur sait produire, et il se traduit par « aucune slide incrustée ».
  const rawMode = String(payload?.renderMode || '') === 'raw';
  // Une slide est exploitable dès qu'elle porte une URL OU un chemin Storage.
  const slides = rawMode
    ? []
    : Array.isArray(payload?.slides)
      ? payload.slides.filter((s) => (typeof s === 'string' ? Boolean(s) : Boolean(s && (s.url || s.storagePath))))
      : [];
  if (!payload?.sourceVideoUrl && !payload?.sourceVideoStoragePath) throw new Error('sourceVideoUrl manquant');

  const srcPath = join(dir, `cr_src_${jobId}.mp4`);
  await materialize(
    await resolveAssetUrl(
      {
        url: payload.sourceVideoUrl,
        storagePath: payload.sourceVideoStoragePath,
        storageBucket: payload.sourceVideoStorageBucket || VIDEOS_BUCKET,
      },
      VIDEOS_BUCKET,
    ),
    srcPath,
  );
  tmpFiles.push(srcPath);

  // La SOURCE est l'autorité sur la durée, la cadence et l'audio (cf. probeSource).
  const probe = await probeSource(srcPath);
  const declaredDur = Number(payload?.sourceDurationSeconds);
  const srcDur =
    probe.duration > 0
      ? probe.duration
      : Number.isFinite(declaredDur) && declaredDur > 0
        ? declaredDur
        : 0;
  // Une cadence délirante (image fixe à 1000 fps, VFR mal décrit) ferait exploser
  // l'encodage : on la ramène dans une plage exploitable.
  const fps = probe.fps > 0 ? Math.min(60, Math.max(10, Math.round(probe.fps * 1000) / 1000)) : FALLBACK_FPS;

  // ── MONTAGE ────────────────────────────────────────────────────────────────
  // Le plan est calculé AVANT tout téléchargement de slide : il décide de la durée de
  // sortie, donc de la fenêtre de chaque plan, donc des plans qui valent la peine d'être
  // téléchargés. `planMontage` est volontairement AVARE : projet absent, vide, ou qui
  // reprend la source à l'identique → `applied:false`, et plus rien ci-dessous ne change.
  // `sourceMeasured` : voir probeSource. Une source non mesurée interdit le montage (sinon,
  // MP4 muet livré en silence) — c'est `planMontage` qui rend le plan inerte et le motif.
  const montage = planMontage(payload?.nleProject, { sourceDuration: srcDur, sourceMeasured: probe.measured });
  for (const n of montage.notices) notes.push(n);
  if (!montage.applied) {
    // Un projet vide ou inerte n'est pas un incident : on ne dérange le formateur que
    // lorsqu'il a POSÉ un montage et que le moteur refuse de le traduire.
    if (montage.segments.length === 0 && payload?.nleProject && !/aucun montage|identique/.test(montage.reason)) {
      notes.push(`montage NON appliqué — ${montage.reason}`);
      console.warn(`[course-render] ${jobId} montage refusé : ${montage.reason}`);
    }
  } else {
    console.log(
      `[course-render] ${jobId} montage appliqué : ${montage.segments.length} segment(s), ` +
        `${montage.timelineDuration.toFixed(3)} s (source ${srcDur.toFixed(3)} s)`,
    );
    // Ceinture-bretelles : un montage sans son est un fait TROP GRAVE pour rester implicite.
    // Ici la source a bien été mesurée (le cas contraire rend le plan inerte plus haut), donc
    // elle est réellement muette — mais le formateur doit le lire AVANT de publier en classe,
    // et non le découvrir en lançant la vidéo devant ses élèves.
    if (!probe.hasAudio) {
      notes.push('la vidéo source ne porte aucune piste audio : le montage est rendu SANS SON.');
    }
  }

  // ⭐ LE NOUVEL AXE DE TEMPS. Dès qu'une coupe raccourcit le cours, PLUS RIEN n'est
  // exprimable en temps source : ni le placement des slides, ni la durée de sortie.
  const outDur = montage.applied ? montage.timelineDuration : srcDur;

  // Recalage des plans sur ce nouvel axe (cf. remapSlidesForMontage), puis élagage : une
  // slide dont le passage a été coupé n'est même pas téléchargée.
  let deckSlides = slides;
  // Un recalage a-t-il eu lieu ? Si oui, l'absence de fenêtre est une DÉCISION du montage
  // (« ce passage n'existe plus »), pas une lacune du job → régime de repli interdit.
  let deckRemapped = false;
  if (montage.applied && slides.length) {
    const placed = slides.some((s) => Number.isFinite(Number(s?.startSeconds)));
    if (placed) {
      const remap = remapSlidesForMontage(slides, montage, payload?.montageChapterWindows, payload?.nleProject);
      for (const n of remap.notices) notes.push(n);
      deckRemapped = true;
      // ⚠️ TESTER LA VALEUR, JAMAIS SA COERCITION. `remapSlidesForMontage` marque un plan
      // coupé avec `startSeconds: null` — or `Number(null) === 0` et `Number.isFinite(0)`
      // vaut `true` : l'ancien filtre ne retirait donc RIEN. Les plans morts restaient dans
      // `deckSlides` (téléchargés depuis le bucket privé pour rien) et, quand TOUS étaient
      // coupés, `buildDeckTimeline` basculait dans son régime de repli et republiait la
      // TOTALITÉ du diaporama sur la durée du montage — le MP4 affichait plein cadre
      // exactement les plans que la notice annonçait retirés.
      deckSlides = remap.slides.filter(
        (s) =>
          s?.startSeconds != null &&
          Number.isFinite(Number(s.startSeconds)) &&
          Number(s.endSeconds) > Number(s.startSeconds),
      );
    } else {
      // Aucune slide n'est horodatée (job d'un ancien émetteur) : il n'y a rien à recaler.
      // On laisse le régime de repli de `buildDeckTimeline` les répartir — sur `outDur`,
      // donc sur le montage et non sur la source.
      notes.push('plans non horodatés : répartis uniformément sur la durée du montage.');
    }
  }

  const slidePaths = [];
  for (let i = 0; i < deckSlides.length; i++) {
    const p = join(dir, `cr_slide_${jobId}_${i}.png`);
    // Signature au dernier moment (bucket privé) — cf. commentaire SMARTBOARD_CANVAS_BUCKET.
    await materialize(await resolveAssetUrl(deckSlides[i], SMARTBOARD_CANVAS_BUCKET), p);
    tmpFiles.push(p);
    slidePaths.push(p);
  }

  // `outDur` et non `srcDur` : c'est le seul changement que la coupe impose au diaporama.
  const timeline = slidePaths.length
    ? buildDeckTimeline(deckSlides, outDur, { allowUniformFallback: !deckRemapped })
    : [];
  const outPath = join(dir, `cr_out_${jobId}.mp4`);
  tmpFiles.push(outPath);

  const args = ['-y', '-loglevel', 'error', '-i', srcPath];

  // Préfixe de montage : il consomme `[0:v]` / `[0:a]` et rend `[nle_pv]` / `[nle_pa]`.
  // Toute la mise en page ci-dessous lit ensuite `VSRC` au lieu de `[0:v]` — c'est le SEUL
  // point de contact entre les deux étages.
  const parts = [];
  let montageAudioLabel = null;
  if (montage.applied) {
    const mf = buildMontageFilters(montage, {
      width: W,
      height: H,
      fps,
      hasAudio: probe.hasAudio,
      sampleRate: probe.sampleRate,
      channelLayout: probe.channelLayout,
    });
    parts.push(...mf.parts);
    montageAudioLabel = mf.audioLabel;
  }
  const VSRC = montage.applied ? '[nle_pv]' : '[0:v]';

  if (timeline.length === 0) {
    // Aucune slide (ou mode « Brut ») → normalisation plein cadre de la source.
    // `fps` est appliqué ICI AUSSI : sans lui, deux rendus du même cours (avec puis
    // sans slides) n'avaient pas la même cadence.
    parts.push(
      `${VSRC}scale=${W}:${H}:force_original_aspect_ratio=decrease:flags=lanczos,` +
        `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${fps}[v]`,
    );
  } else {
    const pipW = even(W * PIP_WIDTH_RATIO);
    const pipH = even(H * PIP_WIDTH_RATIO);
    const margin = even(W * PIP_MARGIN_RATIO);
    // Fin de timeline : le diaporama doit couvrir EXACTEMENT [0, deckEnd] pour que le
    // concat ne dérive pas d'une image par rapport à l'horloge du cours. `outDur` vaut la
    // durée de la SOURCE sans montage, et celle du MONTAGE sinon — c'est là que le
    // diaporama suit la coupe au lieu de rester sur l'ancien axe.
    const deckEnd = outDur > 0 ? outDur : timeline[timeline.length - 1].end;

    // Une entrée ffmpeg par slide RETENUE (une slide éliminée par la timeline — fenêtre
    // vide ou avalée — n'est pas décodée pour rien). `-loop 1 -t` fige le PNG le temps
    // de sa fenêtre ; `trim`+`setpts` plus bas garantit la durée à l'image près.
    const inputOfSegment = new Map();
    timeline.forEach((seg, k) => {
      const dur = seg.end - seg.start;
      args.push('-loop', '1', '-t', dur.toFixed(3), '-i', slidePaths[seg.index]);
      inputOfSegment.set(k, k + 1); // l'entrée 0 est la source vidéo
    });

    // Deux copies de la source (ou du MONTAGE) : le plein cadre (fond) et le médaillon.
    parts.push(`${VSRC}split=2[vbase][vpip]`);
    parts.push(
      `[vbase]scale=${W}:${H}:force_original_aspect_ratio=decrease:flags=lanczos,` +
        `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${fps}[base]`,
    );
    parts.push(
      `[vpip]scale=${pipW}:${pipH}:force_original_aspect_ratio=decrease:flags=lanczos,` +
        `setsar=1,fps=${fps}[pip]`,
    );

    // Le DIAPORAMA est une bande RGBA continue de [0, deckEnd] : segments opaques quand
    // une slide est active, TRANSPARENTS le reste du temps (le formateur plein cadre
    // reste alors visible dessous). C'est ce qui remplace le `concat` bout-à-bout depuis
    // t=0 qui rendait toute synchronisation impossible.
    const deckLabels = [];
    let cursor = 0;
    let g = 0;
    const pushGap = (dur) => {
      if (dur <= MIN_SEGMENT_SECONDS) return;
      const label = `gap${g++}`;
      // `colorchannelmixer=aa=0` met l'alpha à 0 de façon fiable, là où `black@0.0`
      // dépend du format négocié par le filtre `color`.
      parts.push(
        `color=c=black:s=${W}x${H}:r=${fps}:d=${dur.toFixed(3)},format=rgba,` +
          `colorchannelmixer=aa=0,setsar=1,trim=duration=${dur.toFixed(3)},setpts=PTS-STARTPTS[${label}]`,
      );
      deckLabels.push(label);
    };
    timeline.forEach((seg, k) => {
      pushGap(seg.start - cursor);
      const dur = seg.end - seg.start;
      const label = `sl${k}`;
      // `format=rgba` AVANT le pad : les bandes d'un visuel non-16:9 deviennent
      // TRANSPARENTES (le formateur transparaît) au lieu d'être du noir opaque.
      // `flags=lanczos` : sans lui, une slide plus petite que le cadre était
      // suréchantillonnée au filtre par défaut → texte de puces flou.
      parts.push(
        `[${inputOfSegment.get(k)}:v]format=rgba,` +
          `scale=${W}:${H}:force_original_aspect_ratio=decrease:flags=lanczos,setsar=1,` +
          `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=0x00000000,fps=${fps},` +
          `trim=duration=${dur.toFixed(3)},setpts=PTS-STARTPTS[${label}]`,
      );
      deckLabels.push(label);
      cursor = seg.end;
    });
    pushGap(deckEnd - cursor);

    parts.push(`${deckLabels.map((l) => `[${l}]`).join('')}concat=n=${deckLabels.length}:v=1:a=0[deck]`);
    // `eof_action=pass` : si le diaporama se termine avant la source, le formateur
    // continue — l'ancien `repeat` figeait la dernière image jusqu'à la fin du cours.
    parts.push(`[base][deck]overlay=0:0:format=auto:eof_action=pass[stage]`);
    // Le médaillon n'apparaît QUE pendant les fenêtres de slide : hors slide, le
    // formateur est déjà plein cadre et une vignette de lui-même n'aurait aucun sens.
    const pipEnable = timeline
      .map((seg) => `between(t,${seg.start.toFixed(3)},${seg.end.toFixed(3)})`)
      .join('+');
    parts.push(
      `[stage][pip]overlay=x=W-w-${margin}:y=H-h-${margin}:eof_action=pass:enable='${pipEnable}'[v]`,
    );

  }

  args.push('-filter_complex', parts.join(';'), '-map', '[v]');
  // ⚠️ AUDIO : sans montage on garde `-map 0:a?` (la piste de la source, telle quelle).
  // AVEC montage il serait CATASTROPHIQUE de la remapper : elle dure la source entière
  // alors que l'image a été coupée — le cours entier partirait en décalage son/image.
  // On mappe donc la piste RECONSTRUITE, ou aucune si la source est muette.
  if (montage.applied) {
    if (montageAudioLabel) args.push('-map', montageAudioLabel);
  } else {
    args.push('-map', '0:a?');
  }

  args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast', '-crf', '23');
  // Audio : ne PAS réencoder ce qui est déjà de l'AAC (perte de qualité + temps CPU
  // pour rien). Sinon AAC à un débit EXPLICITE — l'ancien `-c:a aac` nu laissait
  // ffmpeg choisir son débit par défaut.
  // Le montage, lui, PASSE PAR LE GRAPHE (découpe, silences, volumes) : ses échantillons
  // n'existent plus tels quels dans le fichier d'entrée, `copy` est alors impossible.
  if (!montage.applied && probe.hasAudio && probe.audioCodec === 'aac') args.push('-c:a', 'copy');
  else args.push('-c:a', 'aac', '-b:a', '192k');
  // Durée DÉTERMINISTE : celle de la source, ou celle du MONTAGE quand il coupe.
  if (outDur > 0) args.push('-t', outDur.toFixed(3));
  else args.push('-shortest'); // durée de la source inconnue → ancien garde-fou
  // `+faststart` déplace le moov en tête : la lecture depuis une URL R2 présignée
  // démarre sans requête Range supplémentaire.
  args.push('-movflags', '+faststart', outPath);

  await runFfmpeg(args);
  return outPath;
}

export async function pollCourseRenderJobs() {
  const { data: jobs } = await supabase
    .from('course_render_jobs')
    .select('*')
    .eq('status', 'queued')
    .limit(2);
  if (!jobs?.length) return 0;

  for (const job of jobs) {
    await supabase.from('course_render_jobs').update({ status: 'rendering', updated_at: new Date().toISOString() }).eq('id', job.id);
    const tmpFiles = [];
    // Ce que le moteur a refusé de traduire ou a dû ajuster. Ce n'est PAS une erreur, mais
    // ça doit atteindre le formateur : sans ça, un fondu enchaîné ou un étalonnage
    // disparaîtrait du MP4 sans que personne ne l'apprenne.
    const notes = [];
    try {
      const outPath = await renderSplitScreen(job.payload || {}, job.id, tmpFiles, notes);
      const key = `tenants/${job.tenant_id}/postprod/${job.content_id}_${job.id}.mp4`;
      const storageKey = await uploadToR2(outPath, key);
      // Sans R2, le MP4 vient d'être produit puis SUPPRIMÉ avec les temporaires : le job
      // n'est pas « completed », il a échoué pour une raison d'infra — on le dit.
      if (!storageKey) {
        throw new Error('R2 non configuré (CF_R2_ACCOUNT_ID / CF_R2_ACCESS_KEY_ID / CF_R2_SECRET_ACCESS_KEY / CF_R2_BUCKET) : le MP4 rendu ne peut pas être stocké.');
      }
      // ⚠️ `output_url` porte en réalité la CLÉ R2 (nom de colonne historique, migration
      // 20260531000003). Le bucket R2 est PRIVÉ : l'URL jouable est PRÉSIGNÉE à la lecture
      // par l'API (CourseBuilderService.getPostprodRenderStatus → `output_video_url`).
      //
      // La colonne `error` sert ICI de canal de MESSAGE, pas seulement d'échec : c'est le
      // seul champ que l'API relaie (→ `error_message`) et que l'écran de post-production
      // affiche déjà, quel que soit le statut, sous « Message du moteur de rendu »
      // (VideoPostProductionPage). Le statut reste `completed` : le rendu a bien abouti,
      // mais le formateur doit savoir ce qui n'a PAS été appliqué. Sans notes → null,
      // ce qui remet au propre un job qui avait échoué lors d'un passage précédent.
      const noteText = notes.length ? `Montage — ${notes.join(' · ')}` : null;
      await supabase.from('course_render_jobs')
        .update({ status: 'completed', output_url: storageKey, error: noteText, updated_at: new Date().toISOString() })
        .eq('id', job.id);
      // Reflète le montage dans le contenu de la formation.
      try {
        const { data: c } = await supabase.from('formation_day_contents').select('data').eq('id', job.content_id).single();
        const nd = { ...((c && c.data) || {}) };
        // B2 — on écrit une CLÉ, donc on la NOMME comme une clé. `renderedStorageKey` est
        // désormais le champ CANONIQUE : aucun lecteur ne doit l'injecter dans <video src>,
        // il faut demander l'URL présignée à l'API (course-builder/render-status →
        // output_video_url), exactement comme les replays.
        nd.renderedStorageKey = storageKey;
        nd.renderedJobId = job.id;
        nd.renderedAt = new Date().toISOString();
        // ⛔ On n'écrit PLUS de miroir `renderedUrl`. Ce champ n'est pas un simple alias :
        // CoursePlayerInterface le teste comme un DRAPEAU booléen « ce contenu porte déjà
        // une URL jouable » et, quand il est rempli, N'INJECTE PAS l'URL signée de la
        // vidéo SOURCE. Y déposer une clé R2 privait donc la classe des DEUX vidéos à la
        // fois : le montage (clé non jouable dans <video src>) ET l'original (jamais
        // signé). Le drapeau « ce contenu a un montage » est porté par
        // `renderedStorageKey` ; le lecteur demande l'URL présignée à l'API
        // (course-builder/render-playback), comme les replays.
        // On NETTOIE au passage le miroir hérité des rendus précédents — sans quoi les
        // contenus déjà rendus resteraient cassés jusqu'à une réécriture manuelle.
        if (nd.renderedUrl && !/^(https?:\/\/|blob:|data:)/i.test(String(nd.renderedUrl).trim())) {
          delete nd.renderedUrl;
        }
        // Trace DURABLE de ce que le montage a fait au contenu : le job peut être purgé,
        // le contenu non. C'est aussi ce qui permettra à l'écran d'afficher « ce montage
        // ne contient pas vos fondus enchaînés » sans relire la file.
        nd.renderedMontageNotes = notes.length ? [...notes] : null;
        await supabase.from('formation_day_contents').update({ data: nd }).eq('id', job.content_id);
      } catch { /* non bloquant */ }
      console.log('[course-render] completed', job.id, storageKey, notes.length ? `(${notes.length} note(s))` : '');
    } catch (e) {
      console.error('[course-render] failed', job.id, e.message);
      await supabase.from('course_render_jobs')
        .update({ status: 'failed', error: String(e.message || e), updated_at: new Date().toISOString() })
        .eq('id', job.id);
    } finally {
      for (const f of tmpFiles) { try { await unlink(f); } catch { /* ignore */ } }
    }
  }
  return jobs.length;
}
