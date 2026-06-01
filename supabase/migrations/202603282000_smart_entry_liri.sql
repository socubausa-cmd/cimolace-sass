-- ============================================================
-- SMART ENTRY / LIRI — Système d'invitation et salle d'attente
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Règles de visibilité et d'accès d'un live
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.live_visibility_rules (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id             UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  is_public                   BOOLEAN NOT NULL DEFAULT false,
  -- Modes d'invitation : class, module, role, individual
  invite_mode                 TEXT[] NOT NULL DEFAULT '{}',
  -- Accès
  requires_password           BOOLEAN NOT NULL DEFAULT false,
  password_hash               TEXT,
  requires_manual_approval    BOOLEAN NOT NULL DEFAULT false,
  -- Salle d'attente
  waiting_room_enabled        BOOLEAN NOT NULL DEFAULT true,
  waiting_room_audio_enabled  BOOLEAN NOT NULL DEFAULT false,
  waiting_room_video_enabled  BOOLEAN NOT NULL DEFAULT false,
  waiting_room_chat_disabled  BOOLEAN NOT NULL DEFAULT true,
  show_live_plan              BOOLEAN NOT NULL DEFAULT false,
  show_live_details           BOOLEAN NOT NULL DEFAULT true,
  welcome_message             TEXT,
  -- Notifications
  notify_dashboard            BOOLEAN NOT NULL DEFAULT true,
  notify_email                BOOLEAN NOT NULL DEFAULT false,
  reminder_before_minutes     INT DEFAULT 15,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (live_session_id)
);

-- ─────────────────────────────────────────────────────────────
-- 2. Invitations
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.live_invitations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Type : individual | class | module | role
  invitation_type TEXT NOT NULL DEFAULT 'individual',
  -- Référence source (id de la classe, du module, du rôle)
  source_ref_id   TEXT,
  source_ref_name TEXT,
  -- Statut de l'invitation
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','sent','seen','accepted','declined')),
  seen_at         TIMESTAMPTZ,
  responded_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (live_session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_live_invitations_user
  ON public.live_invitations(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_invitations_session
  ON public.live_invitations(live_session_id);

-- ─────────────────────────────────────────────────────────────
-- 3. Entrées en salle d'attente
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.live_waiting_room_entries (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id       UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Statut : waiting | accepted | rejected | audio_only | host_pending
  status                TEXT NOT NULL DEFAULT 'waiting'
                        CHECK (status IN ('waiting','accepted','rejected','audio_only','host_pending')),
  -- Options accordées par l'hôte
  granted_publish_video BOOLEAN DEFAULT true,
  granted_publish_audio BOOLEAN DEFAULT true,
  -- Origine de l'invitation
  invitation_type       TEXT DEFAULT 'individual',
  joined_waiting_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at           TIMESTAMPTZ,
  rejected_at           TIMESTAMPTZ,
  host_note             TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (live_session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_waiting_room_session_status
  ON public.live_waiting_room_entries(live_session_id, status, joined_waiting_at);

-- ─────────────────────────────────────────────────────────────
-- 4. Notifications live (dashboard + email queue)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.live_notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id UUID REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- channel : dashboard | email
  channel      TEXT NOT NULL DEFAULT 'dashboard'
               CHECK (channel IN ('dashboard','email')),
  -- type : invited | live_starting | live_now | waiting_entry | access_granted | access_rejected
  type         TEXT NOT NULL,
  title        TEXT,
  body         TEXT,
  action_url   TEXT,
  payload_json JSONB NOT NULL DEFAULT '{}',
  read_at      TIMESTAMPTZ,
  sent_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_notifications_user
  ON public.live_notifications(user_id, read_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_notifications_session
  ON public.live_notifications(live_session_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 5. RLS sur toutes les nouvelles tables
-- ─────────────────────────────────────────────────────────────

-- live_visibility_rules
ALTER TABLE public.live_visibility_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "visibility_rules_read" ON public.live_visibility_rules;
CREATE POLICY "visibility_rules_read" ON public.live_visibility_rules FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.live_sessions ls WHERE ls.id = live_session_id AND ls.teacher_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.live_invitations li WHERE li.live_session_id = live_visibility_rules.live_session_id AND li.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(COALESCE(p.role,'')) IN ('owner','admin','secretariat'))
  -- Accessible à tous pour les sessions live (pour afficher la salle d'attente)
  OR EXISTS (SELECT 1 FROM public.live_sessions ls WHERE ls.id = live_session_id AND ls.status = 'live')
);

DROP POLICY IF EXISTS "visibility_rules_write" ON public.live_visibility_rules;
CREATE POLICY "visibility_rules_write" ON public.live_visibility_rules FOR ALL USING (
  EXISTS (SELECT 1 FROM public.live_sessions ls WHERE ls.id = live_session_id AND ls.teacher_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(COALESCE(p.role,'')) IN ('owner','admin','secretariat'))
);

-- live_invitations
ALTER TABLE public.live_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "live_invitations_read" ON public.live_invitations;
CREATE POLICY "live_invitations_read" ON public.live_invitations FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.live_sessions ls WHERE ls.id = live_session_id AND ls.teacher_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(COALESCE(p.role,'')) IN ('owner','admin','secretariat'))
);

DROP POLICY IF EXISTS "live_invitations_insert" ON public.live_invitations;
CREATE POLICY "live_invitations_insert" ON public.live_invitations FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.live_sessions ls WHERE ls.id = live_session_id AND ls.teacher_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(COALESCE(p.role,'')) IN ('owner','admin','secretariat'))
);

DROP POLICY IF EXISTS "live_invitations_update" ON public.live_invitations;
CREATE POLICY "live_invitations_update" ON public.live_invitations FOR UPDATE USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.live_sessions ls WHERE ls.id = live_session_id AND ls.teacher_id = auth.uid())
);

-- live_waiting_room_entries
ALTER TABLE public.live_waiting_room_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "waiting_room_read" ON public.live_waiting_room_entries;
CREATE POLICY "waiting_room_read" ON public.live_waiting_room_entries FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.live_sessions ls WHERE ls.id = live_session_id AND ls.teacher_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(COALESCE(p.role,'')) IN ('owner','admin','secretariat'))
);

DROP POLICY IF EXISTS "waiting_room_insert" ON public.live_waiting_room_entries;
CREATE POLICY "waiting_room_insert" ON public.live_waiting_room_entries FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

DROP POLICY IF EXISTS "waiting_room_update" ON public.live_waiting_room_entries;
CREATE POLICY "waiting_room_update" ON public.live_waiting_room_entries FOR UPDATE USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.live_sessions ls WHERE ls.id = live_session_id AND ls.teacher_id = auth.uid())
);

-- live_notifications
ALTER TABLE public.live_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "live_notifications_read" ON public.live_notifications;
CREATE POLICY "live_notifications_read" ON public.live_notifications FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(COALESCE(p.role,'')) IN ('owner','admin','secretariat'))
);

DROP POLICY IF EXISTS "live_notifications_update" ON public.live_notifications;
CREATE POLICY "live_notifications_update" ON public.live_notifications FOR UPDATE USING (
  user_id = auth.uid()
);

DROP POLICY IF EXISTS "live_notifications_insert" ON public.live_notifications;
CREATE POLICY "live_notifications_insert" ON public.live_notifications FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.live_sessions ls WHERE ls.id = live_session_id AND ls.teacher_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND lower(COALESCE(p.role,'')) IN ('owner','admin','secretariat'))
);

-- ─────────────────────────────────────────────────────────────
-- 6. Nouvelles colonnes sur live_sessions
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS access_mode TEXT DEFAULT 'free'
  CHECK (access_mode IN ('free','password','manual','double'));
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS waiting_room_enabled BOOLEAN DEFAULT true;
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS waiting_room_audio_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;
