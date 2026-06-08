-- ============================================================
-- Live Arena — Complétion du schéma
-- • live_session_chat  : RLS + realtime
-- • live_recordings    : table + RLS + storage bucket
-- • live_sessions      : colonne post_notes
-- • live_session_participants : RLS
-- ============================================================

-- ──────────────────────────────────────────────
-- 1. live_session_chat — création si absente
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS live_session_chat (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id  UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message          TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 4000),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_session_chat_session
  ON live_session_chat(live_session_id, created_at);

ALTER TABLE live_session_chat ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'live_session_chat' AND policyname = 'chat_select_participants'
  ) THEN
    CREATE POLICY "chat_select_participants" ON live_session_chat
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM live_session_participants p
          WHERE p.live_session_id = live_session_chat.live_session_id
            AND p.user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM live_sessions s
          WHERE s.id = live_session_chat.live_session_id
            AND s.teacher_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role IN ('owner','admin','secretariat')
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'live_session_chat' AND policyname = 'chat_insert_authenticated'
  ) THEN
    CREATE POLICY "chat_insert_authenticated" ON live_session_chat
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Realtime (ignore si déjà présente)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE live_session_chat;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ──────────────────────────────────────────────
-- 2. live_recordings — création si absente
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS live_recordings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id  UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  file_path        TEXT NOT NULL,
  file_size        BIGINT,
  duration_seconds INTEGER,
  mime_type        TEXT DEFAULT 'video/webm',
  storage_provider TEXT DEFAULT 'supabase',
  recorded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_recordings_session
  ON live_recordings(live_session_id, recorded_at DESC);

ALTER TABLE live_recordings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'live_recordings' AND policyname = 'recordings_select_host_staff'
  ) THEN
    CREATE POLICY "recordings_select_host_staff" ON live_recordings
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM live_sessions s
          WHERE s.id = live_session_id AND s.teacher_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role IN ('owner','admin','secretariat')
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'live_recordings' AND policyname = 'recordings_insert_host'
  ) THEN
    CREATE POLICY "recordings_insert_host" ON live_recordings
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM live_sessions s
          WHERE s.id = live_session_id AND s.teacher_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role IN ('owner','admin','secretariat')
        )
      );
  END IF;
END $$;

-- ──────────────────────────────────────────────
-- 3. live_sessions — colonne post_notes
-- ──────────────────────────────────────────────
ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS post_notes TEXT;

-- ──────────────────────────────────────────────
-- 4. live_session_participants — RLS
-- ──────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE live_session_participants ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'live_session_participants' AND policyname = 'participants_select_own'
  ) THEN
    CREATE POLICY "participants_select_own" ON live_session_participants
      FOR SELECT USING (
        user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM live_sessions s
          WHERE s.id = live_session_id AND s.teacher_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid() AND role IN ('owner','admin','secretariat')
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'live_session_participants' AND policyname = 'participants_insert_own'
  ) THEN
    CREATE POLICY "participants_insert_own" ON live_session_participants
      FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'live_session_participants' AND policyname = 'participants_update_own'
  ) THEN
    CREATE POLICY "participants_update_own" ON live_session_participants
      FOR UPDATE USING (user_id = auth.uid());
  END IF;
END $$;

-- ──────────────────────────────────────────────
-- 5. Storage bucket live-recordings
-- ──────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'live-recordings',
  'live-recordings',
  false,
  524288000,
  ARRAY['video/webm','video/mp4','video/quicktime']
)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
      AND schemaname = 'storage'
      AND policyname = 'recordings_upload_authenticated'
  ) THEN
    CREATE POLICY "recordings_upload_authenticated" ON storage.objects
      FOR INSERT WITH CHECK (
        bucket_id = 'live-recordings'
        AND auth.role() = 'authenticated'
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
      AND schemaname = 'storage'
      AND policyname = 'recordings_read_authenticated'
  ) THEN
    CREATE POLICY "recordings_read_authenticated" ON storage.objects
      FOR SELECT USING (
        bucket_id = 'live-recordings'
        AND auth.role() = 'authenticated'
      );
  END IF;
END $$;
