/**
 * zoom-transfer.js — Transfert des enregistrements Zoom → R2 (datacenter), côté worker.
 *
 * Poll `zoom_recordings` status='pending' : pour chaque, jeton S2S Zoom, téléchargement
 * REPRENABLE (Range), re-mux **faststart** (moov en tête → lecture instantanée), cues VTT,
 * upload R2 multipart, puis publie dans `published_videos` (+ transcript_cues).
 * Idempotent, 1 à la fois (n'impacte pas les notifs live). Bande passante datacenter.
 *
 * Env requis (worker) : ZOOM_ACCOUNT_ID/CLIENT_ID/CLIENT_SECRET, CF_R2_*, SUPABASE_*.
 */
import { createClient } from '@supabase/supabase-js';
import { S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand } from '@aws-sdk/client-s3';
import { spawn } from 'child_process';
import { createWriteStream, statSync, promises as fsp } from 'fs';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { tmpdir } from 'os';
import { join } from 'path';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

const R2 = { acct: process.env.CF_R2_ACCOUNT_ID, key: process.env.CF_R2_ACCESS_KEY_ID, secret: process.env.CF_R2_SECRET_ACCESS_KEY, bucket: process.env.CF_R2_BUCKET };
const r2ok = () => Boolean(R2.acct && R2.key && R2.secret && R2.bucket);
const r2 = () => new S3Client({ region: 'auto', endpoint: `https://${R2.acct}.r2.cloudflarestorage.com`, credentials: { accessKeyId: R2.key, secretAccessKey: R2.secret }, forcePathStyle: true });
const zoomEnv = { account: process.env.ZOOM_ACCOUNT_ID, id: process.env.ZOOM_CLIENT_ID, secret: process.env.ZOOM_CLIENT_SECRET };
const zoomOk = () => Boolean(zoomEnv.account && zoomEnv.id && zoomEnv.secret);

let _tok = null, _at = 0;
async function zoomToken() {
  if (_tok && Date.now() - _at < 50 * 60 * 1000) return _tok;
  const basic = Buffer.from(`${zoomEnv.id}:${zoomEnv.secret}`).toString('base64');
  const r = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${zoomEnv.account}`, { method: 'POST', headers: { Authorization: `Basic ${basic}` } });
  const d = await r.json();
  if (!d.access_token) throw new Error('zoom token: ' + JSON.stringify(d).slice(0, 120));
  _tok = d.access_token; _at = Date.now(); return _tok;
}

// Téléchargement reprenable (Range) — survit aux coupures Zoom sur les gros fichiers.
async function downloadResumable(url, dest) {
  let offset = 0;
  for (let attempt = 0; attempt < 8; attempt++) {
    const tok = await zoomToken();
    const u = url + (url.includes('?') ? '&' : '?') + 'access_token=' + tok;
    const headers = offset > 0 ? { Range: `bytes=${offset}-` } : {};
    try {
      const res = await fetch(u, { headers });
      if (![200, 206].includes(res.status)) throw new Error('http ' + res.status);
      const append = offset > 0 && res.status === 206;
      if (offset > 0 && res.status === 200) offset = 0; // serveur ignore Range → repart de 0
      await pipeline(Readable.fromWeb(res.body), createWriteStream(dest, { flags: append ? 'a' : 'w' }));
      return statSync(dest).size;
    } catch (e) {
      try { offset = statSync(dest).size; } catch { offset = 0; }
      if (attempt === 7) throw e;
      await sleep(2500 * (attempt + 1));
    }
  }
  throw new Error('download failed');
}

function faststart(input, output) {
  return new Promise((resolve) => {
    const p = spawn('ffmpeg', ['-y', '-i', input, '-map', '0', '-c', 'copy', '-movflags', '+faststart', output], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = ''; p.stderr.on('data', (d) => (err += d.toString()));
    p.on('close', (c) => resolve(c === 0)); // fallback : si échec, on uploadera l'original
    p.on('error', () => resolve(false));
  });
}

const hms = (s) => { const p = s.split(':').map(Number); return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : p[0]; };
async function fetchCues(vttUrl) {
  if (!vttUrl) return { text: null, cues: null };
  const res = await fetch(vttUrl + (vttUrl.includes('?') ? '&' : '?') + 'access_token=' + await zoomToken());
  if (!res.ok) return { text: null, cues: null };
  const raw = await res.text();
  const parsed = [];
  for (const b of raw.replace(/\r/g, '').split(/\n\n+/)) {
    const lines = b.split('\n').map((s) => s.trim()).filter(Boolean);
    const tl = lines.find((l) => l.includes('-->')); if (!tl) continue;
    const t = Math.round(hms(tl.split('-->')[0].trim()) * 100) / 100;
    const text = lines.filter((l) => !l.includes('-->') && !/^\d+$/.test(l) && l !== 'WEBVTT' && !l.startsWith('NOTE')).map((l) => l.replace(/^[^:]{2,40}:\s+/, '')).join(' ').trim();
    if (text) parsed.push({ t, text });
  }
  const cues = []; let cur = null;
  for (const c of parsed) {
    if (!cur) { cur = { t: c.t, text: c.text }; continue; }
    if (cur.text === c.text) continue;
    cur.text = `${cur.text} ${c.text}`.trim();
    if (/[.!?…»]$/.test(c.text) || cur.text.length > 200) { cues.push(cur); cur = null; }
  }
  if (cur) cues.push(cur);
  return { text: parsed.map((c) => c.text).join('\n') || null, cues: cues.length ? cues : null };
}

const PART = 8 * 1024 * 1024;
async function r2Upload(path, key, contentType) {
  const size = statSync(path).size;
  const c = r2();
  const { UploadId } = await c.send(new CreateMultipartUploadCommand({ Bucket: R2.bucket, Key: key, ContentType: contentType }));
  const fh = await fsp.open(path, 'r'); const buf = Buffer.allocUnsafe(PART); const parts = [];
  try {
    let pn = 1, off = 0;
    while (off < size) {
      const { bytesRead } = await fh.read(buf, 0, Math.min(PART, size - off), off);
      const body = Buffer.from(buf.subarray(0, bytesRead));
      let a = 0;
      for (;;) { try { const { ETag } = await c.send(new UploadPartCommand({ Bucket: R2.bucket, Key: key, UploadId, PartNumber: pn, Body: body, ContentLength: bytesRead })); parts.push({ ETag, PartNumber: pn }); break; } catch (e) { if (++a >= 5) throw e; await sleep(1500 * a); } }
      pn++; off += bytesRead;
    }
    await c.send(new CompleteMultipartUploadCommand({ Bucket: R2.bucket, Key: key, UploadId, MultipartUpload: { Parts: parts } }));
  } catch (e) { try { await c.send(new AbortMultipartUploadCommand({ Bucket: R2.bucket, Key: key, UploadId })); } catch {} throw e; }
  finally { await fh.close(); }
  return key;
}

async function processOne(rec) {
  const day = (rec.start_time || '').slice(0, 10).replace(/-/g, '');
  const key = `zoom-replays/isna/${rec.zoom_meeting_number}-${day}.mp4`;
  const raw = join(tmpdir(), `zt_${rec.id}.mp4`);
  const fs = join(tmpdir(), `zt_${rec.id}_fs.mp4`);
  const vttUrl = rec.metadata?.vttUrl || null;
  console.log(`[zoom-transfer] ⏬ ${rec.topic} (${((rec.total_size || 0) / 1e9).toFixed(2)}GB)`);
  try {
    await supabase.from('zoom_recordings').update({ status: 'downloading', updated_at: new Date().toISOString() }).eq('id', rec.id);
    const t0 = Date.now();
    await downloadResumable(rec.download_url, raw);
    const ok = await faststart(raw, fs);
    const up = ok ? fs : raw;
    const { text, cues } = await fetchCues(vttUrl);
    console.log(`[zoom-transfer]    dl+mux ${((Date.now() - t0) / 1000).toFixed(0)}s · faststart:${ok} · cues:${cues ? cues.length : 0}`);
    const t1 = Date.now();
    await r2Upload(up, key, 'video/mp4');
    console.log(`[zoom-transfer]    ⏫ R2 ${((Date.now() - t1) / 1000).toFixed(0)}s → ${key}`);

    await supabase.from('zoom_recordings').update({ status: 'downloaded', storage_key: key, transcript_text: text, transcript_cues: cues, is_published: true, published_at: new Date().toISOString(), updated_at: new Date().toISOString(), error_message: null }).eq('id', rec.id);
    const title = rec.topic?.replace(/^R[ée]union Zoom de\s*/i, '').trim();
    await supabase.from('published_videos').delete().eq('tenant_id', rec.tenant_id).eq('storage_key', key);
    await supabase.from('published_videos').insert({ recording_id: rec.id, tenant_id: rec.tenant_id, title: rec.metadata?.title || title, description: rec.metadata?.description || null, playback_url: key, thumbnail_url: rec.thumbnail_url || null, duration_sec: (rec.duration_min || 0) * 60, category: title, transcript_text: text, transcript_cues: cues, storage_key: key, source: 'zoom', locale: 'fr', is_public: true, published_at: new Date().toISOString() });
    console.log(`[zoom-transfer] ✅ ${title}`);
    return true;
  } catch (e) {
    await supabase.from('zoom_recordings').update({ status: 'pending', error_message: String(e.message).slice(0, 300), updated_at: new Date().toISOString() }).eq('id', rec.id);
    console.error(`[zoom-transfer] ❌ ${rec.topic}: ${String(e.message).slice(0, 200)}`);
    return false;
  } finally {
    try { await fsp.unlink(raw); } catch {} try { await fsp.unlink(fs); } catch {}
  }
}

export async function pollZoomTransfer() {
  if (!r2ok() || !zoomOk()) return 0;
  const { data: pending } = await supabase.from('zoom_recordings').select('*').eq('status', 'pending').not('download_url', 'is', null).order('total_size', { ascending: true }).limit(1);
  if (!pending || !pending.length) return 0;
  const ok = await processOne(pending[0]);
  return ok ? 1 : 0;
}
