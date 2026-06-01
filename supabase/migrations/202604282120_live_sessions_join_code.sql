-- Code court pour rejoindre un live depuis LIRI mobile (saisie dans « Rejoindre avec un code »).
-- Stockage : 8 caractères [A-Z2-9] sans ambiguïté I/O/0/1.

ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS join_code text;

CREATE UNIQUE INDEX IF NOT EXISTS live_sessions_join_code_uidx
  ON public.live_sessions (join_code)
  WHERE join_code IS NOT NULL AND length(trim(join_code)) > 0;

COMMENT ON COLUMN public.live_sessions.join_code IS 'Code 8 caractères (sans tiret en base) pour rejoindre le live depuis LIRI mobile.';

CREATE OR REPLACE FUNCTION public.live_session_id_from_join_code(p_code text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ls.id
  FROM public.live_sessions AS ls
  WHERE ls.join_code IS NOT NULL
    AND upper(regexp_replace(trim(ls.join_code), '[^A-Za-z0-9]', '', 'g'))
      = upper(regexp_replace(trim(COALESCE(p_code, '')), '[^A-Za-z0-9]', '', 'g'))
    AND length(regexp_replace(trim(COALESCE(p_code, '')), '[^A-Za-z0-9]', '', 'g')) BETWEEN 6 AND 16
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.live_session_id_from_join_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.live_session_id_from_join_code(text) TO anon;
GRANT EXECUTE ON FUNCTION public.live_session_id_from_join_code(text) TO authenticated;
