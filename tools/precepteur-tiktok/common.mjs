/**
 * common.mjs — helpers du pipeline TikTok → Précepteur.
 * DB via psql (child_process) : pg n'est pas dans le workspace, et le précédent
 * projet (.zoom-import.mjs) fait pareil. Chaînes passées en dollar-quoting à tag
 * aléatoire → sûres quel que soit le contenu (transcripts, JSON).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const TENANT_ID = '4f6faaa8-43a0-46d6-b98a-99ea1154f9ea'; // isna (Prorascience)
export const TIKTOK_SECUID = 'MS4wLjABAAAAyy7Fx51xAjE1IK9CQBG5T32wmTOUzSpgvqpZhwLwlIb5RC0lcGfMGxCmjtgix5H8'; // @manikongo5 (GOWAZULU)
export const TIKTOK_HANDLE = 'manikongo5';

function envProd() {
  const txt = readFileSync(path.join(ROOT, '.env.production'), 'utf8');
  const out = {};
  for (const line of txt.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}
// Les clés LLM de .env.production peuvent être PÉRIMÉES ; l'environnement du process
// (ex. injecté depuis `railway variables`) PRIME. DATABASE_URL vient du fichier.
const _file = envProd();
export const ENV = { ..._file };
for (const k of ['DEEPSEEK_API_KEY', 'GROQ_API_KEY', 'OPENAI_API_KEY', 'MISTRAL_API_KEY']) {
  if (process.env[k]) ENV[k] = process.env[k];
}

/** Dollar-quote sûre (tag aléatoire, re-tiré si collision avec le contenu). */
export function q(s) {
  if (s == null) return 'NULL';
  const str = String(s);
  let tag = 'q' + randomBytes(4).toString('hex');
  while (str.includes(`$${tag}$`)) tag = 'q' + randomBytes(4).toString('hex');
  return `$${tag}$${str}$${tag}$`;
}

/** Exécute du SQL ; renvoie stdout (lignes -tA séparées par |). */
export function sql(query, { tuples = true } = {}) {
  const url = ENV.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL absent de .env.production');
  const args = tuples ? ['-tA', '-c', query] : ['-c', query];
  return execFileSync('psql', [url, ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, PGCONNECT_TIMEOUT: '15' },
  }).trim();
}

export function log(...a) { console.log(new Date().toISOString().slice(11, 19), ...a); }
