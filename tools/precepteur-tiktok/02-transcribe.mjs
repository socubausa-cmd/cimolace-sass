/**
 * 02-transcribe.mjs — Transcription des sources `new` → transcript_text.
 * Stratégie : 1) sous-titres TikTok (créateur/auto) via yt-dlp (rapide, gratuit) ;
 *             2) sinon audio (-x m4a) + Whisper local (--language French).
 * Vidéos courtes (1-3 min) → whisper `small` = bon compromis précision/temps.
 *
 * Usage : node tools/precepteur-tiktok/02-transcribe.mjs [--limit N] [--model small]
 */
import { execFileSync, execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { sql, q, TENANT_ID, log } from './common.mjs';

const argv = process.argv;
const limit = (() => { const i = argv.indexOf('--limit'); return i > -1 ? Number(argv[i + 1]) : 5; })();
const model = (() => { const i = argv.indexOf('--model'); return i > -1 ? argv[i + 1] : 'small'; })();
// --subs-only : PASSE RAPIDE. Les sous-titres TikTok sortent en ~5 s et donnent les meilleures
// transcriptions (vraie parole) ; Whisper met 1-3 min et, sur les vidéos chantées/rituelles,
// ne produit que du bruit. Sans sous-titres → statut 'no_subs' (repris plus tard par --whisper-only).
const subsOnly = argv.includes('--subs-only');
// --whisper-only : la passe LENTE de rattrapage sur les 'no_subs'.
const whisperOnly = argv.includes('--whisper-only');

const WORK = path.join(os.tmpdir(), 'precepteur-tiktok');
mkdirSync(WORK, { recursive: true });

/** VTT/SRT → texte plat (dédupliqué : TikTok répète les lignes en fenêtres). */
function subsToText(raw) {
  const lines = raw.split('\n')
    .filter((l) => !/^\s*$/.test(l) && !/^WEBVTT/.test(l) && !/^\d+\s*$/.test(l) && !/-->/.test(l) && !/^NOTE/.test(l))
    .map((l) => l.replace(/<[^>]+>/g, '').trim()).filter(Boolean);
  const out = [];
  for (const l of lines) if (out[out.length - 1] !== l) out.push(l);
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

// --ids 123,456 : cibler des vidéos précises (ex. celles dont le titre annonce un enseignement) ;
// sinon file d'attente naturelle (les plus anciennes 'new' d'abord).
const idsArg = (() => { const i = argv.indexOf('--ids'); return i > -1 ? String(argv[i + 1] || '').split(',').map((x) => x.trim()).filter(Boolean) : []; })();
const whereIds = idsArg.length
  ? `and external_id in (${idsArg.map((x) => q(x)).join(',')})`
  : (whisperOnly ? "and status='no_subs'" : "and status='new'");
// PRIORITÉ : les vidéos dont le TITRE annonce un enseignement d'abord (elles donnent de vrais
// cours ; les évocations rituelles / clips courts sont rejetés plus tard par le filtre topic_ok).
const PRIORITY = `case when title ~* '(comment|pourquoi|différence|explique|je t.explique|c.est quoi|origine|signifie|science|doctrine|initiation|enseign|le sens|décode|savoir)' then 0 else 1 end`;
const rows = sql(`select id, external_id, url from precepteur_sources
                  where tenant_id=${q(TENANT_ID)}::uuid ${whereIds}
                  order by ${PRIORITY} asc, length(coalesce(title,'')) desc, created_at asc limit ${limit};`)
  .split('\n').filter(Boolean).map((l) => { const [id, ext, url] = l.split('|'); return { id, ext, url }; });
log(`${rows.length} source(s) à transcrire (modèle whisper: ${model}).`);

for (const r of rows) {
  const dir = path.join(WORK, r.ext);
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  try {
    // 1) Sous-titres TikTok d'abord (skip-download).
    try {
      execFileSync('python3', ['-m', 'yt_dlp', '--skip-download', '--write-subs', '--write-auto-subs',
        '--sub-langs', 'fra.*,fr.*,fra-FR', '-o', path.join(dir, 'v.%(ext)s'), r.url],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 });
    } catch { /* pas de subs → whisper */ }
    const subFile = readdirSync(dir).find((f) => /\.(vtt|srt)$/.test(f));
    let text = '', source = '';
    if (subFile) {
      text = subsToText(readFileSync(path.join(dir, subFile), 'utf8'));
      source = 'tiktok_subs';
    }
    if ((!text || text.length < 40) && subsOnly) {
      sql(`update precepteur_sources set status='no_subs', updated_at=now() where id=${q(r.id)}::uuid;`);
      log(`⏭️  ${r.ext} — pas de sous-titres, reporté à la passe Whisper.`);
      continue;
    }
    if (!text || text.length < 40) {
      // 2) Whisper local sur l'audio.
      execFileSync('python3', ['-m', 'yt_dlp', '-x', '--audio-format', 'm4a',
        '-o', path.join(dir, 'a.%(ext)s'), r.url],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 300000 });
      const audio = readdirSync(dir).find((f) => /\.m4a$/.test(f));
      if (!audio) throw new Error('audio introuvable après téléchargement');
      execSync(`whisper ${JSON.stringify(path.join(dir, audio))} --model ${model} --language French --task transcribe --output_format txt --output_dir ${JSON.stringify(dir)} --fp16 False`,
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 1200000 });
      const txtFile = readdirSync(dir).find((f) => f.endsWith('.txt'));
      text = txtFile ? readFileSync(path.join(dir, txtFile), 'utf8').replace(/\s+/g, ' ').trim() : '';
      source = 'whisper';
    }
    if (!text || text.length < 40) throw new Error('transcription vide/trop courte');
    sql(`update precepteur_sources set transcript_text=${q(text)}, transcript_lang='fr',
         transcript_source=${q(source)}, status='transcribed', error_message=null, updated_at=now()
         where id=${q(r.id)}::uuid;`);
    log(`✅ ${r.ext} (${source}, ${text.length} car.) — « ${text.slice(0, 70)}… »`);
  } catch (e) {
    const msg = String(e?.message || e).slice(0, 300);
    sql(`update precepteur_sources set status='failed', error_message=${q(msg)}, updated_at=now() where id=${q(r.id)}::uuid;`);
    log(`❌ ${r.ext} — ${msg.slice(0, 120)}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const counts = sql(`select status||':'||count(*) from precepteur_sources where tenant_id=${q(TENANT_ID)}::uuid group by status order by 1;`);
log('État →', counts.replace(/\n/g, '  '));
