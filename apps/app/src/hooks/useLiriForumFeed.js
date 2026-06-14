import { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { activeTenantConfig as isnaTenantConfig } from '@/lib/tenant/activeTenantConfig';

const ISNA_TENANT_ID = isnaTenantConfig?.id ?? null;

/**
 * Récupère les derniers sujets du forum depuis Supabase (`forum_topics`)
 * pour alimenter la section « À la une » de l'écran Communauté LIRI.
 *
 * Colonnes réelles : id, title, category, created_at, replies_count, is_locked, is_pinned
 * Retourne [] si la table est vide ou inaccessible (RLS sans auth).
 */
export function useLiriForumFeed({ limit = 5, userId } = {}) {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        let q = supabase
          .from('forum_topics')
          .select('id, title, category, created_at, replies_count, is_locked, is_pinned')
          .eq('is_locked', false);
        if (ISNA_TENANT_ID) q = q.eq('tenant_id', ISNA_TENANT_ID);
        const { data, error: err } = await q
          .order('last_post_at', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(limit);
        if (!alive) return;
        if (err) { setError(err.message); setTopics([]); }
        else setTopics(data || []);
      } catch (e) {
        if (alive) { setError(e.message); setTopics([]); }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [limit, userId]);

  return { topics, loading, error };
}

export default useLiriForumFeed;
