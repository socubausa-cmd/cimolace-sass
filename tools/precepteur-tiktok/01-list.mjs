/**
 * 01-list.mjs — Inventaire des vidéos TikTok @manikongo5 → precepteur_sources.
 * yt-dlp `tiktokuser:<secUid>` (la page @handle est bloquée anonyme ; le secUid,
 * extrait du profil connecté, marche sans cookies). Upsert idempotent.
 *
 * Usage : node tools/precepteur-tiktok/01-list.mjs [--limit N]
 */
import { execFileSync } from 'node:child_process';
import { sql, q, TENANT_ID, TIKTOK_SECUID, TIKTOK_HANDLE, log } from './common.mjs';

const limit = (() => { const i = process.argv.indexOf('--limit'); return i > -1 ? Number(process.argv[i + 1]) : 0; })();

log(`Listage TikTok @${TIKTOK_HANDLE}${limit ? ` (limite ${limit})` : ' (tout)'}…`);
const args = ['-m', 'yt_dlp', '--flat-playlist', '--print', '%(id)s\t%(title)s\t%(url)s'];
if (limit) args.push('--playlist-end', String(limit));
args.push(`tiktokuser:${TIKTOK_SECUID}`);
const out = execFileSync('python3', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });

const rows = out.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
  const [id, title, url] = l.split('\t');
  return { id, title: (title || '').trim(), url: url || `https://www.tiktok.com/@${TIKTOK_HANDLE}/video/${id}` };
}).filter((r) => /^\d+$/.test(r.id || ''));

log(`${rows.length} vidéos listées. Upsert…`);
// Upsert par lots de 50 (title mis à jour si meilleur ; jamais de doublon).
for (let i = 0; i < rows.length; i += 50) {
  const batch = rows.slice(i, i + 50);
  const values = batch.map((r) => `(${q(TENANT_ID)}::uuid, 'tiktok', ${q(r.id)}, ${q(r.url)}, ${q(r.title)})`).join(',\n');
  sql(`insert into precepteur_sources (tenant_id, platform, external_id, url, title)
       values ${values}
       on conflict (tenant_id, platform, external_id)
       do update set title = case when precepteur_sources.title is null or precepteur_sources.title = '' then excluded.title else precepteur_sources.title end,
                     url = excluded.url, updated_at = now();`);
  log(`  upsert ${Math.min(i + 50, rows.length)}/${rows.length}`);
}
const counts = sql(`select status||':'||count(*) from precepteur_sources where tenant_id=${q(TENANT_ID)}::uuid group by status order by 1;`);
log('État des sources →', counts.replace(/\n/g, '  '));
