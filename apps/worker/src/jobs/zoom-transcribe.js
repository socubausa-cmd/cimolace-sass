/**
 * zoom-transcribe — transcrit les replays importés SANS transcript (ex. imports LOCAUX
 * record-to-computer, sans VTT). Tourne sur le worker Railway (réseau US → Groq NON
 * géo-bloqué, contrairement à la machine du fondateur en Chine).
 *
 * Par cycle (1 vidéo) : published_videos avec storage_key R2 + transcript_text null →
 * download R2 → ffmpeg audio opus mono 24k SEGMENTÉ 20 min (chaque tranche < 25 Mo pour
 * Whisper) → Groq whisper-large-v3 (verbose_json, offset par tranche) → cues {t,text}
 * fusionnées → update published_videos.transcript_text/transcript_cues + zoom_recordings.
 * Non-bloquant : tout échec est loggé sans planter la boucle.
 *
 * Env : SUPABASE_*, CF_R2_*, GROQ_API_KEY (ou OPENAI_API_KEY).
 */
import { createClient } from '@supabase/supabase-js';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { spawn } from 'child_process';
import { createWriteStream, promises as fsp, readdirSync, unlinkSync } from 'fs';
import { pipeline } from 'stream/promises';
import { tmpdir } from 'os';
import { join } from 'path';

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const R2 = { acct: process.env.CF_R2_ACCOUNT_ID, key: process.env.CF_R2_ACCESS_KEY_ID, secret: process.env.CF_R2_SECRET_ACCESS_KEY, bucket: process.env.CF_R2_BUCKET };
const r2 = () => new S3Client({ region: 'auto', endpoint: `https://${R2.acct}.r2.cloudflarestorage.com`, credentials: { accessKeyId: R2.key, secretAccessKey: R2.secret }, forcePathStyle: true });
const SEG = 1200; // 20 min
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (m) => console.log(`[zoom-transcribe] ${m}`);

// mp4 R2 → audio opus mono 24k, segmenté 20 min ; renvoie les fichiers ordonnés
function segmentAudio(mp4, prefix) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', ['-y', '-i', mp4, '-vn', '-ac', '1', '-c:a', 'libopus', '-b:a', '24k', '-f', 'segment', '-segment_time', String(SEG), `${prefix}_%03d.ogg`], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = ''; p.stderr.on('data', (d) => (err += d));
    p.on('close', (c) => (c === 0 ? resolve() : reject(new Error(`ffmpeg ${c}: ${err.slice(-160)}`))));
    p.on('error', reject);
  });
}

async function whisperChunk(file) {
  const providers = [];
  if (process.env.GROQ_API_KEY) providers.push({ name: 'Groq', url: 'https://api.groq.com/openai/v1/audio/transcriptions', key: process.env.GROQ_API_KEY, model: 'whisper-large-v3' });
  if (process.env.OPENAI_API_KEY) providers.push({ name: 'OpenAI', url: 'https://api.openai.com/v1/audio/transcriptions', key: process.env.OPENAI_API_KEY, model: 'whisper-1' });
  const buf = await fsp.readFile(file);
  let lastErr = 'aucun fournisseur';
  let throttled = false;
  for (const p of providers) {
    for (let a = 0; a < 3; a++) {
      try {
        const form = new FormData();
        form.append('file', new Blob([buf], { type: 'audio/ogg' }), 'a.ogg');
        form.append('model', p.model); form.append('language', 'fr'); form.append('response_format', 'verbose_json');
        const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 180_000);
        let res;
        try { res = await fetch(p.url, { method: 'POST', headers: { Authorization: `Bearer ${p.key}` }, body: form, signal: ctl.signal }); }
        finally { clearTimeout(to); }
        // 5xx transitoire → réessayer (backoff court, plafonné 12s) ; 429 = quota → fail-fast
        if (res.status >= 500) { lastErr = `${p.name} ${res.status}`; await sleep(Math.min(3000 * (a + 1), 12_000)); continue; }
        if (res.status === 429) { lastErr = `${p.name} 429`; throttled = true; break; } // quota épuisé → passer/laisser en attente
        if (!res.ok) { lastErr = `${p.name} ${res.status} ${(await res.text()).slice(0, 100)}`; break; } // 4xx → abandonner ce fournisseur
        const d = await res.json();
        return (d.segments || []).map((s) => ({ start: Number(s.start) || 0, text: String(s.text || '').trim() })).filter((s) => s.text);
      } catch (e) { lastErr = `${p.name}: ${e.message}`; await sleep(Math.min(3000 * (a + 1), 12_000)); } // réseau/timeout → réessayer
    }
    console.log(`[zoom-transcribe] fournisseur ${p.name} indisponible → ${lastErr}`);
  }
  const err = new Error(lastErr); if (throttled) err.throttled = true; throw err;
}

// segments timés → cues {t,text} fusionnées (paragraphes, comme les 55 existantes)
function toCues(segments) {
  const cues = []; let cur = null;
  for (const s of segments) {
    const t = Math.round(s.start * 100) / 100; const text = (s.text || '').trim(); if (!text) continue;
    if (!cur) { cur = { t, text }; continue; }
    cur.text = `${cur.text} ${text}`.trim();
    if (/[.!?…»]$/.test(text) || cur.text.length > 200) { cues.push(cur); cur = null; }
  }
  if (cur) cues.push(cur);
  return cues;
}

export async function pollZoomTranscribe() {
  if (!R2.acct || !process.env.SUPABASE_URL) return 0;
  if (!process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY) return 0;
  // 1 vidéo par cycle : R2 présent, transcript absent (imports locaux sans VTT)
  const { data: rows } = await supabase
    .from('published_videos')
    .select('id, title, storage_key, tenant_id')
    .not('storage_key', 'is', null)
    .is('transcript_text', null)
    .like('storage_key', '%local-%')
    .limit(6);
  // rotation : une vidéo AU HASARD parmi les restantes (évite de rester coincé sur la
  // même si elle est throttlée, laisse les autres passer quand le quota se libère).
  const pending = rows || [];
  if (!pending.length) return 0;
  const v = pending[Math.floor(Math.random() * pending.length)];

  const base = join(tmpdir(), `zt_${v.id}`);
  const mp4 = `${base}.mp4`, prefix = `${base}_a`;
  log(`🎙️ ${v.title}`);
  try {
    // download R2 → mp4
    const obj = await r2().send(new GetObjectCommand({ Bucket: R2.bucket, Key: v.storage_key }));
    await pipeline(obj.Body, createWriteStream(mp4));
    await segmentAudio(mp4, prefix);
    const chunks = readdirSync(tmpdir()).filter((f) => f.startsWith(`zt_${v.id}_a_`) && f.endsWith('.ogg')).sort();
    let allText = ''; const allCues = [];
    for (let c = 0; c < chunks.length; c++) {
      const cf = join(tmpdir(), chunks[c]);
      const segs = (await whisperChunk(cf)).map((s) => ({ ...s, start: s.start + c * SEG }));
      allText += (allText ? '\n' : '') + segs.map((s) => s.text).join(' ');
      allCues.push(...toCues(segs));
      try { unlinkSync(cf); } catch {}
    }
    const upd = { transcript_text: allText || null, transcript_cues: allCues.length ? allCues : null };
    await supabase.from('published_videos').update(upd).eq('id', v.id);
    await supabase.from('zoom_recordings').update(upd).eq('tenant_id', v.tenant_id).eq('storage_key', v.storage_key);
    log(`✅ ${v.title} — ${allCues.length} cues`);
    return 1;
  } catch (e) {
    log(`❌ ${v.title}: ${String(e.message).slice(0, 200)}${e.throttled ? ' (quota — retenté plus tard)' : ''}`);
    // Throttle (429) = quota temporaire → LAISSER en attente (null) pour re-tenter quand
    // le quota se libère. Autre erreur (4xx/ffmpeg/corrompu) = sentinelle '' pour ne pas
    // boucler indéfiniment sur une vidéo cassée.
    if (!e.throttled) await supabase.from('published_videos').update({ transcript_text: '' }).eq('id', v.id);
    return 0;
  } finally {
    try { unlinkSync(mp4); } catch {}
    readdirSync(tmpdir()).filter((f) => f.startsWith(`zt_${v.id}`)).forEach((f) => { try { unlinkSync(join(tmpdir(), f)); } catch {} });
  }
}
