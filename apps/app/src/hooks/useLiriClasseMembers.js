import { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * Récupère les membres actifs du tenant pour l'écran « Ma classe ».
 * Joint `tenant_memberships` avec `profiles` pour obtenir noms et avatars.
 *
 * Colonnes utilisées :
 *   tenant_memberships : tenant_id, user_id, role, status
 *   profiles           : id, name, full_name, avatar_url
 *
 * Retourne :
 *   - members  : [{ id, name, initials, avatarUrl, role }]
 *   - total    : nombre total de membres actifs
 *   - loading, error
 */
export function useLiriClasseMembers({ tenantId, limit = 8 } = {}) {
  const [members, setMembers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!tenantId) {
      setMembers([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);

    (async () => {
      try {
        // Count total active members
        const { count } = await supabase
          .from('tenant_memberships')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('status', 'active');

        // Fetch sample of members with profile info
        const { data, error: err } = await supabase
          .from('tenant_memberships')
          .select('id, user_id, role, profiles:user_id(name, full_name, avatar_url)')
          .eq('tenant_id', tenantId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(limit);

        if (!alive) return;
        if (err) {
          setError(err.message);
          setMembers([]);
          setTotal(0);
        } else {
          const mapped = (data || []).map((m) => {
            const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
            const rawName = profile?.full_name || profile?.name || '';
            const initials = rawName
              ? rawName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
              : '?';
            return {
              id: m.id,
              userId: m.user_id,
              name: rawName || 'Membre',
              initials,
              avatarUrl: profile?.avatar_url || null,
              role: m.role,
            };
          });
          setMembers(mapped);
          setTotal(count || mapped.length);
        }
      } catch (e) {
        if (alive) { setError(e.message); setMembers([]); setTotal(0); }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [tenantId, limit]);

  return { members, total, loading, error };
}

export default useLiriClasseMembers;
