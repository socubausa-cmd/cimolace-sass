-- Temps réel sur les participants immersifs (présence / join / leave)
ALTER TABLE public.immersive_live_participants REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.immersive_live_participants;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
