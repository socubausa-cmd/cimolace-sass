/**
 * ISNA Worker — Point d'entrée principal
 * Exécute tous les pollers en boucle infinie avec gestion d'erreurs isolée.
 * Lancement : npm run dev  (tsx watch)  |  npm start  (tsx)
 */

import { startPingJob }               from './jobs/ping.js';
import { pollVideoJobs }              from './jobs/video.js';
import { runBillingRenewal, processDLQ } from './jobs/billing.js';
import { pollEmailQueue }             from './jobs/email.js';
import { pollAIJobs }                 from './jobs/ai.js';
import { pollZoomSync }               from './jobs/zoom-sync.js';
import { pollShortGeneration }        from './jobs/short-generator.js';
import { pollCourseRenderJobs }       from './jobs/courseRender.js';
import { pollLiveReminders }          from './jobs/live-reminders.js';
import { pollLiveInvitations }        from './jobs/live-invitations.js';
import { pollGdprExports }            from './jobs/gdpr-export.js';

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

console.log('[worker] Démarrage ISNA Worker v2');

// ── Ping heartbeat (10s) ──────────────────────────────────────────────────
startPingJob();
console.log('[worker] ✓ Ping heartbeat (10s)');

// ── Video processing (30s) ───────────────────────────────────────────────
(async () => {
  while (true) {
    try {
      const count = await (pollVideoJobs as () => Promise<number>)();
      if (count > 0) console.log(`[worker] Video: ${count} jobs traités`);
    } catch (e: unknown) { console.error('[worker] Video error:', (e as Error).message); }
    await sleep(30_000);
  }
})();
console.log('[worker] ✓ Video poller (30s)');

// ── Billing renewal (1h) ─────────────────────────────────────────────────
(async () => {
  while (true) {
    try { await (runBillingRenewal as () => Promise<unknown>)(); }
    catch (e: unknown) { console.error('[worker] Billing error:', (e as Error).message); }
    await sleep(3_600_000);
  }
})();
console.log('[worker] ✓ Billing renewal (1h)');

// ── DLQ retry (5min) ─────────────────────────────────────────────────────
(async () => {
  while (true) {
    try { await (processDLQ as () => Promise<unknown>)(); }
    catch (e: unknown) { console.error('[worker] DLQ error:', (e as Error).message); }
    await sleep(300_000);
  }
})();
console.log('[worker] ✓ DLQ processor (5min)');

// ── Email queue (15s) ────────────────────────────────────────────────────
(async () => {
  while (true) {
    try {
      const count = await (pollEmailQueue as () => Promise<number>)();
      if (count > 0) console.log(`[worker] Email: ${count} emails envoyés`);
    } catch (e: unknown) { console.error('[worker] Email error:', (e as Error).message); }
    await sleep(15_000);
  }
})();
console.log('[worker] ✓ Email poller (15s)');

// ── Rappels live (60s) ───────────────────────────────────────────────────
(async () => {
  while (true) {
    try {
      const count = await (pollLiveReminders as () => Promise<number>)();
      if (count > 0) console.log(`[worker] Live reminders: ${count} rappels enfilés`);
    } catch (e: unknown) { console.error('[worker] Live reminders error:', (e as Error).message); }
    await sleep(60_000);
  }
})();
console.log('[worker] ✓ Live reminders poller (60s)');

// ── Invitations live (120s) ──────────────────────────────────────────────
(async () => {
  while (true) {
    try {
      const count = await (pollLiveInvitations as () => Promise<number>)();
      if (count > 0) console.log(`[worker] Live invitations: ${count} invitations enfilées`);
    } catch (e: unknown) { console.error('[worker] Live invitations error:', (e as Error).message); }
    await sleep(120_000);
  }
})();
console.log('[worker] ✓ Live invitations poller (120s)');

// ── AI generation (10s) ──────────────────────────────────────────────────
(async () => {
  while (true) {
    try {
      const count = await (pollAIJobs as () => Promise<number>)();
      if (count > 0) console.log(`[worker] AI: ${count} jobs terminés`);
    } catch (e: unknown) { console.error('[worker] AI error:', (e as Error).message); }
    await sleep(10_000);
  }
})();
console.log('[worker] ✓ AI poller (10s)');

// ── Zoom sync (5min) ───────────────────────────────────────────────────
(async () => {
  while (true) {
    try {
      const count = await (pollZoomSync as () => Promise<number>)();
      if (count > 0) console.log(`[worker] Zoom sync: ${count} vidéos traitées`);
    } catch (e: unknown) { console.error('[worker] Zoom sync error:', (e as Error).message); }
    await sleep(300_000);
  }
})();
console.log('[worker] ✓ Zoom sync poller (5min)');

// ── Short generation (5min) ────────────────────────────────────────────
(async () => {
  while (true) {
    try {
      const count = await (pollShortGeneration as () => Promise<number>)();
      if (count > 0) console.log(`[worker] Short gen: ${count} clips générés`);
    } catch (e: unknown) { console.error('[worker] Short gen error:', (e as Error).message); }
    await sleep(300_000);
  }
})();
console.log('[worker] ✓ Short generation poller (5min)');

// ── Rendu split-screen classe numérique (30s) ──────────────────────────
(async () => {
  while (true) {
    try {
      const count = await (pollCourseRenderJobs as () => Promise<number>)();
      if (count > 0) console.log(`[worker] Course render: ${count} vidéos composées`);
    } catch (e: unknown) { console.error('[worker] Course render error:', (e as Error).message); }
    await sleep(30_000);
  }
})();
console.log('[worker] ✓ Course render poller (30s)');

// ── Exports RGPD async (Art. 20) (60s) ──────────────────────────────────
(async () => {
  while (true) {
    try {
      const count = await (pollGdprExports as () => Promise<number>)();
      if (count > 0) console.log(`[worker] GDPR exports: ${count} générés`);
    } catch (e: unknown) { console.error('[worker] GDPR export error:', (e as Error).message); }
    await sleep(60_000);
  }
})();
console.log('[worker] ✓ GDPR export poller (60s)');

console.log('[worker] Tous les workers actifs ✅');
