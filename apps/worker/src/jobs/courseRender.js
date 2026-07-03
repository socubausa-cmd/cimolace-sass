// Course render — compose un MP4 SPLIT-SCREEN (vidéo à gauche | diaporama des slides à droite)
// pour la classe numérique (post-production). Lit la file `course_render_jobs`.
// Filtergraph validé : [video → moitié gauche][slides concat → moitié droite] hstack.
import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
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

/**
 * payload = { sourceVideoUrl, slides:[{url, durationSeconds}], width?, height? }
 * Renvoie le chemin du MP4 produit. Les fichiers temporaires sont listés dans `tmpFiles`.
 */
export async function renderSplitScreen(payload, jobId, tmpFiles) {
  const W = Number(payload?.width) || 1280;
  const H = Number(payload?.height) || 720;
  const half = Math.floor(W / 2);
  const dir = tmpdir();
  const slides = Array.isArray(payload?.slides) ? payload.slides.filter((s) => s && s.url) : [];
  if (!payload?.sourceVideoUrl) throw new Error('sourceVideoUrl manquant');

  const srcPath = join(dir, `cr_src_${jobId}.mp4`);
  await materialize(payload.sourceVideoUrl, srcPath);
  tmpFiles.push(srcPath);

  const slidePaths = [];
  for (let i = 0; i < slides.length; i++) {
    const p = join(dir, `cr_slide_${jobId}_${i}.png`);
    await materialize(slides[i].url, p);
    tmpFiles.push(p);
    slidePaths.push(p);
  }

  const outPath = join(dir, `cr_out_${jobId}.mp4`);
  tmpFiles.push(outPath);
  const padHalf = `scale=${half}:${H}:force_original_aspect_ratio=decrease,pad=${half}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=25`;

  const args = ['-y', '-loglevel', 'error', '-i', srcPath];
  slidePaths.forEach((p, i) => {
    const dur = Math.max(1, Number(slides[i].durationSeconds) || 4);
    args.push('-loop', '1', '-t', String(dur), '-i', p);
  });

  if (slidePaths.length === 0) {
    // pas de slides → simple normalisation plein cadre
    args.push('-filter_complex',
      `[0:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1[v]`,
      '-map', '[v]', '-map', '0:a?');
  } else {
    let fc = `[0:v]${padHalf}[L];`;
    slidePaths.forEach((_p, i) => { fc += `[${i + 1}:v]${padHalf}[s${i}];`; });
    fc += slidePaths.map((_p, i) => `[s${i}]`).join('') + `concat=n=${slidePaths.length}:v=1:a=0[R];`;
    fc += `[L][R]hstack=inputs=2[v]`;
    args.push('-filter_complex', fc, '-map', '[v]', '-map', '0:a?');
  }
  args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', '-shortest', outPath);

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
    try {
      const outPath = await renderSplitScreen(job.payload || {}, job.id, tmpFiles);
      const key = `tenants/${job.tenant_id}/postprod/${job.content_id}_${job.id}.mp4`;
      const outputUrl = await uploadToR2(outPath, key);
      await supabase.from('course_render_jobs')
        .update({ status: 'completed', output_url: outputUrl, updated_at: new Date().toISOString() })
        .eq('id', job.id);
      // reflète l'URL rendue dans le contenu de la formation
      try {
        const { data: c } = await supabase.from('formation_day_contents').select('data').eq('id', job.content_id).single();
        const nd = { ...((c && c.data) || {}), renderedUrl: outputUrl };
        await supabase.from('formation_day_contents').update({ data: nd }).eq('id', job.content_id);
      } catch { /* non bloquant */ }
      console.log('[course-render] completed', job.id, outputUrl || '(no R2)');
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
