import { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * LIRI a DEUX modes : SIMPLE (visioconférence façon Zoom : Accueil/Lives/Forum/Messages)
 * et ÉCOLE (ajoute la Vie scolaire : agenda/notes/cours…). Le mode école est activé par
 * tenant via le service `school` (tenant_services). Un client qui ne l'active pas n'a que
 * LIRI simple → les sections Vie scolaire du rail sont masquées.
 *
 * Retourne : null tant qu'inconnu (chargement), puis true/false. Cache module-level d'un
 * résultat DÉFINITIF uniquement.
 *
 * ⚠️ PIÈGE réparé (2×). `tenant_services` est protégé par RLS (membre actif du tenant). Si la
 * requête tourne AVANT que la session soit prête (race au chargement), la RLS renvoie VIDE.
 *   • Bug v1 : on concluait `false` ET on le cachait DÉFINITIVEMENT → menu école gelé masqué.
 *   • Bug v2 (ma 1re correction) : gater sur `supabase.auth.getSession()` — mais `supabase` est
 *     un SHIM compat (lib/supabase) dont l'auth ne passe pas par getSession → renvoyait toujours
 *     null → menu jamais révélé.
 * Correction robuste : on ne dépend PLUS de getSession. On RÉESSAIE simplement la requête (que
 * l'ancien code faisait déjà) jusqu'à obtenir une réponse NON VIDE — un membre authentifié a
 * toujours ≥1 service, donc `[]` = pas-encore-authentifié → on retente sans rien cacher. On ne
 * cache QUE des réponses non vides (autoritatives : école présente=true, ou services sans école=false).
 */
let _schoolCache = null; // null = inconnu ; { active: boolean } = DÉFINITIF

async function fetchServices() {
  try {
    const { data, error } = await supabase.from('tenant_services').select('service_key, active');
    if (error) return null;
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

export function useSchoolActive() {
  const [active, setActive] = useState(_schoolCache ? _schoolCache.active : null);

  useEffect(() => {
    let alive = true;
    if (_schoolCache) { setActive(_schoolCache.active); return undefined; }

    let tries = 0;
    let timer = null;
    const attempt = async () => {
      if (!alive) return;
      if (_schoolCache) { setActive(_schoolCache.active); return; }
      const rows = await fetchServices();
      // Réponse NON VIDE = autoritative (l'utilisateur est authentifié et membre d'≥1 tenant).
      if (rows && rows.length > 0) {
        const on = rows.some((s) => s.service_key === 'school' && s.active);
        _schoolCache = { active: on };
        if (alive) setActive(on);
        return;
      }
      // Vide/erreur = probablement pré-auth (RLS renvoie 0 sans auth.uid()). NE PAS cacher → réessayer.
      tries += 1;
      if (alive && tries < 10) timer = window.setTimeout(attempt, 700); // ~7 s max, puis on renonce
    };
    attempt();

    return () => {
      alive = false;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  // Escape-hatch DEV (guardé, sans effet en prod : les deux clés sont absentes → ignoré).
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
