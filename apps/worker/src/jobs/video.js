import { createClient } from '@supabase/supabase-js';
import { spawn } from 'child_process';
import { writeFile, unlink, readFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import { join } from 'path';

const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

const R2_ACCOUNT = process.env.CF_R2_ACCOUNT_ID;
const R2_KEY = process.env.CF_R2_ACCESS_KEY_ID;
const R2_SECRET = process.env.CF_R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.CF_R2_BUCKET || 'cimolace-media';

function r2Configured() { return Boolean(R2_ACCOUNT && R2_KEY && R2_SECRET && R2_BUCKET); }

async function uploadToR2(filePath, key) {
  if (!r2Configured()) return null;
  const fileBuffer = await readFile(filePath);
  const endpoint = `https://${R2_ACCOUNT}.r2.cloudflarestorage.com`;
  const url = `${endpoint}/${R2_BUCKET}/${key}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Authorization': `Basic ${Buffer.from(R2_KEY + ':' + R2_SECRET).toString('base64')}`, 'Content-Type': 'application/octet-stream' },
    body: fileBuffer,
  });
  if (!res.ok) throw new Error(`R2 upload failed: ${res.status}`);
  return `https://${R2_BUCKET}.${R2_ACCOUNT}.r2.cloudflarestorage.com/${key}`;
}

async function ffmpeg(inputPath, outputPath, options = []) {
  return new Promise((resolve, reject) => {
    const args = ['-y', '-i', inputPath, '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac', '-b:a', '128k', ...options, outputPath];
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', d => stderr += d.toString());
    proc.on('close', code => {
      if (code === 0) resolve(outputPath);
      else reject(new Error(`FFmpeg exit ${code}: ${stderr.slice(-200)}`));
    });
    proc.on('error', reject);
  });
}

async function downloadFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(destPath, buffer);
}

export async function processVideoJob(job) {
  const jobId = job.id || randomUUID();
  console.log('[video-worker] Processing', jobId, job.inputUrl || job.input_url);

  const tmpDir = tmpdir();
  const inputFile = join(tmpDir, `input_${jobId}.mp4`);
  const outputFile = join(tmpDir, `output_${jobId}.${job.outputFormat || job.output_format || 'mp4'}`);

  try {
    // Download input
    const inputUrl = job.inputUrl || job.input_url;
    if (inputUrl && (inputUrl.startsWith('http://') || inputUrl.startsWith('https://'))) {
      await downloadFile(inputUrl, inputFile);
    } else if (inputUrl) {
      // Assume local path
      await writeFile(inputFile, Buffer.from(''));
    } else {
      throw new Error('No input URL provided');
    }

    // Transcode with FFmpeg
    await ffmpeg(inputFile, outputFile);
    console.log('[video-worker] Transcoding complete', jobId);

    // Upload to R2
    const tenantId = job.tenantId || job.tenant_id || 'default';
    const assetId = job.assetId || job.asset_id || jobId;
    const r2Key = `tenants/${tenantId}/videos/${assetId}.mp4`;
    const outputUrl = await uploadToR2(outputFile, r2Key);

    // Update database
    const update = {
      status: 'completed',
      processed_at: new Date().toISOString(),
      duration_seconds: 0,
    };
    if (outputUrl) update.output_url = outputUrl;

    if (job.assetId || job.asset_id) {
      await supabase.from('video_assets').update(update).eq('id', assetId);
    }
    if (job.id) {
      await supabase.from('render_jobs').update(update).eq('id', job.id);
    }

    console.log('[video-worker] Completed', jobId, outputUrl || '(no R2)');
    return { status: 'completed', assetId, outputUrl };

  } finally {
    // Cleanup temp files
    try { await unlink(inputFile); } catch {}
    try { await unlink(outputFile); } catch {}
  }
}

export async function pollVideoJobs() {
  const { data: jobs } = await supabase.from('render_jobs')
    .select('*').eq('status', 'pending').eq('job_type', 'video').limit(5);
  if (!jobs?.length) return 0;
  for (const job of jobs) {
    await supabase.from('render_jobs').update({ status: 'processing' }).eq('id', job.id);
    try {
      await processVideoJob({
        id: job.id, assetId: job.asset_id || job.id,
        inputUrl: job.input_url, outputFormat: job.output_format || 'mp4',
        tenantId: job.tenant_id,
      });
    } catch (e) {
      console.error('[video-worker] Failed', job.id, e.message);
      await supabase.from('render_jobs').update({ status: 'failed', error: e.message }).eq('id', job.id);
    }
  }
  return jobs.length;
}
