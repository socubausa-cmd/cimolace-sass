// Course video export — LOT 5 du cahier des charges Tableau Vivant (§3.3,
// « Option Générer un cours vidéo ») : assembler les scènes d'une `live_session`
// en UNE vidéo autonome, chaque plan portant la narration de sa scène.
//
// ═══ CE QUI A ÉTÉ EXÉCUTÉ, ET CE QUI NE L'A PAS ÉTÉ ═══════════════════════════
// ⚠️ HONNÊTETÉ — état au 2026-07-31, à lire AVANT de faire confiance à ce fichier.
//
// PROUVÉ, ffmpeg RÉELLEMENT EXÉCUTÉ sur le poste de dev (ffmpeg 8.1.1 Homebrew),
// sur 3 plans dont un seul narré (MP3 de 3,200 s) :
//   • `encodeSegment` rend des plans de 3,720 / 6,000 / 6,000 s — la durée suit la
//     narration (3,200 + 0,5 de respiration) et retombe sur le plancher sans elle ;
//   • les 3 segments sortent avec des flux IDENTIQUES (h264 1920×1080 + aac 48 kHz),
//     donc le collage `concat` en `-c copy` passe : MP4 final de 15,741 s (attendu 15,7) ;
//   • la piste audio est CONTINUE de bout en bout — mesuré : −24,9 dB sur le plan narré,
//     −91,0 dB (silence, mais flux présent) sur le plan sans narration, et 84 352
//     échantillons encore présents sur la dernière seconde.
//
// NON PROUVÉ ICI, ET C'EST LE PIÈGE DOCUMENTÉ DU DÉPÔT (apps/worker/Dockerfile) :
//   • le TEXTE. Le ffmpeg de ce poste est compilé SANS libfreetype : le filtre
//     `drawtext` n'existe tout simplement pas (`ffmpeg -filters | grep drawtext`
//     → 0 ligne ; un graphe qui l'appelle meurt en « No such filter: 'drawtext' »).
//     Le graphe produit par `composeCardFilters` a été construit et RELU, jamais
//     EXÉCUTÉ : aucune carte de cours n'a été rendue ni regardée. La typographie,
//     le repli de ligne et l'empilement vertical des blocs reposent sur des
//     ESTIMATIONS de métriques (cf. LINE_FACTOR / CHAR_WIDTH_RATIO) que personne
//     n'a encore confrontées à une image. Attendre un premier rendu sur le
//     conteneur avant de considérer la mise en page comme acquise.
//   • le chemin Supabase (`exportCourseVideo` de bout en bout) : il n'a jamais été
//     lancé contre une base. Seules ses fonctions pures ont été exercées.
//
// À CONTRÔLER UNE FOIS SUR LE CONTENEUR (mêmes commandes que le Dockerfile) :
//     ffmpeg -filters | grep drawtext   → le filtre doit exister
//     fc-list | head                    → une police doit être visible
//     node -e "import('./src/jobs/courseVideoExport.js').then(m=>m.probeTextCapability().then(console.log))"
//         → doit rendre { available:true, fontFile:'…', reason:'' }
//
// ⛔ POURQUOI CE JOB REFUSE DE S'EXÉCUTER SANS `drawtext` (et n'invente pas un repli
// silencieux) : le Dockerfile le dit déjà pour libass — « ffmpeg sort en code 0 après
// avoir dessiné du vide ». Un cours vidéo de 40 plans muets d'écriture, livré en
// statut « réussi », est exactement la panne invisible qu'on refuse. Le repli sans
// texte existe (`allowTextlessFallback`) mais il est OPT-IN, il ne produit que des
// cartes de couleur SANS UN MOT, et il est signalé dans `notes` du résultat.
//
// ═══ PÉRIMÈTRE ═══════════════════════════════════════════════════════════════
// Ce module n'écrit RIEN en base : ni statut, ni table de file (aucune n'existe pour
// cet export au 2026-07-31). Son seul effet de bord est l'objet R2 déposé sous une
// clé DÉTERMINISTE — d'où son idempotence : rejouer l'export d'une session réécrit
// le même objet, ne duplique rien, et ne laisse aucun temporaire derrière lui.
//
// Conventions reprises de `courseRender.js` (même worker, mêmes pièges) : client
// Supabase service_role, signature au dernier moment des buckets PRIVÉS, upload R2
// en SigV4, wrappers ffmpeg/ffprobe. Ces briques sont IMPORTÉES et non recopiées :
// la logique de signature (bucket privé → 403 sur l'URL publique) doit rester unique.
import { readdir, mkdtemp, rm, writeFile, access } from 'fs/promises';
import { constants as FS } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { runFfmpeg, runFfprobe, materialize, resolveAssetUrl, uploadToR2 } from './courseRender.js';

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

// Bucket des narrations par scène, posé par `apps/api/src/masterclass-factory/scene-audio.service.ts`
// (chemin `{tenant}/{session}/{scene}.mp3`). Il est PRIVÉ et l'URL persistée dans
// `live_scenes.audio_url` est une URL SIGNÉE à 30 jours : sur une session un peu
// ancienne elle est PÉRIMÉE. `resolveAssetUrl` en redérive le chemin Storage et
// resigne juste avant le téléchargement — c'est la raison d'être de cette constante.
const SCENE_AUDIO_BUCKET = 'scene-audio';

// ── Cadre et typographie ────────────────────────────────────────────────────────
const OUT_WIDTH = 1920;
const OUT_HEIGHT = 1080;
// Cartes fixes : 25 i/s suffit largement, et `-tune stillimage` fait le reste.
const OUT_FPS = 25;
const AUDIO_RATE = 48000;
const AUDIO_LAYOUT = 'stereo';

// Palette LIRI (apps/app/src/styles/liri-brand-theme.css). Directive artistique :
// fond #262624, accent corail — ni navy, ni violet, ni teal.
const COLOR_BG = '0x262624';
const COLOR_ACCENT = '0xd97757';
const COLOR_TEXT = '0xf5f5f7';
const COLOR_MUTED = '0x8e8e93';
const COLOR_SOFT = '0xd8d6d0';

const MARGIN_X = 130;
const CONTENT_WIDTH = OUT_WIDTH - MARGIN_X * 2;

const SIZE_CHAPTER = 34;
const SIZE_TITLE = 68;
const SIZE_IDEA = 44;
const SIZE_POINT = 36;
const SIZE_FOOTER = 26;

/**
 * Interligne budgétée, en cadratins. Reprise de la métrique Noto Sans déjà établie
 * dans `short-sous-titres.js` (ascendante 1,069 + descendante 0,293 = 1,362).
 * ⚠️ C'est une ESTIMATION servant à EMPILER les blocs : `drawtext` fait son propre
 * interligne, on ne le pilote pas. Un écart de quelques pixels ne casse rien tant
 * que les blocs gardent une marge entre eux (cf. GAP_*).
 */
const LINE_FACTOR = 1.36;

/**
 * Largeur d'avance moyenne, en part du corps. ESTIMATION, PAS UNE MESURE : on ne
 * peut pas mesurer la police depuis Node sans la charger. 0,52 est volontairement
 * pessimiste (Noto Sans est plus large qu'Helvetica) — une ligne un peu courte est
 * sans conséquence, une ligne qui déborde du cadre est illisible.
 */
const CHAR_WIDTH_RATIO = 0.52;

const GAP_AFTER_CHAPTER = 30;
const GAP_AFTER_TITLE = 34;
const GAP_AFTER_RULE = 34;
const GAP_AFTER_IDEA = 40;
const GAP_BETWEEN_POINTS = 16;

const Y_CHAPTER = 92;
const RULE_HEIGHT = 5;
const RULE_WIDTH = 190;
const FOOTER_BASELINE = OUT_HEIGHT - 92;

/** Durée d'un plan sans narration : le temps de lire la carte. */
export const DEFAULT_FLOOR_SECONDS = 6;
/**
 * Plancher appliqué MÊME avec narration : une scène dont le MP3 dure 0,8 s
 * produirait un plan illisible. La voix n'est jamais tronquée (elle est plus courte
 * que le plan), seul le silence de fin s'allonge.
 */
const MIN_READABLE_SECONDS = 2.5;
/** Respiration après la voix, pour que la phrase ne soit pas coupée par la transition. */
const TAIL_SECONDS = 0.5;

/**
 * Polices candidates, dans l'ordre de préférence.
 *
 * ⚠️ AUCUN de ces chemins n'a pu être vérifié sur l'image déployée depuis ce poste.
 * `apk add font-noto` (Dockerfile) installe bien une Noto, mais le NOM du fichier
 * varie selon la version d'Alpine (statique `NotoSans-Regular.ttf` sur les anciennes,
 * variable `NotoSans[wdth,wght].ttf` sur les récentes). D'où le balayage de secours
 * de `scanFontDirs` : plutôt qu'un chemin en dur qui ferait échouer l'export sur une
 * image un peu différente, on prend la première police réellement présente.
 * `COURSE_EXPORT_FONT_FILE` reste le dernier mot de l'exploitant.
 */
const FONT_CANDIDATES = [
  '/usr/share/fonts/noto/NotoSans-Regular.ttf',
  '/usr/share/fonts/noto/NotoSans[wdth,wght].ttf',
  '/usr/share/fonts/noto/NotoSans-Regular.otf',
  '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/dejavu/DejaVuSans.ttf',
  // Poste de dev macOS — sans valeur en production, mais évite de bloquer un essai local.
  '/System/Library/Fonts/Supplemental/Arial.ttf',
  '/Library/Fonts/Arial.ttf',
];

const FONT_DIRS = ['/usr/share/fonts', '/usr/local/share/fonts'];

async function fileExists(p) {
  try {
    await access(p, FS.R_OK);
    return true;
  } catch {
    return false;
  }
}

/** Balayage borné (profondeur 3) des dossiers de polices système. */
async function scanFontDirs(dirs, depth = 3) {
  for (const dir of dirs) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    const subDirs = [];
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) subDirs.push(full);
      else if (/\.(ttf|otf)$/i.test(e.name)) return full;
    }
    if (depth > 1) {
      const found = await scanFontDirs(subDirs, depth - 1);
      if (found) return found;
    }
  }
  return null;
}

/** @returns {Promise<string|null>} chemin d'une police utilisable, ou null. */
export async function resolveFontFile() {
  const forced = String(process.env.COURSE_EXPORT_FONT_FILE || '').trim();
  if (forced) return (await fileExists(forced)) ? forced : null;
  for (const c of FONT_CANDIDATES) {
    if (await fileExists(c)) return c;
  }
  return scanFontDirs(FONT_DIRS);
}

/**
 * Le ffmpeg courant sait-il RÉELLEMENT graver du texte ?
 *
 * On ne se contente pas de lister les filtres : on ENCODE une image d'essai avec la
 * police retenue. C'est le seul contrôle qui distingue « drawtext existe » de
 * « drawtext existe ET sait ouvrir cette police » — un `fontfile` illisible fait
 * échouer le graphe, pas la liste des filtres.
 *
 * @returns {Promise<{available:boolean, fontFile:string, reason:string}>}
 */
export async function probeTextCapability() {
  const fontFile = await resolveFontFile();
  if (!fontFile) {
    return {
      available: false,
      fontFile: '',
      reason:
        "aucune police trouvée (ni COURSE_EXPORT_FONT_FILE, ni /usr/share/fonts) — installer `fontconfig font-noto` et vérifier `fc-list`",
    };
  }
  try {
    await runFfmpeg([
      '-y',
      '-loglevel',
      'error',
      '-f',
      'lavfi',
      '-i',
      `color=c=${COLOR_BG}:s=64x64:d=1`,
      '-vf',
      `drawtext=fontfile=${quoteFilterValue(fontFile)}:text=Aa:expansion=none:fontsize=24:fontcolor=${COLOR_TEXT}:x=4:y=4`,
      '-frames:v',
      '1',
      '-f',
      'null',
      '-',
    ]);
    return { available: true, fontFile, reason: '' };
  } catch (e) {
    return { available: false, fontFile, reason: String(e?.message || e).slice(0, 240) };
  }
}

/**
 * Échappement d'une valeur d'option de filtergraph.
 *
 * ⚠️ Le `'` est REFUSÉ plutôt qu'échappé. L'échappement de ffmpeg est à deux étages
 * (analyseur de graphe puis analyseur d'options) et la quote simple est précisément
 * le cas où les deux se contredisent selon la version : mieux vaut une erreur nette
 * qu'un graphe qui se réinterprète tout seul. Aucun de nos chemins (dossier
 * temporaire créé ici, police système) n'en contient.
 */
function quoteFilterValue(value) {
  const s = String(value);
  if (s.includes("'")) throw new Error(`Chemin refusé pour un filtre ffmpeg (quote simple) : ${s}`);
  return `'${s.replace(/\\/g, '\\\\').replace(/:/g, '\\:')}'`;
}

/**
 * Découpe un texte en lignes d'au plus `maxChars` caractères, SANS jamais couper un
 * mot (même règle que `couperEnLignes` de short-sous-titres.js). Un mot plus long
 * que la ligne occupe sa ligne et débordera : c'est assumé, le tronquer produirait
 * un mot faux, ce qui est pire dans un cours.
 */
function wrapText(text, maxChars) {
  const words = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  if (!words.length) return [];
  const lines = [];
  let current = '';
  for (const w of words) {
    if (!current) current = w;
    else if (current.length + 1 + w.length <= maxChars) current += ` ${w}`;
    else {
      lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function maxCharsFor(fontSize) {
  return Math.max(8, Math.floor(CONTENT_WIDTH / (fontSize * CHAR_WIDTH_RATIO)));
}

function blockHeight(lineCount, fontSize) {
  return Math.round(lineCount * fontSize * LINE_FACTOR);
}

/**
 * Extrait de la scène ce qu'il y a à ÉCRIRE au tableau.
 *
 * Deux vocabulaires cohabitent dans `content_payload_json` (cf. master-factory.service.ts) :
 *   • `ia_data` — la forme lue par le tableau vivant (title / core_idea / development /
 *     slide_summary / student_prompt) ;
 *   • `blocks`  — la forme historique des lecteurs legacy (title / key-idea / retain).
 * On lit la première et on retombe sur la seconde : une scène publiée par un ancien
 * émetteur reste exportable au lieu de sortir vide.
 */
export function readSceneContent(scene) {
  const payload = scene && typeof scene.content_payload_json === 'object' && scene.content_payload_json
    ? scene.content_payload_json
    : {};
  const ia = payload.ia_data && typeof payload.ia_data === 'object' ? payload.ia_data : {};
  const blocks = Array.isArray(payload.blocks)
    ? payload.blocks
    : Array.isArray(ia.blocks)
      ? ia.blocks
      : [];
  const blockOf = (type) => blocks.find((b) => b && b.type === type) || null;

  const clean = (v) => (typeof v === 'string' && v.trim() ? v.trim() : '');

  const title = clean(ia.title) || clean(blockOf('title')?.text) || clean(scene?.name);
  const coreIdea = clean(ia.core_idea) || clean(blockOf('key-idea')?.text) || clean(ia.slide_summary);

  let points = [];
  if (Array.isArray(ia.development)) {
    for (const group of ia.development) {
      const list = Array.isArray(group?.points) ? group.points : [];
      for (const p of list) {
        const t = clean(p);
        if (t) points.push(t);
      }
    }
  }
  if (!points.length) {
    const retain = blockOf('retain');
    if (Array.isArray(retain?.items)) points = retain.items.map(clean).filter(Boolean);
  }

  const chapterRaw = scene?.chapter_id ?? ia.chapter_id ?? payload.chapter_id;
  const chapterId = Number.isFinite(Number(chapterRaw)) && Number(chapterRaw) > 0 ? Number(chapterRaw) : null;

  // `audio_url` est doublement écrit par scene-audio.service.ts (colonne + JSON) :
  // la colonne peut manquer si la migration 20260731090000 n'est pas appliquée.
  const audioUrl = clean(scene?.audio_url) || clean(payload.audio_url) || '';

  return { title, coreIdea, points, chapterId, audioUrl };
}

/**
 * Construit la chaîne de filtres d'UNE carte, et la liste des fichiers texte à écrire.
 *
 * ⭐ `textfile=` et non `text=` : le contenu d'un cours contient des `:`, des `'`, des
 * `%` et des accolades — tout ce qui fait exploser l'analyseur de filtres, et que
 * short-sous-titres.js documente comme « NON MAÎTRISÉ » écrit dans un `drawtext=`.
 * En passant par un fichier, le texte ne traverse JAMAIS l'analyseur. `expansion=none`
 * ferme la dernière porte : sans lui, un `%{…}` du cours serait interprété.
 *
 * @returns {{filters:string[], files:Array<{path:string, content:string}>, truncated:boolean}}
 */
export function composeCardFilters(content, opts) {
  const { fontFile, dir, index, courseTitle, total } = opts;
  const filters = [];
  const files = [];
  let truncated = false;
  let fileSeq = 0;

  const pushText = (text, { fontSize, color, x, y, align }) => {
    const path = join(dir, `t_${index}_${fileSeq++}.txt`);
    files.push({ path, content: text });
    // `x=w-tw-M` : l'alignement à droite se calcule dans ffmpeg, qui est le SEUL à
    // connaître la largeur réelle du texte (`tw`) — notre estimation ne sert qu'au
    // découpage en lignes, jamais au positionnement.
    const xExpr = align === 'right' ? `w-tw-${MARGIN_X}` : String(x);
    filters.push(
      `drawtext=fontfile=${quoteFilterValue(fontFile)}:textfile=${quoteFilterValue(path)}` +
        `:expansion=none:fontsize=${fontSize}:fontcolor=${color}:x=${xExpr}:y=${y}`,
    );
  };

  let y = Y_CHAPTER;

  if (content.chapterId) {
    pushText(`CHAPITRE ${content.chapterId}`, { fontSize: SIZE_CHAPTER, color: COLOR_ACCENT, x: MARGIN_X, y });
    y += blockHeight(1, SIZE_CHAPTER) + GAP_AFTER_CHAPTER;
  }

  if (content.title) {
    // 3 lignes de titre au maximum : au-delà, ce n'est plus un titre, et la carte
    // n'aurait plus de place pour l'idée qu'elle doit porter.
    const lines = wrapText(content.title, maxCharsFor(SIZE_TITLE)).slice(0, 3);
    pushText(lines.join('\n'), { fontSize: SIZE_TITLE, color: COLOR_TEXT, x: MARGIN_X, y });
    y += blockHeight(lines.length, SIZE_TITLE) + GAP_AFTER_TITLE;
    filters.push(
      `drawbox=x=${MARGIN_X}:y=${y}:w=${RULE_WIDTH}:h=${RULE_HEIGHT}:color=${COLOR_ACCENT}:t=fill`,
    );
    y += RULE_HEIGHT + GAP_AFTER_RULE;
  }

  // Plafond vertical : la zone se termine au-dessus du pied de page.
  const yLimit = FOOTER_BASELINE - 60;

  if (content.coreIdea) {
    const lines = wrapText(content.coreIdea, maxCharsFor(SIZE_IDEA)).slice(0, 5);
    const h = blockHeight(lines.length, SIZE_IDEA);
    if (y + h <= yLimit) {
      pushText(lines.join('\n'), { fontSize: SIZE_IDEA, color: COLOR_TEXT, x: MARGIN_X, y });
      y += h + GAP_AFTER_IDEA;
    } else {
      truncated = true;
    }
  }

  for (const point of content.points) {
    const maxChars = maxCharsFor(SIZE_POINT) - 3;
    const lines = wrapText(point, maxChars);
    if (!lines.length) continue;
    // Puce sur la première ligne, retrait pendu sur les suivantes : sans ça, une
    // idée sur deux lignes se lit comme deux idées distinctes.
    const rendered = lines.map((l, i) => (i === 0 ? `—  ${l}` : `    ${l}`)).join('\n');
    const h = blockHeight(lines.length, SIZE_POINT);
    if (y + h > yLimit) {
      truncated = true;
      break;
    }
    pushText(rendered, { fontSize: SIZE_POINT, color: COLOR_SOFT, x: MARGIN_X, y });
    y += h + GAP_BETWEEN_POINTS;
  }

  if (courseTitle) {
    pushText(courseTitle, { fontSize: SIZE_FOOTER, color: COLOR_MUTED, x: MARGIN_X, y: FOOTER_BASELINE });
  }
  pushText(`${index + 1} / ${total}`, {
    fontSize: SIZE_FOOTER,
    color: COLOR_MUTED,
    x: 0,
    y: FOOTER_BASELINE,
    align: 'right',
  });

  return { filters, files, truncated };
}

/**
 * Cartes du repli SANS TEXTE (`allowTextlessFallback`). Elles ne portent AUCUN mot :
 * seulement un bandeau corail dont la largeur varie avec le rang du plan, pour qu'on
 * voie au moins que la vidéo avance. Ce n'est PAS un cours — c'est un moyen d'exercer
 * la chaîne d'assemblage sur un ffmpeg dépourvu de `drawtext`.
 */
function composeTextlessFilters(index, total) {
  const w = Math.max(60, Math.round((CONTENT_WIDTH * (index + 1)) / Math.max(1, total)));
  return [
    `drawbox=x=${MARGIN_X}:y=${Math.round(OUT_HEIGHT / 2) - 40}:w=${w}:h=80:color=${COLOR_ACCENT}:t=fill`,
  ];
}

// `export` sur les trois primitives d'assemblage (carte / plan / liste de collage) :
// elles sont pilotées telles quelles par le harnais de preuve, qui n'a ni base ni R2.
// Prouver une COPIE de ces commandes ne prouverait rien.
export async function renderCardPng(filters, outPath) {
  await runFfmpeg([
    '-y',
    '-loglevel',
    'error',
    '-f',
    'lavfi',
    '-i',
    `color=c=${COLOR_BG}:s=${OUT_WIDTH}x${OUT_HEIGHT}`,
    '-vf',
    filters.join(','),
    '-frames:v',
    '1',
    outPath,
  ]);
}

/** Durée d'un média, en secondes. 0 si illisible (jamais une erreur : on dégrade). */
async function probeDuration(filePath) {
  try {
    const out = await runFfprobe(['-v', 'error', '-print_format', 'json', '-show_format', filePath]);
    const d = Number(JSON.parse(out)?.format?.duration);
    return Number.isFinite(d) && d > 0 ? d : 0;
  } catch {
    return 0;
  }
}

/**
 * Encode UN plan : image fixe + piste audio, durée bornée à `duration`.
 *
 * ⛔ TOUS LES SEGMENTS DOIVENT SORTIR AVEC LES MÊMES PARAMÈTRES DE FLUX. Le collage
 * final se fait au démuxeur `concat` en `-c copy` : un segment sans piste audio, ou
 * en 44,1 kHz quand les autres sont en 48 kHz, ferait échouer le collage (ou, pire,
 * produirait un fichier dont la lecture décroche au changement de plan). D'où la
 * piste `anullsrc` imposée aux scènes SANS narration : le silence est un flux, pas
 * une absence de flux.
 *
 * `apad` allonge l'audio en silence jusqu'à ce que `-t` coupe : la voix n'est jamais
 * tronquée par le plan, et le plan n'est jamais tronqué par la voix.
 */
export async function encodeSegment({ imagePath, audioPath, duration, outPath }) {
  const args = ['-y', '-loglevel', 'error', '-loop', '1', '-framerate', String(OUT_FPS), '-i', imagePath];
  if (audioPath) args.push('-i', audioPath);
  else args.push('-f', 'lavfi', '-i', `anullsrc=r=${AUDIO_RATE}:cl=${AUDIO_LAYOUT}`);

  const graph = [
    `[0:v]scale=${OUT_WIDTH}:${OUT_HEIGHT}:force_original_aspect_ratio=decrease:flags=lanczos,` +
      `pad=${OUT_WIDTH}:${OUT_HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=${COLOR_BG},setsar=1,fps=${OUT_FPS}[v]`,
    `[1:a]aresample=${AUDIO_RATE},aformat=sample_fmts=fltp:channel_layouts=${AUDIO_LAYOUT},apad[a]`,
  ].join(';');

  args.push(
    '-filter_complex',
    graph,
    '-map',
    '[v]',
    '-map',
    '[a]',
    // ⚠️ `-t` et SURTOUT PAS `-shortest` : `apad` produit un flux infini, `-shortest`
    // n'aurait donc jamais de borne côté audio et se rabattrait sur la vidéo bouclée.
    '-t',
    duration.toFixed(3),
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-preset',
    'veryfast',
    '-tune',
    'stillimage',
    '-crf',
    '23',
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-ar',
    String(AUDIO_RATE),
    '-ac',
    '2',
    outPath,
  );
  await runFfmpeg(args);
}

/** Fichier de liste du démuxeur `concat`. Les chemins sont les nôtres (dossier temporaire). */
export function concatListContent(segmentPaths) {
  return segmentPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n') + '\n';
}

/**
 * Assemble les scènes d'une `live_session` en une vidéo de cours autonome.
 *
 * TOLÉRANCE (exigence du lot) : une scène sans narration ne bloque pas — elle reçoit
 * une durée plancher et une piste silencieuse. Une scène sans le moindre texte, ou
 * dont l'encodage échoue, est SAUTÉE et TRACÉE dans `skipped` ; l'export continue.
 * Seule une session sans AUCUN plan exploitable lève une erreur.
 *
 * @param {{
 *   liveSessionId: string,
 *   floorSeconds?: number,
 *   allowTextlessFallback?: boolean,
 *   keepLocal?: boolean,
 *   storageKey?: string,
 * }} options
 * @returns {Promise<{
 *   scenes: number, scenesTotal: number, withAudio: number,
 *   skipped: Array<{sceneId:string, orderIndex:number|null, reason:string}>,
 *   notes: string[], durationSeconds: number,
 *   outputPath: string|null, url: string|null, textRendered: boolean
 * }>}
 */
export async function exportCourseVideo(options = {}) {
  const liveSessionId = String(options.liveSessionId || '').trim();
  if (!liveSessionId) throw new Error('liveSessionId manquant');
  const floorSeconds = Number.isFinite(Number(options.floorSeconds)) && Number(options.floorSeconds) > 0
    ? Number(options.floorSeconds)
    : DEFAULT_FLOOR_SECONDS;

  const notes = [];
  const skipped = [];

  const { data: session, error: sessionError } = await supabase
    .from('live_sessions')
    .select('id, title, tenant_id')
    .eq('id', liveSessionId)
    .single();
  if (sessionError || !session) {
    throw new Error(`live_session ${liveSessionId} introuvable : ${sessionError?.message || 'aucune ligne'}`);
  }

  // `select('*')` volontaire : `chapter_id` / `render_mode` / `audio_url` sont des
  // colonnes RÉCENTES (migration 20260731090000). Les nommer ferait échouer la
  // requête ENTIÈRE sur une base où la migration n'est pas passée, alors que
  // `readSceneContent` sait très bien s'en passer.
  const { data: sceneRows, error: scenesError } = await supabase
    .from('live_scenes')
    .select('*')
    .eq('live_session_id', liveSessionId)
    .order('order_index', { ascending: true });
  if (scenesError) throw new Error(`Lecture des scènes impossible : ${scenesError.message}`);

  const scenes = Array.isArray(sceneRows) ? sceneRows : [];
  if (!scenes.length) throw new Error(`La session ${liveSessionId} ne porte aucune scène : rien à exporter.`);

  const capability = await probeTextCapability();
  let textRendered = capability.available;
  if (!capability.available) {
    if (!options.allowTextlessFallback) {
      throw new Error(
        `Le texte ne peut pas être gravé (${capability.reason}). ` +
          'Un cours vidéo sans un mot au tableau ne doit pas être livré en silence : ' +
          "corriger l'image (ffmpeg avec libfreetype + une police) ou passer allowTextlessFallback:true en connaissance de cause.",
      );
    }
    textRendered = false;
    notes.push(
      `REPLI SANS TEXTE — aucune carte ne porte le moindre mot (${capability.reason}). ` +
        "Cette vidéo n'est PAS un cours diffusable.",
    );
  }

  const dir = await mkdtemp(join(tmpdir(), `cve_${liveSessionId.slice(0, 8)}_`));
  let outPath = join(dir, 'cours.mp4');
  let uploadedKey = null;
  let totalDuration = 0;
  let withAudio = 0;

  try {
    const segments = [];
    for (let i = 0; i < scenes.length; i += 1) {
      const scene = scenes[i];
      const sceneId = String(scene?.id || `#${i}`);
      const orderIndex = Number.isFinite(Number(scene?.order_index)) ? Number(scene.order_index) : null;
      const content = readSceneContent(scene);

      if (textRendered && !content.title && !content.coreIdea && !content.points.length) {
        skipped.push({ sceneId, orderIndex, reason: 'aucun texte exploitable (ni titre, ni idée, ni point)' });
        continue;
      }

      // ── Narration ──────────────────────────────────────────────────────────
      // Un échec ici ne saute JAMAIS la scène : le plan est conservé, muet, et tracé.
      let audioPath = null;
      let audioSeconds = 0;
      if (content.audioUrl) {
        const candidate = join(dir, `a_${i}.mp3`);
        try {
          await materialize(await resolveAssetUrl({ url: content.audioUrl }, SCENE_AUDIO_BUCKET), candidate);
          audioSeconds = await probeDuration(candidate);
          if (audioSeconds > 0) {
            audioPath = candidate;
            withAudio += 1;
          } else {
            notes.push(`scène ${i + 1} : narration illisible (durée nulle) → plan muet`);
          }
        } catch (e) {
          notes.push(`scène ${i + 1} : narration inaccessible (${String(e?.message || e).slice(0, 120)}) → plan muet`);
        }
      }

      const duration = audioSeconds > 0
        ? Math.max(audioSeconds + TAIL_SECONDS, MIN_READABLE_SECONDS)
        : floorSeconds;

      // ── Carte + encodage du plan ───────────────────────────────────────────
      try {
        const imagePath = join(dir, `p_${i}.png`);
        if (textRendered) {
          const card = composeCardFilters(content, {
            fontFile: capability.fontFile,
            dir,
            index: i,
            courseTitle: String(session.title || ''),
            total: scenes.length,
          });
          for (const f of card.files) await writeFile(f.path, f.content, 'utf8');
          if (card.truncated) {
            notes.push(`scène ${i + 1} : carte trop chargée, la fin du contenu n'est pas affichée`);
          }
          await renderCardPng(card.filters, imagePath);
        } else {
          await renderCardPng(composeTextlessFilters(i, scenes.length), imagePath);
        }

        const segPath = join(dir, `s_${String(i).padStart(4, '0')}.mp4`);
        await encodeSegment({ imagePath, audioPath, duration, outPath: segPath });
        segments.push(segPath);
        totalDuration += duration;
      } catch (e) {
        // La scène est perdue, pas l'export. Si elle portait une narration, on la
        // retire du compte : ce plan n'existe pas dans le MP4.
        if (audioPath) withAudio -= 1;
        skipped.push({ sceneId, orderIndex, reason: `rendu du plan échoué : ${String(e?.message || e).slice(0, 200)}` });
      }
    }

    if (!segments.length) {
      throw new Error(
        `Aucun plan exploitable sur ${scenes.length} scène(s) — voir skipped : ${skipped
          .map((s) => s.reason)
          .join(' · ')
          .slice(0, 400)}`,
      );
    }

    const listPath = join(dir, 'plans.txt');
    await writeFile(listPath, concatListContent(segments), 'utf8');
    // `-c copy` : les segments sortent déjà aux bons paramètres (cf. encodeSegment),
    // ré-encoder ici coûterait une génération de qualité pour rien.
    // `+faststart` : la lecture depuis une URL R2 présignée démarre sans requête Range.
    await runFfmpeg([
      '-y',
      '-loglevel',
      'error',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      listPath,
      '-c',
      'copy',
      '-movflags',
      '+faststart',
      outPath,
    ]);

    // ── Dépôt ──────────────────────────────────────────────────────────────────
    // Clé DÉTERMINISTE : c'est ce qui rend le job idempotent (rejouer réécrit le même
    // objet). Le bucket R2 est PRIVÉ — l'URL jouable est présignée à la lecture,
    // exactement comme les rendus de courseRender.js.
    const key = String(options.storageKey || '').trim()
      || `tenants/${session.tenant_id || 'sans-tenant'}/cours-video/${liveSessionId}.mp4`;
    uploadedKey = await uploadToR2(outPath, key);
    if (!uploadedKey) {
      // Sans R2 on ne perd pas le travail : on garde le MP4 sur disque et on le DIT.
      // L'appelant reçoit `outputPath` et devient responsable du fichier.
      notes.push(
        'R2 non configuré (CF_R2_ACCOUNT_ID / CF_R2_ACCESS_KEY_ID / CF_R2_SECRET_ACCESS_KEY / CF_R2_BUCKET) : ' +
          'le MP4 reste sur le disque local et le dossier temporaire N\'EST PAS supprimé.',
      );
    }

    const keepFile = Boolean(options.keepLocal) || !uploadedKey;
    if (!keepFile) {
      await rm(dir, { recursive: true, force: true });
      outPath = null;
    }

    console.log(
      `[course-video-export] ${liveSessionId} → ${segments.length} plan(s), ` +
        `${withAudio} narré(s), ${skipped.length} sauté(s), ${totalDuration.toFixed(1)} s` +
        (uploadedKey ? ` → ${uploadedKey}` : ' (local)'),
    );

    return {
      scenes: segments.length,
      scenesTotal: scenes.length,
      withAudio,
      skipped,
      notes,
      durationSeconds: Math.round(totalDuration * 1000) / 1000,
      outputPath: outPath,
      url: uploadedKey,
      textRendered,
    };
  } catch (e) {
    // Sur échec, aucun résidu : le dossier temporaire entier disparaît.
    await rm(dir, { recursive: true, force: true }).catch(() => {});
    console.error(`[course-video-export] ${liveSessionId} échec :`, e?.message || e);
    throw e;
  }
}
