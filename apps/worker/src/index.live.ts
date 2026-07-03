/**
 * Entrypoint LIVE NOTIFS — sous-ensemble ciblé du worker, dédié aux
 * notifications des séances live. Process long-running (pollers en boucle).
 *
 * Pipeline complet des notifs live :
 *   live-reminders  → enfile un rappel (15 min avant) dans email_queue
 *   live-invitations→ enfile l'invitation (à la programmation) + WhatsApp Twilio
 *   email           → vide email_queue → Resend (envoi réel)
 *
 * Les autres pollers de index.ts (vidéo/Mux, IA/OpenAI, billing/Stripe, R2…)
 * ne sont PAS lancés ici : ils exigent d'autres secrets hors périmètre notifs
 * et n'ont rien à voir avec les rappels/invitations live.
 *
 * Secrets requis : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY,
 * RESEND_FROM, APP_PUBLIC_URL. WhatsApp (Twilio) optionnel.
 */
import { startPingJob }        from './jobs/ping.js';
import { pollEmailQueue }      from './jobs/email.js';
import { pollLiveReminders }   from './jobs/live-reminders.js';
import { pollLiveInvitations } from './jobs/live-invitations.js';
import { pollLiveReplayShorts } from './jobs/short-generator.js';
import { pollReplayPostprod } from './jobs/replay-postprod.js';
import { pollDraftSocialPosts } from './jobs/social-poster.js';
import { pollImapSync }         from './jobs/imap-sync.js';
import { pollGdprExports }      from './jobs/gdpr-export.js';
import { pollCourseRenderJobs } from './jobs/courseRender.js';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

console.log('[worker:live] Démarrage — notifs live (rappels + invitations + email)');
startPingJob();

// ── Email queue → Resend (15s) ──────────────────────────────────────────────
(async () => {
  while (true) {
    try {
      const n = await (pollEmailQueue as () => Promise<number>)();
      if (n > 0) console.log(`[worker:live] Email: ${n} envoyé(s)`);
    } catch (e: unknown) { console.error('[worker:live] Email error:', (e as Error)?.message || e); }
    await sleep(15_000);
  }
})();

// ── Rappels live (60s) ──────────────────────────────────────────────────────
(async () => {
  while (true) {
    try {
      const n = await (pollLiveReminders as () => Promise<number>)();
      if (n > 0) console.log(`[worker:live] Rappels: ${n} enfilé(s)`);
    } catch (e: unknown) { console.error('[worker:live] Reminders error:', (e as Error)?.message || e); }
    await sleep(60_000);
  }
})();

// ── Invitations live (120s) ─────────────────────────────────────────────────
(async () => {
  while (true) {
    try {
      const n = await (pollLiveInvitations as () => Promise<number>)();
      if (n > 0) console.log(`[worker:live] Invitations: ${n} enfilée(s)`);
    } catch (e: unknown) { console.error('[worker:live] Invitations error:', (e as Error)?.message || e); }
    await sleep(120_000);
  }
})();

// ── RÉCEPTION inbound : sync IMAP des boîtes → boîte CRM back-office (90s) ─────
(async () => {
  while (true) {
    try {
      const n = await (pollImapSync as () => Promise<number>)();
      if (n > 0) console.log(`[worker:live] IMAP: ${n} email(s) reçu(s)`);
    } catch (e: unknown) { console.error('[worker:live] IMAP error:', (e as Error)?.message || e); }
    await sleep(90_000);
  }
})();

// ── Shorts depuis les replays LiveKit (5 min) ───────────────────────────────
(async () => {
  while (true) {
    try {
      const n = await (pollLiveReplayShorts as () => Promise<number>)();
      if (n > 0) console.log(`[worker:live] Shorts: ${n} clip(s) généré(s)`);
    } catch (e: unknown) { console.error('[worker:live] Shorts error:', (e as Error)?.message || e); }
    await sleep(300_000);
  }
})();

// ── Post-production auto des replays (audio → transcription → chapitres, 60s) ─
(async () => {
  while (true) {
    try {
      const n = await (pollReplayPostprod as () => Promise<number>)();
      if (n > 0) console.log(`[worker:live] Replay post-prod: ${n} traité(s)`);
    } catch (e: unknown) { console.error('[worker:live] Replay postprod error:', (e as Error)?.message || e); }
    await sleep(60_000);
  }
})();

// ── Brouillons réseaux sociaux depuis les shorts prêts (90s) ────────────────
(async () => {
  while (true) {
    try {
      const n = await (pollDraftSocialPosts as () => Promise<number>)();
      if (n > 0) console.log(`[worker:live] Posts brouillons: ${n} créé(s)`);
    } catch (e: unknown) { console.error('[worker:live] Social drafts error:', (e as Error)?.message || e); }
    await sleep(90_000);
  }
})();

// ── Exports RGPD async (Art. 20) depuis med_gdpr_exports pending (60s) ───────
(async () => {
  while (true) {
    try {
      const n = await (pollGdprExports as () => Promise<number>)();
      if (n > 0) console.log(`[worker:live] Exports RGPD: ${n} généré(s)`);
    } catch (e: unknown) { console.error('[worker:live] GDPR export error:', (e as Error)?.message || e); }
    await sleep(60_000);
  }
})();

// ── Rendu vidéo des cours (Précepteur/Tableau Vivant → MP4, 60s) ─────────────
//    ⚠️ Ce poller vivait dans index.ts (jamais déployé) → le rendu de cours ne
//    tournait PAS en prod. Rapatrié ici, le seul entrypoint déployé (audit P0).
(async () => {
  while (true) {
    try {
      const n = await (pollCourseRenderJobs as () => Promise<number>)();
      if (n > 0) console.log(`[worker:live] Rendu cours: ${n} traité(s)`);
    } catch (e: unknown) { console.error('[worker:live] Course render error:', (e as Error)?.message || e); }
    await sleep(60_000);
  }
})();

console.log('[worker:live] Pollers actifs ✅ (email 15s · rappels 60s · invitations 120s · imap 90s · shorts 5min · posts 90s · rgpd 60s · replay post-prod 60s · rendu cours 60s)');
