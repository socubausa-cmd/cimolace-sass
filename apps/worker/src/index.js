// ⚠️  FICHIER OBSOLÈTE — Ce fichier est un doublon de index.ts.
// Le worker est lancé via `tsx src/index.ts` (voir package.json scripts).
// Ce fichier ne doit pas être exécuté directement.
// Il sera supprimé dans une prochaine version.

import { startPingJob } from './jobs/ping.js';
import { pollVideoJobs } from './jobs/video.js';
import { runBillingRenewal, processDLQ } from './jobs/billing.js';
import { pollEmailQueue } from './jobs/email.js';
import { pollAIJobs } from './jobs/ai.js';

console.log('[worker-v2] Worker demarre');

// ── Ping heartbeat (10s) ──────────────────────────────────────────────
startPingJob();
console.log('[worker-v2] Ping heartbeat started (10s)');

// ── Video processing (30s) ─────────────────────────────────────────────
async function videoLoop() {
  while (true) {
    try {
      const count = await pollVideoJobs();
      if (count > 0) console.log('[worker-v2] Video: processed', count, 'jobs');
    } catch (e) { console.error('[worker-v2] Video error:', e.message); }
    await new Promise(r => setTimeout(r, 30000));
  }
}
videoLoop();
console.log('[worker-v2] Video poller started (30s)');

// ── Billing renewal (hourly) ──────────────────────────────────────────
async function billingLoop() {
  while (true) {
    try {
      await runBillingRenewal();
    } catch (e) { console.error('[worker-v2] Billing renewal error:', e.message); }
    await new Promise(r => setTimeout(r, 3600000)); // 1h
  }
}
billingLoop();
console.log('[worker-v2] Billing renewal started (hourly)');

// ── DLQ retry (5min) ──────────────────────────────────────────────────
async function dlqLoop() {
  while (true) {
    try {
      await processDLQ();
    } catch (e) { console.error('[worker-v2] DLQ error:', e.message); }
    await new Promise(r => setTimeout(r, 300000)); // 5min
  }
}
dlqLoop();
console.log('[worker-v2] DLQ processor started (5min)');

// ── Email queue (15s) ──────────────────────────────────────────────────
async function emailLoop() {
  while (true) {
    try {
      const count = await pollEmailQueue();
      if (count > 0) console.log('[worker-v2] Email: sent', count, 'emails');
    } catch (e) { console.error('[worker-v2] Email error:', e.message); }
    await new Promise(r => setTimeout(r, 15000));
  }
}
emailLoop();
console.log('[worker-v2] Email poller started (15s)');

// ── AI generation (10s) ────────────────────────────────────────────────
async function aiLoop() {
  while (true) {
    try {
      const count = await pollAIJobs();
      if (count > 0) console.log('[worker-v2] AI: completed', count, 'jobs');
    } catch (e) { console.error('[worker-v2] AI error:', e.message); }
    await new Promise(r => setTimeout(r, 10000));
  }
}
aiLoop();
console.log('[worker-v2] AI poller started (10s)');

console.log('[worker-v2] All workers started');
