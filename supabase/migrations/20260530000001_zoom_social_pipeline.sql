-- ═════════════════════════════════════════════════════════════════════════════
-- Migration: Zoom Cloud Recordings → Shorts → Social Pipeline
--
-- Tables :
--   1) zoom_oauth_tokens       — Tokens OAuth Zoom (chiffrés)
--   2) zoom_recordings         — Metadata des enregistrements Zoom
--   3) zoom_sync_logs          — Historique des syncs
--   4) published_videos        — Vidéos publiées sur le site public
--   5) short_clips             — Shorts générés (9:16)
--   6) social_posts            — Historique publications TikTok/Facebook
--   7) social_tokens           — Tokens OAuth TikTok/Meta
-- ═════════════════════════════════════════════════════════════════════════════

-- ─── 1) Tokens OAuth Zoom (chiffrés au niveau applicatif) ────────────────
CREATE TABLE IF NOT EXISTS zoom_oauth_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL,
  zoom_user_id  TEXT,                     -- ID Zoom du user
  access_token  TEXT,                     -- Chiffré AES-256-GCM
  refresh_token TEXT,                     -- Chiffré AES-256-GCM
  expires_at    TIMESTAMPTZ,
  scope         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zoom_tokens_tenant ON zoom_oauth_tokens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_zoom_tokens_user ON zoom_oauth_tokens(user_id);

-- ─── 2) Enregistrements Zoom ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS zoom_recordings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  zoom_meeting_id TEXT NOT NULL,          -- Meeting UUID from Zoom
  zoom_meeting_number BIGINT,            -- Meeting number (visible)
  topic           TEXT NOT NULL,          -- Titre de la réunion
  agenda          TEXT,
  start_time      TIMESTAMPTZ,
  end_time        TIMESTAMPTZ,
  duration_min    INT,                   -- Durée en minutes
  recording_count INT DEFAULT 0,
  total_size      BIGINT DEFAULT 0,      -- Taille totale en bytes
  status          TEXT NOT NULL DEFAULT 'pending',
    -- pending | downloaded | analyzed | published | error
  download_url    TEXT,                  -- URL de téléchargement temporaire
  storage_key     TEXT,                  -- Clé dans R2/Supabase Storage
  playback_url    TEXT,                  -- URL signée pour lecture
  thumbnail_url   TEXT,
  transcript_text TEXT,                  -- Texte brut de transcription
  category        TEXT,                  -- Catégorie attribuée
  tags            TEXT[] DEFAULT '{}',
  is_published    BOOLEAN NOT NULL DEFAULT false,
  published_at    TIMESTAMPTZ,
  error_message   TEXT,
  metadata        JSONB DEFAULT '{}',    -- Metadata brute Zoom
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, zoom_meeting_id)
);

CREATE INDEX IF NOT EXISTS idx_zoom_recordings_tenant  ON zoom_recordings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_zoom_recordings_status  ON zoom_recordings(status);
CREATE INDEX IF NOT EXISTS idx_zoom_recordings_pub     ON zoom_recordings(is_published, created_at DESC);

-- ─── 3) Logs de synchronisation ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS zoom_sync_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'running',  -- running | success | error
  recordings_found INT DEFAULT 0,
  recordings_new   INT DEFAULT 0,
  error_message TEXT,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);

-- ─── 4) Vidéos publiées (site public) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS published_videos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id    UUID REFERENCES zoom_recordings(id) ON DELETE SET NULL,
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  playback_url    TEXT NOT NULL,          -- URL signée sécurisée
  thumbnail_url   TEXT,
  duration_sec    INT,
  category        TEXT,
  tags            TEXT[] DEFAULT '{}',
  locale          TEXT DEFAULT 'fr',
  is_featured     BOOLEAN NOT NULL DEFAULT false,
  is_public       BOOLEAN NOT NULL DEFAULT false,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pub_videos_public  ON published_videos(is_public, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_pub_videos_tenant  ON published_videos(tenant_id);

-- ─── 5) Shorts générés (9:16) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS short_clips (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id    UUID NOT NULL REFERENCES zoom_recordings(id) ON DELETE CASCADE,
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  start_sec       INT NOT NULL,           -- Début du clip dans la vidéo source
  end_sec         INT NOT NULL,           -- Fin du clip
  duration_sec    INT NOT NULL,
  storage_key     TEXT,                   -- Clé dans R2
  thumbnail_url   TEXT,
  transcript_snippet TEXT,               -- Texte correspondant
  subtitle_srt    TEXT,                   -- Sous-titres SRT
  status          TEXT NOT NULL DEFAULT 'generating',
    -- generating | ready | published | error
  social_posts    TEXT[] DEFAULT '{}',    -- IDs des publications sociales
  error_message   TEXT,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_short_clips_recording ON short_clips(recording_id);
CREATE INDEX IF NOT EXISTS idx_short_clips_status    ON short_clips(status);

-- ─── 6) Historique publications sociales ─────────────────────────────────
CREATE TABLE IF NOT EXISTS social_posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  short_clip_id   UUID REFERENCES short_clips(id) ON DELETE SET NULL,
  recording_id    UUID REFERENCES zoom_recordings(id) ON DELETE SET NULL,
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  platform        TEXT NOT NULL,           -- tiktok | facebook | instagram | youtube_shorts
  platform_post_id TEXT,                   -- ID de la plateforme
  platform_url     TEXT,                   -- URL du post publié
  title           TEXT,
  description     TEXT,
  hashtags        TEXT[] DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'draft',
    -- draft | ready | publishing | published | failed
  published_at    TIMESTAMPTZ,
  metrics         JSONB DEFAULT '{}',     -- Vues, likes, etc. (pull)
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_posts_clip    ON social_posts(short_clip_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_platform ON social_posts(platform, status);

-- ─── 7) Tokens OAuth Sociaux (TikTok, Meta) ──────────────────────────────
CREATE TABLE IF NOT EXISTS social_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES tenants(id) ON DELETE CASCADE,
  platform        TEXT NOT NULL,           -- tiktok | facebook | instagram
  access_token    TEXT,
  refresh_token   TEXT,
  token_type      TEXT,
  expires_at      TIMESTAMPTZ,
  page_id         TEXT,                    -- Facebook Page ID
  page_name       TEXT,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, platform)
);

-- ─── RLS : Sécurité rows-level ───────────────────────────────────────────
ALTER TABLE zoom_oauth_tokens  ENABLE ROW LEVEL SECURITY;
ALTER TABLE zoom_recordings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE zoom_sync_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE published_videos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE short_clips        ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_tokens      ENABLE ROW LEVEL SECURITY;

-- Les admins (service_role) peuvent tout voir
-- Les utilisateurs ne voient que leurs propres données tenant
CREATE POLICY tenant_isolation ON zoom_oauth_tokens
  USING (tenant_id = current_setting('app.tenant_id')::UUID);
CREATE POLICY tenant_isolation ON zoom_recordings
  USING (tenant_id = current_setting('app.tenant_id')::UUID);
CREATE POLICY tenant_isolation ON zoom_sync_logs
  USING (tenant_id = current_setting('app.tenant_id')::UUID);
CREATE POLICY tenant_isolation ON published_videos
  USING (tenant_id = current_setting('app.tenant_id')::UUID);
CREATE POLICY tenant_isolation ON short_clips
  USING (tenant_id = current_setting('app.tenant_id')::UUID);
CREATE POLICY tenant_isolation ON social_posts
  USING (tenant_id = current_setting('app.tenant_id')::UUID);
CREATE POLICY tenant_isolation ON social_tokens
  USING (tenant_id = current_setting('app.tenant_id')::UUID);

-- Les vidéos publiques sont visibles sans auth
CREATE POLICY public_read ON published_videos
  FOR SELECT USING (is_public = true);
