import { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';

/**
 * Récupère les annonces de classe depuis :
 *   1. `forum_topics` avec category = 'annonce' (pinned first)
 *   2. `notifications` avec type = 'announcement' ciblant l'utilisateur
 *
 * Retourne :
 *   - annonces : [{ id, who, time, tag, tagTone, text, source }]
 *   - loading, error
 */
export function useLiriClasseAnnonces({ tenantId, userId, limit = 5 } = {}) {
  const [annonces, setAnnonces] = useState([]);
  const [loading, setLoading] = useState(Boolean(tenantId));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!tenantId) {
      setAnnonces([]);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);

    (async () => {
      try {
        // Fetch forum announcements (category = 'annonce')
        const { data: topicData } = await supabase
          .from('forum_topics')
          .select('id, title, content, is_pinned, created_at, author_id, profiles:author_id(name, full_name)')
          .eq('tenant_id', tenantId)
          .eq('category', 'annonce')
          .eq('is_locked', false)
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(limit);

        // Fetch broadcast notifications for this user / tenant
        // Important: .or() must be called BEFORE .order()/.limit() to be included in the query
        let notifQuery = supabase
          .from('notifications')
          .select('id, title, body, created_at, priority')
          .eq('tenant_id', tenantId)
          .eq('type', 'announcement');

        if (userId) {
          notifQuery = notifQuery.or(`user_id.eq.${userId},user_id.is.null`);
        } else {
          notifQuery = notifQuery.is('user_id', null);
        }

        const { data: notifData } = await notifQuery
          .order('created_at', { ascending: false })
          .limit(limit);

        if (!alive) return;

        const now = Date.now();
        const fmtTime = (iso) => {
          const diff = now - new Date(iso).getTime();
          const h = Math.floor(diff / 3_600_000);
          if (h < 1) return "À l'instant";
          if (h < 24) return `Il y a ${h}h`;
          const d = Math.floor(h / 24);
          if (d === 1) return 'Hier';
          return `Il y a ${d}j`;
        };

        const fromTopics = (topicData || []).map((t) => {
          const profile = Array.isArray(t.profiles) ? t.profiles[0] : t.profiles;
          const who = profile?.full_name || profile?.name || 'Annonce';
          return {
            id: t.id,
            source: 'forum',
            who,
            time: fmtTime(t.created_at),
            tag: t.is_pinned ? 'ÉPINGLÉ' : 'ANNONCE',
            tagTone: t.is_pinned ? 'violet' : 'sky',
            text: t.content ? String(t.content).slice(0, 160) : t.title,
          };
        });

        const fromNotifs = (notifData || []).map((n) => ({
          id: n.id,
          source: 'notification',
          who: 'École',
          time: fmtTime(n.created_at),
          tag: n.priority === 'high' ? 'IMPORTANT' : 'INFO',
          tagTone: n.priority === 'high' ? 'violet' : 'sky',
          text: n.body || n.title || '',
        }));

        // Merge, deduplicate, sort by relevance
        const all = [...fromTopics, ...fromNotifs].slice(0, limit);
        setAnnonces(all);
      } catch (e) {
        if (alive) { setError(e.message); setAnnonces([]); }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [tenantId, userId, limit]);

  return { annonces, loading, error };
}

export default useLiriClasseAnnonces;
