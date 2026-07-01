/**
 * replay-postprod — Post-production automatique d'un replay de live.
 *
 * Déclenché par la RPC request_replay_postprod (front → live_neuro_recall_state
 * .workflow_status='processing'). Pour chaque replay en attente :
 *   1. télécharge le MP4 (R2) ;
 *   2. extrait l'audio (ffmpeg, WAV 16 kHz mono — accepté par Whisper) ;
 *   3. transcrit (Whisper Groq/OpenAI, segments timés) ;
 *   4. génère des chapitres horodatés (LLM Groq) depuis le transcript ;
 *   5. écrit live_neuro_recall_state.chapters + transcript_text + status='published'.
 * Le player (fromReplay) lit alors chapitres + transcript RÉELS.
 *
 * Secrets requis (Railway isna-worker) : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * CF_R2_* , et GROQ_API_KEY (ou OPENAI_API_KEY). Non-bloquant : tout échec passe
 * le status à 'error' sans planter la boucle.
 */
import { createClient } from '@supabase/supabase-js';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { spawn } from 'child_process';
import { writeFile, readFile, unlink } from 'fs/promises';
import os from 'os';
import path from 'path';

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

const R2_ACCOUNT = process.env.CF_R2_ACCOUNT_ID;
const R2_KEY = process.env.CF_R2_ACCESS_KEY_ID;
const R2_SECRET = process.env.CF_R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.CF_R2_BUCKET;

const fmt = (s) => {
  const n = Math.max(0, Math.floor(Number(s) || 0));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
};

function r2Client() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_KEY, secretAccessKey: R2_SECRET },
    forcePathStyle: true,
  });
}

async function downloadFromR2(key, dest) {
  const res = await r2Client().send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  const bytes = await res.Body.transformToByteArray();
  await writeFile(dest, Buffer.from(bytes));
}

function extractAudio(input, output) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', ['-y', '-i', input, '-vn', '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', output], { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d.toString()));
    p.on('close', (c) => (c === 0 ? resolve(output) : reject(new Error(`ffmpeg ${c}: ${err.slice(-200)}`))));
    p.on('error', reject);
  });
}

async function transcribeAudio(audioPath) {
  const fileBuffer = await readFile(audioPath);
  const providers = [];
  if (process.env.OPENAI_API_KEY)
    providers.push({ name: 'OpenAI', url: 'https://api.openai.com/v1/audio/transcriptions', key: process.env.OPENAI_API_KEY, model: 'whisper-1' });
  if (process.env.GROQ_API_KEY)
    providers.push({ name: 'Groq', url: 'https://api.groq.com/openai/v1/audio/transcriptions', key: process.env.GROQ_API_KEY, model: 'whisper-large-v3' });
  let lastErr = 'aucun fournisseur de transcription configuré';
  for (const p of providers) {
    try {
      const form = new FormData();
      form.append('file', new Blob([fileBuffer], { type: 'audio/wav' }), 'audio.wav');
      form.append('model', p.model);
      form.append('language', 'fr');
      form.append('response_format', 'verbose_json');
      const res = await fetch(p.url, { method: 'POST', headers: { Authorization: `Bearer ${p.key}` }, body: form });
      if (!res.ok) { lastErr = `${p.name} ${res.status}`; continue; }
      const data = await res.json();
      return {
        text: data.text || '',
        segments: (data.segments || []).map((s) => ({ start: Number(s.start) || 0, text: String(s.text || '').trim() })).filter((s) => s.text),
      };
    } catch (e) { lastErr = `${p.name}: ${e.message}`; }
  }
  throw new Error(`Transcription: ${lastErr}`);
}

/** Providers chat compatibles OpenAI, essayés dans l'ordre de disponibilité (worker : OpenAI/Mistral/DeepSeek présents ; Groq optionnel). */
function chatProviders() {
  const p = [];
  if (process.env.OPENAI_API_KEY) p.push({ url: 'https://api.openai.com/v1/chat/completions', key: process.env.OPENAI_API_KEY, model: 'gpt-4o-mini' });
  if (process.env.MISTRAL_API_KEY) p.push({ url: 'https://api.mistral.ai/v1/chat/completions', key: process.env.MISTRAL_API_KEY, model: 'mistral-small-latest' });
  if (process.env.GROQ_API_KEY) p.push({ url: 'https://api.groq.com/openai/v1/chat/completions', key: process.env.GROQ_API_KEY, model: 'llama-3.3-70b-versatile' });
  if (process.env.DEEPSEEK_API_KEY) p.push({ url: 'https://api.deepseek.com/v1/chat/completions', key: process.env.DEEPSEEK_API_KEY, model: 'deepseek-chat' });
  return p;
}

/** Chapitres horodatés depuis le transcript, via LLM (OpenAI/Mistral/Groq/DeepSeek) ; fallback découpage régulier. */
async function chaptersFromTranscript(segments) {
  const compact = segments.slice(0, 400).map((s) => `[${Math.round(s.start)}] ${s.text}`).join('\n').slice(0, 12000);
  if (compact) {
    for (const p of chatProviders()) {
      try {
        const res = await fetch(p.url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${p.key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: p.model,
            temperature: 0.2,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: 'Tu découpes une transcription horodatée (chaque ligne = [secondes] texte) en chapitres pédagogiques. Réponds UNIQUEMENT en JSON {"chapters":[{"label":"titre court","timeSeconds":number}]}, 3 à 10 chapitres, timeSeconds croissants, chaque timeSeconds pris dans la transcription.' },
              { role: 'user', content: compact },
            ],
          }),
        });
        if (!res.ok) continue;
        const j = await res.json();
        const parsed = JSON.parse(j?.choices?.[0]?.message?.content || '{}');
        const ch = Array.isArray(parsed?.chapters) ? parsed.chapters : [];
        const clean = ch.map((c) => ({ label: String(c.label || '').trim(), timeSeconds: Number(c.timeSeconds) || 0 })).filter((c) => c.label).sort((a, b) => a.timeSeconds - b.timeSeconds);
        if (clean.length) return clean;
      } catch { /* provider suivant */ }
    }
  }
  // Fallback : un chapitre toutes les ~3 min, titre = début du segment.
  const out = [];
  let next = 0;
  for (const s of segments) {
    if (s.start >= next) { out.push({ label: s.text.slice(0, 60), timeSeconds: Math.round(s.start) }); next = s.start + 180; }
  }
  return out.slice(0, 12);
}

export async function pollReplayPostprod() {
  const { data: rows, error } = await supabase
    .from('live_neuro_recall_state')
    .select('live_session_id')
    .eq('workflow_status', 'processing')
    .limit(2);
  if (error || !rows?.length) return 0;

  for (const row of rows) {
    const sid = row.live_session_id;
    const { data: rec } = await supabase
      .from('live_recordings')
      .select('storage_filepath')
      .eq('live_session_id', sid)
      .eq('status', 'completed')
      .not('storage_filepath', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!rec?.storage_filepath) {
      await supabase.from('live_neuro_recall_state').update({ workflow_status: 'error' }).eq('live_session_id', sid);
      continue;
    }

    const tmpV = path.join(os.tmpdir(), `replay-${sid}.mp4`);
    const tmpA = path.join(os.tmpdir(), `replay-${sid}.wav`);
    try {
      await downloadFromR2(rec.storage_filepath, tmpV);
      await extractAudio(tmpV, tmpA);
      const { text, segments } = await transcribeAudio(tmpA);
      const chapters = await chaptersFromTranscript(segments);
      const transcriptText = segments.length
        ? segments.map((s) => `[${fmt(s.start)}] ${s.text}`).join('\n')
        : text;
      await supabase
        .from('live_neuro_recall_state')
        .update({ chapters, transcript_text: transcriptText, workflow_status: 'published', updated_at: new Date().toISOString() })
        .eq('live_session_id', sid);
      console.log('[replay-postprod] ok', sid, `${segments.length} segments, ${chapters.length} chapitres`);
    } catch (e) {
      await supabase.from('live_neuro_recall_state').update({ workflow_status: 'error' }).eq('live_session_id', sid);
      console.warn('[replay-postprod] échec', sid, e?.message);
    } finally {
      for (const f of [tmpV, tmpA]) { try { await unlink(f); } catch { /* ignore */ } }
    }
  }
  return rows.length;
}
