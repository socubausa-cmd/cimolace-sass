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
 * ⚠️ PIÈGE réparé : la requête `tenant_services` est protégée par RLS (membre du tenant). Si
 * elle tourne AVANT que la session soit restaurée (race au chargement / SPA multi-onglets), la
 * RLS renvoie VIDE → on concluait `school=false` ET on le cachait DÉFINITIVEMENT → le menu école
 * restait masqué toute la session même après login. Désormais : on n'accepte un résultat que
 * pour un utilisateur CONNECTÉ (sinon indéterminé = on réessaie sur onAuthStateChange), et on ne
 * cache jamais un négatif issu d'une lecture non authentifiée / en erreur.
 */
let _schoolCache = null; // null = inconnu ; { active: boolean } = DÉFINITIF (positif ou négatif)

async function resolveSchoolActive() {
  // Exige une session : sans auth.uid(), la RLS renvoie vide → un « false » trompeur.
  const { data: sess } = await supabase.auth.getSession();
  if (!sess?.session?.user) return null; // pas encore connecté → indéterminé
  const { data, error } = await supabase.from('tenant_services').select('service_key, active');
  if (error) return null; // erreur transitoire → indéterminé (on réessaiera)
  // Réponse authoritative d'un utilisateur connecté (liste, même vide, = définitive).
  return Array.isArray(data) && data.some((s) => s.service_key === 'school' && s.active);
}

export function useSchoolActive() {
  const [active, setActive] = useState(_schoolCache ? _schoolCache.active : null);

  useEffect(() => {
    let alive = true;
    if (_schoolCache) { setActive(_schoolCache.active); return undefined; }

    const run = async () => {
      if (_schoolCache) { if (alive) setActive(_schoolCache.active); return; }
      const res = await resolveSchoolActive();
      if (res == null) return; // indéterminé → ne rien cacher, attendre un changement d'auth
      _schoolCache = { active: res };
      if (alive) setActive(res);
    };

    run();
    // Réévalue quand la session arrive/change (restauration async au chargement, login…).
    const { data: authSub } = supabase.auth.onAuthStateChange(() => {
      if (!_schoolCache) run();
    });
    return () => {
      alive = false;
      try { authSub?.subscription?.unsubscribe?.(); } catch { /* */ }
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
