-- File d'attente e-mail (email_queue) — table-pivot des notifications.
--
-- Les jobs du worker (apps/worker/src/jobs/live-reminders.js,
-- live-invitations.js, …) ENFILENT ici un e-mail (status='pending'), et
-- apps/worker/src/jobs/email.js le CONSOMME (poll status='pending' → POST
-- Resend → status='sent'/'failed'). La table était absente en prod → tout
-- le flux de notifs (rappels + invitations live) cassait silencieusement à
-- l'insert. Accès worker en service_role (bypass RLS).
--
-- ⚠️ `to` et `from` sont des mots réservés SQL → colonnes entre guillemets.
-- Le code (PostgREST) les requête tels quels (`.insert({ to, from, ... })`),
-- PostgREST gère le quoting automatiquement.

CREATE TABLE IF NOT EXISTS public.email_queue (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "to"       text NOT NULL,
  "from"     text,
  subject    text,
  html_body  text,
  status     text NOT NULL DEFAULT 'pending',
  error      text,
  sent_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Le poller ne scanne que les e-mails en attente.
CREATE INDEX IF NOT EXISTS idx_email_queue_pending
  ON public.email_queue (created_at)
  WHERE status = 'pending';

-- Table interne au worker : RLS activée SANS policy publique → seuls les
-- accès service_role (worker) passent ; anon/authenticated n'ont aucun accès
-- (la file contient des adresses e-mail = données personnelles).
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;
