# Audit Final — ISNA V1 vs ISNA Consolidated V2

Date : 2026-05-14

## Chiffres clés

| | V1 | V2 | Couverture |
|---|---|---|---|
| Netlify Functions | 156 | — | — |
| Edge Functions | 33 | — | — |
| **Total backend** | **189** | **79 endpoints** | **42%** |
| Pages frontend | 398 | ~180 | 45% |

---

## Gap Analysis — 156 Netlify Functions

### ✅ Couvertes par V2 (35 fonctions — 22%)

| Fonction V1 | Équivalent V2 |
|------------|---------------|
| billing-webhook-stripe | POST /billing/webhook/stripe |
| billing-webhook-chariow | POST /billing/webhook/chariow |
| billing-webhook-cinetpay | POST /billing/webhook/cinetpay |
| billing-create-initial-checkout | POST /billing/subscription |
| billing-subscription-status | GET /billing/subscription |
| billing-my-invoices | GET /billing/invoices |
| billing-invoice-download | GET /billing/invoices/:id |
| immersive-livekit-create-room | POST /lives/immersive/rooms |
| immersive-livekit-get-token | GET /lives/immersive/:id/token |
| immersive-livekit-create-companion-link | POST /lives/immersive/:id/companion-link |
| immersive-livekit-companion-exchange | POST /lives/immersive/:id/companion-exchange |
| livekit-start-recording | POST /lives/:id/recording/start |
| livekit-stop-recording | POST /lives/:id/recording/stop |
| livekit-mobile-camera-create-link | POST /lives/:id/mobile-camera-link |
| livekit-mobile-camera-exchange | POST /lives/:id/mobile-camera-exchange |
| livekit-send-invitations | POST /lives/:id/invitations |
| livekit-create-room | (intégré dans LiveService.create) |
| livekit-get-token | GET /lives/:id/token |
| liri-masterclass-factory | POST /masterclass-factory/generate |
| liri-masterclass-document-analyze | POST /masterclass-factory/analyze |
| liri-orchestrator-start | POST /masterclass-factory/orchestrate |
| smartboard-ia-generate | POST /smartboard/generate |
| course-builder-pipeline-auto-segment | POST /course-builder/pipelines/:id/segment |
| course-builder-pipeline-master-script | POST /course-builder/pipelines/:id/master-script |
| course-builder-segment-ai-generate | POST /course-builder/segments/:id/generate |
| course-builder-segment-ai-approve | POST /course-builder/segments/:id/approve |
| course-builder-segment-ai-regenerate | POST /course-builder/segments/:id/regenerate |
| course-builder-render-enqueue | POST /course-builder/pipelines/:id/render |
| course-builder-render-status | GET /course-builder/render-jobs/:id |
| course-builder-postprod-version-save | POST /course-builder/pipelines/:id/versions |
| course-builder-postprod-version-restore | POST /course-builder/pipelines/:id/versions/:vid/restore |
| neuro-recall-bootstrap | POST /neuro-recall/bootstrap |
| neuro-recall-create-postprod-content | POST /neuro-recall/postprod-from-pipeline |
| neuro-recall-generate-flashcards | POST /neuro-recall/generate-from-course |
| neuro-recall-generate-node-reports | GET /neuro-recall/decks/:id/report |

### 🟡 Partiellement couvertes — logique simplifiée (28 fonctions — 18%)

| Fonction V1 | Statut V2 |
|------------|-----------|
| billing-run-renewal-cycle | Non implémenté (worker cron nécessaire) |
| billing-expire-subscriptions | Non implémenté (cron) |
| billing-process-webhook-dlq | Non implémenté (DLQ retry) |
| billing-activate-license | Non implémenté |
| billing-create-payment | Partiel (checkout seulement) |
| billing-create-renewal-checkout | Non implémenté |
| billing-backfill-invoices | Non implémenté |
| billing-get-tenant-billing-context | Partiel |
| billing-payment-setup-assistant | Non implémenté |
| billing-payment-status | GET /billing/subscription (basique) |
| billing-save-tenant-billing-preferences | POST /billing/payment-accounts |
| billing-save-tenant-payment-accounts | POST /billing/payment-accounts |
| billing-resend-invoice | Non implémenté |
| billing-webhook-nowpayments | Non implémenté (provider manquant) |
| billing-webhook-paypal | Non implémenté (provider manquant) |
| billing-webhook-dlq-admin | Non implémenté |
| booking-* (18 fonctions) | Partiel — CRUD slots/appointments seulement |
| live-start-emails-scheduled | Non implémenté (cron email) |
| course-builder-render-worker | Simulé (pas de vrai worker FFmpeg) |
| course-builder-postprod-version-list | GET /course-builder/pipelines/:id/versions |
| course-builder-segment-illustration-regenerate | Non implémenté |
| livekit-check-password | Non implémenté (room password) |
| immersive-ai-guide | Non implémenté |
| immersive-context-snapshot | POST /lives (partiel) |
| immersive-livekit-participant-leave | Non implémenté |
| immersive-nav-track | Non implémenté |
| capture-studio-slide-ai | Non implémenté |
| debate-ai-judge-round | Non implémenté |

### 🔴 Non couvertes (93 fonctions — 60%)

#### Email / Messaging / Notifications (18 fonctions)
- mail-imap-scheduled.js, mail-imap-sync.js
- org-mailbox-send.js, resend-inbound-webhook.js
- response-engine-followup.js, response-engine-query.js
- response-engine-secretariat-reply.js, response-engine-secretariat-threads.js
- response-engine-thread-messages.js
- response-kb-delete.js, response-kb-ingest.js, response-kb-list.js, response-kb-upsert.js
- school-announcement-ai-polish.js, school-announcement-broadcast.js
- ngowazulu-sla-overdue-scheduled.js
- debate-send-invite-email.js
- live-start-emails-scheduled.js
- marketing-ai-suggest-message.js

#### LIRI / IA / Studio (15 fonctions)
- liri-slide-generate.js, liri-summary-generate.js, liri-mindmap-generate.js
- liri-script-ai-improve.js, liri-pedagogy-generate.js
- liri-neuronq-reformulate.js, liri-konva-course-copilot.js
- liri-orchestrator-status.js
- smartboard-mindmap-course.js
- ai-generation-worker.js, annual-program-generate.js
- post-call-report.js, reformulate-text.js
- capture-studio-slide-ai.js
- ad-copy-generate.js

#### Booking / Secrétariat (14 fonctions)
- booking-available-secretaries.js, booking-cancel-appointment.js
- booking-confirm-appointment.js, booking-detect-context.js
- booking-my-appointment.js, booking-my-appointments.js
- booking-post-session.js, booking-reminders-scheduled.js
- booking-reschedule-*.js (4 fonctions)
- booking-satisfaction-send.js, booking-satisfaction-submit.js
- booking-send-reminder.js, booking-set-preparation.js
- booking-start-immersive-chat.js, booking-start-immersive-live.js
- booking-appointment-ics.js, appointments-availability.js
- appointments-book.js, appointments-secretariat-heartbeat.js

#### Marketing avancé (12 fonctions)
- marketing-analytics.js, marketing-automation-audit.js
- marketing-automation-run.js, marketing-logs.js
- marketing-orchestrate.js, marketing-payment-recovery.js
- marketing-publish.js, marketing-score-refresh.js
- marketing-lead-capture.js, marketing-leads.js
- marketing-ai-suggest-message.js

#### Admin / Teams / Reviews / IRI / Others (12 fonctions)
- admin-invite-user.js, team-invite.js, team-invite-resend-link.js
- auth-logout.js, tenant-context.js
- privileged-link-create.js, privileged-link-redeem.js
- public-reviews-list.js, public-reviews-submit.js
- iri-admin.js, iri-page.js
- replay-augmentation-worker.js

#### Edge Functions non couvertes (33 — 0% en V2)
- liri-smartboard-architect-structured/
- liri-smartboard-designer-chat/
- liri-smartboard-vision-describe/
- liri-smartboard-vision-segment/
- liri-agent-course-generate/
- liri-coach-slide/
- liri-designer-voice-realtime-session/
- liri-formation-engine/
- liri-konva-scene-improve/
- liri-multilang-live/
- liri-multilang-video/
- liri-tts/
- liri-vision-temp-sweep/
- studio-cover-prompt-assistant/
- studio-longia-chat/
- studio-longia-chat-stream/
- generate-mindmap/
- generate-node-explanation/
- generate-quiz/
- generate-transcript/
- generate-visual-image/
- embed-knowledge/
- neuronq-reformulate/
- longia-admin-document/
- longia-guest-live/
- longia-live-realtime/
- translate-transcript/
- answer-question/
- create-checkout-session/
- create-owner-user/
- create-owner-user-direct/
- reset-owner-password/

---

## Synthèse

| Catégorie | Couvert | Partiel | Non couvert | Total |
|-----------|---------|---------|-------------|-------|
| Netlify Functions | 35 (22%) | 28 (18%) | 93 (60%) | 156 |
| Edge Functions | 0 (0%) | 0 | 33 (100%) | 33 |
| **Total backend** | **35 (18%)** | **28 (15%)** | **126 (67%)** | **189** |

### Ce qui manque vraiment

1. **Email/Messaging engine** — 18 fonctions (IMAP, Resend, response engine, knowledge base, annonces)
2. **LIRI Edge Functions** — 33 fonctions Deno (smartboard chat, vision, TTS, Longia, multilangue, quiz, mindmap...)
3. **Booking avancé** — 14 fonctions (rappels, satisfaction, replanification, ICS, secrétariat workflow)
4. **Marketing orchestration** — 12 fonctions (automation run, payment recovery, logique métier)
5. **Workers lourds** — FFmpeg, renewal cron, DLQ retry, AI generation worker
6. **Admin/Teams** — invitations, privileged links, IRI pages, reviews

### Ce qui est solide en V2

- Architecture multi-tenant propre (`tenant_id` partout, RLS)
- API NestJS modulaire (31 modules)
- Format réponse standardisé
- Multi-provider billing (Stripe, Chariow, CinetPay)
- Masterclass Factory avec fallback multi-AI
- SmartBoard Designer avec scoring qualité
- Course Builder avec pipeline IA
- Live immersif complet
- Tests TypeScript 0 erreurs
