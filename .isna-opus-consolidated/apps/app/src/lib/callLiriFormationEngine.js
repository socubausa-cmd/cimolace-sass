/**
 * Appel Supabase Edge `liri-formation-engine` (pipeline LIRI spec v2).
 * Même corps et réponse que `liri-agent-course-generate` ; `meta.pipeline` est renseigné côté serveur.
 */

import { invokeSupabaseFunction } from './supabaseEdgeInvoke.js';

/** Libellés UI pour le sélecteur « type de programme » (non envoyé au serveur pour l’instant). */
export const PROGRAMME_OPTIONS = [
  { value: 'one_month_program', label: 'Programme sur 1 mois' },
  { value: 'two_month_program', label: 'Programme sur 2 mois' },
  { value: 'three_month_program', label: 'Programme sur 3 mois' },
  { value: 'semester_program', label: 'Semestre' },
  { value: 'compact_program', label: 'Parcours compact' },
];

function normalizeSupabaseAnonKey(raw) {
  if (raw == null || raw === '') return '';
  let s = String(raw).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s.replace(/\s/g, '');
}

function isLikelyJwt(s) {
  return typeof s === 'string' && s.split('.').length === 3 && s.length > 40;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{
 *   body: Record<string, unknown>;
 *   headers?: Record<string, string>;
 *   timeout?: number;
 * }} options
 * @returns {Promise<{ cours?: unknown; meta?: unknown; error?: unknown }>}
 */
export async function callLiriFormationEngine(supabase, options = {}) {
  const { body, headers, timeout = 180_000 } = options;
  return invokeSupabaseFunction(supabase, 'liri-formation-engine', {
    body: body ?? {},
    headers,
    timeout,
  });
}

/**
 * Appel avec session utilisateur (headers Authorization / x-user-jwt), comme LIRIAgent.
 */
export async function callLiriFormationEngineAuthenticated(supabase, body, options = {}) {
  const { timeout = 180_000 } = options;
  const anonKey = normalizeSupabaseAnonKey(import.meta.env.VITE_SUPABASE_ANON_KEY);
  if (!import.meta.env.VITE_SUPABASE_URL || !anonKey) {
    throw new Error('Configuration Supabase manquante (URL ou clé anonyme).');
  }

  const { data: { session: initialSession } } = await supabase.auth.getSession();
  if (!initialSession?.access_token) {
    throw new Error('Connectez-vous pour générer une formation.');
  }
  const { data: refreshData } = await supabase.auth.refreshSession();
  const sessionAfterRefresh = refreshData?.session ?? initialSession;
  const accessToken = sessionAfterRefresh?.access_token;
  if (!accessToken) {
    throw new Error('Session expirée — reconnectez-vous.');
  }
  const { error: userErr } = await supabase.auth.getUser(accessToken);
  if (userErr) {
    throw new Error('Session invalide ou expirée — déconnectez-vous et reconnectez-vous.');
  }

  const headers =
    isLikelyJwt(anonKey) && isLikelyJwt(accessToken)
      ? { Authorization: `Bearer ${anonKey}`, 'x-user-jwt': accessToken }
      : { Authorization: `Bearer ${accessToken}` };

  return callLiriFormationEngine(supabase, { body, headers, timeout });
}
