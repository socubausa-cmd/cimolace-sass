-- Boîte mail intégrée CRM : IMAP (Hostinger) → sync → Supabase ; envoi sortant Resend (séparé).
-- Les secrets IMAP restent dans les variables d'environnement Netlify, pas en base.

-- ---------------------------------------------------------------------------
-- mailboxes : métadonnées + curseur sync (connexion IMAP via env côté worker)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mailboxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'hostinger',
  imap_host TEXT,
  imap_port INT,
  sync_status TEXT NOT NULL DEFAULT 'idle' CHECK (sync_status IN ('idle', 'syncing', 'error', 'ok')),
  last_error TEXT,
  imap_last_uid BIGINT NOT NULL DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mailboxes_address_lower ON public.mailboxes (lower(address));

-- Boîte par défaut (sans mot de passe en base)
INSERT INTO public.mailboxes (id, address, provider, imap_host, imap_port)
SELECT 'a0000000-0000-4000-8000-000000000001', 'infos@prorascience.org', 'hostinger', 'imap.hostinger.com', 993
WHERE NOT EXISTS (SELECT 1 FROM public.mailboxes m WHERE lower(m.address) = lower('infos@prorascience.org'));

-- ---------------------------------------------------------------------------
-- email_threads
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_id UUID NOT NULL REFERENCES public.mailboxes(id) ON DELETE CASCADE,
  subject TEXT,
  normalized_subject TEXT,
  primary_contact_email TEXT,
  pipeline_status TEXT NOT NULL DEFAULT 'new' CHECK (
    pipeline_status IN ('new', 'in_progress', 'to_treat', 'converted', 'closed')
  ),
  assigned_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  ngowazulu_case_ref TEXT,
  classification_label TEXT,
  confidence_score NUMERIC(4, 3),
  classification_suggestions JSONB NOT NULL DEFAULT '[]'::jsonb,
  internal_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_threads_mailbox ON public.email_threads(mailbox_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_threads_assigned ON public.email_threads(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_lead ON public.email_threads(lead_id);

-- ---------------------------------------------------------------------------
-- emails
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_id UUID NOT NULL REFERENCES public.mailboxes(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES public.email_threads(id) ON DELETE CASCADE,
  message_id TEXT,
  in_reply_to TEXT,
  references_chain TEXT,
  from_name TEXT,
  from_email TEXT,
  to_emails TEXT[] DEFAULT '{}',
  cc_emails TEXT[] DEFAULT '{}',
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  snippet TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_starred BOOLEAN NOT NULL DEFAULT false,
  is_outbound BOOLEAN NOT NULL DEFAULT false,
  raw_headers_json JSONB,
  imap_uid BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_emails_message_id_mailbox
  ON public.emails (mailbox_id, message_id)
  WHERE message_id IS NOT NULL AND message_id <> '';

CREATE INDEX IF NOT EXISTS idx_emails_thread ON public.emails(thread_id, received_at ASC);
CREATE INDEX IF NOT EXISTS idx_emails_received ON public.emails(received_at DESC);

-- ---------------------------------------------------------------------------
-- email_attachments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID NOT NULL REFERENCES public.emails(id) ON DELETE CASCADE,
  filename TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  storage_path TEXT,
  content_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- outgoing_emails (envoi Resend depuis l'app)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.outgoing_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES public.email_threads(id) ON DELETE SET NULL,
  sent_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT,
  body_text TEXT,
  resend_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outgoing_thread ON public.outgoing_emails(thread_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- email_tags + email_thread_tags
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_tags_name_lower ON public.email_tags (lower(name));

INSERT INTO public.email_tags (name, color)
SELECT v.name, v.color FROM (VALUES
  ('information', '#64748b'),
  ('cursus', '#3b82f6'),
  ('consultation', '#D4AF37'),
  ('mentorat', '#a855f7'),
  ('temple', '#10b981'),
  ('spirituel', '#ec4899'),
  ('support', '#f97316'),
  ('urgent', '#ef4444')
) AS v(name, color)
WHERE NOT EXISTS (SELECT 1 FROM public.email_tags t WHERE lower(t.name) = lower(v.name));

CREATE TABLE IF NOT EXISTS public.email_thread_tags (
  thread_id UUID NOT NULL REFERENCES public.email_threads(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.email_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, tag_id)
);

-- ---------------------------------------------------------------------------
-- email_sync_logs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.email_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_id UUID NOT NULL REFERENCES public.mailboxes(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('started', 'success', 'error')),
  message TEXT,
  synced_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_sync_logs_mailbox ON public.email_sync_logs(mailbox_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.mailboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outgoing_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_thread_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sync_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mail_staff_select_mailboxes" ON public.mailboxes;
CREATE POLICY "mail_staff_select_mailboxes" ON public.mailboxes FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(COALESCE(p.role,'')) IN ('owner','admin','secretariat'))
);

DROP POLICY IF EXISTS "mail_staff_update_mailboxes" ON public.mailboxes;
CREATE POLICY "mail_staff_update_mailboxes" ON public.mailboxes FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(COALESCE(p.role,'')) IN ('owner','admin','secretariat'))
);

DROP POLICY IF EXISTS "mail_staff_select_threads" ON public.email_threads;
CREATE POLICY "mail_staff_select_threads" ON public.email_threads FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(COALESCE(p.role,'')) IN ('owner','admin','secretariat'))
);

DROP POLICY IF EXISTS "mail_staff_update_threads" ON public.email_threads;
CREATE POLICY "mail_staff_update_threads" ON public.email_threads FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(COALESCE(p.role,'')) IN ('owner','admin','secretariat'))
);

DROP POLICY IF EXISTS "mail_staff_select_emails" ON public.emails;
CREATE POLICY "mail_staff_select_emails" ON public.emails FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(COALESCE(p.role,'')) IN ('owner','admin','secretariat'))
);

DROP POLICY IF EXISTS "mail_staff_update_emails" ON public.emails;
CREATE POLICY "mail_staff_update_emails" ON public.emails FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(COALESCE(p.role,'')) IN ('owner','admin','secretariat'))
);

DROP POLICY IF EXISTS "mail_staff_attachments" ON public.email_attachments;
CREATE POLICY "mail_staff_attachments" ON public.email_attachments FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(COALESCE(p.role,'')) IN ('owner','admin','secretariat'))
);

DROP POLICY IF EXISTS "mail_staff_outgoing" ON public.outgoing_emails;
CREATE POLICY "mail_staff_outgoing" ON public.outgoing_emails FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(COALESCE(p.role,'')) IN ('owner','admin','secretariat'))
);

DROP POLICY IF EXISTS "mail_staff_tags" ON public.email_tags;
CREATE POLICY "mail_staff_tags" ON public.email_tags FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(COALESCE(p.role,'')) IN ('owner','admin','secretariat'))
);

DROP POLICY IF EXISTS "mail_staff_thread_tags" ON public.email_thread_tags;
CREATE POLICY "mail_staff_thread_tags" ON public.email_thread_tags FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(COALESCE(p.role,'')) IN ('owner','admin','secretariat'))
);

DROP POLICY IF EXISTS "mail_staff_sync_logs" ON public.email_sync_logs;
CREATE POLICY "mail_staff_sync_logs" ON public.email_sync_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(COALESCE(p.role,'')) IN ('owner','admin','secretariat'))
);

COMMENT ON TABLE public.mailboxes IS 'Métadonnées boîte IMAP ; secrets dans Netlify env.';
COMMENT ON TABLE public.email_threads IS 'Fil de conversation CRM.';
COMMENT ON TABLE public.emails IS 'Messages synchronisés IMAP ou envoyés via Resend (is_outbound).';
