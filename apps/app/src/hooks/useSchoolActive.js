import { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * LIRI a DEUX modes : SIMPLE (visioconférence façon Zoom : Accueil/Lives/Forum/Messages)
 * et ÉCOLE (ajoute la Vie scolaire : agenda/notes/cours…). Le mode école est activé par
 * tenant via le service `school` (tenant_services). Un client qui ne l'active pas n'a que
 * LIRI simple → les sections Vie scolaire du rail sont masquées.
 *
 * Retourne : null tant qu'inconnu (chargement), puis true/false. Cache module-level
 * (le service est tenant-scopé + stable sur la session → une seule requête).
 */
let _schoolCache = null; // null = pas encore chargé ; { active: boolean } sinon

export function useSchoolActive() {
  const [active, setActive] = useState(_schoolCache ? _schoolCache.active : null);

  useEffect(() => {
    if (_schoolCache) { setActive(_schoolCache.active); return; }
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase.from('tenant_services').select('service_key, active');
        const on = Array.isArray(data) && data.some((s) => s.service_key === 'school' && s.active);
        _schoolCache = { active: on };
        if (alive) setActive(on);
      } catch {
        // Fail-closed : en cas d'erreur, on reste en LIRI SIMPLE (pas de fuite école).
        _schoolCache = { active: false };
        if (alive) setActive(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Escape-hatch DEV (guardé, sans effet en prod : les deux clés sont absentes → ignoré).
  // Sert à tester les modes ÉCOLE/SIMPLE en preview quand le fetch tenant_services n'aboutit
  // pas (préflight CORS de l'API locale). `window.__FORCE_SCHOOL_ACTIVE__` = volatile ;
  // `localStorage.__FORCE_SCHOOL_ACTIVE__` = survit au reload complet (pour la revue).
  if (typeof window !== 'undefined') {
    if (window.__FORCE_SCHOOL_ACTIVE__ != null) return window.__FORCE_SCHOOL_ACTIVE__;
    try {
      const ls = window.localStorage?.getItem('__FORCE_SCHOOL_ACTIVE__');
      if (ls === 'true') return true;
      if (ls === 'false') return false;
    } catch { /* localStorage indisponible */ }
  }

  return active;
}

/** Réinitialise le cache (ex. changement de tenant / logout). */
export function resetSchoolActiveCache() { _schoolCache = null; }
