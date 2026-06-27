import { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

// NB : plus de tenant_id codé en dur ici. La RLS de `forum_topics`
// (forum_topics_member_select) scope DÉJÀ la lecture au(x) tenant(s) du lecteur
// via tenant_memberships → multi-tenant safe. L'ancien filtre ISNA_TENANT_ID
// cassait le feed pour tout tenant ≠ isna.

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
