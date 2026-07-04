#!/usr/bin/env node
/**
 * smoke-front-health.mjs — SMOKE TEST RUNTIME du portail LIRI (apps/app).
 * ============================================================================
 * Détecte le crash « page blanche globale » qu'un `vite build` NE VOIT PAS et
 * que le WIP d'une session parallèle peut MASQUER en local :
 *   TypeError: Cannot read properties of undefined (reading 'default')
 * (mélange import statique + dynamique d'un gros module → Rollup résout undefined
 *  en PROD uniquement. Cf. mémoire `vite-prod-crash-build-only`.)
 *
 * Charge l'URL dans un vrai Chromium headless et vérifie que React MONTE
 * (#root a des enfants) sans erreur console fatale.
 *
 * Usage :  node scripts/smoke-front-health.mjs <url>
 *   ex :   node scripts/smoke-front-health.mjs https://prorascience.org/liri
 * Sortie : JSON sur stdout ; exit 0 = SAIN, exit 1 = CASSÉ (à ne PAS promouvoir).
 */
import { chromium } from '@playwright/test';

const url = process.argv[2] || 'https://prorascience.org/liri';
const TIMEOUT = Number(process.env.SMOKE_TIMEOUT_MS || 30000);

const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e && e.message ? e.message : e)));

let healthy = false;
let rootChildren = 0;
try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
  // React doit monter quelque chose dans #root (login, portail, etc.)
  await page.waitForFunction(
    () => { const r = document.getElementById('root'); return !!r && r.children.length > 0; },
    { timeout: TIMEOUT },
  );
  rootChildren = await page.evaluate(() => document.getElementById('root')?.children.length || 0);
  healthy = rootChildren > 0;
} catch {
  healthy = false;
}

// Signature exacte du crash import statique/dynamique.
const bootCrash = errors.some((t) => /Cannot read properties of undefined \(reading 'default'\)/.test(t))
  || errors.some((t) => /before initialization/.test(t)); // TDZ circular chunk

await browser.close();

const ok = healthy && !bootCrash;
console.log(JSON.stringify({
  url,
  ok,
  rootChildren,
  bootCrash,
  errorCount: errors.length,
  errorsSample: errors.slice(0, 4),
}, null, 2));
process.exit(ok ? 0 : 1);
