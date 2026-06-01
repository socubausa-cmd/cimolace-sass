/**
 * zoom-sync.js — Synchronisation des enregistrements Zoom Cloud.
 *
 * Pattern : poll toutes les 5 minutes la table zoom_sync_queue pour des jobs,
 * appelle l'API Zoom via le service NestJS, puis télécharge les vidéos
 * et les stocke dans Supabase Storage / R2.
 *
 * Dépendances : FFmpeg installé, variables ZOOM_* configurées.
 */

import { createClient } from '@supabase/supabase-js';
import { spawn } from 'child_process';
import { writeFile, unlink, readFile, mkdir } from 'fs/promises';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import { join } from 'path';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const ZOOM_API_BASE = 'https://api.zoom.us/v2';

// ── Cloudflare R2 Configuration ─────────────────────────────────────────────
const R2_ACCOUNT = process.env.CF_R2_ACCOUNT_ID;
const R2_KEY = process.env.CF_R2_ACCESS_KEY_ID;
const R2_SECRET = process.env.CF_R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.CF_R2_BUCKET || 'cimolace-media';

function r2Configured() {
  return Boolean(R2_ACCOUNT && R2_KEY && R2_SECRET && R2_BUCKET);
}

async function uploadToR2(filePath, key, contentType = 'video/mp4') {
  if (!r2Configured()) return null;
  const fileBuffer = await readFile(filePath);
  const endpoint = `https://${R2_ACCOUNT}.r2.cloudflarestorage.com`;
  const url = `${endpoint}/${R2_BUCKET}/${key}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Basic ${Buffer.from(R2_KEY + ':' + R2_SECRET).toString('base64')}`,
      'Content-Type': contentType,
    },
    body: fileBuffer,
  });
  if (!res.ok) throw new Error(`R2 upload failed: ${res.status}`);
  return `https://${R2_BUCKET}.${R2_ACCOUNT}.r2.cloudflarestorage.com/${key}`;
}

// ── Obtenir un token Zoom valide (via l'API NestJS) ─────────────────────────
async function getZoomToken(tenantId) {
  const { data: tokens, error } = await supabase
    .from('zoom_oauth_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error || !tokens) {
    console.error(`[zoom-sync] Aucun token Zoom pour tenant ${tenantId}`);
    return null;
  }

  // Note: les tokens sont chiffrés par le service NestJS.
  // Le worker utilise le endpoint NestJS comme proxy.
  // Pour le worker autonome, on délègue le refresh à l'API.
  // On appelle directement l'API NestJS.
  try {
    const baseUrl = process.env.API_INTERNAL_URL || 'http://localhost:4002';
    const res = await fetch(`${baseUrl}/zoom-engine/auth/token-proxy/${tenantId}`, {
      headers: { 'Authorization': `Bearer ${process.env.API_SERVICE_KEY || ''}` },
    });
    if (!res.ok) throw new Error(`Token proxy: ${res.status}`);
    const data = await res.json();
    return data.access_token;
  } catch (err) {
    console.error(`[zoom-sync] Erreur récupération token: ${err.message}`);
    return null;
  }
}

// ─── Téléchargement d'un fichier depuis Zoom ────────────────────────────────
async function downloadFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Téléchargement échoué: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(destPath, buffer);
  return destPath;
}

// ─── FFmpeg : extraire une miniature ────────────────────────────────────────
async function extractThumbnail(videoPath, outputPath) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', [
      '-y', '-i', videoPath,
      '-ss', '00:00:05',
      '-vframes', '1',
      '-vf', 'scale=640:360',
      outputPath,
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', d => stderr += d.toString());
    proc.on('close', code => {
      if (code === 0) resolve(outputPath);
      else reject(new Error(`FFmpeg thumbnail exit ${code}: ${stderr.slice(-200)}`));
    });
    proc.on('error', reject);
  });
}

// ─── Traiter un enregistrement : télécharger + stocker ──────────────────────
async function processRecording(recordingId, tenantId, downloadUrl, topic) {
  const jobId = recordingId;
  const tmpDir = tmpdir();
  const videoFile = join(tmpDir, `zoom_${jobId}.mp4`);
  const thumbFile = join(tmpDir, `zoom_${jobId}_thumb.jpg`);

  try {
    console.log(`[zoom-sync] Téléchargement: "${topic}" (${recordingId})`);

    // 1. Télécharger la vidéo
    await downloadFile(downloadUrl, videoFile);

    // 2. Upload vers R2
    const r2Key = `zoom-recordings/${tenantId}/${recordingId}.mp4`;
    const playbackUrl = await uploadToR2(videoFile, r2Key);
    if (!playbackUrl) {
      throw new Error('R2 non configuré');
    }
    console.log(`[zoom-sync] Upload R2 OK: ${r2Key}`);

    // 3. Générer thumbnail
    let thumbnailUrl = null;
    try {
      await extractThumbnail(videoFile, thumbFile);
      const thumbKey = `zoom-recordings/${tenantId}/${recordingId}_thumb.jpg`;
      thumbnailUrl = await uploadToR2(thumbFile, thumbKey, 'image/jpeg');
    } catch (thumbErr) {
      console.warn(`[zoom-sync] Thumbnail ignoré: ${thumbErr.message}`);
    }

    // 4. Mettre à jour le statut en base
    await supabase
      .from('zoom_recordings')
      .update({
        status: 'downloaded',
        storage_key: r2Key,
        playback_url: playbackUrl,
        thumbnail_url: thumbnailUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', recordingId);

    console.log(`[zoom-sync] ✅ Traitement terminé: ${topic}`);
    return true;
  } catch (err) {
    console.error(`[zoom-sync] ❌ Erreur: ${err.message}`);

    await supabase
      .from('zoom_recordings')
      .update({
        status: 'error',
        error_message: err.message,
        updated_at: new Date().toISOString(),
      })
      .eq('id', recordingId);

    return false;
  } finally {
    // Nettoyage fichiers temporaires
    try { await unlink(videoFile); } catch {}
    try { await unlink(thumbFile); } catch {}
  }
}

// ─── Poller les enregistrements en attente de téléchargement ────────────────
export async function pollZoomSync() {
  try {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const { data: pending, error } = await supabase
      .from('zoom_recordings')
      .select('id, tenant_id, download_url, topic')
      .eq('status', 'pending')
      .gte('created_at', thirtyMinutesAgo)
      .not('download_url', 'is', null)
      .limit(5);

    if (error) throw error;
    if (!pending || pending.length === 0) return 0;

    console.log(`[zoom-sync] ${pending.length} enregistrement(s) à traiter`);

    let count = 0;
    for (const rec of pending) {
      const ok = await processRecording(rec.id, rec.tenant_id, rec.download_url, rec.topic);
      if (ok) count++;
    }

    return count;
  } catch (err) {
    console.error(`[zoom-sync] Poll error: ${err.message}`);
    return 0;
  }
}
