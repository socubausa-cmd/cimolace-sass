/**
 * short-generator.js — Génération de shorts verticaux (9:16) à partir
 * des replays : Vidéothèque (`zoom_recordings`) et directs LiveKit (`live_recordings`).
 *
 * Pipeline :
 *   1. Transcription — RÉEMPLOYÉE si elle existe déjà (voir plus bas), sinon Whisper
 *   2. CHOIX DES MOMENTS — par le SENS (short-highlights.js) : le modèle lit la
 *      transcription horodatée et rend les passages qui ACCROCHENT, avec un titre et
 *      une raison ; un garde-fou MESURÉ (silence réel, image vide) a ensuite le
 *      dernier mot, parce que le modèle ne peut ni entendre un blanc ni voir un
 *      tableau vierge. Repli mécanique explicitement étiqueté si le modèle manque.
 *   3. RELECTURE DU TEXTE AFFICHÉ (short-sous-titres.js) : la transcription
 *      automatique est fautive — « Je suis Shao cinquième Manikongo piste Vita Kimba »
 *      pour « Je suis Cheo, cinquième Manikongo, fils de Kimpa Vita ». Tant que le
 *      sous-titre était un ornement de 18 px, cela passait ; c'est maintenant LE
 *      CONTENU du clip. Le modèle relit, des garde-fous serveur refusent toute
 *      réécriture, et l'original reste tracé en base.
 *   4. FFmpeg : découpage, mise en page 9:16 où LE TEXTE EST LE HÉROS
 *      (`geometrieVerticale` : ~43 à 52 % de la trame pour la parole, ~28 % pour la
 *      vidéo), cadrage du contenu DANS la bande vidéo décidé extrait par extrait
 *      (short-cadrage.js détecte), puis incrustation d'un ASS fabriqué par nous.
 *      ⛔ Aucun repli « clip sans texte » : si ce ffmpeg ne sait pas dessiner, on ne
 *      produit RIEN et on l'écrit dans `shorts_error`.
 *   5. Upload vers R2
 *   6. Sauvegarde metadata en DB (`short_clips`), avec traçabilité de la sélection,
 *      du cadrage, de la mise en page et de la relecture
 *
 * ── CONTRAT D'IDEMPOTENCE VIDÉOTHÈQUE (zoom_recordings.shorts_status) ──────
 * Colonne dédiée, calquée sur `live_recordings.shorts_status` (jumeau LiveKit),
 * migration : supabase/migrations/20260727140000_zoom_shorts_idempotence.sql
 *
 *   NULL         → jamais demandé. LE POLLER NE LE PREND PAS.  ← garde de dépense :
 *                  les 61 replays déjà en base ne partent PAS tout seuls à l'encodage.
 *   'requested'  → le créateur a explicitement cliqué depuis la Vidéothèque.
 *                  ('queued' est accepté comme synonyme, au cas où le déclencheur
 *                   côté API emploie ce verbe : les deux entrent dans la file.)
 *   'processing' → pris par un worker (posé AVANT le travail, comme le jumeau).
 *   'done'       → terminé, clips visibles dans `short_clips`.
 *   'error'      → échoué ; motif lisible dans `shorts_error`, nombre d'essais dans
 *                  `shorts_attempts`. Fail-closed : on ne retente PAS tout seul,
 *                  c'est un nouveau clic (repasser à 'requested') qui relance.
 *
 * Garde-fous : au-delà de SHORTS_MAX_ATTEMPTS essais cumulés on passe en 'error'
 * avec le motif écrit (jamais de boucle silencieuse) ; un 'processing' orphelin
 * (worker redéployé en plein travail — c'est arrivé côté LiveKit, une ligne y est
 * figée depuis) est repris après SHORTS_STALE_MS.
 *
 * ── RÉEMPLOI DES TRANSCRIPTIONS (le vrai enjeu d'argent) ──────────────────
 * 56 des 61 replays de la Vidéothèque ont DÉJÀ leurs cues horodatées
 * (`zoom_recordings.transcript_cues`, doublées dans `published_videos`), payées
 * une fois lors du chapitrage sémantique. Le poller les convertit en segments et
 * SAUTE Whisper : zéro appel de transcription, et zéro extraction audio (un WAV
 * 16 kHz de 2 h pèse 1,7 Go et exige de décoder la vidéo entière).
 *
 * Dépendances : FFmpeg installé ; OPENAI_API_KEY / GROQ_API_KEY seulement pour
 * le chemin LiveKit (courtes séances) — la Vidéothèque n'en consomme plus.
 */

import { createClient } from '@supabase/supabase-js';
import { spawn } from 'child_process';
import { writeFile, unlink, readFile, mkdir, rm } from 'fs/promises';
import { existsSync, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { randomUUID, createHash } from 'crypto';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
// CHOIX DES MOMENTS — voir short-highlights.js. L'ancienne `detectHighlightMoments`
// n'avait aucun critère d'accroche (96 % des segments passaient son test) : elle a été
// SUPPRIMÉE, pas contournée.
import { selectionnerMoments, MAX_EXTRAITS } from './short-highlights.js';
// CADRAGE — où est le contenu dans l'image (marges mortes, vignette caméra,
// gouttières entre colonnes). Voir short-cadrage.js : la détection y est mesurée,
// la décision de recadrer est prise ici (geometrieVerticale).
import { detecterRegionUtile, SEUILS_CADRAGE } from './short-cadrage.js';
// SOUS-TITRES — voir short-sous-titres.js. Ils ne sont plus un ornement : ils PORTENT
// l'information du short. D'où l'ASS (position au pixel, titre affichable sans risque
// d'échappement), la découpe en cartons lisibles, la relecture du texte par le modèle,
// et la sonde qui refuse de produire un clip muet de sens.
import {
  FOND_LIRI_HEX,
  MAX_LIGNES_PAROLE, HAUTEUR_LIGNE_PAROLE, LIGNES_RESERVEES, MARGE_GAUCHE, MARGE_DROITE,
  MAX_LIGNES_TITRE, HAUTEUR_LIGNE_TITRE, MAX_CAR_LIGNE,
  TAILLE_SOUS_TITRE, typographieParole,
  capaciteSousTitres, construireAss, corrigerTitre, corrigerTranscription,
  couperEnLignes, decouperEnUnites, echapperCheminFiltre, pairesDeCorrection,
  preparerTitre, srtDesUnites,
} from './short-sous-titres.js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

// ── R2 Configuration ──────────────────────────────────────────────────────
const R2_ACCOUNT = process.env.CF_R2_ACCOUNT_ID;
const R2_KEY = process.env.CF_R2_ACCESS_KEY_ID;
const R2_SECRET = process.env.CF_R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.CF_R2_BUCKET || 'cimolace-media';

function r2Configured() {
  return Boolean(R2_ACCOUNT && R2_KEY && R2_SECRET && R2_BUCKET);
}

// ── Garde-fous du poller Vidéothèque ──────────────────────────────────────
// Statuts acceptés comme « le créateur l'a demandé ». Deux mots plutôt qu'un :
// le déclencheur manuel vit dans l'API (autre périmètre), et selon le verbe qu'il
// emploie la demande doit entrer dans la file sans coordination fragile.
const SHORTS_REQUESTED_STATES = ['requested', 'queued'];
// Un replay = plusieurs Go et plusieurs minutes de ffmpeg : UN SEUL par cycle.
const SHORTS_BATCH = 1;
// Au-delà, on renonce EN L'ÉCRIVANT (jamais de reprise silencieuse à l'infini).
const SHORTS_MAX_ATTEMPTS = 3;
// 'processing' plus vieux que ça = worker redéployé en plein travail. Sans ce
// rattrapage la ligne reste figée pour toujours — c'est l'état où se trouve
// aujourd'hui un `live_recordings` du jumeau LiveKit.
const SHORTS_STALE_MS = 2 * 60 * 60 * 1000; // 2 h
// Au-delà de cette durée, un WAV 16 kHz mono dépasse la limite de 25 Mo des
// fournisseurs Whisper : transcrire ici ne peut QUE échouer (cf. bloc (b) plus bas).
const WHISPER_INLINE_MAX_SEC = 12 * 60;

// R2 = S3-compatible → SigV4 obligatoire (l'ancien `Authorization: Basic` était
// rejeté par R2). On passe par @aws-sdk/client-s3 (même approche que le presign
// du replay côté API).
function r2Client() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_KEY, secretAccessKey: R2_SECRET },
    forcePathStyle: true,
  });
}

async function uploadToR2(filePath, key, contentType) {
  if (!r2Configured()) return null;
  const body = await readFile(filePath);
  await r2Client().send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType || 'video/mp4',
    }),
  );
  return key; // la clé R2 suffit ; la lecture se fait via URL présignée (API/front)
}

// Suppression d'un objet R2. Utilisée UNIQUEMENT par la purge des extraits
// obsolètes : sans elle, chaque refabrication laissait sur le stockage un MP4
// vertical que plus aucune ligne de `short_clips` ne désigne — invisible,
// impayable à retrouver, et facturé au Go indéfiniment.
// NON BLOQUANTE : un objet déjà absent (ou une clé nulle) ne doit pas faire
// échouer une fabrication qui, elle, a réussi.
async function deleteFromR2(key) {
  if (!key || !r2Configured()) return;
  try {
    await r2Client().send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  } catch (e) {
    console.warn(`[short-gen] Objet R2 non supprimé (${key}) : ${e.message}`);
  }
}

// ── Téléchargement depuis R2 (SigV4) ──────────────────────────────────────
// ⚠️ EN FLUX, PAS EN MÉMOIRE. L'ancienne version faisait
// `transformToByteArray()` puis `Buffer.from()` : la vidéo ENTIÈRE tenait en RAM,
// en double (le tableau d'octets + la copie Buffer). Sur les replays réels de la
// Vidéothèque — 378 Mo en moyenne, 1,8 Go au maximum — cela demandait jusqu'à
// ~3,6 Go au conteneur worker, qui héberge aussi les notifs live : un OOM y tue
// TOUS les pollers, pas seulement les shorts. Le flux ne garde qu'un tampon.
// (Même schéma que zoom-transfer.js / zoom-transcribe.js, déjà éprouvés sur ces
// mêmes fichiers.) Le disque éphémère, lui, encaisse : le transfert Zoom écrit
// déjà ces multi-Go dans tmpdir.
async function downloadFromR2(storageKey, destPath) {
  if (!r2Configured()) throw new Error('R2 not configured');
  const res = await r2Client().send(
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: storageKey }),
  );
  await pipeline(res.Body, createWriteStream(destPath));
}

// ─── FFmpeg helpers ────────────────────────────────────────────────────────

// `inputOptions` = arguments placés AVANT `-i` (le seul endroit où `-ss` déclenche
// la recherche rapide par images-clés ; après `-i`, ffmpeg décode depuis le début).
//
// ⚠️ LES CODECS PAR DÉFAUT SONT AJOUTÉS APRÈS `...options`, DONC ILS GAGNENT.
// ffmpeg retient le DERNIER `-c:a` de la ligne de commande. Tant que ce helper
// imposait `-c:a aac` en fin de liste, un appelant qui demandait `-c:a pcm_s16le`
// dans `options` voyait sa demande écrasée EN SILENCE, sans erreur ni code de
// retour non nul. C'est ce qui rendait `extractAudio` inopérant depuis toujours :
// le fichier `short_audio_*.wav` contenait de l'AAC (vérifié : `ffprobe` rend
// `aac` et ffmpeg écrit « Pulse data corrupt or invalid »), donc tout fournisseur
// Whisper le refusait — un échec ensuite maquillé en « Transcription indisponible
// (quota…) ». D'où `sansCodecsParDefaut` : l'appelant qui sait ce qu'il encode
// reprend la main, explicitement.
function ffmpeg(inputPath, outputPath, options = [], inputOptions = [], opts = {}) {
  return new Promise((resolve, reject) => {
    const codecsParDefaut = opts.sansCodecsParDefaut
      ? []
      : ['-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac', '-b:a', '128k'];
    const args = [
      '-y', ...inputOptions, '-i', inputPath,
      ...options,
      ...codecsParDefaut,
      outputPath,
    ];
    // ⚠️ L'ARGV EXACT, JOURNALISÉ. Une chaîne de filtres se construit par morceaux
    // (géométrie + sous-titres) : quand un clip sort de travers, la question n'est
    // jamais « qu'a-t-on voulu ? » mais « qu'a-t-on réellement passé à ffmpeg ? ».
    // Sans cette ligne, il faut réexécuter tout le pipeline pour la connaître.
    console.log(`[short-gen] ffmpeg ${args.map((a) => (/[\s'"]/.test(a) ? JSON.stringify(a) : a)).join(' ')}`);
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('close', (code) => {
      if (code === 0) resolve(outputPath);
      // ⚠️ LE MOTIF D'ABORD, LE VIDAGE ENSUITE. Ce message finit dans `shorts_error`,
      // donc à l'écran du créateur, et il y est tronqué : mettre en tête les 300
      // derniers octets de stderr revenait à n'y montrer que la queue d'un vidage
      // technique (« frame= 121 fps=… »), en poussant hors champ la seule ligne qui dit
      // ce qui ne va pas. `ligneUtileFfmpeg` la remonte en tête ; le reste suit et peut
      // être coupé sans perte d'information actionnable.
      else reject(new Error(`FFmpeg exit ${code} — ${ligneUtileFfmpeg(stderr)} | stderr: ${stderr.slice(-400)}`));
    });
    proc.on('error', reject);
  });
}

/**
 * La ligne de stderr qui DIT quelque chose, dans un vidage ffmpeg qui n'en dit rien.
 * ffmpeg mêle bannière, description des flux et compteurs de progression au diagnostic
 * réel ; ce dernier est presque toujours une ligne contenant un mot de faute.
 *
 * ⭐ ON PREND LA PREMIÈRE, PAS LA DERNIÈRE. Une panne ffmpeg remonte en cascade et les
 * dernières lignes sont les plus GÉNÉRIQUES. Mesuré sur le vrai stderr de ce poste, où
 * le filtre `ass` n'existe pas : la dernière ligne parlante dit « Error opening output
 * files: Invalid argument » (vrai, et parfaitement inutile) là où la première dit
 * « No option name near '/tmp/…​.ass' » — la cause. À défaut de toute ligne parlante, on
 * rend la dernière ligne non vide plutôt que rien.
 */
export function ligneUtileFfmpeg(stderr) {
  const lignes = String(stderr || '').split('\n').map((l) => l.trim()).filter(Boolean);
  // La bannière de version cite des bibliothèques et des options de compilation : elle
  // peut contenir « not found » sans qu'aucune panne n'ait eu lieu.
  const banniere = /^(ffmpeg version|built with|configuration:|lib[a-z]+\s+\d)/i;
  // « no option name » / « no such filter » : la formule exacte d'un ffmpeg à qui il
  // manque un filtre — le cas que ce module redoute le plus (l'absence de libass).
  const parlante = /(no option|no such|not found|unrecognized|invalid|unable|failed|denied|permission|does not contain|conversion failed|error)/i;
  const utiles = lignes.filter((l) => !banniere.test(l));
  for (const l of utiles) if (parlante.test(l)) return l.slice(0, 200);
  return (utiles[utiles.length - 1] || lignes[lignes.length - 1] || 'aucune sortie de ffmpeg').slice(0, 200);
}

/**
 * Le motif écrit dans `shorts_error`, c'est-à-dire LE SEUL TEXTE QUE LE CRÉATEUR VERRA.
 *
 * ⛔ CE QUI N'ALLAIT PAS. On écrivait `err.message.slice(0, 300)`. Or le message le plus
 * important du module — celui du refus d'incruster — fait 305 caractères et range le
 * correctif à la FIN : « … Correctif : image worker avec ffmpeg compilé avec libass +
 * fontconfig + font-noto (apps/worker/Dockerfile). » La troncature coupait exactement
 * cette phrase. Le créateur lisait un constat d'impuissance sans la moindre indication
 * de ce qu'il fallait faire — et l'information existait, à cinq caractères près.
 *
 * ✅ CE QU'ON FAIT. On ne raccourcit plus la phrase qui donne le correctif : on la met
 * EN TÊTE et on tronque ce qui la suit. `shorts_error` est un TEXT sans contrainte de
 * longueur (voir la migration) ; la limite ici n'est donc pas une contrainte de schéma
 * mais un choix de lisibilité — au-delà, l'écran affiche un mur.
 */
const MARQUE_CORRECTIF = 'Correctif :';
export function motifActionnable(message, limite = 600) {
  const brut = String(message ?? '').replace(/\s+/g, ' ').trim() || 'erreur inconnue';
  const i = brut.indexOf(MARQUE_CORRECTIF);
  const tronquer = (t, n) => (t.length <= n ? t : `${t.slice(0, Math.max(1, n - 1)).trimEnd()}…`);
  if (i < 0) return tronquer(brut, limite);
  const correctif = brut.slice(i).trim();          // jamais coupé : c'est l'action à faire
  const cause = brut.slice(0, i).trim();           // le constat : utile, mais sacrifiable
  const reste = limite - correctif.length - 3;     // 3 = le séparateur « — »
  if (reste <= 0) return correctif;
  return cause ? `${correctif} — ${tronquer(cause, reste)}` : correctif;
}

// ─── Géométrie verticale 9:16 — LE TEXTE PRONONCÉ EST LE HÉROS ────────────
/** Couleur de fond LIRI (directive artistique : tout chaud, fond #262624). */
const FOND_LIRI = `0x${FOND_LIRI_HEX}`;
const TRAME_L = 1080;
const TRAME_H = 1920;
/**
 * Bas de la zone sûre, en fraction de la hauteur. En dessous, TikTok et Reels posent
 * leur propre interface (légende, pseudo, son) : tout ce qu'on y écrit est masqué.
 */
const ZONE_SURE_BAS = 0.84;
const BAS_SUR = Math.round(TRAME_H * ZONE_SURE_BAS); // 1613 px
/** Marge haute : une image collée au bord de la trame paraît tronquée. */
const MARGE_HAUTE = 48;
/**
 * Hauteur réservée à la coiffe. DÉRIVÉE de la typographie du titre plutôt que posée en
 * dur : 2 lignes × 70 px + 10 px de respiration. Un nombre recopié à la main se
 * désaccorderait à la première retouche du corps de titre, et la coiffe mordrait alors
 * sur la bande vidéo sans que rien ne le signale.
 */
const HAUTEUR_TITRE = MAX_LIGNES_TITRE * HAUTEUR_LIGNE_TITRE + 10;
const ECART_TITRE_VIDEO = 28;
/**
 * PLAFOND DE LA BANDE VIDÉO — la décision centrale de cette mise en page.
 *
 * 740 px = 38,5 % de la trame. Au-delà, la vidéo redeviendrait le sujet ; en dessous,
 * une source portrait (une caméra LiveKit en 720×1280) se réduirait à un timbre-poste.
 * Ce plafond ne mord QUE sur les sources plus hautes que 1080×740, c'est-à-dire plus
 * carrées que 1,46:1 — un partage d'écran (2,04:1 sur le replay de référence, 1,78:1
 * en 16:9) n'y touche jamais et garde toute la largeur de la trame.
 *
 * ⚠️ CE N'EST PAS UN CHIFFRE ROND CHOISI À L'ŒIL : c'est ce plafond qui fixe le PIRE
 * CAS de la zone de texte (source carrée ou portrait, avec coiffe), et ce pire cas doit
 * rester au-dessus de la réserve de 4 lignes de sous-titre. À 760 le pire cas tombait à
 * 591 px pour 596 px de réserve — 5 px de trop. Voir le calcul complet plus bas.
 */
const VIDEO_H_MAX = 740;
const ECART_VIDEO_TEXTE = 36;

/** Dimensions paires : x264 en yuv420p refuse les côtés impairs. */
const pair = (v) => Math.max(2, Math.round(v / 2) * 2);

/**
 * Sonde les dimensions et la durée réelles d'un fichier. Sans ces valeurs, aucune
 * géométrie ne peut être calculée honnêtement — et `duration_min` de la base est
 * arrondi à la minute (donc faux de ±30 s sur les bornes d'un extrait).
 * Rend `null` si ffprobe est absent ou échoue : l'appelant se rabat sur des valeurs
 * par défaut plutôt que d'échouer.
 */
function sonderVideo(filePath) {
  return new Promise((resolve) => {
    const proc = spawn(
      'ffprobe',
      ['-v', 'error', '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height', '-show_entries', 'format=duration',
        '-of', 'default=nw=1', filePath],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let out = '';
    proc.stdout.on('data', (d) => (out += d.toString()));
    proc.on('error', () => resolve(null));
    proc.on('close', (code) => {
      if (code !== 0) return resolve(null);
      const lire = (cle) => {
        const m = out.match(new RegExp(`^${cle}=([\\d.]+)`, 'm'));
        return m ? Number(m[1]) : null;
      };
      const largeur = lire('width');
      const hauteur = lire('height');
      const duree = lire('duration');
      if (!largeur || !hauteur) return resolve(null);
      resolve({ largeur, hauteur, dureeSec: duree || null });
    });
  });
}

/**
 * GÉOMÉTRIE 9:16 — LA TRAME EST BÂTIE AUTOUR DU TEXTE, PLUS AUTOUR DE L'IMAGE.
 *
 * ⛔ CE QU'ON A ESSAYÉ PENDANT TROIS PASSES, ET POURQUOI C'EST FINI.
 * On a cherché à rendre LA DIAPO lisible en vertical. Trois géométries, trois échecs
 * MESURÉS au pixel sur la trame finale (hauteur médiane de caractère, en % de 1920) :
 *   · recadrage centré 9:16 : 27,6 % de la largeur gardée, lignes coupées ;
 *   · mise à l'échelle + fond : 100 % des pixels, mais 72,4 % de trame vide, 0,42 % ;
 *   · recadrage sur la région utile + colonnes empilées : 0,57 % — le meilleur.
 * Le plancher lisible est 3 %. **0,0 % des caractères de diapo l'atteignaient, sur
 * 10 trames, avant comme après.** Et l'arithmétique interdit d'y arriver : amener un
 * corps de 26 px à 57,6 px demande une échelle de 2,2, donc de ne garder que 487 px de
 * large sur 1920 — les trois quarts de la diapo jetés, chaque ligne coupée.
 * La cause est structurelle : le texte d'un partage d'écran est dimensionné pour un
 * 16:9 d'ordinateur. Il ne rentrera jamais dans un 9:16 de téléphone.
 *
 * ✅ CE QU'ON FAIT MAINTENANT. L'accroche d'un short est PARLÉE. On donne donc la trame
 * à la PAROLE, en 104 px (médiane de glyphe 3,07 % — au-dessus du plancher, là où la
 * diapo restait 5 à 7 fois en dessous), et on garde la vidéo comme présence et
 * mouvement, en bande secondaire. Trois zones empilées :
 *
 *      0 ─────────────────────────────  marge haute 48
 *        [ TITRE, sur fond LIRI ]       150 px (facultatif : seulement si le sélecteur
 *      ─────────────────────────────    a produit un vrai titre)
 *        [ BANDE VIDÉO ]                min(1080·h/l, 760) — 530 px sur la référence
 *      ─────────────────────────────
 *        [ PAROLE, sur fond LIRI ]      tout le reste jusqu'à 84 % de la hauteur
 *   1613 ─────────────────────────────  au-delà : interface TikTok/Reels
 *
 * CE QUE ÇA DONNE, EN CHIFFRES, SUR LE REPLAY DE RÉFÉRENCE (1920×942) :
 *   sans titre : vidéo 530 px (27,6 %), texte 999 px (52,0 %)
 *   avec titre : titre 150 px (7,8 %), vidéo 530 px (27,6 %), texte 821 px (42,8 %)
 * En 16:9 (1920×1080) : vidéo 608 px, texte 921 px (48,0 %). En portrait (720×1280),
 * la bande est plafonnée à 740 px et le texte garde 789 px (41,1 %).
 * PIRE CAS PAR CONSTRUCTION (titre + bande au plafond) : 1613 − (48+150+28+740+36)
 * = 611 px de texte, soit 31,8 % de la trame — et 4 lignes de 149 px en tiennent 596.
 *
 * ⚠️ « LA ZONE TIENT 4 LIGNES » NE SUFFIT PAS, ET CETTE PHRASE A ÉTÉ FAUSSE ICI.
 * Le bloc de parole n'occupe pas la zone : il y est ANCRÉ (Alignment=8), à une hauteur
 * calculée pour centrer optiquement TROIS lignes. Un 4e repli descend donc sous
 * l'ancre, pas sous le haut de la zone. Comparer `hTexte` à 596 px ne décrit pas cette
 * géométrie — et le balayage des 2 806 formats de source le montre : 3 lignes ne
 * débordent jamais (0/2806), mais 4 lignes débordaient dans 982/2806 cas dès qu'il y
 * avait une coiffe ET une bande ≥ 608 px (16:9 pile : 1 px dehors ; portrait : 67 px).
 * L'ancre est désormais BORNÉE (voir `geometrieVerticale`, point 4) : elle ne descend
 * jamais plus bas que `BAS_SUR − 4 lignes`. Le centrage optique est conservé partout
 * où la zone le permet, et abandonné — de quelques pixels — là où il coûterait un
 * débordement sous l'interface du réseau.
 *
 * ⛔ LE MODE « COLONNES » EST RETIRÉ. Il coupait la diapo à une gouttière pour empiler
 * ses deux colonnes, ce qui faisait gagner +29 % de taille de caractère — de 0,44 % à
 * 0,57 % de la trame, soit toujours cinq fois sous le plancher. Dans une bande vidéo
 * secondaire il ferait pire : deux demi-diapos à ~0,4 %, illisibles ET disloquées.
 * On ne paie plus la complexité d'un `-filter_complex` à deux entrées pour ça.
 * Le RECADRAGE sur la région utile, lui, reste : il retire les marges mortes et la
 * vignette caméra, ce qui grossit le SUJET à l'intérieur d'une bande de hauteur fixe.
 *
 * ⭐ LA HAUTEUR DE LA BANDE NE DÉPEND QUE DE LA SOURCE, JAMAIS DU RECADRAGE. C'est
 * délibéré : le cadrage est décidé extrait par extrait (une même séance montre une
 * diapo, puis un tableau, puis une caméra), et si la bande suivait le recadrage, la
 * zone de texte changerait de hauteur d'un extrait à l'autre — cinq clips de la même
 * séance n'auraient pas la même mise en page. Ici, seule change l'image DANS la bande.
 *
 * `cadrage` = résultat de detecterRegionUtile(), ou null (aucune détection possible →
 * image entière dans la bande).
 * `opts.avecTitre` = réserve-t-on la coiffe ? (voir `preparerTitre`).
 */
/**
 * LA TYPOGRAPHIE D'UNE SÉANCE, décidée avant le premier découpage de texte.
 *
 * On prend délibérément le PIRE CAS — avec coiffe, donc la zone de texte la plus
 * courte — et on l'applique à tous les extraits de la séance, y compris à ceux qui
 * n'auront pas de titre. Deux raisons, et la seconde est la plus importante :
 *  1. le texte est découpé en lignes une seule fois, pour tous les extraits : la
 *     longueur de ligne employée doit être valable pour le plus contraint d'entre eux ;
 *  2. cinq extraits d'une même séance publiés à la suite doivent se ressembler. Une
 *     taille de sous-titre qui change d'un clip à l'autre se voit immédiatement dans
 *     un fil, et se lit comme un défaut de fabrication.
 */
export function typographieSeance(largeur, hauteur) {
  const geo = geometrieVerticale(largeur, hauteur, null, { avecTitre: true });
  return geo.typo;
}

export function geometrieVerticale(largeur, hauteur, cadrage = null, opts = {}) {
  const avecTitre = Boolean(opts.avecTitre);
  const src = { l: Number(largeur) || 1920, h: Number(hauteur) || 1080 };

  // (1) La bande vidéo : ajustée à la largeur, plafonnée en hauteur.
  const hBande = Math.min(VIDEO_H_MAX, pair((TRAME_L * src.h) / src.l));
  const yBande = MARGE_HAUTE + (avecTitre ? HAUTEUR_TITRE + ECART_TITRE_VIDEO : 0);
  const yTexte = yBande + hBande + ECART_VIDEO_TEXTE;
  const hTexte = BAS_SUR - yTexte;

  // (2) Ce qu'on met DEDANS : image entière, ou région utile détectée.
  //     Même formule pour les deux — seule change la boîte source.
  const poser = (b) => {
    const echelle = Math.min(TRAME_L / b.l, hBande / b.h);
    const ml = pair(b.l * echelle);
    const mh = pair(b.h * echelle);
    return {
      ...b,
      echelle,
      ml,
      mh,
      px: Math.max(0, Math.round((TRAME_L - ml) / 2)),
      py: Math.max(0, yBande + Math.round((hBande - mh) / 2)),
    };
  };

  const plein = poser({ x: 0, y: 0, l: src.l, h: src.h });
  let choix = { ...plein, mode: 'plein' };

  const boite = cadrage?.boite;
  if (boite && boite.l >= 32 && boite.h >= 32) {
    const contenu = poser(boite);
    const partGardee = (boite.l * boite.h) / (src.l * src.h);
    // DEUX RAISONS D'ACCEPTER LE RECADRAGE, et il en suffit d'une.
    //  (a) il grossit le sujet d'au moins 8 % — le seuil historique de
    //      short-cadrage.js : rogner pour 3 % de plus, c'est prendre un risque de
    //      cadrage sans rien rendre de plus lisible ;
    //  (b) il retire au moins 8 % de SURFACE MORTE sans jamais rétrécir le sujet.
    //
    // ⚠️ (b) N'EXISTAIT PAS AVANT, et son absence se voyait. Dans l'ancienne mise en
    // page, la hauteur de l'image suivait le recadrage : rogner rendait mécaniquement
    // le texte de diapo plus gros, donc « le gain d'échelle » résumait tout l'intérêt
    // de l'opération. Ici la bande a une hauteur FIXE, si bien qu'un recadrage qui
    // retire une grande zone morte ne fait presque pas monter l'échelle. Mesuré sur
    // l'extrait 653→679 s du replay de référence : la détection cerne 1686×906 (elle
    // retire la vignette caméra ET le rectangle noir du partage d'écran), soit 15,6 %
    // de la trame en moins, pour un gain d'échelle de ×1,04 seulement — sous le seuil
    // (a). On gardait donc un aplat noir de 85 px dans la bande, alors que la machine
    // l'avait parfaitement identifié.
    // La condition `echelle >= plein.echelle` est le garde-fou : on ne rogne jamais
    // pour RÉTRÉCIR le sujet.
    const grossit = contenu.echelle > plein.echelle * SEUILS_CADRAGE.GAIN_MIN_ROGNAGE;
    const nettoie = contenu.echelle >= plein.echelle && partGardee <= 0.92;
    if (grossit || nettoie) choix = { ...contenu, mode: 'contenu' };
  }

  // (3) La chaîne ffmpeg. UNE SEULE bande, donc une seule chaîne `-vf` linéaire :
  //     rogner (si utile) → mettre à l'échelle → poser sur la trame de fond LIRI.
  const rogne = (choix.x || choix.y || choix.l !== src.l || choix.h !== src.h)
    ? [`crop=${choix.l}:${choix.h}:${choix.x}:${choix.y}`] : [];
  const filtres = [
    ...rogne,
    `scale=${choix.ml}:${choix.mh}:flags=lanczos`,
    `pad=${TRAME_L}:${TRAME_H}:${choix.px}:${choix.py}:color=${FOND_LIRI}`,
  ];

  // (4) Les nombres que l'ASS attend. Le bloc de parole est ancré par le HAUT
  //     (Alignment=8 : MarginV se compte depuis le haut de la trame) et centré
  //     optiquement dans sa zone en supposant 3 lignes — un carton d'une seule ligne
  //     démarre alors au même endroit qu'un carton de trois, donc l'œil ne cherche
  //     jamais la première ligne.
  //
  // ⭐ MAIS L'ANCRE EST BORNÉE PAR LE BAS, et c'est le point que la version précédente
  //    manquait. Le bloc GRANDIT VERS LE BAS depuis l'ancre : si libass replie une
  //    ligne de plus que les 3 prévues, la 4e se pose à `ancre + 4×149`. Centrer
  //    l'ancre revient à la poser à mi-hauteur de la zone, donc d'autant plus bas que
  //    la zone est haute — le 4e repli sortait alors de la zone sûre alors même que la
  //    zone, elle, mesurait plus de 596 px. Mesuré sur 2 806 formats de source :
  //    982 débordaient (16:9 avec coiffe : 1 px ; portrait 9:16 : 67 px).
  //    On plafonne donc l'ancre à `BAS_SUR − 4 lignes`. Conséquence visible : dans les
  //    cas serrés, le bloc remonte de quelques pixels (1 px en 16:9, 67 px en portrait)
  //    et n'est plus parfaitement centré — un décalage invisible à l'œil, contre un
  //    sous-titre passant sous les icônes de TikTok, lui parfaitement visible.
  // ⭐ LE CORPS DE LA PAROLE EST DÉDUIT DE LA ZONE (voir `typographieParole`) : le
  //    plancher de lisibilité, 110, laissait la parole (447 px) plus petite que
  //    l'image (530 px) alors qu'on avait décidé d'en faire le sujet. On prend donc
  //    le plus grand corps qui tienne encore la réserve de 4 lignes — 131 sur les
  //    sources larges, 113 dans le pire cas portrait — au lieu du même 110 partout.
  // ⚠️ LA TYPOGRAPHIE PEUT ÊTRE IMPOSÉE, ET ELLE DOIT L'ÊTRE EN PRODUCTION.
  // Le découpage du texte en lignes se fait UNE FOIS pour tous les extraits d'une
  // séance, alors que cette fonction est appelée UNE FOIS PAR EXTRAIT — et la zone
  // de texte n'a pas la même hauteur selon qu'un extrait porte une coiffe ou non.
  // Laisser chacun recalculer son corps produirait des lignes coupées pour 10
  // caractères mais dessinées à un corps prévu pour 12 : le texte déborderait.
  // L'appelant fige donc `opts.typo` sur le pire cas de la séance (avec coiffe) et le
  // passe à tous. Effet de bord recherché : les cinq clips d'une même séance ont
  // exactement la même mise en page, comme la bande vidéo (voir plus haut).
  const typo = opts.typo || typographieParole(hTexte);
  const hBloc = MAX_LIGNES_PAROLE * typo.hauteurLigne;   // 531 px à 131 (3 lignes)
  const hReserve = LIGNES_RESERVEES * typo.hauteurLigne; // 708 px à 131 (4 lignes)
  const ancreCentree = yTexte + Math.max(0, Math.round((hTexte - hBloc) / 2));
  const ancreBasseMax = BAS_SUR - hReserve;                        // 905 px à 131
  const margeHauteParole = Math.max(yTexte, Math.min(ancreCentree, ancreBasseMax));

  // GARDE-FOU SILENCIEUX — il contrôle CE QUI EST DESSINÉ, pas une réserve abstraite :
  // le bas d'un bloc de 4 lignes posé sur l'ancre réelle. Depuis que le corps se déduit
  // de la zone (`typographieParole`), il est structurellement impossible à déclencher
  // TANT QUE le corps peut descendre : la taille est justement choisie pour que
  // 4 lignes tiennent. Il ne peut donc plus mordre que si la zone descend sous ce que
  // permet le PLANCHER de 110 — soit 596 px — c'est-à-dire si quelqu'un a touché à
  // MARGE_HAUTE, HAUTEUR_TITRE ou VIDEO_H_MAX sans refaire le calcul (pire cas actuel :
  // 611 px, il reste 15 px de marge). Le symptôme, sinon, serait un sous-titre glissé
  // sous l'interface de TikTok — invisible dans les journaux.
  const basQuatreLignes = margeHauteParole + hReserve;
  if (basQuatreLignes > BAS_SUR) {
    console.error(
      `[short-gen] ⚠️ MISE EN PAGE INCOHÉRENTE : bloc de ${LIGNES_RESERVEES} lignes ancré à `
      + `${margeHauteParole} px, bas à ${basQuatreLignes} px pour une zone sûre qui s'arrête à `
      + `${BAS_SUR} px (zone de texte ${hTexte} px, il en faut ${hReserve}) — un repli de ligne `
      + `déborderait sous l'interface du réseau. Revoir MARGE_HAUTE / HAUTEUR_TITRE / VIDEO_H_MAX.`,
    );
  }

  return {
    mode: choix.mode,
    filtres,
    video: { x: choix.px, y: choix.py, l: choix.ml, h: choix.mh },
    bande: { x: 0, y: yBande, l: TRAME_L, h: hBande },
    zoneTexte: { x: 0, y: yTexte, l: TRAME_L, h: hTexte },
    zoneTitre: avecTitre ? { x: 0, y: MARGE_HAUTE, l: TRAME_L, h: HAUTEUR_TITRE } : null,
    ass: {
      margeHauteParole,
      margeHauteTitre: MARGE_HAUTE,
      margeGauche: MARGE_GAUCHE,
      margeDroite: MARGE_DROITE,
      // Le corps RÉELLEMENT dessiné. `construireAss` le lit ici plutôt que de
      // recopier la constante : la zone, l'ancre et la longueur de ligne ont toutes
      // été dimensionnées pour cette valeur-là.
      taille: typo.taille,
    },
    // La typographie déduite, pour que le découpage en lignes emploie la MÊME
    // longueur maximale que celle sur laquelle la géométrie a été calculée.
    typo,
    // Part de la trame donnée à chaque rôle — c'est la mesure qui dit si le texte est
    // vraiment le héros, et elle est journalisée à chaque extrait.
    partTexte: hTexte / TRAME_H,
    partVideo: hBande / TRAME_H,
    partTitre: avecTitre ? HAUTEUR_TITRE / TRAME_H : 0,
    // Combien de lignes tiennent RÉELLEMENT sous l'ancre avant la zone sûre. On compte
    // depuis l'ancre et non depuis le haut de la zone : c'est de l'ancre que le bloc
    // descend, et l'ancienne formule (hTexte / 149) surestimait donc la capacité de
    // 1 à 2 lignes sur les sources les plus carrées.
    lignesTenables: Math.floor((BAS_SUR - margeHauteParole) / typo.hauteurLigne),
    // Ancre du bloc et bas d'un 4e repli : les deux nombres que le garde-fou compare.
    ancreParole: margeHauteParole,
    ancreCentree,
    basQuatreLignes,
    echelle: choix.echelle,
    echellePlein: plein.echelle,
    gain: choix.echelle / plein.echelle,
    decoupes: [{ x: choix.x, y: choix.y, l: choix.l, h: choix.h, ml: choix.ml, mh: choix.mh }],
    partGardee: (choix.l * choix.h) / (src.l * src.h),
    // Pour mémoire : ce qu'aurait gardé l'ancien recadrage centré.
    partAncienRecadrage: Math.min(1, (src.h * 9) / 16 / src.l),
    mesures: cadrage?.mesures || null,
  };
}

/**
 * Coupe un segment et le convertit en vertical 9:16, sous-titres compris.
 *
 * ⚠️ IL N'Y A PLUS DE REPLI « SANS SOUS-TITRES ». L'appelant a déjà vérifié, une fois
 * pour tout le processus, que ce ffmpeg sait dessiner du texte (`capaciteSousTitres`) :
 * si l'incrustation échoue ici, c'est une panne réelle et elle doit remonter. Livrer le
 * même clip sans texte reviendrait à publier une vidéo vide de sens en croyant l'avoir
 * sous-titrée — c'est précisément ce qui se passait avant, dans le silence d'un journal
 * de conteneur.
 */
async function createShortClip(inputPath, outputPath, startSec, endSec, assPath, geo) {
  const duration = endSec - startSec;
  const geometrie = geo || geometrieVerticale(1920, 1080);
  const filtres = [...geometrie.filtres];

  // ⚠️ UNE SEULE chaîne `-vf`. Une version passée poussait un SECOND `-vf` pour les
  // sous-titres : ffmpeg ne garde que le dernier, donc la mise en page 9:16 sautait et
  // le « short vertical » sortait en 16:9. Ordre imposé : on met en page D'ABORD, on
  // incruste ENSUITE — le style ASS est calibré pour la trame finale 1080×1920.
  // Le texte du modèle, lui, ne traverse PAS cet analyseur : il est dans le fichier ASS
  // (voir short-sous-titres.js). Seul le CHEMIN passe ici, et il est échappé.
  if (assPath && existsSync(assPath)) filtres.push(`ass=${echapperCheminFiltre(assPath)}`);

  return ffmpeg(
    inputPath,
    outputPath,
    ['-t', String(duration), '-vf', filtres.join(',')],
    // `-ss` AVANT `-i` : recherche rapide par images-clés. Après `-i`, ffmpeg décodait
    // depuis la seconde 0 — sur un replay de 2 h, un extrait pris à 1 h 40 coûtait
    // 100 minutes de décodage, sur le même conteneur que les notifs live. ffmpeg 8.x
    // reste exact au ré-encodage malgré la recherche rapide.
    ['-ss', String(startSec)],
  );
}

/**
 * Lit le codec du PREMIER flux audio d'un fichier. Sert à contrôler le RÉSULTAT
 * de l'extraction, pas l'intention : le défaut corrigé ci-dessus sortait en code 0
 * avec un flux AAC baptisé `.wav` — seul ffprobe le disait.
 * Rend `null` si ffprobe est absent du conteneur ou échoue : un contrôle qui ne
 * peut pas s'exécuter ne doit pas condamner une extraction qui, elle, va bien.
 */
function probeAudioCodec(filePath) {
  return new Promise((resolve) => {
    const proc = spawn(
      'ffprobe',
      ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=codec_name',
        '-of', 'default=nw=1:nk=1', filePath],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let out = '';
    proc.stdout.on('data', (d) => (out += d.toString()));
    proc.on('error', () => resolve(null)); // ffprobe non installé
    proc.on('close', (code) => resolve(code === 0 ? out.trim() || null : null));
  });
}

/**
 * Extrait l'audio d'une vidéo pour transcription.
 *
 * `sansCodecsParDefaut` est INDISPENSABLE ici : sans lui, le `-c:a aac` du helper
 * annulait le `-c:a pcm_s16le` demandé juste au-dessus (cf. le commentaire de
 * `ffmpeg`). Et on ne fait pas confiance au seul code de retour — ffmpeg sortait
 * en 0 dans le cas cassé — donc on relit le fichier produit.
 */
async function extractAudio(inputPath, outputPath) {
  await ffmpeg(
    inputPath,
    outputPath,
    [
      '-vn',               // Pas de vidéo
      '-ar', '16000',      // 16kHz pour Whisper
      '-ac', '1',          // Mono
      '-c:a', 'pcm_s16le',
    ],
    [],
    { sansCodecsParDefaut: true },
  );
  const codec = await probeAudioCodec(outputPath);
  if (codec && codec !== 'pcm_s16le') {
    // Échouer ICI, bruyamment.
    //
    // ⚠️ MESURÉ CONTRE UN VRAI FOURNISSEUR (Groq / whisper-large-v3), avec un fichier
    // fabriqué exprès pour reproduire le défaut (une sinusoïde de 3 s encodée en AAC
    // dans un conteneur .wav) : le fournisseur NE REFUSE PAS. Il répond **HTTP 200**
    // et annonce `"duration": 0.0465` au lieu de 3 — c'est-à-dire qu'il n'a rien
    // entendu — puis rend un mot halluciné (« you »). Le même son correctement encodé
    // en pcm_s16le donne `"duration": 3`.
    // Autrement dit : le défaut ne produisait AUCUNE erreur nulle part. Il produisait
    // une transcription vide, plausible, qui redescendait ensuite dans tout le
    // pipeline. Ce contrôle ffprobe est la SEULE chose qui l'attrape.
    throw new Error(`Audio extrait en « ${codec} » au lieu de pcm_s16le — le fournisseur ne l'entendrait pas`);
  }
  return outputPath;
}

// ─── Transcription via Whisper (OpenAI API) ────────────────────────────
// Transcription Whisper — essaie OpenAI puis Groq (API compatible). Jette si
// AUCUN fournisseur ne répond (l'appelant rend l'échec non-bloquant).
async function transcribeAudio(audioPath) {
  const fileBuffer = await readFile(audioPath);
  const providers = [];
  // `form` = champs spécifiques pour obtenir les SEGMENTS timés (moments forts +
  // sous-titres) : OpenAI/Groq via response_format=verbose_json ; Voxtral via
  // timestamp_granularities=segment (vérifié : renvoie alors text + segments).
  if (process.env.OPENAI_API_KEY)
    providers.push({ name: 'OpenAI', url: 'https://api.openai.com/v1/audio/transcriptions', key: process.env.OPENAI_API_KEY, model: 'whisper-1', form: { response_format: 'verbose_json' } });
  if (process.env.GROQ_API_KEY)
    providers.push({ name: 'Groq', url: 'https://api.groq.com/openai/v1/audio/transcriptions', key: process.env.GROQ_API_KEY, model: 'whisper-large-v3', form: { response_format: 'verbose_json' } });
  if (process.env.MISTRAL_API_KEY)
    providers.push({ name: 'Mistral', url: 'https://api.mistral.ai/v1/audio/transcriptions', key: process.env.MISTRAL_API_KEY, model: 'voxtral-mini-latest', form: { timestamp_granularities: 'segment' } });

  let lastErr = 'aucun fournisseur de transcription configuré';
  for (const p of providers) {
    try {
      const formData = new FormData();
      formData.append('file', new Blob([fileBuffer], { type: 'audio/wav' }), 'audio.wav');
      formData.append('model', p.model);
      formData.append('language', 'fr');
      for (const [fk, fv] of Object.entries(p.form || {})) formData.append(fk, fv);
      const res = await fetch(p.url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${p.key}` },
        body: formData,
      });
      if (!res.ok) {
        lastErr = `${p.name} ${res.status}`;
        continue; // ex: OpenAI 429 quota → on tente Groq
      }
      const data = await res.json();
      return {
        text: data.text || '',
        segments: (data.segments || []).map((seg) => ({
          start: seg.start,
          end: seg.end,
          text: (seg.text || '').trim(),
          confidence: seg.confidence || 0,
        })),
      };
    } catch (e) {
      lastErr = `${p.name}: ${e.message}`;
    }
  }
  throw new Error(`Transcription: ${lastErr}`);
}

// ─── Réemploi d'une transcription déjà payée ──────────────────────────────
/**
 * Convertit les cues stockées `[{t: secondes, text}]` en segments
 * `[{start, end, text}]`, la forme qu'attendent selectionnerMoments()
 * (short-highlights.js) et la fabrique de sous-titres (short-sous-titres.js) — toutes
 * deux lisent `.start`, `.end`, `.text`.
 *
 * ⚠️ LA FIN D'UN SEGMENT N'EST PAS STOCKÉE. Les cues n'ont qu'un `t` de début —
 * elles sont produites par fusion de phrases (zoom-transcribe.js/toCues), pas par
 * découpage temporel. Choix retenu, et pourquoi :
 *   · fin d'une cue = `t` de la SUIVANTE. C'est exact par construction : la parole
 *     est continue, la cue suivante commence là où la précédente s'arrête. Aucune
 *     invention, et les deux consommateurs n'ont besoin que d'un axe cohérent.
 *   · AUCUNE durée minimale imposée. Une première version forçait « au moins 1 s »
 *     pour se garder des durées nulles : sur les cues réelles (certaines se suivent
 *     à 0,2 s) cela faisait DÉBORDER un segment sur le suivant, et deux sous-titres
 *     se chevauchaient à l'écran. Le seul cas réellement dégénéré est celui de deux
 *     cues au MÊME `t` : on les fusionne alors (le texte est conservé, pas perdu).
 *   · DERNIÈRE cue : pas de suivante → on prend la durée réelle du replay quand on
 *     la connaît (zoom_recordings.duration_min) ; sinon on estime à partir de la
 *     longueur du texte (≈14 caractères/seconde en français parlé), borné à 30 s
 *     pour qu'une estimation fausse ne fabrique jamais un extrait de 10 minutes.
 *   · `confidence` : ABSENTE et volontairement non inventée. Plus personne ne la lit
 *     depuis que la sélection est sémantique — l'ancien détecteur en faisait un
 *     critère (`(seg.confidence || 1) > 0.6`) qui, faute de valeur, était toujours vrai.
 */
export function cuesToSegments(cues, durationSec) {
  if (!Array.isArray(cues) || cues.length === 0) return [];

  const sorted = cues
    .map((c) => ({ t: Number(c?.t), text: String(c?.text || '').trim() }))
    .filter((c) => Number.isFinite(c.t) && c.t >= 0 && c.text.length > 0)
    .sort((a, b) => a.t - b.t); // défensif : on ne présume pas l'ordre de stockage

  // Fusion des cues partageant le même instant : elles produiraient un segment de
  // durée nulle, que ffmpeg refuse et que le SRT afficherait comme un éclair.
  const clean = [];
  for (const cue of sorted) {
    const prev = clean[clean.length - 1];
    if (prev && cue.t <= prev.t) prev.text = `${prev.text} ${cue.text}`.trim();
    else clean.push(cue);
  }

  const total = Number.isFinite(durationSec) && durationSec > 0 ? durationSec : null;

  return clean.map((cue, i) => {
    const next = clean[i + 1];
    let end;
    if (next) {
      end = next.t;
    } else if (total && total > cue.t) {
      end = total;
    } else {
      end = cue.t + Math.min(30, Math.max(2, cue.text.length / 14));
    }
    return { start: cue.t, end, text: cue.text };
  });
}

/**
 * Va chercher la transcription DÉJÀ EN BASE pour un replay de la Vidéothèque.
 * Deux emplacements, tous deux renseignés par le pipeline d'import (zoom-transfer,
 * zoom-transcribe, chapitrage) : la ligne `zoom_recordings` elle-même, puis la
 * `published_videos` correspondante (jointure par `recording_id`). On tente les deux
 * parce qu'un import ancien peut n'en avoir alimenté qu'un seul.
 */
async function fetchStoredTranscript(recordingId, inlineCues) {
  if (Array.isArray(inlineCues) && inlineCues.length > 0) {
    return { cues: inlineCues, origin: 'zoom_recordings.transcript_cues' };
  }
  const { data } = await supabase
    .from('published_videos')
    .select('transcript_cues')
    .eq('recording_id', recordingId)
    .not('transcript_cues', 'is', null)
    .limit(1)
    .maybeSingle();
  if (Array.isArray(data?.transcript_cues) && data.transcript_cues.length > 0) {
    return { cues: data.transcript_cues, origin: 'published_videos.transcript_cues' };
  }
  return null;
}

// ─── Détection des moments forts ──────────────────────────────────────────
// ⛔ SUPPRIMÉE. `detectHighlightMoments()` et `pickSpreadHighlights()` vivaient ici.
// Leur critère réel était « le segment fait plus de 20 caractères », ce que 96 % des
// segments du replay de référence satisfaisaient : un découpeur régulier déguisé en
// détecteur, qui livrait en « Extrait 1 » les 60 premières secondes — un tableau blanc
// vide sur « Ok, là, je pense qu'on enregistre bien sur le Clad ».
// Le choix des moments est désormais SÉMANTIQUE et vit dans ./short-highlights.js
// (`selectionnerMoments`), avec un garde-fou mesuré sur le signal et un repli mécanique
// explicitement étiqueté comme tel.

// ─── Génération SRT ───────────────────────────────────────────────────────
// ⛔ `generateSrt()` A ÉTÉ RETIRÉE. Elle produisait un SRT d'un bloc par cue — jusqu'à
// 300 caractères affichés d'un coup, soit un paragraphe. Tant que le sous-titre était
// un ornement de 18 px c'était sans conséquence ; il est maintenant le contenu du clip.
// La découpe en cartons lisibles (`decouperEnUnites`) et le SRT qui en découle
// (`srtDesUnites`, archivé en base parce qu'il décrit EXACTEMENT ce qui est à l'écran)
// vivent dans ./short-sous-titres.js — avec la règle de recouvrement, elle, conservée
// intacte : `segmentsDeLaFenetre` retient tout segment qui INTERSECTE la fenêtre et
// rogne ses bornes dessus (l'inclusion stricte perdait le dernier segment de chaque
// extrait — couverture médiane 92,6 %, minimum 9,6 % sur les cues réelles).

// ─── CARTONS-ÉCLAIRS : on les ABSORBE, on ne se contente plus de les compter ───
/**
 * PLANCHER D'AFFICHAGE D'UN CARTON, en secondes. C'est LE nombre de ce garde-fou.
 *
 * ⚠️ À NE PAS CONFONDRE avec `DUREE_UNITE_MIN` (0,5 s) de short-sous-titres.js : celle-là
 * n'est qu'un plancher d'ESTIMATION, appliqué à la durée *souhaitée* d'un carton avant
 * répartition. La borne finale (`Math.min(seg.end, …)` et le repli au prorata quand la
 * parole est plus dense que l'estimation) passe outre — mesuré sur les cues réelles de
 * 5 replays et 5 672 fenêtres : **6,34 % des 84 404 cartons tombaient sous 1 s, 2,46 %
 * sous 0,5 s, et le plus court durait 0,05 s** (« à », un caractère). Le diagnostic les
 * COMPTAIT (`trop_rapides`) et rien ne les absorbait.
 *
 * POURQUOI 1,0 s ET PAS 0,5. Le sous-titrage professionnel pose son plancher là :
 * 1 s pour les recommandations BBC, 5/6 s (0,833 s) pour Netflix — durées établies pour
 * un sous-titre discret en bas de trame. Ici le carton fait 110 px et occupe le tiers
 * de l'image : l'œil doit en plus faire l'aller-retour avec la bande vidéo. On prend la
 * borne haute des deux usages. En dessous, ce n'est plus une lecture, c'est un
 * clignotement — et le mot passé sous 1 s est un mot PERDU, alors que la parole écrite
 * est désormais tout le contenu du clip.
 */
export const DUREE_CARTON_MIN = 1.0;
/**
 * Silence maximal qu'une fusion a le droit d'enjamber. Deux cartons issus de cues
 * voisines sont contigus par construction ; un trou n'apparaît que si un segment sans
 * texte a été écarté entre les deux. Fusionner par-dessus un long blanc afficherait une
 * phrase pendant que personne ne parle — au-delà d'une seconde, on préfère étirer.
 */
const ECART_FUSION_MAX = 1.0;
/**
 * DURÉE MAXIMALE D'UN CARTON ISSU D'UNE FUSION, en secondes — le garde-fou qui manquait.
 *
 * Un carton affiche TOUT son texte dès sa première image : son dernier mot est donc
 * toujours à l'écran quelques secondes avant d'être prononcé. C'est normal, c'est la
 * définition même d'un sous-titre, et pour un carton plein (3 × 13 = 39 caractères,
 * soit ≈ 3,2 s au débit du français) cette avance vaut au plus ces 3,2 s.
 * Elle cesse de l'être quand le voisin S'ATTARDE : `decouperEnUnites` donne au dernier
 * carton d'une cue tout le silence qui suit, et une première version de cette fusion,
 * qui prenait l'union des deux plages sans rien vérifier, collait le carton-éclair à un
 * voisin de 42 s — **mesuré : un mot affiché 41,66 s avant d'être dit**. Le plafond
 * (≈ 2 × 3,2 s) refuse ces fusions-là ; l'étirement, qui ne déplace qu'une frontière et
 * ne remonte donc jamais le texte, s'en charge à la place.
 */
const DUREE_FUSION_MAX = 6.0;

/**
 * Rend une liste de cartons où AUCUN ne clignote — par fusion d'abord, par étirement
 * ensuite. Ne touche jamais aux MOTS : ni suppression, ni réécriture, seulement des
 * regroupements et des bornes déplacées.
 *
 * ⛔ POURQUOI CE N'EST PAS DANS `decouperEnUnites`. La découpe appartient à
 * short-sous-titres.js et calcule des durées cue par cue ; or un carton-éclair est
 * presque toujours le DERNIER d'une cue (borné par `seg.end`) ou le plus court d'une
 * cue partie au prorata — sa réparation demande de regarder le carton d'à côté, qui
 * appartient à la cue SUIVANTE. C'est donc une passe sur la liste complète, une fois la
 * fenêtre entièrement découpée.
 *
 * ── DEUX REMÈDES, DANS CET ORDRE, PARCE QU'ILS NE COÛTENT PAS LA MÊME CHOSE ──
 * (1) FUSION DU TEXTE avec un voisin — le remède propre : « Je » rejoint le carton
 *     suivant et disparaît en tant que carton. Autorisée UNIQUEMENT si le texte
 *     recollé tient encore en `maxLignes` lignes une fois REPLIÉ (on repasse par
 *     `couperEnLignes`, on ne présume rien) : un carton de 4 lignes déborderait la
 *     réserve de la zone de texte, ce que toute la géométrie s'emploie à éviter.
 *     C'est pourquoi la fusion ne suffit pas : un carton-éclair coincé entre deux
 *     cartons pleins (3 lignes chacun) n'a aucun voisin fusionnable.
 * (2) ÉTIREMENT — on déplace la frontière au lieu de recoller le texte. Le carton prend
 *     d'abord le TROU éventuel qui le suit (gratuit : personne n'y parle), puis du temps
 *     au carton SUIVANT, et seulement ensuite au PRÉCÉDENT.
 *     ⭐ L'ordre n'est pas arbitraire : prendre au suivant RETARDE le carton d'après,
 *     prendre au précédent AVANCE le carton courant — donc afficher des mots avant
 *     qu'ils soient prononcés. Le module a déjà tranché ce débat (« mieux vaut un carton
 *     un peu lent qu'un carton qui devance »), on suit la même règle.
 *     Un donneur ne descend JAMAIS sous le plancher : on ne répare pas un clignotement
 *     en en créant un autre. Le dernier carton, lui, peut s'étendre jusqu'à la fin du
 *     clip — rien ne le suit, et une zone de texte vide se voit plus qu'un carton qui
 *     s'attarde (même arbitrage que `decouperEnUnites`).
 *
 * Ce qui RESTE sous le plancher après les deux passes est un cas où la fenêtre est
 * réellement trop dense pour le nombre de cartons (aucun voisin fusionnable, aucun
 * voisin donneur). On ne le maquille pas : il est compté dans le diagnostic.
 *
 * @param {Array} unites  sortie de `decouperEnUnites` (porte `.diagnostic`)
 * @param {object} opts   { duree } = durée du clip, pour l'étirement du dernier carton
 */
export function fusionnerCartonsCourts(unites, opts = {}) {
  const seuil = Number.isFinite(opts.seuil) ? opts.seuil : DUREE_CARTON_MIN;
  const maxLignes = opts.maxLignes || MAX_LIGNES_PAROLE;
  const maxCar = opts.maxCar || MAX_CAR_LIGNE;
  const finClip = Number.isFinite(opts.duree) ? opts.duree : null;
  const source = Array.isArray(unites) ? unites : [];
  const avant = {
    unites: source.length,
    trop_courts: source.filter((u) => u.fin - u.debut < seuil).length,
    plus_court: source.length ? Math.min(...source.map((u) => u.fin - u.debut)) : 0,
  };
  if (source.length === 0) {
    const vide = [];
    vide.diagnostic = { ...(unites?.diagnostic || {}), plancher_s: seuil, fusionnes: 0, etires: 0 };
    return vide;
  }

  // Copie de travail : on ne mute jamais la liste que l'appelant a construite.
  const liste = source.map((u) => ({ ...u, lignes: [...u.lignes] }));

  // ── (1) Fusion du texte ────────────────────────────────────────────────
  // Boucle jusqu'au point fixe : fusionner deux cartons peut en révéler un troisième
  // devenu fusionnable. Elle termine forcément — chaque tour retire un carton.
  let fusionnes = 0;
  let encore = true;
  while (encore && liste.length > 1) {
    encore = false;
    for (let i = 0; i < liste.length; i++) {
      if (liste[i].fin - liste[i].debut >= seuil) continue;
      // Voisin de DROITE d'abord : recoller vers l'avant préserve l'ordre de lecture
      // et ne fait jamais apparaître un mot avant qu'il soit dit.
      for (const j of [i + 1, i - 1]) {
        if (j < 0 || j >= liste.length) continue;
        const a = liste[Math.min(i, j)];
        const b = liste[Math.max(i, j)];
        if (b.debut - a.fin > ECART_FUSION_MAX) continue;   // enjamberait un silence
        if (b.fin - a.debut > DUREE_FUSION_MAX) continue;   // remonterait trop le texte
        const lignes = couperEnLignes(`${a.texte} ${b.texte}`, maxCar);
        if (lignes.length > maxLignes) continue;      // déborderait la zone : interdit
        liste.splice(Math.min(i, j), 2, {
          debut: a.debut, fin: b.fin, lignes, texte: lignes.join(' '),
        });
        fusionnes += 1;
        encore = true;
        break;
      }
      if (encore) break;
    }
  }

  // ── (2) Étirement ──────────────────────────────────────────────────────
  // Une SEULE passe avant→arrière suffit : on ne prend au suivant que son excédent
  // au-dessus du plancher, donc quand on l'atteint il y est déjà conforme.
  let etires = 0;
  for (let i = 0; i < liste.length; i++) {
    const u = liste[i];
    let manque = seuil - (u.fin - u.debut);
    if (manque <= 1e-6) continue;
    const suiv = liste[i + 1];
    // (a) le trou qui suit — du temps que personne n'occupe
    const borneDroite = suiv ? suiv.debut : (finClip !== null ? Math.max(finClip, u.fin) : u.fin);
    const trou = Math.max(0, borneDroite - u.fin);
    const prisTrou = Math.min(manque, trou);
    u.fin += prisTrou; manque -= prisTrou;
    // (b) l'excédent du carton suivant — il recule, il ne disparaît pas
    if (manque > 1e-6 && suiv) {
      const don = Math.min(manque, Math.max(0, (suiv.fin - suiv.debut) - seuil));
      u.fin += don; suiv.debut += don; manque -= don;
    }
    // (c) en dernier recours seulement, le temps d'avant (le carton devance la voix)
    if (manque > 1e-6) {
      const prec = liste[i - 1];
      const borneGauche = prec ? prec.fin : 0;
      const trouAvant = Math.max(0, u.debut - borneGauche);
      const prisAvant = Math.min(manque, trouAvant);
      u.debut -= prisAvant; manque -= prisAvant;
      if (manque > 1e-6 && prec) {
        const don = Math.min(manque, Math.max(0, (prec.fin - prec.debut) - seuil));
        u.debut -= don; prec.fin -= don; manque -= don;
      }
    }
    if (manque < seuil - 1e-6) etires += 1;   // quelque chose a bougé pour ce carton
  }

  // Arrondi au centième : c'est la résolution de l'horodatage ASS (`tempsAss`) et du
  // SRT archivé. Sans cet arrondi, deux bornes « égales » à 1e-15 près pourraient
  // s'écrire différemment dans les deux fichiers, qui ne s'attesteraient plus l'un
  // l'autre.
  const cent = (v) => Math.round(v * 100) / 100;
  const sortie = liste.map((u) => ({ ...u, debut: cent(Math.max(0, u.debut)), fin: cent(u.fin) }))
    .filter((u) => u.fin > u.debut);

  const carTotal = sortie.reduce((s, u) => s + u.texte.length, 0);
  const dureeTotale = sortie.reduce((s, u) => s + (u.fin - u.debut), 0);
  const restants = sortie.filter((u) => u.fin - u.debut < seuil - 1e-6).length;
  sortie.diagnostic = {
    ...(unites.diagnostic || {}),
    unites: sortie.length,
    caracteres: carTotal,
    debit_car_par_s: dureeTotale > 0 ? Number((carTotal / dureeTotale).toFixed(1)) : 0,
    lignes_max: sortie.reduce((m, u) => Math.max(m, u.lignes.length), 0),
    caracteres_ligne_max: sortie.reduce((m, u) => Math.max(m, ...u.lignes.map((l) => l.length)), 0),
    // ⚠️ `trop_rapides` garde son nom (il est archivé dans `short_clips.metadata`) mais
    // change de sens : il ne compte plus les cartons sous 0,5 s AVANT réparation, il
    // compte ceux qui, APRÈS réparation, restent sous le plancher. Zéro est la normale.
    trop_rapides: restants,
    plancher_s: seuil,
    fusionnes,
    etires,
    avant_reparation: avant,
    plus_court_s: sortie.length ? Number(Math.min(...sortie.map((u) => u.fin - u.debut)).toFixed(2)) : 0,
  };
  return sortie;
}

/**
 * Texte RÉELLEMENT prononcé dans une fenêtre (segments intersectés, dans l'ordre).
 * Sert la description et `transcript_snippet` en base.
 *
 * ⚠️ Ce n'est PAS le titre du modèle : le titre est une accroche écrite pour la
 * vignette, la description doit rester ce qui a été dit. Les confondre reviendrait à
 * archiver en base une phrase que personne n'a prononcée.
 * Même règle de recouvrement que les sous-titres : on retient tout segment qui
 * INTERSECTE la fenêtre (l'inclusion stricte perdait le dernier segment de chaque
 * extrait).
 *
 * ⚠️ ON LUI PASSE LES SEGMENTS RELUS, pas les bruts : ce que la base archive comme
 * « ce qui a été dit » doit être ce que le spectateur LIT à l'écran. Le texte brut de
 * Whisper, lui, reste tracé dans `metadata.transcription`.
 */
function texteDeLaFenetre(segments, debut, fin) {
  return (Array.isArray(segments) ? segments : [])
    .filter((s) => Number.isFinite(s?.start) && Number.isFinite(s?.end))
    .filter((s) => s.end > debut && s.start < fin)
    .map((s) => String(s.text || '').trim())
    .filter(Boolean)
    .join(' ')
    .slice(0, 1000);
}

// ─── Idempotence des extraits produits ────────────────────────────────────
/**
 * UUID DÉTERMINISTE d'un extrait, dérivé de (source, enregistrement, seconde de
 * début) — la clé naturelle d'un extrait : au même endroit du même replay
 * correspond le même extrait, quel que soit le nombre de fabrications.
 *
 * POURQUOI PAS `randomUUID()` : parce qu'un identifiant tiré au sort rend toute
 * reprise indistinguable d'une création. Deux passages produisaient deux lignes
 * « Extrait 1 » et deux objets R2 différents, sans aucun moyen de savoir lequel
 * jeter — et rien, nulle part dans le dépôt, ne supprimait jamais une ligne
 * `short_clips`. Avec une clé dérivée, `upsert` remplace et le PUT R2 écrase :
 * relancer devient sans conséquence, ce qui est exactement la promesse faite par
 * le bouton « Relancer la fabrication ».
 *
 * Forme : UUID v5 « maison » (SHA-1 tronqué + bits de version/variante), pour que
 * la valeur soit acceptée par la colonne `uuid` de PostgreSQL.
 */
function clipIdDeterministe(recordingId, source, startSec) {
  const empreinte = createHash('sha1')
    .update(`short_clips:${source}:${recordingId}:${Math.round(startSec)}`)
    .digest();
  const b = Buffer.from(empreinte.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x50; // version 5
  b[8] = (b[8] & 0x3f) | 0x80; // variante RFC 4122
  const hex = b.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Supprime les extraits d'un replay que la fabrication qui vient de s'achever n'a
 * PAS reproduits — en base ET sur R2.
 *
 * Le préfixe R2 `shorts/<tenant>/<recording>/` est la seule désignation qui marche
 * pour les DEUX sources : côté LiveKit `recording_id` vaut NULL en base (le lien
 * passe par `live_session_id`), alors que la clé de stockage, elle, porte toujours
 * l'identifiant de l'enregistrement.
 *
 * NON BLOQUANTE : un ménage impossible ne doit pas transformer une fabrication
 * réussie en échec — mais il est journalisé, jamais avalé.
 */
async function purgerClipsObsoletes(tenantId, recordingId, idsGardes) {
  try {
    const prefixe = `shorts/${tenantId}/${recordingId}/`;
    const { data: existants, error } = await supabase
      .from('short_clips')
      .select('id, storage_key')
      .eq('tenant_id', tenantId)
      .like('storage_key', `${prefixe}%`);
    if (error) throw error;

    const aJeter = (existants || []).filter((c) => c?.id && !idsGardes.includes(c.id));
    if (aJeter.length === 0) return 0;

    const { error: delErr } = await supabase
      .from('short_clips')
      .delete()
      .in('id', aJeter.map((c) => c.id));
    if (delErr) throw delErr;

    // L'objet R2 APRÈS la ligne : si la suppression du fichier échoue, on a perdu un
    // fichier orphelin, pas une ligne qui désignerait un fichier disparu.
    for (const c of aJeter) await deleteFromR2(c.storage_key);

    console.warn(
      `[short-gen] 🧹 ${aJeter.length} extrait(s) d'une fabrication précédente supprimé(s) pour ${recordingId}`,
    );
    return aJeter.length;
  } catch (e) {
    console.error(`[short-gen] Purge des extraits obsolètes impossible (${e.message}) — doublons possibles à l'écran`);
    return 0;
  }
}

// ─── Traiter une vidéo pour en extraire des shorts ────────────────────────
async function processVideoForShorts(recordingId, tenantId, storageKey, videoUrlFallback, opts = {}) {
  const source = opts.source || 'zoom';        // 'zoom' (Vidéothèque) | 'live' (replay LiveKit)
  const liveSessionId = opts.liveSessionId || null;
  // Segments DÉJÀ connus (cues réemployées) : quand ils sont fournis, on ne
  // télécharge pas d'audio et on n'appelle aucun fournisseur de transcription.
  const presetSegments = Array.isArray(opts.presetSegments) ? opts.presetSegments : null;
  const durationSec = Number(opts.durationSec) || null;
  const jobId = randomUUID();
  const tmpDir = tmpdir();
  const videoFile = join(tmpDir, `short_source_${jobId}.mp4`);
  const audioFile = join(tmpDir, `short_audio_${jobId}.wav`);
  const shortsDir = join(tmpDir, `shorts_${jobId}`);

  try {
    console.log(`[short-gen] Démarrage pour recording ${recordingId}`);

    // 1. Télécharger la vidéo source
    if (storageKey) {
      console.log(`[short-gen] Téléchargement depuis R2: ${storageKey}`);
      await downloadFromR2(storageKey, videoFile);
    } else if (videoUrlFallback) {
      console.log(`[short-gen] Téléchargement depuis URL: ${videoUrlFallback}`);
      const res = await fetch(videoUrlFallback);
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);
      // En flux, pour la même raison que le téléchargement R2 ci-dessus :
      // `arrayBuffer()` chargeait le replay entier en mémoire.
      await pipeline(Readable.fromWeb(res.body), createWriteStream(videoFile));
    } else {
      throw new Error('Aucune source vidéo disponible');
    }

    // 2-3. TRANSCRIPTION — trois cas, dans cet ordre.
    let transcript;
    let transcriptSource;   // 'cues' | 'whisper' | 'none' — tracé dans short_clips.metadata
    let transcribedNow = false;

    if (presetSegments && presetSegments.length > 0) {
      // (a) RÉEMPLOI : la transcription existe déjà en base, payée une fois lors de
      // l'import/chapitrage. On saute l'extraction audio ET l'appel Whisper. Sur un
      // replay de 2 h cela évite un décodage complet, un WAV de 1,7 Go, et une
      // facture de transcription pour un texte qu'on possède déjà.
      transcript = {
        text: presetSegments.map((s) => s.text).join(' ').slice(0, 20000),
        segments: presetSegments,
      };
      transcriptSource = 'cues';
      console.log(
        `[short-gen] ♻️ Transcription réemployée : ${presetSegments.length} segment(s) depuis les cues — aucun appel Whisper`,
      );
    } else if (source === 'zoom' && durationSec && durationSec > WHISPER_INLINE_MAX_SEC) {
      // (b) Replay long SANS cues : on ne tente même pas. L'extraction produit ici un
      // WAV 16 kHz mono (≈2 Mo/minute) et les fournisseurs Whisper refusent au-delà de
      // 25 Mo, soit ~12 minutes : au-delà, l'appel échoue à COUP SÛR après avoir
      // décodé la vidéo entière.
      //
      // ⛔ NE PAS CROIRE QUE « zoom-transcribe s'en chargera ». C'était écrit ici et
      // c'est FAUX pour exactement les replays qui atteignent cette branche :
      // `pollZoomTranscribe` (zoom-transcribe.js) filtre `.is('transcript_text', null)`,
      // or il pose lui-même `transcript_text = ''` comme SENTINELLE « tenté, en échec »
      // (zoom-transcribe.js, bloc `catch`) pour ne plus y revenir. Les replays qui ont
      // déjà échoué une fois sont donc SORTIS de sa file pour de bon. La seule reprise
      // possible est manuelle :
      //     update published_videos set transcript_text = null where transcript_text = '';
      // C'est pourquoi l'API prévient l'utilisateur AVANT le clic (drapeau
      // `sans_transcription` de ReplayShortsState) : il choisit en connaissance de cause.
      //
      // ⚠️ CE QUE CE DRAPEAU PROMET A CHANGÉ. Il annonçait « des extraits sans
      // sous-titres » ; depuis que le sous-titre EST le contenu, cette branche ne
      // produit plus rien du tout : sans segments, aucun moment ne peut être choisi (le
      // choix se fait sur ce qui est DIT) et la fabrication s'arrête au bloc 4 avec un
      // message explicite. Le drapeau signifie donc désormais « ce replay ne peut pas
      // encore donner d'extraits », et non « il en donnera de moins bons ».
      transcript = { text: '', segments: [] };
      transcriptSource = 'none';
      console.warn(
        `[short-gen] Replay de ${Math.round(durationSec / 60)} min sans cues → AUCUN extrait possible : les moments se choisissent sur ce qui est dit, et le texte est le contenu du clip (zoom-transcribe ne reprendra ce replay que si published_videos.transcript_text est remis à NULL à la main)`,
      );
    } else {
      // (c) Comportement historique (directs LiveKit, courts) : extraction + Whisper,
      // NON BLOQUANT pour la transcription elle-même.
      // ⚠️ MAIS LA SUITE A CHANGÉ : sans transcription il n'y a plus de repli
      // « première minute ». Le choix des moments est sémantique, il lui faut du
      // texte ; à défaut on tombe sur le repli MÉCANIQUE de short-highlights.js, qui
      // exige lui aussi des segments. Sans segments du tout, la fabrication échoue en
      // le disant, au lieu de livrer 60 s de préambule (voir le bloc 5).
      //
      // ⚠️ L'EXTRACTION EST DANS LE MÊME `try` QUE LA TRANSCRIPTION. Elle était
      // au-dessus, hors garde : tant qu'elle ne pouvait pas échouer (ffmpeg rendait 0
      // même en produisant un WAV bidon) c'était sans conséquence. Maintenant qu'elle
      // CONTRÔLE son résultat et peut jeter, la laisser dehors ferait échouer toute la
      // fabrication d'un direct pour un simple défaut d'audio — alors que le contrat
      // affiché de cette branche est justement de dégrader, pas de renoncer.
      try {
        console.log(`[short-gen] Extraction audio...`);
        await extractAudio(videoFile, audioFile);
        transcript = await transcribeAudio(audioFile);
        transcribedNow = true;
        transcriptSource = 'whisper';
      } catch (e) {
        console.warn(
          `[short-gen] Transcription indisponible (${String(e.message).slice(0, 80)}) → clip sans transcript`,
        );
        transcript = { text: '', segments: [] };
        transcriptSource = 'none';
      }
      console.log(`[short-gen] Transcription: ${(transcript.text || '').slice(0, 100)}...`);
    }

    // 3bis. SONDER LA VIDÉO. Deux usages, tous deux indispensables :
    //   · les dimensions réelles décident de la mise en page 9:16 (voir
    //     `geometrieVerticale`) — un partage d'écran Zoom n'est pas en 16:9
    //     (le replay de référence est en 1920×942, soit 2,04:1) ;
    //   · la durée EXACTE borne les extraits. `zoom_recordings.duration_min` est
    //     arrondi à la minute : s'y fier peut poser une borne jusqu'à 30 s après la
    //     fin réelle du fichier.
    const sonde = await sonderVideo(videoFile);
    const dureeReelle = sonde?.dureeSec || durationSec || 0;
    if (sonde) {
      console.log(
        `[short-gen] Source ${sonde.largeur}×${sonde.hauteur} (${(sonde.largeur / sonde.hauteur).toFixed(2)}:1), ` +
          `${Math.round(dureeReelle)} s`,
      );
    } else {
      console.warn('[short-gen] ffprobe indisponible → géométrie 9:16 calculée sur des dimensions supposées (1920×1080)');
    }
    // Mise en page TÉMOIN, calculée sans regarder l'image et sans titre : elle sert à
    // journaliser d'entrée ce que cette source donnera comme trame, avant même de
    // choisir les moments. La mise en page réellement encodée est recalculée par
    // extrait (le cadrage change dans la bande, et la coiffe n'est pas toujours là).
    const geometrieTemoin = geometrieVerticale(sonde?.largeur || 1920, sonde?.hauteur || 1080);
    // La typographie de TOUTE la séance, figée ici : le découpage du texte en lignes
    // (plus bas) et chaque géométrie d'extrait doivent employer la même.
    const typoSeance = typographieSeance(sonde?.largeur || 1920, sonde?.hauteur || 1080);
    console.log(
      `[short-gen] Typographie de la séance : corps ${typoSeance.taille} px ` +
        `(${(typoSeance.taille / 1920 * 100).toFixed(2)} % de cadratin), ligne ${typoSeance.hauteurLigne} px, ` +
        `${typoSeance.maxCar} caractères au plus par ligne`,
    );
    console.log(
      `[short-gen] Trame 9:16 « le texte est le héros » : bande vidéo ${geometrieTemoin.bande.h} px ` +
        `(${Math.round(geometrieTemoin.partVideo * 100)} % de la trame), zone de parole ${geometrieTemoin.zoneTexte.h} px ` +
        `(${Math.round(geometrieTemoin.partTexte * 100)} %, de quoi tenir ${geometrieTemoin.lignesTenables} lignes de sous-titre) — ` +
        `l'ancien recadrage centré n'aurait gardé que ${Math.round(geometrieTemoin.partAncienRecadrage * 100)} % de la largeur ; ` +
        `le cadrage DANS la bande est décidé extrait par extrait`,
    );

    // 4. CHOISIR LES MOMENTS — par le SENS, avec veto du signal (short-highlights.js).
    const { extraits, origine, diagnostic } = await selectionnerMoments({
      segments: transcript.segments,
      dureeSec: dureeReelle,
      titre: opts.titre || '',
      fichier: videoFile,
      source: sonde,
      max: MAX_EXTRAITS,
      journal: console,
    });
    console.log(
      `[short-gen] ${extraits.length} extrait(s) retenu(s) — sélection ${origine === 'ia' ? 'PAR LE SENS' : '⚠️ MÉCANIQUE (repli)'}` +
        `, ${diagnostic.candidats} candidat(s) examiné(s), ${diagnostic.ecartes.length} écarté(s) par le garde-fou`,
    );

    if (extraits.length === 0) {
      // ⛔ PLUS DE REPLI « PREMIÈRE MINUTE ». C'était lui qui produisait l'« Extrait 1 »
      // désastreux : 60 s de tableau blanc vide sur « on enregistre bien sur le Clad ».
      // Et ce n'était pas un accident de ce replay-là : le début d'un enregistrement,
      // c'est PAR CONSTRUCTION l'accueil et les réglages. Un repli qui vise toujours le
      // même endroit vise toujours le pire endroit.
      // Quand rien n'est publiable on le DIT, et on n'inscrit rien en base — un extrait
      // mort coûte du stockage, de l'encodage, et la confiance du créateur.
      // (Ce contrôle est AVANT la relecture : on ne paie pas un appel de modèle pour
      // corriger le texte de zéro extrait.)
      throw new Error(
        transcript.segments.length === 0
          ? "Ce replay n'a pas de transcription horodatée : les extraits sont choisis sur ce qui est DIT, il n'y a donc rien sur quoi les choisir. Lancez d'abord la transcription du replay."
          : "Aucun moment publiable dans ce replay : tous les passages proposés ont été écartés (silence dominant ou écran vide). Rien n'a été fabriqué.",
      );
    }

    // 5. RELIRE LE TEXTE QUI VA ÊTRE AFFICHÉ EN GROS.
    // ⚠️ Whisper écrit « Je suis Shao cinquième Manikongo piste Vita Kimba » pour
    // « Je suis Cheo, cinquième Manikongo, fils de Kimpa Vita ». En 18 px au bas d'une
    // diapo, personne ne le voyait. En 110 px au milieu de l'écran, cette faute EST le
    // clip — et une faute sur un nom propre décrédibilise plus qu'une absence de texte.
    // ⚠️ CE QUE LA RELECTURE NE SAIT PAS FAIRE, ET IL FAUT LE SAVOIR : elle rétablit
    // « fils de Kimpa Vita » (le modèle connaît la prophétesse du royaume Kongo), mais
    // PAS « Shao » → « Cheo », qui est le nom de l'orateur lui-même — aucun modèle ne
    // peut le deviner. Ce nom est pourtant écrit noir sur blanc sur la diapo partagée
    // (« JE SUIS CHEO 5ieme manikongo… ») : seul un glossaire par tenant, ou une
    // lecture de l'image, le récupérerait. Ni l'un ni l'autre n'existe ici.
    // On ne relit QUE les segments réellement touchés par les fenêtres retenues (une
    // trentaine de lignes au lieu de plusieurs centaines), et le résultat passe par les
    // garde-fous serveur de `verdictCorrection` : une ligne réécrite est refusée et
    // l'originale conservée. Non bloquant de bout en bout.
    const indexTouches = new Map(); // index de segment → [numéros d'extrait concernés]
    extraits.forEach((e, n) => {
      transcript.segments.forEach((s, idx) => {
        if (Number.isFinite(s?.start) && Number.isFinite(s?.end) && s.end > e.start && s.start < e.end) {
          if (!indexTouches.has(idx)) indexTouches.set(idx, []);
          indexTouches.get(idx).push(n);
        }
      });
    });
    const lignesARelire = [...indexTouches.keys()]
      .sort((a, b) => a - b)
      .map((idx) => ({ ref: String(idx), texte: String(transcript.segments[idx].text || '') }));
    const { textes: textesRelus, trace: traceRelecture } = await corrigerTranscription({
      lignes: lignesARelire,
      // ⚠️ SANS `tenantId`, TOUT LE GLOSSAIRE EST INERTE. `chargerGlossaire` rend
      // alors une liste vide et la relecture retombe au taux mesuré SANS
      // vocabulaire : 0 correction sur 24 essais. Le sous-titre afficherait
      // « Je suis Shao … piste Vita Kimba » en 110 px, juste au-dessus d'une
      // bande vidéo où la diapo écrit « JE SUIS CHEO … fils de vita kimpa ».
      // Avec le tenant : 24/24, zéro invention.
      tenantId,
      titre: opts.titre || '',
      journal: console,
    });
    // Segments AFFICHÉS = les segments d'origine, avec le texte relu là où il a passé
    // les garde-fous. Les originaux restent intacts dans `transcript.segments`.
    const segmentsAffiches = transcript.segments.map((s, idx) => {
      const relu = textesRelus.get(String(idx));
      return relu && relu !== s.text ? { ...s, text: relu } : s;
    });
    // Substitutions de mots (mal entendu → corrigé) DÉDUITES d'une correction déjà
    // validée, rangées par extrait : elles servent à propager la correction au TITRE,
    // que le sélecteur a écrit sur la transcription fautive. On ne redemande rien au
    // modèle — donc aucune invention ne peut entrer par là.
    const pairesParExtrait = extraits.map(() => []);
    for (const [idx, numeros] of indexTouches) {
      const avant = transcript.segments[idx]?.text || '';
      const apres = textesRelus.get(String(idx));
      if (!apres || apres === avant) continue;
      const paires = pairesDeCorrection(avant, apres);
      for (const n of numeros) pairesParExtrait[n].push(...paires);
    }

    const highlights = extraits.map((e, n) => {
      const titreBrut = e.titre || '';
      const titreAffiche = titreBrut ? corrigerTitre(titreBrut, pairesParExtrait[n]) : '';
      return {
        ...e,
        titre: titreAffiche || titreBrut,
        titreBrut,
        // `text` alimente la description et l'extrait de transcription en base : c'est
        // le texte RÉELLEMENT prononcé dans la fenêtre — relu, donc ce que le
        // spectateur va lire —, pas le titre du modèle.
        text: texteDeLaFenetre(segmentsAffiches, e.start, e.end) || titreAffiche || 'Extrait vidéo',
        // Les cartons de sous-titres, calculés AVANT tout encodage : c'est ce qui permet
        // de savoir, avant de dépenser une seule seconde de ffmpeg, s'il y a quelque
        // chose à afficher et si ce worker sait l'afficher.
        // ⭐ La découpe est suivie de la RÉPARATION des cartons-éclairs : la découpe
        // raisonne cue par cue et produit encore des cartons de 0,15 s (le dernier
        // d'une cue, borné par sa fin) ; les absorber demande de voir la cue d'à côté,
        // donc la liste entière. Voir `fusionnerCartonsCourts`.
        // ⚠️ `maxCar` DOIT venir de la typographie de la séance. Couper à 13
        // caractères puis dessiner à un corps prévu pour 10, c'est exactement le
        // bug que `typographieSeance` existe pour empêcher : les lignes sortiraient
        // plus larges que les 870 px utiles et libass replierait en permanence.
        unites: fusionnerCartonsCourts(
          decouperEnUnites(segmentsAffiches, e.start, e.end, { maxCar: typoSeance.maxCar }),
          { duree: e.end - e.start, maxCar: typoSeance.maxCar },
        ),
      };
    });

    for (const [n, hl] of highlights.entries()) {
      if (hl.titreBrut && hl.titre !== hl.titreBrut) {
        console.log(`[short-gen] Extrait ${n + 1} — titre recalé sur la relecture : « ${hl.titreBrut} » → « ${hl.titre} »`);
      }
      if (hl.unites.length === 0) {
        console.warn(`[short-gen] ⚠️ Extrait ${n + 1} (${Math.round(hl.start)} s) : aucune parole transcrite dans la fenêtre → clip SANS texte`);
      } else {
        const d = hl.unites.diagnostic;
        const reparation = (d.fusionnes || d.etires)
          ? ` | ${d.avant_reparation.trop_courts} éclair(s) réparé(s) : ${d.fusionnes} fusion(s), ${d.etires} étirement(s)`
          : '';
        console.log(
          `[short-gen] Extrait ${n + 1} — ${d.unites} carton(s) de sous-titre, ${d.caracteres} caractères, ` +
            `${d.debit_car_par_s} car/s, ${d.lignes_max} ligne(s) au plus, ${d.caracteres_ligne_max} caractères sur la plus longue, ` +
            `plus court ${d.plus_court_s} s${reparation}` +
            `${d.trop_rapides ? ` | ⚠️ ${d.trop_rapides} carton(s) encore sous ${d.plancher_s} s (fenêtre trop dense)` : ''}`,
        );
      }
    }

    // ⛔ LE CLIP MUET DE SENS N'EST PLUS UNE OPTION.
    // Avant, l'incrustation était tentée puis, en cas d'échec, le clip était refabriqué
    // SANS texte avec un simple `console.warn` — sur un poste sans libass, TOUS les
    // clips passaient par là et sortaient nus, sans que rien d'autre qu'une ligne de
    // journal ne le dise. Le sous-titre étant devenu le contenu, on sonde MAINTENANT,
    // une fois, avant tout encodage, et on renonce bruyamment si ce ffmpeg ne sait pas
    // dessiner. Le motif remonte tel quel dans `zoom_recordings.shorts_error`, donc à
    // l'écran du créateur.
    if (highlights.some((h) => h.unites.length > 0)) {
      const capacite = await capaciteSousTitres(console);
      if (!capacite.ok) {
        throw new Error(
          `Ce worker ne sait pas incruster de sous-titres (${capacite.motif}). Les extraits reposent `
          + `désormais sur la parole écrite en gros : les fabriquer sans texte donnerait des vidéos `
          + `vides de sens. Rien n'a été produit. Correctif : image worker avec ffmpeg compilé avec `
          + `libass + fontconfig + font-noto (apps/worker/Dockerfile).`,
        );
      }
    }

    await mkdir(shortsDir, { recursive: true });
    const clips = [];
    // Identifiants réellement produits par CE passage : ils servent de laissez-passer
    // à la purge finale (tout le reste sous le même préfixe R2 est un vestige).
    const idsProduits = [];

    for (let i = 0; i < highlights.length; i++) {
      const hl = highlights[i];
      // ⚠️ IDENTIFIANT DÉTERMINISTE, PAS `randomUUID()`. Une refabrication du même
      // replay reproduit exactement les mêmes id et les mêmes clés R2 : l'`upsert`
      // ci-dessous REMPLACE la ligne au lieu d'en empiler une seconde, et le PUT R2
      // écrase l'objet au lieu d'en abandonner un orphelin. Sans cela, un échec au
      // milieu de la boucle (ffmpeg, 5xx R2) laissait les clips déjà insérés en base,
      // le replay en 'error', et le bouton « Relancer la fabrication » — offert
      // précisément dans cet état — refaisait TOUT : deux « Extrait 1 », deux
      // « Extrait 2 », indiscernables et que rien dans le dépôt ne savait supprimer.
      const clipId = clipIdDeterministe(recordingId, source, hl.start);
      const clipPath = join(shortsDir, `short_${i}.mp4`);
      const assPath = join(shortsDir, `short_${i}.ass`);

      // Le titre ne coiffe la trame que s'il en existe un VRAI. En repli mécanique il
      // n'y a pas eu de choix éditorial : afficher « Extrait 3 » en manchette serait du
      // bruit, et la place rendue profite alors à la parole.
      const lignesTitre = hl.unites.length > 0 && hl.titre ? preparerTitre(hl.titre) : null;

      // ── CADRAGE, EXTRAIT PAR EXTRAIT ────────────────────────────────────────
      // Le cadrage NE PEUT PAS être calculé une fois pour tout le replay : un même
      // enregistrement montre successivement une diapo pleine largeur, un tableau
      // blanc, une vue caméra. Mesuré sur les 41 fenêtres de 29 s du replay de
      // référence : la région utile va de 1920×942 (rien à rogner, 9 fenêtres) à
      // 686×942 (une diapo presque vide). Une seule sonde pour tout le fichier aurait
      // donc, au choix, sur-rogné une fenêtre ou renoncé sur toutes les autres.
      // Coût mesuré : 0,27 s de ffmpeg par extrait (6 sondes en un seul décodage de la
      // fenêtre, en niveaux de gris réduits) — à comparer aux dizaines de secondes de
      // l'encodage qui suit.
      // ⚠️ Ce que le cadrage change désormais, c'est ce qu'on voit DANS la bande vidéo,
      // pas la hauteur de la bande : la mise en page reste identique d'un extrait à
      // l'autre (voir `geometrieVerticale`).
      const avecTitre = Boolean(lignesTitre);
      let geometrie = geometrieVerticale(sonde?.largeur || 1920, sonde?.hauteur || 1080, null, { avecTitre, typo: typoSeance });
      try {
        const cadrage = await detecterRegionUtile({
          fichier: videoFile,
          debut: hl.start,
          duree: hl.end - hl.start,
          largeur: sonde?.largeur || 1920,
          hauteur: sonde?.hauteur || 1080,
        });
        geometrie = geometrieVerticale(sonde?.largeur || 1920, sonde?.hauteur || 1080, cadrage, { avecTitre, typo: typoSeance });
        hl.cadrage = {
          mode: geometrie.mode,
          gain: Number(geometrie.gain.toFixed(3)),
          part_gardee: Number(geometrie.partGardee.toFixed(3)),
          decoupes: geometrie.decoupes,
          mesures: geometrie.mesures,
        };
      } catch (e) {
        // Un défaut de détection ne coûte QUE le gain : on retombe sur l'image entière.
        console.warn(`[short-gen] Cadrage indétectable pour l'extrait ${i + 1} (${e.message}) → image entière dans la bande`);
      }
      console.log(
        `[short-gen] Extrait ${i + 1} — cadrage « ${geometrie.mode} » : ` +
          geometrie.decoupes.map((d) => `${d.l}×${d.h}@(${d.x},${d.y})→${d.ml}×${d.mh}`).join(' + ') +
          ` posé en (${geometrie.video.x},${geometrie.video.y}) | échelle ${geometrie.echelle.toFixed(3)} ` +
          `contre ${geometrie.echellePlein.toFixed(3)} (×${geometrie.gain.toFixed(2)})` +
          `${geometrie.mesures?.vignette_retiree ? ' | vignette caméra retirée' : ''} | ` +
          `parole ${geometrie.zoneTexte.h} px (${Math.round(geometrie.partTexte * 100)} %) à partir de y=${geometrie.ass.margeHauteParole}` +
          `${avecTitre ? ' | titre en coiffe' : ''}`,
      );

      // ── LE FICHIER ASS ──────────────────────────────────────────────────────
      // C'est lui qui porte le contenu du short. Le texte du modèle (le titre) et le
      // texte relu (la parole) y sont échappés pour la syntaxe ASS seule — ils ne
      // traversent JAMAIS l'analyseur de filtres de ffmpeg, qui ne voit que le chemin.
      const srtContent = srtDesUnites(hl.unites);
      let sousTitresIncrustes = false;
      if (hl.unites.length > 0) {
        await writeFile(
          assPath,
          construireAss({ unites: hl.unites, lignesTitre, geo: geometrie, duree: hl.end - hl.start }),
        );
        sousTitresIncrustes = true;
      }

      // Générer le clip. Pas de repli sans texte : la sonde a déjà tranché plus haut,
      // donc un échec ici est une vraie panne et doit remonter.
      await createShortClip(videoFile, clipPath, hl.start, hl.end, sousTitresIncrustes ? assPath : null, geometrie);

      // Upload vers R2 (clé déterministe : une refabrication écrase, elle n'ajoute pas)
      const clipKey = `shorts/${tenantId}/${recordingId}/${clipId}.mp4`;
      const clipUrl = await uploadToR2(clipPath, clipKey);
      const duration = Math.round(hl.end - hl.start);

      // Sauvegarder en DB — `upsert` sur la clé primaire, pas `insert` : refabriquer
      // met la ligne À JOUR. Bonus non négligeable : `social_posts.short_clip_id`
      // (ON DELETE SET NULL) continue de pointer sur le même clip, alors qu'une
      // suppression/réinsertion aurait détaché les brouillons déjà rédigés.
      const { error: dbErr } = await supabase.from('short_clips').upsert(
        {
          id: clipId,
          recording_id: source === 'zoom' ? recordingId : null,
          live_session_id: liveSessionId,
          source,
          tenant_id: tenantId,
          // TITRE : celui que le modèle a écrit pour CE passage, pas « Extrait N ».
          // C'est la première chose que voit le créateur dans la Vidéothèque et la base
          // de la légende sociale. En repli mécanique il n'y a PAS de titre (aucun
          // choix éditorial n'a eu lieu) : on retombe alors sur la numérotation, ce qui
          // dit la vérité plutôt que de maquiller un découpage en sélection.
          title: hl.titre || `Extrait ${i + 1}`,
          description: hl.text.slice(0, 200),
          start_sec: Math.round(hl.start),
          end_sec: Math.round(hl.end),
          duration_sec: duration,
          storage_key: clipKey,
          thumbnail_url: null,
          transcript_snippet: hl.text.slice(0, 500),
          // Le SRT archivé décrit EXACTEMENT ce qui est à l'écran : mêmes cartons,
          // mêmes bornes, texte relu. Le publieur social et le poste de production le
          // réutilisent sans re-transcrire.
          // ⚠️ MAIS SEULEMENT S'IL EST RÉELLEMENT À L'IMAGE. Tester
          // `transcript.segments.length > 0`, comme avant, faisait attester la base de
          // sous-titres qu'un repli venait justement d'abandonner : on livrait des
          // vidéos nues avec un SRT en base pour dire le contraire.
          subtitle_srt: sousTitresIncrustes ? srtContent : null,
          metadata: {
            transcript_source: transcriptSource,
            subtitles_burned: sousTitresIncrustes,
            // ── Traçabilité de la SÉLECTION ────────────────────────────────────
            // `selection` doit rester lisible en base : c'est la seule façon de savoir,
            // devant un extrait médiocre, si le modèle l'a choisi ou si un découpeur
            // mécanique a bouché un trou. Ne jamais écrire 'ia' sur un repli.
            selection: origine,
            raison: hl.raison || null,
            force: hl.force ?? null,
            // Recadrage sur la parole : de combien de secondes la fenêtre du modèle a
            // été resserrée pour retirer les blancs (0 = bornes du modèle intactes).
            recadre_sec: hl.recadre ?? 0,
            // Ce que le signal a réellement mesuré sur la fenêtre finale.
            mesures: hl.mesures || null,
            // ── Traçabilité de la MISE EN PAGE ─────────────────────────────────
            // Les parts de trame sont ce qui distingue cette mise en page de la
            // précédente : elles disent, en base, que le texte a bien reçu la place.
            geometrie: {
              modele: 'texte_heros_v1',
              video_px: geometrie.bande.h,
              texte_px: geometrie.zoneTexte.h,
              part_video: Number(geometrie.partVideo.toFixed(3)),
              part_texte: Number(geometrie.partTexte.toFixed(3)),
              titre_affiche: avecTitre,
              // L'ancre du bloc de parole et le bas qu'atteindrait un 4e repli : les
              // deux seuls nombres qui disent si un sous-titre peut passer sous
              // l'interface du réseau. Sans eux, un débordement reste invisible après
              // coup — c'est exactement ce qui s'est produit.
              ancre_parole: geometrie.ancreParole,
              bas_quatre_lignes: geometrie.basQuatreLignes,
              lignes_tenables: geometrie.lignesTenables,
            },
            // ── Traçabilité des SOUS-TITRES ────────────────────────────────────
            sous_titres: hl.unites.length > 0 ? {
              ...hl.unites.diagnostic,
              // ⚠️ LA TAILLE VIENT DE LA GÉOMÉTRIE, PLUS D'UNE CONSTANTE. Depuis que
              // le corps se déduit de la hauteur de zone (`typographieParole`), citer
              // `TAILLE_SOUS_TITRE` écrirait 110 en base pour un texte dessiné à 131 —
              // une trace fausse est pire que pas de trace, puisqu'on s'y fie ensuite
              // pour juger la lisibilité sans rouvrir le fichier.
              taille_police: geometrie.typo.taille,
              part_hauteur_cadratin: Number((geometrie.typo.taille / 1920).toFixed(4)),
              max_caracteres_ligne: geometrie.typo.maxCar,
            } : null,
            // ── Traçabilité de la RELECTURE ────────────────────────────────────
            // Ce que la machine avait entendu, et ce qu'on affiche à la place. Sans
            // cette trace, une correction fautive serait indétectable après coup.
            transcription: {
              modele: traceRelecture.modele,
              lignes_corrigees: traceRelecture.corrigees,
              lignes_refusees: traceRelecture.refusees,
              motif: traceRelecture.motif,
              exemples: traceRelecture.exemples,
              titre_avant: hl.titreBrut && hl.titreBrut !== hl.titre ? hl.titreBrut : null,
            },
            // ── Traçabilité du CADRAGE ─────────────────────────────────────────
            // Devant un extrait au cadrage douteux, c'est la seule façon de savoir ce
            // que la machine a vu : quel mode elle a choisi ('plein' = elle a renoncé),
            // quelles découpes elle a faites, et si elle a retiré la vignette caméra.
            cadrage: hl.cadrage || { mode: 'plein', gain: 1, decoupes: null, mesures: null },
          },
          status: 'ready',
        },
        { onConflict: 'id' },
      );

      if (dbErr) console.error(`[short-gen] DB upsert error: ${dbErr.message}`);

      idsProduits.push(clipId);
      clips.push({ id: clipId, duration, url: clipUrl, text: hl.text.slice(0, 200) });
      console.log(
        `[short-gen] ✅ Short ${i + 1}: ${duration}s${sousTitresIncrustes ? ` (${hl.unites.length} cartons de sous-titre)` : ' (SANS texte — fenêtre muette)'} — ` +
          `« ${hl.titre || `Extrait ${i + 1}`} » @${Math.round(hl.start)}s`,
      );
    }

    // Vestiges d'une fabrication PRÉCÉDENTE : les identifiants déterministes ne
    // couvrent que les extraits qui retombent au même endroit. Si la détection a
    // bougé (transcription arrivée entre-temps, bornes différentes), les anciennes
    // lignes resteraient affichées et facturées sur R2 sans que rien ne les désigne.
    await purgerClipsObsoletes(tenantId, recordingId, idsProduits);

    // Mettre à jour le statut du recording (selon la source)
    if (source === 'live') {
      const { error: majLive } = await supabase
        .from('live_recordings')
        .update({ shorts_status: 'done' })
        .eq('id', recordingId);
      // Non lu jusqu'ici : un UPDATE perdu laisse la ligne en 'processing', et
      // pollLiveReplayShorts ne prend QUE les `shorts_status IS NULL` → le replay
      // sort de la file pour toujours, sans le moindre message. On le crie.
      if (majLive) {
        console.error(`[short-gen] ⚠️ live_recordings ${recordingId} : statut 'done' non écrit (${majLive.message}) — la ligne reste en 'processing'`);
      }
    } else {
      // ⚠️ NE PLUS TOUCHER À `zoom_recordings.status`. Cette colonne est la machine à
      // états du TRANSFERT/PUBLICATION de la Vidéothèque
      // (pending → downloading → downloaded → published) : la faire passer à
      // 'analyzed' (ou à 'error' en cas d'échec, avec `error_message` écrasé) sortait
      // le replay de 'downloaded', changeait son état affiché et pouvait le condamner
      // — zoom-transfer ne reprend que les 'pending'. Les shorts ont désormais leur
      // colonne à eux, `shorts_status`, exactement comme le jumeau LiveKit.
      const update = {
        shorts_status: 'done',
        shorts_error: null,
        updated_at: new Date().toISOString(),
      };
      // On n'écrit `transcript_text` que si on vient RÉELLEMENT de transcrire :
      // réemployer des cues et réécrire la colonne avec leur concaténation tronquée
      // ne ferait qu'abîmer un texte déjà propre. Et un transcript vide n'écrase rien.
      if (transcribedNow && transcript.text) update.transcript_text = transcript.text;

      // ⚠️ ON LIT LE RÉSULTAT DE CETTE ÉCRITURE. supabase-js NE JETTE PAS : si cet
      // UPDATE échoue (coupure réseau, 502 PostgREST), la ligne reste en 'processing',
      // `reclaimStaleShortJobs` la remet en file au bout de 2 h, et le replay entier —
      // plusieurs Go téléchargés, plusieurs minutes de ffmpeg — est réencodé TOUT SEUL,
      // sans qu'aucun humain ait cliqué. Toute l'idempotence du chemin Vidéothèque
      // repose sur cette seule écriture : elle ne peut pas rester non vérifiée.
      const { error: majErr } = await supabase.from('zoom_recordings').update(update).eq('id', recordingId);
      if (majErr) {
        console.error(`[short-gen] ⚠️ Statut 'done' non écrit (${majErr.message}) — nouvel essai`);
        const { error: majErr2 } = await supabase.from('zoom_recordings').update(update).eq('id', recordingId);
        if (majErr2) {
          console.error(
            `[short-gen] ❌ Statut 'done' TOUJOURS non écrit pour ${recordingId} (${majErr2.message}). La ligne restera en 'processing' et sera reprise dans 2 h ; les extraits, eux, sont déjà en base — grâce aux identifiants déterministes la reprise les remplacera au lieu de les dupliquer.`,
          );
        }
      }
    }

    console.log(`[short-gen] ✅ ${clips.length} short(s) généré(s) pour ${recordingId}`);
    return clips;
  } catch (err) {
    console.error(`[short-gen] ❌ Erreur: ${err.message}`);

    if (source === 'live') {
      await supabase
        .from('live_recordings')
        .update({ shorts_status: 'error' })
        .eq('id', recordingId);
    } else {
      // Échec CLOISONNÉ : motif dans `shorts_error`, jamais dans `error_message`
      // (réservé au transfert Zoom) et sans toucher `status`. Le replay reste
      // consultable dans la Vidéothèque ; seule la génération de shorts est en échec.
      await supabase
        .from('zoom_recordings')
        .update({
          shorts_status: 'error',
          // Le préfixe est court À DESSEIN : chaque caractère qu'il prend est un
          // caractère de moins pour le correctif (voir `motifActionnable`).
          shorts_error: `Extraits : ${motifActionnable(err.message)}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', recordingId);
    }

    return [];
  } finally {
    // Nettoyage. `unlink` sur un DOSSIER échoue toujours (EPERM/EISDIR) : les clips
    // et les SRT restaient donc sur le disque éphémère du conteneur à chaque passage.
    try { await unlink(videoFile); } catch {}
    try { await unlink(audioFile); } catch {}
    try { await rm(shortsDir, { recursive: true, force: true }); } catch {}
  }
}

// ─── Poller la VIDÉOTHÈQUE (zoom_recordings) — À LA DEMANDE UNIQUEMENT ─────
/**
 * Ne traite QUE les replays dont le créateur a explicitement demandé les extraits
 * depuis la Vidéothèque (`shorts_status` = 'requested' | 'queued', posé par l'API).
 *
 * ⛔ IL NE BALAIE PLUS `status='downloaded'`. Cette requête-là désignait les 61
 * replays de la Vidéothèque, sans aucune marque de traitement : branché tel quel,
 * le poller aurait repris les 3 mêmes toutes les 5 minutes, indéfiniment, en
 * retéléchargeant des fichiers de plusieurs Go et en rebrûlant la transcription à
 * chaque tour — une dépense que personne n'a décidée.
 *
 * ── CONTRAT AVEC LE DÉCLENCHEUR MANUEL (API `/zoom-engine/shorts-from-replay`) ──
 * L'API n'a QUE ça à faire pour mettre un replay dans cette file :
 *     UPDATE zoom_recordings
 *        SET shorts_status = 'requested', shorts_requested_at = now(),
 *            shorts_attempts = 0, shorts_error = NULL
 *      WHERE id = <recording_id> AND tenant_id = <tenant>
 *        AND (shorts_status IS NULL OR shorts_status IN ('error','done'));
 * La clause finale rend le bouton IDEMPOTENT : redemander pendant que le worker
 * travaille ne remet pas la ligne dans la file et ne refacture rien.
 * Lecture de l'état pour l'écran : `shorts_status` (NULL → « aucun »,
 * 'requested'/'queued' → « demande », 'processing' → « encours », 'done' → « pret »,
 * 'error' → « erreur »), + `shorts_error` et `shorts_requested_at`.
 */
export async function pollShortGeneration() {
  try {
    // (0) Rattrapage des 'processing' orphelins — un redéploiement Railway en plein
    //     travail laisse sinon la ligne verrouillée à vie, sans erreur visible.
    await reclaimStaleShortJobs();

    // (1) La file : demandes explicites, les plus anciennes d'abord, une seule.
    const { data: recordings, error } = await supabase
      .from('zoom_recordings')
      .select('id, tenant_id, storage_key, playback_url, topic, duration_min, transcript_cues, shorts_attempts')
      .in('shorts_status', SHORTS_REQUESTED_STATES)
      .not('storage_key', 'is', null)
      .order('shorts_requested_at', { ascending: true, nullsFirst: false })
      .limit(SHORTS_BATCH);

    if (error) throw error;
    if (!recordings || recordings.length === 0) return 0;

    let count = 0;
    for (const rec of recordings) {
      const attempts = Number(rec.shorts_attempts) || 0;

      // (2) Trop d'essais → on abandonne EN L'ÉCRIVANT. La ligne quitte la file
      //     (donc elle ne bloque pas les suivantes) et le motif reste lisible à
      //     l'écran ; seul un nouveau clic du créateur remet le compteur à zéro.
      if (attempts >= SHORTS_MAX_ATTEMPTS) {
        await supabase
          .from('zoom_recordings')
          .update({
            shorts_status: 'error',
            shorts_error: `Abandon après ${attempts} tentatives — relancez la demande depuis la Vidéothèque`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', rec.id);
        console.warn(`[short-gen] "${rec.topic}" abandonné après ${attempts} tentatives`);
        continue;
      }

      // (3) Prise de jeton : on passe à 'processing' AVANT tout travail (comme le
      //     jumeau LiveKit), en n'acceptant la transition QUE depuis un état de file.
      //     Si deux instances du worker tournent, la seconde ne met à jour aucune
      //     ligne et s'efface — c'est un verrou par comparaison-et-échange.
      const { data: claimed } = await supabase
        .from('zoom_recordings')
        .update({
          shorts_status: 'processing',
          shorts_started_at: new Date().toISOString(),
          shorts_attempts: attempts + 1,
          shorts_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', rec.id)
        .in('shorts_status', SHORTS_REQUESTED_STATES)
        .select('id');
      if (!claimed || claimed.length === 0) {
        console.log(`[short-gen] "${rec.topic}" déjà pris par une autre instance`);
        continue;
      }

      // (4) Transcription déjà payée ? On la réemploie plutôt que de rappeler Whisper.
      const durationSec = (Number(rec.duration_min) || 0) * 60 || null;
      const stored = await fetchStoredTranscript(rec.id, rec.transcript_cues);
      const presetSegments = stored ? cuesToSegments(stored.cues, durationSec) : [];
      if (presetSegments.length > 0) {
        console.log(
          `[short-gen] "${rec.topic}" — ${presetSegments.length} segment(s) réemployés depuis ${stored.origin}`,
        );
      } else {
        console.log(`[short-gen] "${rec.topic}" — aucune transcription exploitable en base`);
      }

      console.log(`[short-gen] Traitement (tentative ${attempts + 1}/${SHORTS_MAX_ATTEMPTS}): "${rec.topic}"`);
      const clips = await processVideoForShorts(
        rec.id,
        rec.tenant_id,
        rec.storage_key,
        rec.playback_url,
        // `titre` sert de CONTEXTE au sélecteur sémantique : le modèle juge bien mieux
        // ce qui accroche quand il sait de quelle séance il s'agit.
        { source: 'zoom', presetSegments, durationSec, titre: rec.topic || '' },
      );
      // processVideoForShorts pose lui-même 'done' ou 'error' — la ligne ne peut
      // pas rester en 'processing' à l'issue d'un cycle normal.
      count += clips.length;
    }

    return count;
  } catch (err) {
    console.error(`[short-gen] Poll error: ${err.message}`);
    return 0;
  }
}

/**
 * Reprend les demandes bloquées en 'processing' depuis plus de SHORTS_STALE_MS :
 * elles sont remises dans la file si le quota de tentatives le permet, sinon
 * passées en 'error' avec le motif. Un travail interrompu ne disparaît donc ni
 * en silence ni pour toujours.
 */
async function reclaimStaleShortJobs() {
  const staleBefore = new Date(Date.now() - SHORTS_STALE_MS).toISOString();
  const { data: stale } = await supabase
    .from('zoom_recordings')
    .select('id, topic, shorts_attempts')
    .eq('shorts_status', 'processing')
    .lt('shorts_started_at', staleBefore)
    .limit(5);

  for (const row of stale || []) {
    const attempts = Number(row.shorts_attempts) || 0;
    const givenUp = attempts >= SHORTS_MAX_ATTEMPTS;
    await supabase
      .from('zoom_recordings')
      .update({
        shorts_status: givenUp ? 'error' : 'requested',
        shorts_error: givenUp
          ? `Interrompu ${attempts} fois (worker redémarré ?) — relancez la demande`
          : 'Traitement interrompu (worker redémarré) — remis en file',
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .eq('shorts_status', 'processing'); // ne pas écraser une reprise concurrente
    console.warn(
      `[short-gen] "${row.topic}" bloqué en cours depuis >2 h → ${givenUp ? 'abandon' : 'remis en file'}`,
    );
  }
}

// ─── Poller les REPLAYS LiveKit (live_recordings) pour générer des shorts ──
// Branche le pipeline shorts sur le replay qu'on a livré (egress LiveKit → R2),
// pas seulement Zoom. Idempotent via live_recordings.shorts_status.
export async function pollLiveReplayShorts() {
  try {
    const { data: recs, error } = await supabase
      .from('live_recordings')
      .select('id, storage_filepath, live_session_id')
      .eq('status', 'completed')
      .not('storage_filepath', 'is', null)
      .is('shorts_status', null)
      .limit(2);
    if (error) throw error;
    if (!recs || recs.length === 0) return 0;

    console.log(`[short-gen:live] ${recs.length} replay(s) à traiter`);
    let count = 0;
    for (const r of recs) {
      // live_recordings n'a PAS tenant_id → on le résout via la session.
      const { data: sess } = await supabase
        .from('live_sessions')
        .select('tenant_id, title')
        .eq('id', r.live_session_id)
        .maybeSingle();
      const tenantId = sess?.tenant_id;
      if (!tenantId) continue;
      // Marque 'processing' AVANT le traitement (évite la reprise en boucle).
      await supabase
        .from('live_recordings')
        .update({ shorts_status: 'processing' })
        .eq('id', r.id);
      const clips = await processVideoForShorts(
        r.id,
        tenantId,
        r.storage_filepath,
        null,
        { source: 'live', liveSessionId: r.live_session_id, titre: sess?.title || '' },
      );
      count += clips.length;
    }
    return count;
  } catch (err) {
    console.error(`[short-gen:live] Poll error: ${err.message}`);
    return 0;
  }
}
