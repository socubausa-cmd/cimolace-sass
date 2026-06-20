-- ════════════════════════════════════════════════════════════════════════════
-- 20260620140000_visual_cache_public.sql
-- Rend le bucket Storage `visual-cache` PUBLIC.
--
-- POURQUOI : ce bucket contient les illustrations IA (générées par
-- Mistral / Imagen / DALL·E via generate-visual-image) destinées à être
-- AFFICHÉES dans les slides SmartBoard et les nœuds du mindmap. La fonction
-- stocke l'image puis renvoie l'URL « publique » (getPublicUrl), mais le bucket
-- était privé → l'URL renvoyait HTTP 400 et l'illustration s'affichait cassée.
-- Les chemins sont des hash de contenu (mistral-<sha256>.png), non énumérables ;
-- l'écriture reste réservée au service_role (les policies INSERT ne changent pas).
-- Aligne `visual-cache` sur `smartboard-canvas`, déjà public pour le même usage.
--
-- À appliquer : psql "$DATABASE_URL" -f supabase/migrations/20260620140000_visual_cache_public.sql
-- Idempotent.
-- ════════════════════════════════════════════════════════════════════════════

update storage.buckets set public = true where id = 'visual-cache';

-- Vérification (optionnel) :
-- select id, public from storage.buckets where id = 'visual-cache';
