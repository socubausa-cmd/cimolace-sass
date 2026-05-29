/**
 * ISNA V2 — Supabase adapter
 * 
 * Redirige tous les appels supabase.from() vers l'API NestJS V2.
 * Le client Supabase réel est conservé uniquement pour l'auth.
 * 
 * Pour les tables sans endpoint API, le fallback utilise le vrai Supabase.
 */

export { supabase, isSupabaseConfigured } from './supabaseCompat';
