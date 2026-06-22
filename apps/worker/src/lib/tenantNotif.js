/**
 * tenantNotif.js — résolution des réglages de notification PAR TENANT.
 *
 * Multi-tenant : chaque école envoie depuis SON domaine (email_from), avec son
 * nom affiché (email_from_name), des liens vers SON portail (app_base_url), et
 * éventuellement SA propre clé Resend (resend_api_key — BYO/domaine custom).
 * Fallback sur l'env (compte Resend central de Cimolace) si pas de réglage tenant.
 *
 * `resendKey` NULL  → utiliser RESEND_API_KEY central (domaine vérifié dans le
 *                     compte Cimolace, ex. zahirwellness.com).
 * `resendKey` set   → compte Resend du tenant (autonome, domaine custom).
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

const FALLBACK_FROM = process.env.RESEND_FROM || 'noreply@cimolace.com';
const FALLBACK_BASE_URL = (process.env.APP_PUBLIC_URL || process.env.PUBLIC_SITE_URL || 'https://app.cimolace.space').replace(/\/+$/, '');

/**
 * @param {string|null|undefined} tenantId
 * @returns {Promise<{from:string, fromName:string, baseUrl:string, resendKey:string|null, verified:boolean}>}
 */
export async function getTenantNotif(tenantId) {
  if (!tenantId) {
    return { from: FALLBACK_FROM, fromName: '', baseUrl: FALLBACK_BASE_URL, resendKey: null, verified: false };
  }
  let row = null;
  try {
    const { data } = await supabase
      .from('tenant_notification_settings')
      .select('email_from, email_from_name, app_base_url, resend_api_key, email_verified')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    row = data || null;
  } catch {
    /* indisponible → fallback env */
  }
  return {
    from: row?.email_from || FALLBACK_FROM,
    fromName: row?.email_from_name || '',
    baseUrl: (row?.app_base_url || FALLBACK_BASE_URL).replace(/\/+$/, ''),
    resendKey: row?.resend_api_key || null,
    verified: row?.email_verified === true,
  };
}
