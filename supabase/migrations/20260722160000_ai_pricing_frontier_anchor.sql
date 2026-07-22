-- ANCRAGE FRONTIÈRE des prix IA (modèle « Cursor ») : on EXÉCUTE sur des modèles
-- cheap (DeepSeek/Groq/Gemini-flash/Flux) mais on FACTURE le client au niveau de
-- valeur d'une requête frontière (Claude/GPT). Les modèles cheap réellement
-- exécutés facturaient au tarif cheap (deepseek 0,00028/token → chat ≈ 0,004 €,
-- 10× sous une requête frontière) → marge cachée non captée. On remonte leur
-- credits_per_unit au palier « op standard ». Le coût réel interne ne change pas.
-- Appliqué hors-bande via psql (JAMAIS db push).

-- 1) TEXTE cheap → palier « op standard » (~1 requête frontière : chat 1,5k in / 0,6k out ≈ 3,9 crédits ≈ 0,05 €).
update public.ai_pricing set credits_per_unit = 0.001
  where unit_type = 'tokens_in' and model in (
    'deepseek-chat','deepseek-coder','gemini-2.5-flash',
    'llama-3.1-8b-instant','llama-3.3-70b-versatile','meta-llama/llama-4-scout-17b-16e-instruct',
    'mistral-medium-latest','grok-3-mini','mixtral-8x7b-32768','gemma2-9b-it'
  );
update public.ai_pricing set credits_per_unit = 0.004
  where unit_type = 'tokens_out' and model in (
    'deepseek-chat','deepseek-coder','gemini-2.5-flash',
    'llama-3.1-8b-instant','llama-3.3-70b-versatile','meta-llama/llama-4-scout-17b-16e-instruct',
    'mistral-medium-latest','grok-3-mini','mixtral-8x7b-32768','gemma2-9b-it'
  );

-- 2) IMAGE cheap (Flux/Gemini-image/Grok-imagine) → ancre « génération d'image réelle »
--    (une image se perçoit comme ~8 chats ; exécutée sur Flux Schnell ~0,003 $).
update public.ai_pricing set credits_per_unit = 8.0
  where unit_type = 'images' and model in (
    'gemini-2.5-flash-image','grok-imagine-image','flux-schnell','flux-1-schnell',
    'flux-dev','flux-pro','stable-diffusion-3','imagen-4-fast','imagen-3'
  );
update public.ai_pricing set credits_per_unit = 15.0
  where unit_type = 'images' and model in ('grok-imagine-image-quality','flux-1.1-pro','imagen-4');

-- 3) TRANSCRIPTION cheap (Groq whisper) → ancre Whisper-1 OpenAI (0,006 $/s côté client).
update public.ai_pricing set credits_per_unit = 0.08
  where unit_type = 'seconds' and model in ('whisper-large-v3','whisper-large-v3-turbo','nova-2','deepgram-nova-2');

-- 4) Neutraliser MES packs IA doublons à 5 € (le système ai_topup_packages, ≥15 €, est la source de vérité).
update public.billing_plans set is_active = false where key in ('pack-ai-100','pack-ai-500');

-- 5) CONTRÔLE : coût effectif d'un chat standard (1500 in + 600 out) sur deepseek APRÈS ancrage.
do $$
declare v_in numeric; v_out numeric; v_chat numeric;
begin
  select credits_per_unit into v_in  from ai_pricing where model='deepseek-chat' and unit_type='tokens_in';
  select credits_per_unit into v_out from ai_pricing where model='deepseek-chat' and unit_type='tokens_out';
  v_chat := 1500*v_in + 600*v_out;
  raise notice 'Chat deepseek APRÈS ancrage = % crédits (~% EUR au prix pack 0,015 EUR/cr)', v_chat, round(v_chat*0.015, 3);
end $$;
