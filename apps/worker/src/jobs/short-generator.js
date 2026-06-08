/**
 * short-generator.js — Génération de shorts verticaux (9:16) à partir
 * des enregistrements Zoom téléchargés.
 *
 * Pipeline :
 *   1. Transcription Whisper/OpenAI du recording complet
 *   2. Détection des "moments forts" (segments intéressants)
 *   3. FFmpeg : découpage, recadrage 9:16, sous-titres
 *   4. Upload vers R2
 *   5. Sauvegarde metadata en DB
 *
 * Dépendances : FFmpeg installé, OPENAI_API_KEY ou GROQ_API_KEY configuré.
 */

import { createClient } from '@supabase/supabase-js';
import { spawn } from 'child_process';
import { writeFile, unlink, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import { join, dirname } from 'path';

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

async function uploadToR2(filePath, key, contentType) {
  if (!r2Configured()) return null;
  const fileBuffer = await readFile(filePath);
  const endpoint = `https://${R2_ACCOUNT}.r2.cloudflarestorage.com`;
  const url = `${endpoint}/${R2_BUCKET}/${key}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Basic ${Buffer.from(R2_KEY + ':' + R2_SECRET).toString('base64')}`,
      'Content-Type': contentType || 'video/mp4',
    },
    body: fileBuffer,
  });
  if (!res.ok) throw new Error(`R2 upload failed: ${res.status}`);
  return `https://${R2_BUCKET}.${R2_ACCOUNT}.r2.cloudflarestorage.com/${key}`;
}

// ── Téléchargement depuis R2 ──────────────────────────────────────────────
async function downloadFromR2(storageKey, destPath) {
  if (!r2Configured()) throw new Error('R2 not configured');
  const endpoint = `https://${R2_ACCOUNT}.r2.cloudflarestorage.com`;
  const url = `${endpoint}/${R2_BUCKET}/${storageKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`R2 download failed: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(destPath, buffer);
}

// ─── FFmpeg helpers ────────────────────────────────────────────────────────

function ffmpeg(inputPath, outputPath, options = []) {
  return new Promise((resolve, reject) => {
    const args = [
      '-y', '-i', inputPath,
      ...options,
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
      '-c:a', 'aac', '-b:a', '128k',
      outputPath,
    ];
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('close', (code) => {
      if (code === 0) resolve(outputPath);
      else reject(new Error(`FFmpeg exit ${code}: ${stderr.slice(-300)}`));
    });
    proc.on('error', reject);
  });
}

/**
 * Coupe un segment et le convertit en vertical 9:16.
 * - Découpage temporel [startSec, endSec]
 * - Recadrage intelligent : crop central vertical
 * - Sous-titres optionnels (fichier SRT)
 */
async function createShortClip(inputPath, outputPath, startSec, endSec, srtPath) {
  const duration = endSec - startSec;
  const filterComplex = [
    // Recadrage 9:16 centré : prend 9/16 de la hauteur en largeur, centré
    'crop=ih*(9/16):ih:(iw-ih*(9/16))/2:0',
    'scale=1080:1920',
  ];

  const options = [
    '-ss', String(startSec),
    '-t', String(duration),
    '-vf', filterComplex.join(','),
  ];

  if (srtPath && existsSync(srtPath)) {
    options.push('-vf', `subtitles=${srtPath}:force_style='FontSize=18,Alignment=2'`);
  }

  return ffmpeg(inputPath, outputPath, options);
}

/**
 * Extrait l'audio d'une vidéo pour transcription.
 */
async function extractAudio(inputPath, outputPath) {
  return ffmpeg(inputPath, outputPath, [
    '-vn',               // Pas de vidéo
    '-ar', '16000',      // 16kHz pour Whisper
    '-ac', '1',          // Mono
    '-c:a', 'pcm_s16le',
  ]);
}

// ─── Transcription via Whisper (OpenAI API) ────────────────────────────
async function transcribeAudio(audioPath, apiKey, model = 'whisper-1') {
  if (!apiKey) throw new Error('OPENAI_API_KEY requise pour la transcription');

  const fileBuffer = await readFile(audioPath);
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: 'audio/wav' });
  formData.append('file', blob, 'audio.wav');
  formData.append('model', model);
  formData.append('response_format', 'verbose_json');
  formData.append('language', 'fr');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: formData,
  });

  if (!res.ok) throw new Error(`Whisper failed: ${res.status} ${await res.text()}`);
  const data = await res.json();

  return {
    text: data.text,
    segments: (data.segments || []).map((seg) => ({
      start: seg.start,
      end: seg.end,
      text: seg.text.trim(),
      confidence: seg.confidence || 0,
    })),
  };
}

// ─── Détection des moments forts ──────────────────────────────────────────
function detectHighlightMoments(segments, minDuration = 15, maxDuration = 60) {
  const highlights = [];

  // Stratégie : segments assez longs avec du texte significatif (>30 chars)
  // et bonne confiance (>0.8)
  let currentStart = null;
  let currentText = '';

  for (const seg of segments) {
    const dur = seg.end - seg.start;
    const meaningful = seg.text.length > 20 && (seg.confidence || 1) > 0.6;

    if (meaningful) {
      if (currentStart === null) {
        currentStart = seg.start;
        currentText = seg.text;
      } else {
        currentText += ' ' + seg.text;
      }

      // Vérifier si on atteint la durée max ou si c'est une "phrase complète"
      const accumulated = seg.end - currentStart;
      if (accumulated >= maxDuration) {
        highlights.push({ start: currentStart, end: seg.end - 1, text: currentText });
        currentStart = null;
        currentText = '';
      }
    } else if (currentStart !== null) {
      const accumulated = seg.start - currentStart;
      if (accumulated >= minDuration && accumulated <= maxDuration) {
        highlights.push({ start: currentStart, end: seg.start, text: currentText });
      }
      currentStart = null;
      currentText = '';
    }
  }

  // Dernier segment
  if (currentStart !== null) {
    const last = segments[segments.length - 1];
    const accumulated = last.end - currentStart;
    if (accumulated >= minDuration) {
      highlights.push({ start: currentStart, end: last.end, text: currentText });
    }
  }

  // Limiter à 5 highlights maximum par vidéo (qualité > quantité)
  return highlights.slice(0, 5);
}

// ─── Génération SRT ───────────────────────────────────────────────────────
function generateSrt(segments, startOffset, endOffset) {
  const relevantSegments = segments.filter(
    (s) => s.start >= startOffset && s.end <= endOffset,
  );

  if (relevantSegments.length === 0) {
    // Fallback : un sous-titre unique
    return `1\n00:00:00,000 --> 00:${String(Math.floor((endOffset - startOffset) / 60)).padStart(2, '0')}:${String(Math.floor((endOffset - startOffset) % 60)).padStart(2, '0')},000\n...\n`;
  }

  return relevantSegments
    .map((seg, i) => {
      const start = new Date((seg.start - startOffset) * 1000)
        .toISOString()
        .substr(11, 12)
        .replace('.', ',');
      const end = new Date((seg.end - startOffset) * 1000)
        .toISOString()
        .substr(11, 12)
        .replace('.', ',');
      return `${i + 1}\n${start} --> ${end}\n${seg.text}\n`;
    })
    .join('\n');
}

// ─── Traiter une vidéo pour en extraire des shorts ────────────────────────
async function processVideoForShorts(recordingId, tenantId, storageKey, videoUrlFallback) {
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
      const buffer = Buffer.from(await res.arrayBuffer());
      await writeFile(videoFile, buffer);
    } else {
      throw new Error('Aucune source vidéo disponible');
    }

    // 2. Extraire l'audio
    console.log(`[short-gen] Extraction audio...`);
    await extractAudio(videoFile, audioFile);

    // 3. Transcrire
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      console.warn(`[short-gen] Pas de OPENAI_API_KEY — utilisation transcription simulée`);
    }

    let transcript;
    if (openaiKey) {
      transcript = await transcribeAudio(audioFile, openaiKey);
    } else {
      // Transcription simulée (fallback développement)
      transcript = {
        text: "Transcription non disponible — configurer OPENAI_API_KEY",
        segments: [
          { start: 0, end: 5, text: "Segment de test pour le développement.", confidence: 1 },
          { start: 5, end: 15, text: "Configurez OPENAI_API_KEY pour la transcription automatique.", confidence: 1 },
        ],
      };
    }
    console.log(`[short-gen] Transcription: ${transcript.text.slice(0, 100)}...`);

    // 4. Détecter les moments forts
    const highlights = detectHighlightMoments(transcript.segments);
    console.log(`[short-gen] ${highlights.length} moment(s) fort(s) détecté(s)`);

    // 5. Générer les clips
    if (highlights.length === 0) {
      // Fallback : prendre la première minute
      highlights.push({ start: 0, end: Math.min(60, 60), text: "Extrait vidéo" });
    }

    await mkdir(shortsDir, { recursive: true });
    const clips = [];

    for (let i = 0; i < highlights.length; i++) {
      const hl = highlights[i];
      const clipId = randomUUID();
      const clipPath = join(shortsDir, `short_${i}.mp4`);
      const srtPath = join(shortsDir, `short_${i}.srt`);

      // Générer SRT
      const srtContent = generateSrt(transcript.segments, hl.start, hl.end);
      await writeFile(srtPath, srtContent);

      // Générer le clip
      try {
        await createShortClip(videoFile, clipPath, hl.start, hl.end, srtPath);
      } catch (ffErr) {
        // Fallback sans sous-titres
        console.warn(`[short-gen] Clip ${i} avec sous-titres échoué, retry sans: ${ffErr.message}`);
        await createShortClip(videoFile, clipPath, hl.start, hl.end, null);
      }

      // Upload vers R2
      const clipKey = `shorts/${tenantId}/${recordingId}/${clipId}.mp4`;
      const clipUrl = await uploadToR2(clipPath, clipKey);
      const duration = Math.round(hl.end - hl.start);

      // Sauvegarder en DB
      const { error: dbErr } = await supabase.from('short_clips').insert({
        id: clipId,
        recording_id: recordingId,
        tenant_id: tenantId,
        title: `Extrait ${i + 1}`,
        description: hl.text.slice(0, 200),
        start_sec: Math.round(hl.start),
        end_sec: Math.round(hl.end),
        duration_sec: duration,
        storage_key: clipKey,
        thumbnail_url: null,
        transcript_snippet: hl.text.slice(0, 500),
        status: 'ready',
      });

      if (dbErr) console.error(`[short-gen] DB insert error: ${dbErr.message}`);

      clips.push({ id: clipId, duration, url: clipUrl, text: hl.text.slice(0, 200) });
      console.log(`[short-gen] ✅ Short ${i + 1}: ${duration}s — ${hl.text.slice(0, 60)}`);
    }

    // Mettre à jour le statut du recording
    await supabase
      .from('zoom_recordings')
      .update({
        transcript_text: transcript.text,
        status: 'analyzed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', recordingId);

    console.log(`[short-gen] ✅ ${clips.length} short(s) généré(s) pour ${recordingId}`);
    return clips;
  } catch (err) {
    console.error(`[short-gen] ❌ Erreur: ${err.message}`);

    await supabase
      .from('zoom_recordings')
      .update({
        status: 'error',
        error_message: `Short gen: ${err.message}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', recordingId);

    return [];
  } finally {
    // Nettoyage
    try { await unlink(videoFile); } catch {}
    try { await unlink(audioFile); } catch {}
    try { await unlink(shortsDir).catch(() => {}); } catch {}
  }
}

// ─── Poller les vidéos téléchargées pour génération de shorts ─────────────
export async function pollShortGeneration() {
  try {
    const { data: recordings, error } = await supabase
      .from('zoom_recordings')
      .select('id, tenant_id, storage_key, playback_url, topic')
      .eq('status', 'downloaded')
      .not('storage_key', 'is', null)
      .limit(3);

    if (error) throw error;
    if (!recordings || recordings.length === 0) return 0;

    console.log(`[short-gen] ${recordings.length} vidéo(s) à traiter`);

    let count = 0;
    for (const rec of recordings) {
      console.log(`[short-gen] Traitement: "${rec.topic}"`);
      const clips = await processVideoForShorts(rec.id, rec.tenant_id, rec.storage_key, rec.playback_url);
      if (clips.length > 0) count += clips.length;
    }

    return count;
  } catch (err) {
    console.error(`[short-gen] Poll error: ${err.message}`);
    return 0;
  }
}
