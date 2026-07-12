#!/usr/bin/env node
/**
 * Check syntaxe JSX/TSX à la volée (hook PostToolUse Edit|Write) — cimolace.
 *
 * Ce repo n'a PAS de test-runner ; le filet manuel utilisé était
 * `npx esbuild <fichier> --outfile=/dev/null` après chaque édition. Ce hook
 * l'automatise : après un Edit/Write sur .jsx/.tsx/.ts/.js, esbuild parse le
 * fichier (sans bundle = pur check syntaxe). Si ça casse, `exit 2` → l'erreur
 * remonte à Claude qui corrige tout de suite.
 *
 * Fail-open : fichier hors code / esbuild introuvable / erreur interne → exit 0.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { spawnSync } from 'node:child_process';

let fp = '';
try {
  fp = String(JSON.parse(readFileSync(0, 'utf8') || '{}')?.tool_input?.file_path ?? '');
} catch {
  process.exit(0);
}
if (!fp || !existsSync(fp)) process.exit(0);
if (!['.jsx', '.tsx', '.ts', '.js'].includes(extname(fp).toLowerCase())) process.exit(0);

// esbuild local (node_modules/.bin) en remontant depuis le fichier ; sinon npx.
let dir = dirname(fp);
let bin = '';
for (let i = 0; i < 9 && dir && dir !== '/'; i += 1) {
  const cand = join(dir, 'node_modules', '.bin', 'esbuild');
  if (existsSync(cand)) { bin = cand; break; }
  dir = dirname(dir);
}
const esbuildArgs = [fp, '--outfile=/dev/null', '--loader:.js=jsx', '--log-level=error'];
const r = bin
  ? spawnSync(bin, esbuildArgs, { encoding: 'utf8', timeout: 25000 })
  : spawnSync('npx', ['--yes', 'esbuild', ...esbuildArgs], { encoding: 'utf8', timeout: 40000 });

if (r.error || r.status == null) process.exit(0); // esbuild indisponible → ne pas bloquer
if (r.status !== 0) {
  const err = String(r.stderr || r.stdout || 'erreur esbuild').trim().slice(0, 1500);
  process.stderr.write(`⚠️ SYNTAXE cimolace — esbuild a rejeté ${fp} :\n${err}\n`);
  process.exit(2);
}
process.exit(0);
