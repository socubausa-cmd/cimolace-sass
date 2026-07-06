// vnpStats — journal FIRE-AND-FORGET de la conversation VNP « vibe-surfing » (spec §6).
// GARANTIE : logEvent() ne bloque JAMAIS (aucun await sur le chemin critique) et ne throw JAMAIS
// (toute erreur — réseau, edge, sessionStorage privé — est avalée). La conversation ne dépend jamais
// du succès du log. On ne journalise que des MÉTADONNÉES (longueurs, ids), pas le contenu brut (pré-signup).
import { supabase } from '@/lib/supabase';

let _session = null;
function session() {
  if (_session) return _session;
  try {
    let s = window.sessionStorage.getItem('vnp_session');
    if (!s) {
      s = (window.crypto && window.crypto.randomUUID)
        ? window.crypto.randomUUID()
        : `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      window.sessionStorage.setItem('vnp_session', s);
    }
    _session = s;
  } catch {
    _session = `eph-${Math.random().toString(36).slice(2)}`; // sessionStorage indisponible (mode privé)
  }
  return _session;
}

/**
 * Journalise un événement (fire-and-forget).
 * @param {string} type  un des types canoniques (voir migration analytics_events)
 * @param {object} payload  métadonnées (jamais de PII)
 * @param {string|null} tenantSlug
 */
export function logEvent(type, payload = {}, tenantSlug = null) {
  try {
    supabase.functions
      .invoke('vnp-log', { body: { type, payload, tenantSlug: tenantSlug || null, userSession: session(), source: 'vnp' } })
      .catch(() => {});
  } catch {
    /* jamais bloquant */
  }
}

/** Question restée sans réponse (onTopic=false ou repli) → « trou » de Cartographie à combler. */
export function logUnanswered(question, tenantSlug = null) {
  logEvent('unanswered_question', { len: String(question || '').length }, tenantSlug);
}
